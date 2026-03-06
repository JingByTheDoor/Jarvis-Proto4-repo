// ─── Electron Main Process ──────────────────────────────────────────
// JARVIS desktop operator console entry point.
// Security: contextIsolation=true, nodeIntegration=false.

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { config } from 'dotenv';
import { IPC_CHANNELS, Action, RunEvent } from '../shared/types';
import { PlanEngine } from './engine/plan-engine';
import { ApprovalEngine } from './engine/approval-engine';
import { RunEventEmitter } from './engine/event-emitter';
import { executeToolAction } from './tools/tool-router';
import { createLLMProvider } from './adapters/adapter-factory';
import { saveMessage, getContext } from './memory/memory-store';

// Load .env from project root
config({ path: path.resolve(__dirname, '..', '..', '.env') });

let mainWindow: BrowserWindow | null = null;
const approvalEngine = new ApprovalEngine();
const emitter = new RunEventEmitter();
const llmProvider = createLLMProvider();

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

  // Emit provider status once the renderer is ready to receive events
  mainWindow.webContents.once('did-finish-load', () => {
    const providerEvent: RunEvent = {
      run_id: 'startup',
      kind: 'agent_message',
      timestamp: new Date().toISOString(),
      payload: llmProvider.isConfigured
        ? `LLM provider active: ${llmProvider.providerName}`
        : `No LLM provider configured. Copy .env.example to .env and set LLM_PROVIDER=openai (with your OPENAI_API_KEY) or LLM_PROVIDER=anthropic (with your ANTHROPIC_API_KEY).`,
    };
    mainWindow?.webContents.send(IPC_CHANNELS.ON_EVENT, providerEvent);
  });

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

  // Save user goal to memory
  saveMessage('user', goal);

  // Get conversation context
  const context = getContext();

  // Use LLM adapter to propose actions
  const plan = await llmProvider.generatePlan(goal, context);

  if (!plan.actions.length) {
    // Surface the reason (error or "no actions needed") to the user
    const summaryEvent: RunEvent = {
      run_id: 'goal',
      kind: llmProvider.isConfigured ? 'agent_message' : 'run_error',
      timestamp: new Date().toISOString(),
      payload: plan.summary,
    };
    mainWindow?.webContents.send(IPC_CHANNELS.ON_EVENT, summaryEvent);

    // For a configured provider, try a conversational reply
    if (llmProvider.isConfigured) {
      const reply = await llmProvider.chat(goal, context);
      if (reply) {
        const chatEvent: RunEvent = {
          run_id: 'goal',
          kind: 'agent_message',
          timestamp: new Date().toISOString(),
          payload: reply,
        };
        mainWindow?.webContents.send(IPC_CHANNELS.ON_EVENT, chatEvent);
      }
    }

    saveMessage('assistant', plan.summary);
    return {
      run_id: 'goal',
      plan_id: plan.id,
      events: [],
      final_result: { state: 'completed' },
      artifacts: [],
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    };
  }

  mainWindow?.webContents.send(IPC_CHANNELS.ON_STATE_CHANGE, engine.state);
  const log = await engine.executePlan(plan);
  mainWindow?.webContents.send(IPC_CHANNELS.ON_STATE_CHANGE, engine.state);

  // Save assistant summary to memory
  saveMessage('assistant', `Plan executed: ${plan.summary}. State: ${engine.state}`);

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
