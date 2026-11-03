import test from 'node:test';
import assert from 'node:assert/strict';
import { VirtualFileSystem } from '../src/packages/core/filesystem.js';
import { DosEngine } from '../src/packages/core/dos-engine.js';

const storage = () => { const values = new Map(); globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) }; };
const session = async () => {
    storage();
    const fs = await new VirtualFileSystem().init();
    const dos = new DosEngine(fs);
    return { fs, dos, run: async line => (await dos.execute(line)).output };
};

test('> NUL discards output, > CON keeps it on screen and < NUL reads nothing', async () => {
    const { fs, run } = await session();
    assert.equal(await run('ECHO hidden > NUL'), '');
    assert.equal(await run('DIR /B >> c:/nul.txt'), '');
    assert.equal(fs.exists('C:\\NUL'), false);
    assert.equal(await run('ECHO shown > CON'), 'shown');
    assert.equal(await run('SORT < NUL'), '');
});

test('a batch file hands ECHO back to the prompt as it found it', async () => {
    const { fs, run } = await session();
    fs.write('C:\\QUIET.BAT', '@ECHO OFF\r\nECHO done');
    fs.write('C:\\LOUD.BAT', 'ECHO second');
    assert.equal(await run('QUIET'), 'done');
    assert.equal(await run('ECHO'), 'ECHO is on.');
    assert.equal(await run('LOUD'), 'C:\\>ECHO second\nsecond');
});

test('REN stars copy the stem or the extension they stand in for', async () => {
    const { fs, run } = await session();
    fs.mkdir('C:\\R');
    fs.write('C:\\R\\a.txt', 'a');
    fs.write('C:\\R\\NOEXT', 'n');
    assert.equal(await run('REN C:\\R\\a.txt b.*'), '');
    assert.equal(fs.get('C:\\R\\b.txt')?.path, 'C:\\R\\b.txt');
    assert.equal(await run('REN C:\\R\\NOEXT *.*'), '');
    assert.equal(fs.get('C:\\R\\NOEXT')?.path, 'C:\\R\\NOEXT');
    assert.equal(await run('REN C:\\R\\b.txt c.'), '');
    assert.ok(fs.exists('C:\\R\\c'));
});

test('CD.., CD\\ and DIR/B work without a space after the command', async () => {
    const { fs, dos, run } = await session();
    fs.mkdir('C:\\R');
    fs.mkdir('C:\\R\\S');
    assert.equal(await run('CD\\R\\S'), '');
    assert.equal(dos.cwd, 'C:\\R\\S');
    assert.equal(await run('CD..'), '');
    assert.equal(dos.cwd, 'C:\\R');
    assert.equal(await run('DIR/B'), 'S');
    assert.equal(await run('CD\\'), '');
    assert.equal(dos.cwd, 'C:\\');
    assert.match(await run('TREE.BAT'), /Bad command/);
});
