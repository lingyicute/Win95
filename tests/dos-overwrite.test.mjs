import test from 'node:test';
import assert from 'node:assert/strict';
import { VirtualFileSystem } from '../src/packages/core/filesystem.js';
import { DosEngine } from '../src/packages/core/dos-engine.js';

async function makeVolume() {
    const storage = new Map();
    globalThis.localStorage = {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: key => storage.delete(key)
    };
    const fs = await new VirtualFileSystem().init();
    return { fs, dos: new DosEngine(fs) };
}

test('MOVE /Y cannot erase the destination when the source is protected', async () => {
    const { fs, dos } = await makeVolume();
    fs.write('C:\\precious.txt', 'keep me');
    const before = fs.export();
    const result = await dos.execute('MOVE /Y C:\\Recycled C:\\precious.txt');
    assert.match(result.output, /system folder cannot be moved/i);
    assert.equal(fs.export(), before);
    assert.equal(fs.read('C:\\precious.txt'), 'keep me');
});

test('MOVE /Y cannot replace a file with a directory', async () => {
    const { fs, dos } = await makeVolume();
    fs.mkdir('C:\\Folder');
    fs.write('C:\\Folder\\child.txt', 'child');
    fs.write('C:\\precious.txt', 'keep me');
    const before = fs.export();
    const result = await dos.execute('MOVE /Y C:\\Folder C:\\precious.txt');
    assert.match(result.output, /replace.*file/i);
    assert.equal(fs.export(), before);
});

test('a failing move leaves an existing destination untouched', async () => {
    const { fs, dos } = await makeVolume();
    fs.write('C:\\source.txt', 'source');
    fs.write('C:\\target.txt', 'target');
    fs.move = () => { throw new Error('simulated failure'); };
    const result = await dos.execute('MOVE /Y C:\\source.txt C:\\target.txt');
    assert.match(result.output, /simulated failure/);
    assert.equal(fs.read('C:\\target.txt'), 'target');
    assert.equal(fs.read('C:\\source.txt'), 'source');
});

test('COPY /Y replaces in one change and discards stale destination attributes', async () => {
    const { fs, dos } = await makeVolume();
    fs.write('C:\\source.txt', 'new', 'text/x-source');
    fs.write('C:\\target.txt', 'old');
    await dos.execute('ATTRIB +H C:\\target.txt');
    const observations = [];
    fs.addEventListener('change', () => observations.push([fs.get('C:\\target.txt')?.content, fs.get('C:\\source.txt')?.content]));
    const result = await dos.execute('COPY /Y C:\\source.txt C:\\target.txt');
    assert.match(result.output, /1 file\(s\) copied/);
    assert.deepEqual(observations, [['new', 'new']]);
    assert.equal(fs.get('C:\\target.txt').mime, 'text/x-source');
    assert.match((await dos.execute('DIR /B C:\\')).output, /target\.txt/i);
});

test('MOVE /Y replaces atomically and preserves source metadata', async () => {
    const { fs, dos } = await makeVolume();
    fs.write('C:\\source.txt', 'new', 'text/x-source');
    fs.get('C:\\source.txt').hidden = true;
    fs.write('C:\\target.txt', 'old');
    const observations = [];
    fs.addEventListener('change', () => observations.push([fs.get('C:\\target.txt')?.content, fs.exists('C:\\source.txt')]));
    assert.match((await dos.execute('MOVE /Y C:\\source.txt C:\\target.txt')).output, /1 file\(s\) moved/);
    assert.deepEqual(observations, [['new', false]]);
    assert.equal(fs.get('C:\\target.txt').mime, 'text/x-source');
    assert.equal(fs.get('C:\\target.txt').hidden, true);
});

test('read-only targets and failed cloning never destroy the destination', async () => {
    const { fs, dos } = await makeVolume();
    fs.write('C:\\source.txt', 'source');
    fs.write('C:\\target.txt', 'target');
    await dos.execute('ATTRIB +R C:\\target.txt');
    assert.match((await dos.execute('COPY /Y C:\\source.txt C:\\target.txt')).output, /read-only/i);
    assert.equal(fs.read('C:\\target.txt'), 'target');
    await dos.execute('ATTRIB -R C:\\target.txt');
    fs.get('C:\\source.txt').uncloneable = () => {};
    assert.throws(() => fs.copy('C:\\source.txt', 'C:\\target.txt', { overwrite: true }));
    assert.equal(fs.read('C:\\target.txt'), 'target');
    assert.equal(fs.read('C:\\source.txt'), 'source');
});
