import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

installDom();
register('./win95-resolver.mjs', import.meta.url);
const { nameError, VirtualFileSystem } = await import('../src/packages/core/filesystem.js');
const { translateText } = await import('../src/packages/core/i18n.js');
const { createFileActions } = await import('../src/packages/apps/explorer.js');

const storage = () => {
    const values = new Map();
    globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
    return values;
};

test('the reserved Windows device names stay out of the volume', () => {
    for (const name of ['CON', 'con', 'CON.txt', 'PRN', 'AUX', 'NUL', 'nul.log', 'COM1', 'LPT9'])
        assert.match(nameError(name), /not valid/, `${name} is a device, not a file name`);
    for (const name of ['CONFIG.SYS', 'CONSOLE.TXT', 'NULL.DAT', 'AUTOEXEC.BAT', 'COM10.LOG', 'AUXILIARY', 'RECONNECT.BAT'])
        assert.equal(nameError(name), null, `${name} only begins with a reserved stem`);
});

test('the 255 character cap is a name limit, not a reason to lose the extension', () => {
    assert.equal(nameError('x'.repeat(255)), null, 'the limit is inclusive');
    assert.equal(nameError('x'.repeat(256)), 'A name can be at most 255 characters.');
    assert.equal(nameError(`${'x'.repeat(300)}   `), 'A name can be at most 255 characters.', 'padding does not hide an over-long name');
    assert.equal(nameError('   '), 'Please type a name.', 'a blank name is still a blank name');
});

test('the volume itself refuses what the dialogs refuse', async () => {
    storage();
    const fs = await new VirtualFileSystem().init();
    assert.throws(() => fs.write('C:\\My Documents\\CON', 'x'), /not valid/);
    assert.throws(() => fs.write('C:\\My Documents\\NUL.txt', 'x'), /not valid/);
    assert.throws(() => fs.mkdir('C:\\My Documents\\' + 'y'.repeat(300)), /at most 255/);
    fs.write('C:\\My Documents\\CONFIG.SYS', 'x');
    assert.ok(fs.exists('C:\\My Documents\\CONFIG.SYS'), 'a name that merely starts with CON is fine');
});

test('importing a host file with an enormous name fits the cap and keeps its extension', async () => {
    storage();
    const s = {
        errors: [], messages: [], fs: new VirtualFileSystem(), clipboard: null,
        ui: { error: e => s.errors.push(String(e?.message || e)), message: async (...a) => { s.messages.push(a); return 'OK'; }, prompt: async () => null, file: async () => null }
    };
    await s.fs.init();
    const files = createFileActions(s);
    const fake = name => ({ name, size: 4, type: 'text/plain', text: async () => 'data' });
    await files.importFiles([fake(`${'a'.repeat(300)}.txt`), fake('note.txt')], 'C:\\My Documents');
    const names = s.fs.list('C:\\My Documents').map(n => n.path.split('\\').pop());
    const big = names.find(n => n.startsWith('aaa'));
    assert.ok(big, 'the long name was imported rather than dropped');
    assert.ok(big.length <= 255, `it fits the cap (${big.length})`);
    assert.ok(big.endsWith('.txt'), 'and it keeps its extension');
    assert.deepEqual(s.errors, [], 'nothing was reported for it');
    assert.ok(names.includes('note.txt'), 'the sibling file still lands');
});

test('the cap is announced in Chinese like every other refusal', () => {
    assert.equal(translateText('A name can be at most 255 characters.', 'zh'), '名称最多 255 个字符。');
    assert.equal(translateText('The file name is not valid.', 'zh'), '文件名无效。');
});
