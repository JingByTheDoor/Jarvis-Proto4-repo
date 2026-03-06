// ─── JARVIS Core Types ──────────────────────────────────────────────
// Single source of truth for all data contracts.
// Mirrors constitution.md § 3 — keep both in sync.

/** Risk severity levels. */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** Approval scopes. */
export type ApprovalScope = 'once' | 'session' | 'never';

/** Action lifecycle states. */
export type ActionStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'running'
  | 'completed'
  | 'failed';

/** Approval decisions an operator can make. */
export type ApprovalDecisionKind =
  | 'pending'
  | 'approve_once'
  | 'approve_session'
  | 'deny';

/** Required event kinds emitted during a run. */
export type EventKind =
  | 'plan_ready'
  | 'action_event'
  | 'tool_output'
  | 'approval_needed'
  | 'run_complete'
  | 'run_error'
  | 'agent_message';

/** UI event categories rendered in the console. */
export type UIEventCategory =
  | 'USER'
  | 'AGENT'
  | 'PLAN'
  | 'STEP'
  | 'TOOL'
  | 'WARNING'
  | 'ERROR'
  | 'TASK'
  | 'RESULT';

/** Execution states for the top-level status bar. */
export type ExecutionState =
  | 'idle'
  | 'preparing_plan'
  | 'awaiting_approval'
  | 'executing_actions'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'aborted';

// ─── Core Data Structures ───────────────────────────────────────────

export interface Action {
  id: string;
  type: string;
  label: string;
  description: string;
  args: Record<string, unknown>;
  expected_output: string;
  risk: RiskLevel;
  requires_approval: boolean;
  approval_scope_allowed: ApprovalScope;
  status: ActionStatus;
}

export interface Plan {
  id: string;
  user_goal: string;
  summary: string;
  risk_level: RiskLevel;
  requires_approval: boolean;
  actions: Action[];
  created_at: string;
  policy_snapshot: string;
}

export interface ApprovalDecision {
  action_id: string;
  decision: ApprovalDecisionKind;
  decided_at: string;
  decided_by: string;
}

export interface RunEvent {
  run_id: string;
  kind: EventKind;
  timestamp: string;
  payload: unknown;
}

export interface RunLog {
  run_id: string;
  plan_id: string;
  events: RunEvent[];
  final_result: unknown;
  artifacts: string[];
  started_at: string;
  finished_at: string;
}

export interface ToolResult {
  ok: boolean;
  summary: string;
  output: unknown;
  error?: string;
  artifacts: string[];
  structured_data?: unknown;
}

// ─── IPC Channel Contracts ──────────────────────────────────────────

/** Channels exposed through the Electron preload bridge. */
export const IPC_CHANNELS = {
  SUBMIT_GOAL: 'jarvis:submit-goal',
  APPROVE_ACTION: 'jarvis:approve-action',
  DENY_ACTION: 'jarvis:deny-action',
  ABORT_RUN: 'jarvis:abort-run',
  ON_EVENT: 'jarvis:on-event',
  ON_STATE_CHANGE: 'jarvis:on-state-change',
  GET_RUN_LOG: 'jarvis:get-run-log',
} as const;
