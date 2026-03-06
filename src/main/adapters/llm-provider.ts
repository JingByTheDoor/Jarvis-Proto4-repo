// ─── LLM Provider Interface ──────────────────────────────────────────
// Mirrors constitution.md § 9 — keep in sync.
// No vendor SDK coupling in business logic; use fetch() for API calls.

import { Plan } from '../../shared/types';

/**
 * LLM provider interface.
 * Implementations propose a Plan for a user goal.
 * Risk evaluation, approvals, and routing remain deterministic.
 */
export interface LLMProvider {
  generatePlan(goal: string, context?: unknown): Promise<Plan>;
}
