import test from 'node:test';
import assert from 'node:assert/strict';
import { VirtualFileSystem } from '../src/packages/core/filesystem.js';

const storage = () => { const values = new Map(); globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) }; };

test('a case-only move keeps the stored case of the folders above it', async () => {
    storage();
    const fs = await new VirtualFileSystem().init();
    fs.mkdir('C:\\My Docs');
    fs.write('C:\\My Docs\\note.txt', 'n');
    const moved = fs.move('C:\\My Docs\\note.txt', 'c:\\my docs\\NOTE.txt');
    assert.equal(moved, 'C:\\My Docs\\NOTE.txt');
    assert.equal(fs.get('C:\\My Docs\\note.txt').path, 'C:\\My Docs\\NOTE.txt');
});

test('a case-only folder move renames the folder and its children under the stored parent', async () => {
    storage();
    const fs = await new VirtualFileSystem().init();
    fs.mkdir('C:\\Outer');
    fs.mkdir('C:\\Outer\\Inner');
    fs.write('C:\\Outer\\Inner\\a.txt', 'a');
    fs.move('C:\\Outer\\Inner', 'c:\\outer\\INNER');
    assert.equal(fs.get('C:\\Outer\\Inner').path, 'C:\\Outer\\INNER');
    assert.equal(fs.get('C:\\Outer\\Inner\\a.txt').path, 'C:\\Outer\\INNER\\a.txt');
    assert.equal(fs.get('C:\\Outer').path, 'C:\\Outer');
});
