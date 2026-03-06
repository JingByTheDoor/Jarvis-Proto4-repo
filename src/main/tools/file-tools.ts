// ─── File Tools ─────────────────────────────────────────────────────
// Deterministic file operations (read, write, list, delete).
// All operations return ToolResult for consistency.

import * as fs from 'fs';
import * as path from 'path';
import { ToolResult } from '../../shared/types';

/**
 * Read a file's contents.
 */
export function fileRead(filePath: string): ToolResult {
  try {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return { ok: false, summary: 'File not found', output: null, error: `Not found: ${resolved}`, artifacts: [] };
    }
    const content = fs.readFileSync(resolved, 'utf-8');
    return { ok: true, summary: `Read ${resolved}`, output: content, artifacts: [] };
  } catch (err) {
    return { ok: false, summary: 'Read failed', output: null, error: String(err), artifacts: [] };
  }
}

/**
 * Write content to a file (creates parent directories as needed).
 */
export function fileWrite(filePath: string, content: string): ToolResult {
  try {
    const resolved = path.resolve(filePath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, 'utf-8');
    return { ok: true, summary: `Wrote ${resolved}`, output: null, artifacts: [resolved] };
  } catch (err) {
    return { ok: false, summary: 'Write failed', output: null, error: String(err), artifacts: [] };
  }
}

/**
 * List files in a directory.
 */
export function fileList(dirPath: string): ToolResult {
  try {
    const resolved = path.resolve(dirPath);
    if (!fs.existsSync(resolved)) {
      return { ok: false, summary: 'Directory not found', output: null, error: `Not found: ${resolved}`, artifacts: [] };
    }
    const entries = fs.readdirSync(resolved, { withFileTypes: true }).map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
    }));
    return { ok: true, summary: `Listed ${entries.length} entries`, output: entries, artifacts: [] };
  } catch (err) {
    return { ok: false, summary: 'List failed', output: null, error: String(err), artifacts: [] };
  }
}

/**
 * Delete a single file (not recursive — recursive delete is a critical-risk action).
 */
export function fileDelete(filePath: string): ToolResult {
  try {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return { ok: false, summary: 'File not found', output: null, error: `Not found: ${resolved}`, artifacts: [] };
    }
    fs.unlinkSync(resolved);
    return { ok: true, summary: `Deleted ${resolved}`, output: null, artifacts: [] };
  } catch (err) {
    return { ok: false, summary: 'Delete failed', output: null, error: String(err), artifacts: [] };
  }
}
