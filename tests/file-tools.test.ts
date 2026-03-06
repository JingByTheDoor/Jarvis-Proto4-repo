import * as fs from 'fs';
import * as path from 'path';
import { fileRead, fileWrite, fileList, fileDelete } from '../src/main/tools/file-tools';

const TMP_DIR = path.join(__dirname, '..', '.tmp', 'test-file-tools');

describe('file-tools', () => {
  beforeAll(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  describe('fileWrite + fileRead', () => {
    it('writes and reads a file', () => {
      const fp = path.join(TMP_DIR, 'test.txt');
      const writeResult = fileWrite(fp, 'hello world');
      expect(writeResult.ok).toBe(true);
      expect(writeResult.artifacts).toContain(path.resolve(fp));

      const readResult = fileRead(fp);
      expect(readResult.ok).toBe(true);
      expect(readResult.output).toBe('hello world');
    });
  });

  describe('fileRead', () => {
    it('returns error for missing file', () => {
      const result = fileRead(path.join(TMP_DIR, 'nonexistent.txt'));
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Not found');
    });
  });

  describe('fileList', () => {
    it('lists files in a directory', () => {
      fileWrite(path.join(TMP_DIR, 'a.txt'), 'a');
      fileWrite(path.join(TMP_DIR, 'b.txt'), 'b');
      const result = fileList(TMP_DIR);
      expect(result.ok).toBe(true);
      const entries = result.output as { name: string; isDirectory: boolean }[];
      const names = entries.map((e) => e.name);
      expect(names).toContain('a.txt');
      expect(names).toContain('b.txt');
    });

    it('returns error for missing directory', () => {
      const result = fileList(path.join(TMP_DIR, 'no-dir'));
      expect(result.ok).toBe(false);
    });
  });

  describe('fileDelete', () => {
    it('deletes an existing file', () => {
      const fp = path.join(TMP_DIR, 'to-delete.txt');
      fileWrite(fp, 'delete me');
      const result = fileDelete(fp);
      expect(result.ok).toBe(true);
      expect(fs.existsSync(fp)).toBe(false);
    });

    it('returns error for missing file', () => {
      const result = fileDelete(path.join(TMP_DIR, 'no-such.txt'));
      expect(result.ok).toBe(false);
    });
  });
});
