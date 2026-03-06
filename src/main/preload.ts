// ─── Electron Preload Bridge ────────────────────────────────────────
// Exposes only typed IPC channels to the renderer.
// Security: contextBridge + contextIsolation.

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, RunEvent, ExecutionState } from '../shared/types';

export interface JarvisAPI {
  submitGoal: (goal: string) => Promise<unknown>;
  approveAction: (actionId: string, scope: 'approve_once' | 'approve_session') => Promise<void>;
  denyAction: (actionId: string) => Promise<void>;
  abortRun: () => Promise<void>;
  onEvent: (callback: (event: RunEvent) => void) => () => void;
  onStateChange: (callback: (state: ExecutionState) => void) => () => void;
}

const api: JarvisAPI = {
  submitGoal: (goal: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SUBMIT_GOAL, goal),

  approveAction: (actionId: string, scope: 'approve_once' | 'approve_session') =>
    ipcRenderer.invoke(IPC_CHANNELS.APPROVE_ACTION, actionId, scope),

  denyAction: (actionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DENY_ACTION, actionId),

  abortRun: () =>
    ipcRenderer.invoke(IPC_CHANNELS.ABORT_RUN),

  onEvent: (callback: (event: RunEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: RunEvent) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.ON_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ON_EVENT, handler);
  },

  onStateChange: (callback: (state: ExecutionState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: ExecutionState) => callback(state);
    ipcRenderer.on(IPC_CHANNELS.ON_STATE_CHANGE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ON_STATE_CHANGE, handler);
  },
};

contextBridge.exposeInMainWorld('jarvis', api);
