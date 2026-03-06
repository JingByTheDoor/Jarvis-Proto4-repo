// ─── Run Log Persistence ────────────────────────────────────────────
// Persists run logs under .tmp/runs/ as JSON files.

import * as fs from 'fs';
import * as path from 'path';
import { RunLog } from '../../shared/types';

const RUNS_DIR = path.resolve(process.cwd(), '.tmp', 'runs');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Save a run log to disk.
 */
export function saveRunLog(log: RunLog): string {
  ensureDir(RUNS_DIR);
  const filePath = path.join(RUNS_DIR, `${log.run_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(log, null, 2), 'utf-8');
  return filePath;
}

/**
 * Load a run log by run ID.
 */
export function loadRunLog(runId: string): RunLog | null {
  const filePath = path.join(RUNS_DIR, `${runId}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as RunLog;
}

/**
 * List all run log IDs.
 */
export function listRunLogs(): string[] {
  ensureDir(RUNS_DIR);
  return fs
    .readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));
}
