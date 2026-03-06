import { ApprovalEngine } from '../src/main/engine/approval-engine';
import { Action } from '../src/shared/types';

function makeAction(type: string, requiresApproval = true): Action {
  return {
    id: `action-${type}`,
    type,
    label: type,
    description: 'test',
    args: {},
    expected_output: '',
    risk: 'high',
    requires_approval: requiresApproval,
    approval_scope_allowed: 'session',
    status: 'pending',
  };
}

describe('ApprovalEngine', () => {
  let engine: ApprovalEngine;

  beforeEach(() => {
    engine = new ApprovalEngine();
  });

  it('allows actions that do not require approval', () => {
    const action = makeAction('file_read', false);
    expect(engine.canProceed(action)).toBe(true);
  });

  it('blocks actions that require approval and have no grant', () => {
    const action = makeAction('shell_exec');
    expect(engine.canProceed(action)).toBe(false);
  });

  it('grants session approval for a type after approve_session', () => {
    const action = makeAction('shell_exec');
    engine.recordDecision(action, 'approve_session');
    expect(engine.canProceed(action)).toBe(true);
    expect(engine.hasSessionApproval('shell_exec')).toBe(true);
  });

  it('does not grant session approval for approve_once', () => {
    const action = makeAction('shell_exec');
    engine.recordDecision(action, 'approve_once');
    expect(engine.hasSessionApproval('shell_exec')).toBe(false);
  });

  it('resets session approvals on resetSession', () => {
    const action = makeAction('shell_exec');
    engine.recordDecision(action, 'approve_session');
    engine.resetSession();
    expect(engine.canProceed(action)).toBe(false);
    expect(engine.hasSessionApproval('shell_exec')).toBe(false);
  });

  it('returns a properly structured ApprovalDecision', () => {
    const action = makeAction('shell_exec');
    const decision = engine.recordDecision(action, 'deny');
    expect(decision).toEqual(
      expect.objectContaining({
        action_id: 'action-shell_exec',
        decision: 'deny',
        decided_by: 'operator',
      }),
    );
    expect(decision.decided_at).toBeDefined();
  });
});
