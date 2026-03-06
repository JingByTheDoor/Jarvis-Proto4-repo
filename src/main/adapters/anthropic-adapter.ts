// ─── Anthropic Adapter ──────────────────────────────────────────────
// Calls the Anthropic Messages API via fetch().
// No vendor SDK — see constitution.md § 9.

import { v4 as uuid } from 'uuid';
import { Plan } from '../../shared/types';
import { LLMProvider } from './llm-provider';
import { parseActionsIntoPlan, buildErrorPlan } from './openai-adapter';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `You are JARVIS, an AI operator console. Given a user goal, respond with a JSON array of proposed actions to accomplish it.

Each action must have:
- type: one of "file_read", "file_write", "file_list", "file_delete", "shell_exec"
- label: short human-readable label
- description: what this action does
- args: object with tool-specific arguments
- expected_output: what to expect from this action
- approval_scope_allowed: one of "once", "session", "never"

Respond ONLY with a valid JSON array. No prose, no code fences.`;

export class AnthropicAdapter implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env['ANTHROPIC_API_KEY'] ?? '';
    this.model = process.env['ANTHROPIC_MODEL'] ?? DEFAULT_MODEL;
  }

  async generatePlan(goal: string, context?: unknown): Promise<Plan> {
    const userContent = context
      ? `Context:\n${JSON.stringify(context)}\n\nGoal: ${goal}`
      : goal;

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return buildErrorPlan(goal, `Anthropic API error ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as {
        content?: { type?: string; text?: string }[];
      };

      const textBlock = data.content?.find((b) => b.type === 'text');
      const content = textBlock?.text ?? '';
      return parseActionsIntoPlan(goal, content);
    } catch (err) {
      return buildErrorPlan(
        goal,
        `Anthropic request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

// Re-export for convenience
export { parseActionsIntoPlan, buildErrorPlan };
export { uuid };
