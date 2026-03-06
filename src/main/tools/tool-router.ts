// ─── Tool Router ────────────────────────────────────────────────────
// Routes actions to the correct tool by action type.

import { Action, ToolResult } from '../../shared/types';
import { fileRead, fileWrite, fileList, fileDelete } from './file-tools';
import { shellExec } from './shell-tools';
import { mcpBridge } from './mcp-bridge';

/**
 * Execute a tool action based on its type.
 * Synchronous tools return ToolResult directly.
 * Async tools (mcp_call) must use executeToolAction.
 */
export function routeTool(action: Action): ToolResult {
  const args = action.args;

  switch (action.type) {
    case 'file_read':
      return fileRead(args['path'] as string);

    case 'file_write':
      return fileWrite(args['path'] as string, args['content'] as string);

    case 'file_list':
      return fileList(args['path'] as string);

    case 'file_delete':
      return fileDelete(args['path'] as string);

    case 'shell_exec':
      return shellExec(
        args['command'] as string,
        args['cwd'] as string | undefined,
        args['timeout'] as number | undefined,
      );

    default:
      return {
        ok: false,
        summary: `Unknown tool type: ${action.type}`,
        output: null,
        error: `No handler for action type "${action.type}"`,
        artifacts: [],
      };
  }
}

/**
 * Async wrapper for use in PlanEngine.executeTool callback.
 * Handles mcp_call in addition to the synchronous tools in routeTool.
 */
export async function executeToolAction(action: Action): Promise<ToolResult> {
  if (action.type === 'mcp_call') {
    const args = action.args;
    return mcpBridge.callTool(
      args['server'] as string,
      args['tool'] as string,
      (args['args'] as Record<string, unknown>) ?? {},
    );
  }
  return routeTool(action);
}
