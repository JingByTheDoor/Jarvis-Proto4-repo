// ─── Risk Evaluator ─────────────────────────────────────────────────
// Deterministic risk scoring for actions.
// Business logic — no LLM involvement.

import { Action, RiskLevel } from '../../shared/types';

/** Action types considered high-risk or critical. */
const HIGH_RISK_TYPES = new Set([
  'shell_exec',
  'process_kill',
  'network_request',
]);

const CRITICAL_TYPES = new Set([
  'credential_use',
  'system_modify',
  'file_delete_recursive',
]);

const MEDIUM_RISK_TYPES = new Set([
  'file_write',
  'file_delete',
  'config_change',
]);

/**
 * Evaluate the risk level of a single action based on its type.
 * This is deterministic — no LLM calls.
 */
export function evaluateActionRisk(action: Action): RiskLevel {
  if (CRITICAL_TYPES.has(action.type)) return 'critical';
  if (HIGH_RISK_TYPES.has(action.type)) return 'high';
  if (MEDIUM_RISK_TYPES.has(action.type)) return 'medium';
  return 'low';
}

/**
 * Evaluate the overall risk of a plan.
 * The plan's risk is the maximum risk among all its actions.
 */
export function evaluatePlanRisk(actions: Action[]): RiskLevel {
  const levels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
  let maxIndex = 0;
  for (const action of actions) {
    const risk = evaluateActionRisk(action);
    const idx = levels.indexOf(risk);
    if (idx > maxIndex) maxIndex = idx;
  }
  return levels[maxIndex];
}

/**
 * Determine if an action requires approval based on risk level.
 */
export function requiresApproval(risk: RiskLevel): boolean {
  return risk === 'medium' || risk === 'high' || risk === 'critical';
}
