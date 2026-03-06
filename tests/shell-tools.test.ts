import { shellExec } from '../src/main/tools/shell-tools';

describe('shell-tools', () => {
  it('executes a simple command', () => {
    const result = shellExec('echo hello');
    expect(result.ok).toBe(true);
    expect(result.output).toBe('hello');
  });

  it('returns error for a failing command', () => {
    const result = shellExec('exit 1');
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('respects timeout', () => {
    // 100ms timeout — command should not complete
    const result = shellExec('sleep 10', undefined, 100);
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});
