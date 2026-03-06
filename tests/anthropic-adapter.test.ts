import { AnthropicAdapter } from '../src/main/adapters/anthropic-adapter';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  process.env['ANTHROPIC_API_KEY'] = 'test-anthropic-key';
  process.env['ANTHROPIC_MODEL'] = 'claude-test';
});

afterEach(() => {
  delete process.env['ANTHROPIC_API_KEY'];
  delete process.env['ANTHROPIC_MODEL'];
});

describe('AnthropicAdapter', () => {
  describe('generatePlan', () => {
    it('returns a plan from a valid Anthropic response', async () => {
      const actions = [
        {
          type: 'file_write',
          label: 'Write file',
          description: 'Write content to a file',
          args: { path: '/tmp/out.txt', content: 'hello' },
          expected_output: 'file written',
          approval_scope_allowed: 'once',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: JSON.stringify(actions) }],
        }),
      });

      const adapter = new AnthropicAdapter();
      const plan = await adapter.generatePlan('Write a file');

      expect(plan.user_goal).toBe('Write a file');
      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0].type).toBe('file_write');
      expect(plan.actions[0].risk).toBe('medium');
      expect(plan.actions[0].requires_approval).toBe(true);
    });

    it('sends the correct Anthropic API headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: '[]' }] }),
      });

      const adapter = new AnthropicAdapter();
      await adapter.generatePlan('goal');

      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(opts.headers['x-api-key']).toBe('test-anthropic-key');
      expect(opts.headers['anthropic-version']).toBeTruthy();
    });

    it('includes context in the user message when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: '[]' }] }),
      });

      const adapter = new AnthropicAdapter();
      await adapter.generatePlan('do something', { recent_messages: [{ role: 'user', content: 'hi' }] });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      const userMsg = body.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMsg.content).toContain('Context:');
    });

    it('returns an error plan when API returns a non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      const adapter = new AnthropicAdapter();
      const plan = await adapter.generatePlan('do something');

      expect(plan.actions).toHaveLength(0);
      expect(plan.summary).toContain('403');
    });

    it('returns an error plan when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      const adapter = new AnthropicAdapter();
      const plan = await adapter.generatePlan('do something');

      expect(plan.actions).toHaveLength(0);
      expect(plan.summary).toContain('Timeout');
    });

    it('uses default model when ANTHROPIC_MODEL is not set', async () => {
      delete process.env['ANTHROPIC_MODEL'];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: '[]' }] }),
      });

      const adapter = new AnthropicAdapter();
      await adapter.generatePlan('goal');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.model).toBe('claude-sonnet-4-20250514');
    });

    it('handles missing text block in Anthropic response gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [] }),
      });

      const adapter = new AnthropicAdapter();
      const plan = await adapter.generatePlan('goal');

      // Empty content → parseActionsIntoPlan with empty string → error plan
      expect(plan.actions).toHaveLength(0);
    });
  });
});
