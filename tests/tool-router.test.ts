import { routeTool } from '../src/main/tools/tool-router';
import { Action } from '../src/shared/types';

function makeAction(type: string, args: Record<string, unknown> = {}): Action {
  return {
    id: 'test-id',
    type,
    label: type,
    description: 'test',
    args,
    expected_output: '',
    risk: 'low',
    requires_approval: false,
    approval_scope_allowed: 'once',
    status: 'pending',
  };
}

describe('tool-router', () => {
  it('routes file_read to fileRead', () => {
    const result = routeTool(makeAction('file_read', { path: '/nonexistent' }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Not found');
  });

  it('routes shell_exec to shellExec', () => {
    const result = routeTool(makeAction('shell_exec', { command: 'echo routed' }));
    expect(result.ok).toBe(true);
    expect(result.output).toBe('routed');
  });

  it('returns error for unknown tool type', () => {
    const result = routeTool(makeAction('unknown_tool'));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No handler');
  });
});
