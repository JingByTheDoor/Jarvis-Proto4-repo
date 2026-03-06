// ─── Memory Types ───────────────────────────────────────────────────

export interface MemoryMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}
