// ─── Approval Engine ────────────────────────────────────────────────
// Deterministic approval gate.
// Tracks per-session approvals and enforces the constitution.

import {
  Action,
  ApprovalDecision,
  ApprovalDecisionKind,
} from '../../shared/types';

export class ApprovalEngine {
  /** Session-scoped approvals keyed by action type. */
  private sessionApprovals = new Set<string>();

  /**
   * Check whether an action may proceed.
   * Returns true if the action does not need approval or has a session-scoped grant.
   */
  canProceed(action: Action): boolean {
    if (!action.requires_approval) return true;
    return this.sessionApprovals.has(action.type);
  }

  /**
   * Record an approval decision.
   * Returns the updated action status.
   */
  recordDecision(
    action: Action,
    decision: ApprovalDecisionKind,
  ): ApprovalDecision {
    const record: ApprovalDecision = {
      action_id: action.id,
      decision,
      decided_at: new Date().toISOString(),
      decided_by: 'operator',
    };

    if (decision === 'approve_session') {
      this.sessionApprovals.add(action.type);
    }

    return record;
  }

  /**
   * Check if a particular action type has session-level approval.
   */
  hasSessionApproval(actionType: string): boolean {
    return this.sessionApprovals.has(actionType);
  }

  /**
   * Reset all session approvals (e.g. on new session).
   */
  resetSession(): void {
    this.sessionApprovals.clear();
  }
}
