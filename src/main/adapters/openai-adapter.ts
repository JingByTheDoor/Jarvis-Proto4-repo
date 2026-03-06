// ─── OpenAI Adapter ─────────────────────────────────────────────────
// Calls the OpenAI Chat Completions API via fetch().
// No vendor SDK — see constitution.md § 9.

import { v4 as uuid } from 'uuid';
import { Plan, Action, ApprovalScope } from '../../shared/types';
import {
  evaluateActionRisk,
  evaluatePlanRisk,
  requiresApproval,
} from '../engine/risk-evaluator';
import { LLMProvider } from './llm-provider';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

/** Shape expected from the LLM in each action JSON object. */
interface RawAction {
  type?: unknown;
  label?: unknown;
  description?: unknown;
  args?: unknown;
  expected_output?: unknown;
  approval_scope_allowed?: unknown;
}

const SYSTEM_PROMPT = `You are JARVIS, an AI operator console. Given a user goal, respond with a JSON array of proposed actions to accomplish it.

Each action must have:
- type: one of "file_read", "file_write", "file_list", "file_delete", "shell_exec"
- label: short human-readable label
- description: what this action does
- args: object with tool-specific arguments
- expected_output: what to expect from this action
- approval_scope_allowed: one of "once", "session", "never"

Respond ONLY with a valid JSON array. No prose, no code fences.`;

export class OpenAIAdapter implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env['OPENAI_API_KEY'] ?? '';
    this.model = process.env['OPENAI_MODEL'] ?? DEFAULT_MODEL;
  }

  async generatePlan(goal: string, context?: unknown): Promise<Plan> {
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    if (context) {
      messages.push({
        role: 'system',
        content: `Context:\n${JSON.stringify(context)}`,
      });
    }

    messages.push({ role: 'user', content: goal });

    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return buildErrorPlan(goal, `OpenAI API error ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? '';
      return parseActionsIntoPlan(goal, content);
    } catch (err) {
      return buildErrorPlan(
        goal,
        `OpenAI request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/** Parse a JSON array string from the LLM into a Plan. */
export function parseActionsIntoPlan(goal: string, raw: string): Plan {
  let rawActions: RawAction[] = [];

  try {
    const parsed: unknown = JSON.parse(raw.trim());
    if (!Array.isArray(parsed)) {
      return buildErrorPlan(goal, `Failed to parse LLM response as JSON: ${raw}`);
    }
    rawActions = parsed as RawAction[];
  } catch {
    return buildErrorPlan(goal, `Failed to parse LLM response as JSON: ${raw}`);
  }

  const actions: Action[] = rawActions.map((ra) => {
    const partial = {
      id: uuid(),
      type: typeof ra.type === 'string' ? ra.type : 'shell_exec',
      label: typeof ra.label === 'string' ? ra.label : 'Action',
      description: typeof ra.description === 'string' ? ra.description : '',
      args: ra.args && typeof ra.args === 'object' && !Array.isArray(ra.args)
        ? (ra.args as Record<string, unknown>)
        : {},
      expected_output: typeof ra.expected_output === 'string' ? ra.expected_output : '',
      approval_scope_allowed: (['once', 'session', 'never'].includes(ra.approval_scope_allowed as string)
        ? ra.approval_scope_allowed
        : 'once') as ApprovalScope,
      status: 'pending' as const,
      risk: 'low' as const,
      requires_approval: false,
    };
    const risk = evaluateActionRisk(partial as Action);
    return {
      ...partial,
      risk,
      requires_approval: requiresApproval(risk),
    };
  });

  return {
    id: uuid(),
    user_goal: goal,
    summary: `LLM-proposed plan with ${actions.length} action(s) for: ${goal}`,
    risk_level: evaluatePlanRisk(actions),
    requires_approval: actions.some((a) => a.requires_approval),
    actions,
    created_at: new Date().toISOString(),
    policy_snapshot: 'v0.1.0',
  };
}

/** Build a zero-action error plan. */
export function buildErrorPlan(goal: string, errorSummary: string): Plan {
  return {
    id: uuid(),
    user_goal: goal,
    summary: errorSummary,
    risk_level: 'low',
    requires_approval: false,
    actions: [],
    created_at: new Date().toISOString(),
    policy_snapshot: 'v0.1.0',
  };
}
