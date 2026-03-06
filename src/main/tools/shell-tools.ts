// ─── Shell Tools ────────────────────────────────────────────────────
// Controlled shell execution. Always requires approval (high-risk).
// Bounded timeout to prevent runaway processes.

import { execSync } from 'child_process';
import { ToolResult } from '../../shared/types';

const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds
const MAX_OUTPUT_LENGTH = 100_000; // 100 KB

/**
 * Execute a shell command synchronously with a timeout.
 * This is a high-risk operation that must be gated by approval.
 */
export function shellExec(
  command: string,
  cwd?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): ToolResult {
  try {
    const output = execSync(command, {
      cwd: cwd ?? process.cwd(),
      timeout: timeoutMs,
      encoding: 'utf-8',
      maxBuffer: MAX_OUTPUT_LENGTH,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return {
      ok: true,
      summary: `Executed: ${command}`,
      output: output.trim(),
      artifacts: [],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      summary: `Command failed: ${command}`,
      output: null,
      error: msg,
      artifacts: [],
    };
  }
}
