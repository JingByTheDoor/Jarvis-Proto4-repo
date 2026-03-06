// ─── Adapter Factory ────────────────────────────────────────────────
// Selects the correct LLM provider based on LLM_PROVIDER env var.

import { v4 as uuid } from 'uuid';
import { Plan } from '../../shared/types';
import { LLMProvider } from './llm-provider';
import { OpenAIAdapter } from './openai-adapter';
import { AnthropicAdapter } from './anthropic-adapter';
import { buildErrorPlan } from './openai-adapter';

/** Fallback provider when no LLM is configured. */
class NullProvider implements LLMProvider {
  async generatePlan(goal: string): Promise<Plan> {
    return {
      id: uuid(),
      user_goal: goal,
      summary: 'No LLM configured. Set LLM_PROVIDER in .env to enable AI planning.',
      risk_level: 'low',
      requires_approval: false,
      actions: [],
      created_at: new Date().toISOString(),
      policy_snapshot: 'v0.1.0',
    };
  }
}

/**
 * Returns the appropriate LLM provider based on LLM_PROVIDER env var.
 * Falls back to NullProvider if no valid provider is configured.
 */
export function createLLMProvider(): LLMProvider {
  const provider = (process.env['LLM_PROVIDER'] ?? '').toLowerCase();

  switch (provider) {
    case 'openai':
      return new OpenAIAdapter();
    case 'anthropic':
      return new AnthropicAdapter();
    default:
      return new NullProvider();
  }
}

export { NullProvider, buildErrorPlan };
