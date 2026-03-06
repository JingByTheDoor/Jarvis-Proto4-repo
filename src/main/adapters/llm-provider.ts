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
  /** Human-readable name of the active provider (e.g. "openai", "anthropic", "none"). */
  readonly providerName: string;

  /** Whether the provider has the credentials/config it needs to make API calls. */
  readonly isConfigured: boolean;

  generatePlan(goal: string, context?: unknown): Promise<Plan>;

  /**
   * Send a free-form chat message and return a plain-text reply.
   * Used for conversational goals that don't require tool actions.
   */
  chat(message: string, context?: unknown): Promise<string>;
}
