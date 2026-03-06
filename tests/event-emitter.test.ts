import { RunEventEmitter } from '../src/main/engine/event-emitter';
import { RunEvent } from '../src/shared/types';

describe('RunEventEmitter', () => {
  let emitter: RunEventEmitter;

  beforeEach(() => {
    emitter = new RunEventEmitter();
  });

  it('emits events to subscribed listeners', () => {
    const received: RunEvent[] = [];
    emitter.on((event) => received.push(event));
    emitter.emit('run-1', 'plan_ready', { summary: 'test' });
    expect(received).toHaveLength(1);
    expect(received[0].run_id).toBe('run-1');
    expect(received[0].kind).toBe('plan_ready');
    expect(received[0].payload).toEqual({ summary: 'test' });
  });

  it('supports multiple listeners', () => {
    let count = 0;
    emitter.on(() => count++);
    emitter.on(() => count++);
    emitter.emit('run-1', 'plan_ready', {});
    expect(count).toBe(2);
  });

  it('returns unsubscribe function', () => {
    let count = 0;
    const unsub = emitter.on(() => count++);
    emitter.emit('run-1', 'plan_ready', {});
    expect(count).toBe(1);
    unsub();
    emitter.emit('run-1', 'plan_ready', {});
    expect(count).toBe(1);
  });

  it('clears all listeners', () => {
    let count = 0;
    emitter.on(() => count++);
    emitter.clear();
    emitter.emit('run-1', 'plan_ready', {});
    expect(count).toBe(0);
  });

  it('returns the emitted event with timestamp', () => {
    const event = emitter.emit('run-1', 'run_complete', { state: 'completed' });
    expect(event.timestamp).toBeDefined();
    expect(event.kind).toBe('run_complete');
  });
});
