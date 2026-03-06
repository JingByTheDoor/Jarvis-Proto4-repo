// ─── Plan Engine ────────────────────────────────────────────────────
// Orchestrates: plan creation → risk evaluation → approval gating → execution → logging.
// Bounded loop with MAX_AGENT_LOOP safety limit.

import { v4 as uuid } from 'uuid';
import {
  Plan,
  Action,
  RunLog,
  RunEvent,
  ExecutionState,
  ToolResult,
} from '../../shared/types';
import {
  evaluateActionRisk,
  evaluatePlanRisk,
  requiresApproval,
} from './risk-evaluator';
import { ApprovalEngine } from './approval-engine';
import { RunEventEmitter } from './event-emitter';
import { saveRunLog } from './run-log';

/** Safety bound from .env or default. */
const MAX_AGENT_LOOP = parseInt(process.env['MAX_AGENT_LOOP'] ?? '25', 10);

/** Callback for requesting operator approval. */
export type ApprovalRequestFn = (action: Action) => Promise<'approve_once' | 'approve_session' | 'deny'>;

/** Callback for executing a single tool action. */
export type ToolExecutorFn = (action: Action) => Promise<ToolResult>;

export interface PlanEngineOptions {
  approvalEngine: ApprovalEngine;
  emitter: RunEventEmitter;
  requestApproval: ApprovalRequestFn;
  executeTool: ToolExecutorFn;
}

export class PlanEngine {
  private approval: ApprovalEngine;
  private emitter: RunEventEmitter;
  private requestApproval: ApprovalRequestFn;
  private executeTool: ToolExecutorFn;
  private _state: ExecutionState = 'idle';

  constructor(opts: PlanEngineOptions) {
    this.approval = opts.approvalEngine;
    this.emitter = opts.emitter;
    this.requestApproval = opts.requestApproval;
    this.executeTool = opts.executeTool;
  }

  get state(): ExecutionState {
    return this._state;
  }

  private setState(state: ExecutionState): void {
    this._state = state;
  }

  /**
   * Build a plan from a set of proposed actions and a user goal.
   * Risk is evaluated deterministically.
   */
  buildPlan(userGoal: string, proposedActions: Omit<Action, 'risk' | 'requires_approval' | 'status'>[]): Plan {
    this.setState('preparing_plan');

    const actions: Action[] = proposedActions.map((a) => {
      const risk = evaluateActionRisk(a as Action);
      return {
        ...a,
        risk,
        requires_approval: requiresApproval(risk),
        status: 'pending' as const,
      };
    });

    const plan: Plan = {
      id: uuid(),
      user_goal: userGoal,
      summary: `Plan with ${actions.length} action(s) for: ${userGoal}`,
      risk_level: evaluatePlanRisk(actions),
      requires_approval: actions.some((a) => a.requires_approval),
      actions,
      created_at: new Date().toISOString(),
      policy_snapshot: 'v0.1.0',
    };

    return plan;
  }

  /**
   * Execute a plan: iterate actions with approval gating and bounded loop.
   * Returns the completed RunLog.
   */
  async executePlan(plan: Plan): Promise<RunLog> {
    const runId = uuid();
    const events: RunEvent[] = [];
    const artifacts: string[] = [];

    const collect = (e: RunEvent) => events.push(e);
    const unsub = this.emitter.on(collect);

    this.emitter.emit(runId, 'plan_ready', { plan_id: plan.id, summary: plan.summary });

    let iterationCount = 0;
    let aborted = false;
    let hasFailure = false;

    this.setState('executing_actions');

    for (const action of plan.actions) {
      iterationCount++;
      if (iterationCount > MAX_AGENT_LOOP) {
        this.emitter.emit(runId, 'run_error', { message: 'Max agent loop limit reached' });
        aborted = true;
        break;
      }

      // Approval gate
      if (action.requires_approval && !this.approval.canProceed(action)) {
        this.setState('awaiting_approval');
        this.emitter.emit(runId, 'approval_needed', { action_id: action.id, label: action.label });

        const decision = await this.requestApproval(action);
        this.approval.recordDecision(action, decision);

        if (decision === 'deny') {
          action.status = 'denied';
          this.emitter.emit(runId, 'action_event', { action_id: action.id, status: 'denied' });
          continue;
        }
        action.status = 'approved';
        this.setState('executing_actions');
      }

      // Execute
      action.status = 'running';
      this.emitter.emit(runId, 'action_event', { action_id: action.id, status: 'running' });

      try {
        const result = await this.executeTool(action);
        this.emitter.emit(runId, 'tool_output', { action_id: action.id, result });

        if (result.ok) {
          action.status = 'completed';
          artifacts.push(...result.artifacts);
        } else {
          action.status = 'failed';
          hasFailure = true;
        }
      } catch (err) {
        action.status = 'failed';
        hasFailure = true;
        this.emitter.emit(runId, 'run_error', {
          action_id: action.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      this.emitter.emit(runId, 'action_event', { action_id: action.id, status: action.status });
    }

    // Determine final state
    if (aborted) {
      this.setState('aborted');
    } else if (hasFailure && plan.actions.some((a) => a.status === 'completed')) {
      this.setState('partial');
    } else if (hasFailure) {
      this.setState('failed');
    } else {
      this.setState('completed');
    }

    this.emitter.emit(runId, 'run_complete', { state: this._state });
    unsub();

    const log: RunLog = {
      run_id: runId,
      plan_id: plan.id,
      events,
      final_result: { state: this._state },
      artifacts,
      started_at: events[0]?.timestamp ?? new Date().toISOString(),
      finished_at: new Date().toISOString(),
    };

    saveRunLog(log);
    return log;
  }
}
