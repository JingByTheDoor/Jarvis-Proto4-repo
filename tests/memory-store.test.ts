import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// We need to override process.cwd() so memory-store writes to a temp dir
let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-memory-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  jest.restoreAllMocks();
});

// Import AFTER mocking cwd
import { saveMessage, getMessages, getContext, clearHistory } from '../src/main/memory/memory-store';

describe('memory-store', () => {
  beforeEach(() => {
    clearHistory();
  });

  describe('saveMessage', () => {
    it('persists a user message', () => {
      saveMessage('user', 'hello world');
      const msgs = getMessages();
      expect(msgs).toHaveLength(1);
      expect(msgs[0].role).toBe('user');
      expect(msgs[0].content).toBe('hello world');
    });

    it('persists an assistant message', () => {
      saveMessage('assistant', 'plan executed');
      const msgs = getMessages();
      expect(msgs[0].role).toBe('assistant');
    });

    it('assigns a unique id and ISO timestamp to each message', () => {
      saveMessage('user', 'msg1');
      saveMessage('user', 'msg2');
      const msgs = getMessages();
      expect(msgs[0].id).toBeTruthy();
      expect(msgs[1].id).toBeTruthy();
      expect(msgs[0].id).not.toBe(msgs[1].id);
      expect(() => new Date(msgs[0].timestamp)).not.toThrow();
    });
  });

  describe('getMessages', () => {
    it('returns all messages when count is below the default limit', () => {
      saveMessage('user', 'a');
      saveMessage('assistant', 'b');
      const msgs = getMessages();
      expect(msgs).toHaveLength(2);
    });

    it('returns only the most recent N messages when limit is specified', () => {
      for (let i = 0; i < 15; i++) {
        saveMessage('user', `msg ${i}`);
      }
      const msgs = getMessages(5);
      expect(msgs).toHaveLength(5);
      expect(msgs[4].content).toBe('msg 14');
    });

    it('returns empty array when no messages saved', () => {
      expect(getMessages()).toEqual([]);
    });
  });

  describe('getContext', () => {
    it('returns an object with recent_messages key', () => {
      saveMessage('user', 'hello');
      const ctx = getContext() as { recent_messages: unknown[] };
      expect(ctx).toHaveProperty('recent_messages');
      expect(Array.isArray(ctx.recent_messages)).toBe(true);
      expect(ctx.recent_messages).toHaveLength(1);
    });

    it('limits to 10 messages in context', () => {
      for (let i = 0; i < 15; i++) {
        saveMessage('user', `msg ${i}`);
      }
      const ctx = getContext() as { recent_messages: unknown[] };
      expect(ctx.recent_messages).toHaveLength(10);
    });
  });

  describe('clearHistory', () => {
    it('removes all messages', () => {
      saveMessage('user', 'hello');
      saveMessage('assistant', 'world');
      clearHistory();
      expect(getMessages()).toHaveLength(0);
    });

    it('can be called on an empty store without error', () => {
      expect(() => clearHistory()).not.toThrow();
    });
  });
});
