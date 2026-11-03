import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VirtualFileSystem } from '../src/packages/core/filesystem.js';

const storage = () => { const values = new Map(); globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) }; };
const names = (fs, pattern) => fs.search(pattern, 'C:\\S').map(n => n.path.slice(5)).sort();

test('Find matches a wildcard pattern against the whole name', async () => {
    storage();
    const fs = await new VirtualFileSystem().init();
    fs.mkdir('C:\\S');
    for (const name of ['notes.txt', 'notes.txt.bak', 'banana.doc', 'apple.txt', 'README', 'page.html'])
        fs.write('C:\\S\\' + name, 'x');
    assert.deepEqual(names(fs, '*.txt'), ['apple.txt', 'notes.txt']);
    assert.deepEqual(names(fs, 'a*'), ['apple.txt']);
    assert.deepEqual(names(fs, '?pple.txt'), ['apple.txt']);
    assert.deepEqual(names(fs, 'README.*'), ['README']);
    assert.equal(names(fs, '*.*').length, 6, '*.* still finds every name, with or without an extension');
    assert.deepEqual(names(fs, 'note'), ['notes.txt', 'notes.txt.bak'], 'a plain name is still found anywhere');
});

test('the Internet Explorer home page still lists .html documents', () => {
    const source = readFileSync(new URL('../src/packages/apps/multimedia.js', import.meta.url), 'utf8');
    assert.match(source, /s\.fs\.search\('\*\.htm\*'\)/);
});
