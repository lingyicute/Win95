import test from 'node:test';
import assert from 'node:assert/strict';
import { DosEngine, normalizeDosPath } from '../src/packages/core/dos-engine.js';

const parent = path => path.lastIndexOf('\\') <= 2 ? path.slice(0, 3) : path.slice(0, path.lastIndexOf('\\'));
class MemoryFS {
    constructor() { this.nodes = new Map(); this.nodes.set('c:\\', { path: 'C:\\', type: 'folder' }); }
    norm(path) { return normalizeDosPath(path); }
    get(path) { return this.nodes.get(this.norm(path).toLowerCase()); }
    exists(path) { return !!this.get(path); }
    list(path) { const resolved = this.norm(path); return [...this.nodes.values()].filter(n => n.path !== resolved && parent(n.path).toLowerCase() === resolved.toLowerCase()); }
    read(path) { const n = this.get(path); if (!n || n.type !== 'file') throw Error('File not found'); return n.content; }
    write(path, content, mime = 'text/plain') { path = this.norm(path); if (!this.exists(parent(path))) throw Error('Path not found'); this.nodes.set(path.toLowerCase(), { ...this.get(path), path, type: 'file', content, mime }); }
    mkdir(path) { path = this.norm(path); if (this.exists(path)) throw Error('Directory already exists'); if (!this.exists(parent(path))) throw Error('Path not found'); this.nodes.set(path.toLowerCase(), { path, type: 'folder' }); }
    copy(from, to) { from = this.norm(from); to = this.norm(to); const n = this.get(from); if (!n) throw Error('File not found'); if (this.exists(to)) throw Error('Destination exists'); this.nodes.set(to.toLowerCase(), { ...n, path: to }); }
    move(from, to) { from = this.norm(from); to = this.norm(to); const n = this.get(from); if (!n) throw Error('File not found'); if (this.exists(to)) throw Error('Destination exists'); const entries = [...this.nodes.values()].filter(e => e.path.toLowerCase() === from.toLowerCase() || e.path.toLowerCase().startsWith(from.toLowerCase() + '\\')); for (const e of entries) { this.nodes.delete(e.path.toLowerCase()); this.nodes.set((to + e.path.slice(from.length)).toLowerCase(), { ...e, path: to + e.path.slice(from.length) }); } }
    remove() { }
    size(path) { return new TextEncoder().encode(this.read(path)).length; }
    flush() { }
}

const makeDos = () => {
    const fs = new MemoryFS();
    for (const p of ['C:\\TEST', 'C:\\TEST\\SUB', 'C:\\TARGET']) fs.mkdir(p);
    fs.write('C:\\TEST\\ONE.TXT', '1');
    fs.write('C:\\TEST\\TWO.TXT', '2');
    const dos = new DosEngine(fs, {});
    return { fs, dos };
};

test('COPY with a wildcard copies the files and skips the folders', async () => {
    const { fs, dos } = makeDos();
    await dos.execute('CD C:\\TEST');
    const out = (await dos.execute('COPY * C:\\TARGET')).output;
    assert.equal(out, '2 file(s) copied.');
    assert.deepEqual(fs.list('C:\\TARGET').map(n => n.path).sort(), ['C:\\TARGET\\ONE.TXT', 'C:\\TARGET\\TWO.TXT']);
});

test('MOVE with a wildcard still moves the folders along', async () => {
    const { fs, dos } = makeDos();
    await dos.execute('CD C:\\TEST');
    const out = (await dos.execute('MOVE * C:\\TARGET')).output;
    assert.equal(out, '3 file(s) moved.');
    assert.deepEqual(fs.list('C:\\TARGET').map(n => n.path).sort(), ['C:\\TARGET\\ONE.TXT', 'C:\\TARGET\\SUB', 'C:\\TARGET\\TWO.TXT']);
});
