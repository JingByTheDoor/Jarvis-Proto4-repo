// ─── Electron Main Process ──────────────────────────────────────────
// JARVIS desktop operator console entry point.
// Security: contextIsolation=true, nodeIntegration=false.

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { config } from 'dotenv';
import { IPC_CHANNELS, Action, RunEvent, ExecutionState } from '../shared/types';
import { PlanEngine } from './engine/plan-engine';
import { ApprovalEngine } from './engine/approval-engine';
import { RunEventEmitter } from './engine/event-emitter';
import { executeToolAction } from './tools/tool-router';

// Load .env from project root
config({ path: path.resolve(__dirname, '..', '..', '.env') });

let mainWindow: BrowserWindow | null = null;
const approvalEngine = new ApprovalEngine();
const emitter = new RunEventEmitter();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'JARVIS — Operator Console',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Load the renderer
  const rendererPath = path.join(__dirname, '..', 'renderer', 'index.html');
  mainWindow.loadFile(rendererPath);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Forward run events to renderer
emitter.on((event: RunEvent) => {
  mainWindow?.webContents.send(IPC_CHANNELS.ON_EVENT, event);
});

// ─── IPC Handlers ───────────────────────────────────────────────────

// Pending approval resolvers (keyed by action_id)
const pendingApprovals = new Map<string, (decision: 'approve_once' | 'approve_session' | 'deny') => void>();

ipcMain.handle(IPC_CHANNELS.SUBMIT_GOAL, async (_event, goal: string) => {
  const engine = new PlanEngine({
    approvalEngine,
    emitter,
    requestApproval: async (action: Action) => {
      return new Promise<'approve_once' | 'approve_session' | 'deny'>((resolve) => {
        pendingApprovals.set(action.id, resolve);
        // The emitter already fires approval_needed — the renderer will show the gate
      });
    },
    executeTool: executeToolAction,
  });

  // Build a minimal demo plan (in production, an LLM adapter would propose actions)
  const plan = engine.buildPlan(goal, []);

  mainWindow?.webContents.send(IPC_CHANNELS.ON_STATE_CHANGE, engine.state);
  const log = await engine.executePlan(plan);
  mainWindow?.webContents.send(IPC_CHANNELS.ON_STATE_CHANGE, engine.state);
  return log;
});

ipcMain.handle(IPC_CHANNELS.APPROVE_ACTION, async (_event, actionId: string, scope: 'approve_once' | 'approve_session') => {
  const resolver = pendingApprovals.get(actionId);
  if (resolver) {
    resolver(scope);
    pendingApprovals.delete(actionId);
  }
});

ipcMain.handle(IPC_CHANNELS.DENY_ACTION, async (_event, actionId: string) => {
  const resolver = pendingApprovals.get(actionId);
  if (resolver) {
    resolver('deny');
    pendingApprovals.delete(actionId);
  }
});

// ─── App Lifecycle ──────────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
