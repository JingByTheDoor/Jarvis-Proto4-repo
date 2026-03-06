// ─── Type declarations for the preload bridge ──────────────────────

import { RunEvent, ExecutionState } from '../shared/types';

export interface JarvisAPI {
  submitGoal: (goal: string) => Promise<unknown>;
  approveAction: (actionId: string, scope: 'approve_once' | 'approve_session') => Promise<void>;
  denyAction: (actionId: string) => Promise<void>;
  abortRun: () => Promise<void>;
  onEvent: (callback: (event: RunEvent) => void) => () => void;
  onStateChange: (callback: (state: ExecutionState) => void) => () => void;
}

declare global {
  interface Window {
    jarvis?: JarvisAPI;
  }
}
