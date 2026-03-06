import { OpenAIAdapter, parseActionsIntoPlan, buildErrorPlan } from '../src/main/adapters/openai-adapter';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  process.env['OPENAI_API_KEY'] = 'test-key';
  process.env['OPENAI_MODEL'] = 'gpt-4o-mini';
});

afterEach(() => {
  delete process.env['OPENAI_API_KEY'];
  delete process.env['OPENAI_MODEL'];
});

describe('OpenAIAdapter', () => {
  describe('generatePlan', () => {
    it('returns a plan from a valid LLM response', async () => {
      const actions = [
        {
          type: 'file_read',
          label: 'Read config',
          description: 'Read the config file',
          args: { path: '/tmp/config.json' },
          expected_output: 'file contents',
          approval_scope_allowed: 'once',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(actions) } }],
        }),
      });

      const adapter = new OpenAIAdapter();
      const plan = await adapter.generatePlan('Read my config');

      expect(plan.user_goal).toBe('Read my config');
      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0].type).toBe('file_read');
      expect(plan.actions[0].risk).toBe('low');
      expect(plan.actions[0].requires_approval).toBe(false);
    });

    it('includes context in the request when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '[]' } }] }),
      });

      const adapter = new OpenAIAdapter();
      await adapter.generatePlan('goal', { recent_messages: [] });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      const contextMsg = body.messages.find(
        (m: { role: string; content: string }) => m.content.includes('"recent_messages"'),
      );
      expect(contextMsg).toBeDefined();
    });

    it('returns an error plan when API returns a non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const adapter = new OpenAIAdapter();
      const plan = await adapter.generatePlan('do something');

      expect(plan.actions).toHaveLength(0);
      expect(plan.summary).toContain('401');
    });

    it('returns an error plan when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const adapter = new OpenAIAdapter();
      const plan = await adapter.generatePlan('do something');

      expect(plan.actions).toHaveLength(0);
      expect(plan.summary).toContain('Network error');
    });

    it('applies correct risk evaluation for shell_exec actions', async () => {
      const actions = [
        {
          type: 'shell_exec',
          label: 'Run script',
          description: 'Execute a shell command',
          args: { command: 'ls -la' },
          expected_output: 'file list',
          approval_scope_allowed: 'once',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify(actions) } }] }),
      });

      const adapter = new OpenAIAdapter();
      const plan = await adapter.generatePlan('list files');

      expect(plan.actions[0].risk).toBe('high');
      expect(plan.actions[0].requires_approval).toBe(true);
      expect(plan.risk_level).toBe('high');
      expect(plan.requires_approval).toBe(true);
    });

    it('uses default model when OPENAI_MODEL is not set', async () => {
      delete process.env['OPENAI_MODEL'];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '[]' } }] }),
      });

      const adapter = new OpenAIAdapter();
      await adapter.generatePlan('goal');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.model).toBe('gpt-4o-mini');
    });
  });

  describe('providerName and isConfigured', () => {
    it('has providerName "openai"', () => {
      const adapter = new OpenAIAdapter();
      expect(adapter.providerName).toBe('openai');
    });

    it('isConfigured is true when OPENAI_API_KEY is set', () => {
      process.env['OPENAI_API_KEY'] = 'sk-test';
      const adapter = new OpenAIAdapter();
      expect(adapter.isConfigured).toBe(true);
    });

    it('isConfigured is false when OPENAI_API_KEY is empty', () => {
      delete process.env['OPENAI_API_KEY'];
      const adapter = new OpenAIAdapter();
      expect(adapter.isConfigured).toBe(false);
    });
  });

  describe('chat', () => {
    it('returns a text reply from the API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello! How can I help?' } }],
        }),
      });

      const adapter = new OpenAIAdapter();
      const reply = await adapter.chat('hello');
      expect(reply).toBe('Hello! How can I help?');
    });

    it('includes context in the chat request when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Hi!' } }] }),
      });

      const adapter = new OpenAIAdapter();
      await adapter.chat('hello', { recent_messages: [] });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      const contextMsg = body.messages.find(
        (m: { role: string; content: string }) => m.content.includes('"recent_messages"'),
      );
      expect(contextMsg).toBeDefined();
    });

    it('returns an error string when the API responds with non-OK status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const adapter = new OpenAIAdapter();
      const reply = await adapter.chat('hello');
      expect(reply).toContain('401');
      expect(reply).toContain('Unauthorized');
    });

    it('returns an error string when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const adapter = new OpenAIAdapter();
      const reply = await adapter.chat('hello');
      expect(reply).toContain('Network failure');
    });
  });
});

describe('parseActionsIntoPlan', () => {
  it('parses a valid JSON array of actions', () => {
    const raw = JSON.stringify([
      {
        type: 'file_list',
        label: 'List files',
        description: 'List directory',
        args: { path: '/tmp' },
        expected_output: 'file list',
        approval_scope_allowed: 'once',
      },
    ]);

    const plan = parseActionsIntoPlan('list files', raw);
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0].type).toBe('file_list');
    expect(plan.actions[0].id).toBeTruthy();
    expect(plan.id).toBeTruthy();
  });

  it('returns an error plan for invalid JSON', () => {
    const plan = parseActionsIntoPlan('goal', 'not json at all');
    expect(plan.actions).toHaveLength(0);
    expect(plan.summary).toContain('Failed to parse');
  });

  it('returns an error plan when the JSON is not an array', () => {
    const plan = parseActionsIntoPlan('goal', '{"type": "file_read"}');
    expect(plan.actions).toHaveLength(0);
    expect(plan.summary).toContain('Failed to parse');
  });

  it('defaults unknown approval_scope_allowed to "once"', () => {
    const raw = JSON.stringify([
      {
        type: 'file_read',
        label: 'Read',
        description: 'Read file',
        args: { path: '/tmp/x' },
        expected_output: '',
        approval_scope_allowed: 'unknown_value',
      },
    ]);

    const plan = parseActionsIntoPlan('goal', raw);
    expect(plan.actions[0].approval_scope_allowed).toBe('once');
  });

  it('handles missing optional fields gracefully', () => {
    const raw = JSON.stringify([{}]);
    const plan = parseActionsIntoPlan('goal', raw);
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0].type).toBe('shell_exec');
    expect(plan.actions[0].label).toBe('Action');
  });
});

describe('buildErrorPlan', () => {
  it('creates a zero-action plan with the given summary', () => {
    const plan = buildErrorPlan('my goal', 'Something went wrong');
    expect(plan.user_goal).toBe('my goal');
    expect(plan.summary).toBe('Something went wrong');
    expect(plan.actions).toHaveLength(0);
    expect(plan.risk_level).toBe('low');
    expect(plan.requires_approval).toBe(false);
  });
});
