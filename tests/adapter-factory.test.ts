import { createLLMProvider } from '../src/main/adapters/adapter-factory';
import { OpenAIAdapter } from '../src/main/adapters/openai-adapter';
import { AnthropicAdapter } from '../src/main/adapters/anthropic-adapter';

// Mock fetch to avoid real HTTP calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createLLMProvider (adapter-factory)', () => {
  afterEach(() => {
    delete process.env['LLM_PROVIDER'];
  });

  it('returns an OpenAIAdapter when LLM_PROVIDER=openai', () => {
    process.env['LLM_PROVIDER'] = 'openai';
    const provider = createLLMProvider();
    expect(provider).toBeInstanceOf(OpenAIAdapter);
  });

  it('returns an AnthropicAdapter when LLM_PROVIDER=anthropic', () => {
    process.env['LLM_PROVIDER'] = 'anthropic';
    const provider = createLLMProvider();
    expect(provider).toBeInstanceOf(AnthropicAdapter);
  });

  it('is case-insensitive for the provider name', () => {
    process.env['LLM_PROVIDER'] = 'OpenAI';
    const provider = createLLMProvider();
    expect(provider).toBeInstanceOf(OpenAIAdapter);
  });

  it('returns a NullProvider when LLM_PROVIDER is empty', async () => {
    process.env['LLM_PROVIDER'] = '';
    const provider = createLLMProvider();
    const plan = await provider.generatePlan('test goal');
    expect(plan.user_goal).toBe('test goal');
    expect(plan.actions).toHaveLength(0);
    expect(plan.summary).toContain('No LLM');
  });

  it('returns a NullProvider when LLM_PROVIDER is unrecognised', async () => {
    process.env['LLM_PROVIDER'] = 'unknown_provider';
    const provider = createLLMProvider();
    const plan = await provider.generatePlan('test goal');
    expect(plan.actions).toHaveLength(0);
    expect(plan.summary).toContain('No LLM');
  });

  it('NullProvider plan has required fields', async () => {
    delete process.env['LLM_PROVIDER'];
    const provider = createLLMProvider();
    const plan = await provider.generatePlan('my goal');
    expect(plan.id).toBeTruthy();
    expect(plan.created_at).toBeTruthy();
    expect(plan.policy_snapshot).toBe('v0.1.0');
    expect(plan.risk_level).toBe('low');
    expect(plan.requires_approval).toBe(false);
  });

  it('NullProvider has providerName "none" and isConfigured false', () => {
    delete process.env['LLM_PROVIDER'];
    const provider = createLLMProvider();
    expect(provider.providerName).toBe('none');
    expect(provider.isConfigured).toBe(false);
  });

  it('NullProvider.chat() returns an actionable config message', async () => {
    delete process.env['LLM_PROVIDER'];
    const provider = createLLMProvider();
    const reply = await provider.chat('hello');
    expect(reply).toContain('No LLM provider configured');
    expect(reply).toContain('LLM_PROVIDER');
  });

  it('NullProvider summary includes instructions to configure .env', async () => {
    delete process.env['LLM_PROVIDER'];
    const provider = createLLMProvider();
    const plan = await provider.generatePlan('do something');
    expect(plan.summary).toContain('LLM_PROVIDER');
    expect(plan.summary).toContain('.env');
  });

  it('OpenAIAdapter has providerName "openai"', () => {
    process.env['LLM_PROVIDER'] = 'openai';
    const provider = createLLMProvider();
    expect(provider.providerName).toBe('openai');
  });

  it('AnthropicAdapter has providerName "anthropic"', () => {
    process.env['LLM_PROVIDER'] = 'anthropic';
    const provider = createLLMProvider();
    expect(provider.providerName).toBe('anthropic');
  });
});
