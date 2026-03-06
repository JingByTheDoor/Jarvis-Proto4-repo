// ─── Event Emitter ──────────────────────────────────────────────────
// Typed event bus for run events.

import { RunEvent, EventKind } from '../../shared/types';

export type EventListener = (event: RunEvent) => void;

export class RunEventEmitter {
  private listeners: EventListener[] = [];

  /** Subscribe to all run events. */
  on(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Emit a run event to all listeners. */
  emit(runId: string, kind: EventKind, payload: unknown): RunEvent {
    const event: RunEvent = {
      run_id: runId,
      kind,
      timestamp: new Date().toISOString(),
      payload,
    };
    for (const listener of this.listeners) {
      listener(event);
    }
    return event;
  }

  /** Remove all listeners. */
  clear(): void {
    this.listeners = [];
  }
}
