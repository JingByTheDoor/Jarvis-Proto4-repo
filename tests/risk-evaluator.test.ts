import {
  evaluateActionRisk,
  evaluatePlanRisk,
  requiresApproval,
} from '../src/main/engine/risk-evaluator';
import { Action } from '../src/shared/types';

function makeAction(type: string): Action {
  return {
    id: 'test-id',
    type,
    label: 'test',
    description: 'test action',
    args: {},
    expected_output: '',
    risk: 'low',
    requires_approval: false,
    approval_scope_allowed: 'once',
    status: 'pending',
  };
}

describe('risk-evaluator', () => {
  describe('evaluateActionRisk', () => {
    it('returns low for read-only actions', () => {
      expect(evaluateActionRisk(makeAction('file_read'))).toBe('low');
    });

    it('returns medium for file_write', () => {
      expect(evaluateActionRisk(makeAction('file_write'))).toBe('medium');
    });

    it('returns medium for file_delete', () => {
      expect(evaluateActionRisk(makeAction('file_delete'))).toBe('medium');
    });

    it('returns high for shell_exec', () => {
      expect(evaluateActionRisk(makeAction('shell_exec'))).toBe('high');
    });

    it('returns high for process_kill', () => {
      expect(evaluateActionRisk(makeAction('process_kill'))).toBe('high');
    });

    it('returns critical for credential_use', () => {
      expect(evaluateActionRisk(makeAction('credential_use'))).toBe('critical');
    });

    it('returns critical for system_modify', () => {
      expect(evaluateActionRisk(makeAction('system_modify'))).toBe('critical');
    });
  });

  describe('evaluatePlanRisk', () => {
    it('returns the highest risk among all actions', () => {
      const actions = [
        makeAction('file_read'),
        makeAction('file_write'),
        makeAction('shell_exec'),
      ];
      expect(evaluatePlanRisk(actions)).toBe('high');
    });

    it('returns low for an empty action list', () => {
      expect(evaluatePlanRisk([])).toBe('low');
    });

    it('returns critical if any action is critical', () => {
      const actions = [makeAction('file_read'), makeAction('credential_use')];
      expect(evaluatePlanRisk(actions)).toBe('critical');
    });
  });

  describe('requiresApproval', () => {
    it('returns false for low risk', () => {
      expect(requiresApproval('low')).toBe(false);
    });

    it('returns true for medium risk', () => {
      expect(requiresApproval('medium')).toBe(true);
    });

    it('returns true for high risk', () => {
      expect(requiresApproval('high')).toBe(true);
    });

    it('returns true for critical risk', () => {
      expect(requiresApproval('critical')).toBe(true);
    });
  });
});
