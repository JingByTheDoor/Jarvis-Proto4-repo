// ─── MCP Bridge ─────────────────────────────────────────────────────
// Lightweight Model Context Protocol tool bridge.
// Spawns MCP servers as child processes and communicates via stdio JSON-RPC.

import { spawn, ChildProcess } from 'child_process';
import { ToolResult } from '../../shared/types';

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPToolDefinition {
  serverName: string;
  toolName: string;
  description?: string;
  inputSchema?: unknown;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class MCPBridge {
  private servers: Map<string, MCPServerConfig> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private toolCache: Map<string, MCPToolDefinition[]> = new Map();

  /** Register an external MCP tool server. */
  registerServer(name: string, config: MCPServerConfig): void {
    this.servers.set(name, config);
    // Clear cached tool list so it is refreshed on next listTools()
    this.toolCache.delete(name);
  }

  /** Return all known tool definitions across registered servers. */
  listTools(): MCPToolDefinition[] {
    const result: MCPToolDefinition[] = [];
    for (const [serverName, tools] of this.toolCache.entries()) {
      // Filter to ensure server is still registered
      if (this.servers.has(serverName)) {
        result.push(...tools);
      }
    }
    return result;
  }

  /**
   * Call a tool on the named MCP server.
   * Spawns the server process if not already running, sends a JSON-RPC
   * `tools/call` request, and returns a ToolResult.
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const config = this.servers.get(serverName);
    if (!config) {
      return {
        ok: false,
        summary: `MCP server "${serverName}" is not registered`,
        output: null,
        error: `Unknown MCP server: ${serverName}`,
        artifacts: [],
      };
    }

    try {
      const response = await this.sendRequest(serverName, config, {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      });

      if (response.error) {
        return {
          ok: false,
          summary: `MCP tool "${toolName}" returned an error`,
          output: null,
          error: response.error.message,
          artifacts: [],
        };
      }

      return {
        ok: true,
        summary: `MCP tool "${toolName}" completed`,
        output: response.result,
        artifacts: [],
      };
    } catch (err) {
      return {
        ok: false,
        summary: `MCP call failed: ${err instanceof Error ? err.message : String(err)}`,
        output: null,
        error: err instanceof Error ? err.message : String(err),
        artifacts: [],
      };
    }
  }

  /**
   * Send a single JSON-RPC request to an MCP server process via stdio.
   * Spawns the process fresh for each request (stateless per-call model).
   */
  private sendRequest(
    _serverName: string,
    config: MCPServerConfig,
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      const proc = spawn(config.command, config.args ?? [], {
        env: { ...process.env, ...(config.env ?? {}) },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn MCP server: ${err.message}`));
      });

      proc.on('close', (code) => {
        if (code !== 0 && !stdout) {
          reject(
            new Error(
              `MCP server exited with code ${code}. stderr: ${stderr}`,
            ),
          );
          return;
        }

        // Parse the last complete JSON line from stdout
        const lines = stdout.trim().split('\n').filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(lines[i]) as JsonRpcResponse;
            resolve(parsed);
            return;
          } catch {
            // Not valid JSON, try previous line
          }
        }
        reject(new Error(`No valid JSON-RPC response found in MCP stdout: ${stdout}`));
      });

      // Send the request
      proc.stdin.write(JSON.stringify(request) + '\n');
      proc.stdin.end();
    });
  }
}

/** Singleton bridge instance. */
export const mcpBridge = new MCPBridge();
