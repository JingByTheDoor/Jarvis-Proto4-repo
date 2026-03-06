import { PlanEngine } from '../src/main/engine/plan-engine';
import { ApprovalEngine } from '../src/main/engine/approval-engine';
import { RunEventEmitter } from '../src/main/engine/event-emitter';
import { Action, ToolResult } from '../src/shared/types';

// Mock saveRunLog to avoid file system side effects
jest.mock('../src/main/engine/run-log', () => ({
  saveRunLog: jest.fn(() => '/mock/path.json'),
}));

function makeToolResult(ok = true): ToolResult {
  return { ok, summary: 'done', output: 'result', artifacts: [] };
}

describe('PlanEngine', () => {
  let engine: PlanEngine;
  let approvalEngine: ApprovalEngine;
  let emitter: RunEventEmitter;
  let mockApprovalFn: jest.Mock;
  let mockToolFn: jest.Mock;

  beforeEach(() => {
    approvalEngine = new ApprovalEngine();
    emitter = new RunEventEmitter();
    mockApprovalFn = jest.fn().mockResolvedValue('approve_once');
    mockToolFn = jest.fn().mockResolvedValue(makeToolResult());

    engine = new PlanEngine({
      approvalEngine,
      emitter,
      requestApproval: mockApprovalFn,
      executeTool: mockToolFn,
    });
  });

  describe('buildPlan', () => {
    it('creates a plan with risk evaluation', () => {
      const plan = engine.buildPlan('test goal', [
        { id: 'a1', type: 'file_read', label: 'read', description: 'read file', args: {}, expected_output: '', approval_scope_allowed: 'once' },
        { id: 'a2', type: 'shell_exec', label: 'exec', description: 'run command', args: {}, expected_output: '', approval_scope_allowed: 'once' },
      ]);

      expect(plan.user_goal).toBe('test goal');
      expect(plan.actions).toHaveLength(2);
      expect(plan.actions[0].risk).toBe('low');
      expect(plan.actions[0].requires_approval).toBe(false);
      expect(plan.actions[1].risk).toBe('high');
      expect(plan.actions[1].requires_approval).toBe(true);
      expect(plan.risk_level).toBe('high');
    });

    it('creates an empty plan', () => {
      const plan = engine.buildPlan('empty', []);
      expect(plan.actions).toHaveLength(0);
      expect(plan.risk_level).toBe('low');
    });
  });

  describe('executePlan', () => {
    it('executes all actions in a plan', async () => {
      const plan = engine.buildPlan('test', [
        { id: 'a1', type: 'file_read', label: 'read', description: 'read file', args: {}, expected_output: '', approval_scope_allowed: 'once' },
      ]);

      const log = await engine.executePlan(plan);
      expect(log.run_id).toBeDefined();
      expect(log.plan_id).toBe(plan.id);
      expect(engine.state).toBe('completed');
      expect(mockToolFn).toHaveBeenCalledTimes(1);
    });

    it('requests approval for high-risk actions', async () => {
      const plan = engine.buildPlan('test', [
        { id: 'a1', type: 'shell_exec', label: 'exec', description: 'run', args: {}, expected_output: '', approval_scope_allowed: 'once' },
      ]);

      const log = await engine.executePlan(plan);
      expect(mockApprovalFn).toHaveBeenCalledTimes(1);
      expect(mockToolFn).toHaveBeenCalledTimes(1);
      expect(engine.state).toBe('completed');
    });

    it('skips denied actions', async () => {
      mockApprovalFn.mockResolvedValue('deny');
      const plan = engine.buildPlan('test', [
        { id: 'a1', type: 'shell_exec', label: 'exec', description: 'run', args: {}, expected_output: '', approval_scope_allowed: 'once' },
      ]);

      const log = await engine.executePlan(plan);
      expect(mockToolFn).not.toHaveBeenCalled();
      expect(plan.actions[0].status).toBe('denied');
    });

    it('handles tool failures gracefully', async () => {
      mockToolFn.mockResolvedValue(makeToolResult(false));
      const plan = engine.buildPlan('test', [
        { id: 'a1', type: 'file_read', label: 'read', description: 'read', args: {}, expected_output: '', approval_scope_allowed: 'once' },
      ]);

      const log = await engine.executePlan(plan);
      expect(engine.state).toBe('failed');
    });

    it('reports partial when some actions succeed and some fail', async () => {
      let callCount = 0;
      mockToolFn.mockImplementation(async () => {
        callCount++;
        return makeToolResult(callCount === 1);
      });

      const plan = engine.buildPlan('test', [
        { id: 'a1', type: 'file_read', label: 'read1', description: 'r1', args: {}, expected_output: '', approval_scope_allowed: 'once' },
        { id: 'a2', type: 'file_read', label: 'read2', description: 'r2', args: {}, expected_output: '', approval_scope_allowed: 'once' },
      ]);

      const log = await engine.executePlan(plan);
      expect(engine.state).toBe('partial');
    });
  });
});
