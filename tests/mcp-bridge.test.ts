import { MCPBridge } from '../src/main/tools/mcp-bridge';

describe('MCPBridge', () => {
  let bridge: MCPBridge;

  beforeEach(() => {
    bridge = new MCPBridge();
  });

  describe('registerServer', () => {
    it('registers a server by name', () => {
      bridge.registerServer('test-server', { command: 'node', args: ['server.js'] });
      // listTools returns empty until cache is populated, but registration shouldn't throw
      expect(() => bridge.listTools()).not.toThrow();
    });
  });

  describe('listTools', () => {
    it('returns an empty array when no servers are registered', () => {
      expect(bridge.listTools()).toEqual([]);
    });

    it('returns an empty array when servers are registered but cache is not populated', () => {
      bridge.registerServer('my-server', { command: 'echo' });
      // No explicit cache population in this implementation — list is empty until tools/list called
      expect(bridge.listTools()).toEqual([]);
    });
  });

  describe('callTool', () => {
    it('returns an error ToolResult when the server is not registered', async () => {
      const result = await bridge.callTool('nonexistent', 'some_tool', {});
      expect(result.ok).toBe(false);
      expect(result.error).toContain('nonexistent');
    });

    it('returns an error ToolResult when the server process fails to start', async () => {
      bridge.registerServer('bad-server', {
        command: 'this-command-does-not-exist-ever-xyz123',
      });

      const result = await bridge.callTool('bad-server', 'tool', {});
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('returns an error ToolResult when the server exits without valid JSON', async () => {
      // Use a command that exits cleanly but prints no valid JSON-RPC response
      bridge.registerServer('no-output-server', {
        command: 'node',
        args: ['-e', 'process.exit(0)'],
      });

      const result = await bridge.callTool('no-output-server', 'tool', {});
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('returns a successful ToolResult when the server returns a valid JSON-RPC response', async () => {
      // Create a mock server that reads stdin and responds with a valid result
      const mockServerScript = `
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin });
        rl.on('line', (line) => {
          const req = JSON.parse(line);
          const response = { jsonrpc: '2.0', id: req.id, result: { output: 'hello from tool' } };
          process.stdout.write(JSON.stringify(response) + '\\n');
          process.exit(0);
        });
      `;

      bridge.registerServer('mock-server', {
        command: 'node',
        args: ['-e', mockServerScript],
      });

      const result = await bridge.callTool('mock-server', 'my_tool', { key: 'value' });
      expect(result.ok).toBe(true);
      expect(result.output).toEqual({ output: 'hello from tool' });
    });

    it('returns an error ToolResult when server returns a JSON-RPC error', async () => {
      const mockServerScript = `
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin });
        rl.on('line', (line) => {
          const req = JSON.parse(line);
          const response = { jsonrpc: '2.0', id: req.id, error: { code: -32601, message: 'Method not found' } };
          process.stdout.write(JSON.stringify(response) + '\\n');
          process.exit(0);
        });
      `;

      bridge.registerServer('error-server', {
        command: 'node',
        args: ['-e', mockServerScript],
      });

      const result = await bridge.callTool('error-server', 'nonexistent_tool', {});
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Method not found');
    });
  });
});
