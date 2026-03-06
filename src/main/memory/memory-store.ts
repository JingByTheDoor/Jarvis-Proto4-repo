// ─── Memory Store ───────────────────────────────────────────────────
// Local file-based conversation history stored under .tmp/memory/.

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { MemoryMessage } from './types';

const MEMORY_DIR = path.resolve(process.cwd(), '.tmp', 'memory');
const HISTORY_FILE = path.join(MEMORY_DIR, 'history.json');

/** Number of recent messages included in context by default. */
const DEFAULT_CONTEXT_LIMIT = 10;

function ensureDir(): void {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function readHistory(): MemoryMessage[] {
  ensureDir();
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MemoryMessage[]) : [];
  } catch {
    return [];
  }
}

function writeHistory(messages: MemoryMessage[]): void {
  ensureDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(messages, null, 2), 'utf-8');
}

/** Save a message to the persistent history. */
export function saveMessage(
  role: 'user' | 'assistant' | 'system',
  content: string,
): void {
  const messages = readHistory();
  messages.push({
    id: uuid(),
    role,
    content,
    timestamp: new Date().toISOString(),
  });
  writeHistory(messages);
}

/**
 * Return the most recent messages, up to `limit`.
 * Defaults to DEFAULT_CONTEXT_LIMIT.
 */
export function getMessages(limit?: number): MemoryMessage[] {
  const all = readHistory();
  const n = limit ?? DEFAULT_CONTEXT_LIMIT;
  return all.slice(-n);
}

/** Return a context object suitable for passing to LLMProvider.generatePlan. */
export function getContext(): unknown {
  const recent = getMessages(DEFAULT_CONTEXT_LIMIT);
  return { recent_messages: recent };
}

/** Clear all stored history. */
export function clearHistory(): void {
  writeHistory([]);
}
