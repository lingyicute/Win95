import test from 'node:test';
import assert from 'node:assert/strict';
import { DosEngine, normalizeDosPath } from '../src/packages/core/dos-engine.js';

const parent = path => path.lastIndexOf('\\') <= 2 ? path.slice(0, 3) : path.slice(0, path.lastIndexOf('\\'));
class MemoryFS {
  constructor() { this.nodes = new Map(); this.nodes.set('c:\\', { path: 'C:\\', type: 'folder' }); this.flushCount = 0; }
  norm(path) { return normalizeDosPath(path); }
  get(path) { return this.nodes.get(this.norm(path).toLowerCase()); }
  exists(path) { return !!this.get(path); }
  list(path) { const resolved = this.norm(path); return [...this.nodes.values()].filter(n => n.path !== resolved && parent(n.path).toLowerCase() === resolved.toLowerCase()); }
  read(path) { const n = this.get(path); if (!n || n.type !== 'file') throw Error('File not found'); return n.content; }
  write(path, content, mime = 'text/plain') { path = this.norm(path); const old = this.get(path); if (old?.readOnly) throw Error('Access denied'); if (!this.exists(parent(path))) throw Error('Path not found'); this.nodes.set(path.toLowerCase(), { ...old, path, type: 'file', content, mime, modified: new Date().toISOString() }); }
  mkdir(path) { path = this.norm(path); if (this.exists(path)) throw Error('Directory already exists'); if (!this.exists(parent(path))) throw Error('Path not found'); this.nodes.set(path.toLowerCase(), { path, type: 'folder' }); }
  copy(from, to, { overwrite = false } = {}) { from = this.norm(from); to = this.norm(to); const n = this.get(from), dest = this.get(to); if (!n) throw Error('File not found'); if (dest && !overwrite) throw Error('Destination exists'); if (dest && (dest.type !== 'file' || n.type !== 'file')) throw Error('Only files can be replaced'); this.nodes.set(to.toLowerCase(), { ...n, path: to }); }
  move(from, to, { overwrite = false } = {}) { from = this.norm(from); to = this.norm(to); const n = this.get(from), dest = this.get(to); if (!n) throw Error('File not found'); if (dest && !overwrite) throw Error('Destination exists'); if (dest && (dest.type !== 'file' || n.type !== 'file')) throw Error('Only files can be replaced'); const entries = [...this.nodes.values()].filter(n => n.path.toLowerCase() === from.toLowerCase() || n.path.toLowerCase().startsWith(from.toLowerCase() + '\\')); for (const e of entries) { this.nodes.delete(e.path.toLowerCase()); const path = to + e.path.slice(from.length); this.nodes.set(path.toLowerCase(), { ...e, path }); } }
  remove(path, recursive) { path = this.norm(path); const n = this.get(path); if (!n) throw Error('File not found'); if (n.readOnly) throw Error('Access denied'); const children = [...this.nodes.values()].filter(e => e.path.toLowerCase().startsWith(path.toLowerCase() + '\\')); if (children.length && !recursive) throw Error('Directory not empty'); for (const e of children) this.nodes.delete(e.path.toLowerCase()); this.nodes.delete(path.toLowerCase()); }
  size(path) { return new TextEncoder().encode(this.read(path)).length; }
  flush() { this.flushCount++; }
}

const makeRun = () => {
    const fs = new MemoryFS();
    fs.write('C:\\NOTES.TXT', 'ab\r\na^b\r\n');
    const dos = new DosEngine(fs);
    return async line => (await dos.execute(line)).output;
};

test('a caret is literal inside double quotes', async () => {
    const run = makeRun();
    assert.equal(await run('ECHO "a^b"'), '"a^b"');
    assert.equal(await run('ECHO "x ^& y"'), '"x ^& y"');
    assert.equal(await run('FIND "a^b" NOTES.TXT'), '---------- C:\\NOTES.TXT\na^b');
});

test('a caret still escapes the next character outside quotes', async () => {
    const run = makeRun();
    assert.equal(await run('ECHO a ^> b'), 'a > b');
    assert.equal(await run('ECHO "q" ^& r'), '"q" & r');
    assert.equal(await run('ECHO ^"a^b^"'), '"ab"');
});
