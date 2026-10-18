import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { installDom } from './dom-shim.mjs';

installDom();
register('./win95-resolver.mjs', import.meta.url);
const { nameError, VirtualFileSystem } = await import('../src/packages/core/filesystem.js');
const { translateText } = await import('../src/packages/core/i18n.js');
const { dataText, infoGrid } = await import('../src/packages/ui/dom.js');
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

test('a host name whose "extension" is enormous is clamped, not stretched', async () => {
    storage();
    const s = {
        errors: [], messages: [], fs: new VirtualFileSystem(), clipboard: null,
        ui: { error: e => s.errors.push(String(e?.message || e)), message: async (...a) => { s.messages.push(a); return 'OK'; }, prompt: async () => null, file: async () => null }
    };
    await s.fs.init();
    const files = createFileActions(s);
    await files.importFiles([{ name: `a.${'b'.repeat(300)}`, size: 4, type: 'text/plain', text: async () => 'data' }], 'C:\\My Documents');
    assert.deepEqual(s.errors, [], 'the clamp does not hand the cap back to the file system as a rejection');
    const kept = s.fs.list('C:\\My Documents').map(n => n.path.split('\\').pop()).find(n => n.startsWith('a.'));
    assert.ok(kept, 'the file is there');
    assert.ok(kept.length <= 255, `cut to ${kept.length} characters`);
});

test('a user name is data, so the dictionary walks past it', () => {
    const owner = dataText('Printers');
    assert.equal(owner.textContent, 'Printers', 'the name is the text of the cell');
    assert.equal(owner.getAttribute('data-i18n-skip'), '', 'and it carries the marker installI18n honours');
    const grid = infoGrid([['Registered to:', owner], ['Version', '1.0.0']]);
    assert.equal(grid.children[1], owner, 'infoGrid uses a given node as the value cell');
    assert.equal(grid.children[3].textContent, '1.0.0', 'plain values still become text cells');
    assert.ok(!/data-i18n-skip/.test(grid.children[3].outerHTML ?? ''), 'and they are still translated');
    /* The two ends of the contract live in different files, so pin them together. */
    const i18nSource = readFileSync(new URL('../src/packages/core/i18n.js', import.meta.url), 'utf8');
    assert.match(i18nSource, /SKIP_SELECTOR[\s\S]{0,300}'\[data-i18n-skip\]'/, 'the walker skips marked nodes');
    /* The name itself stays translatable for the chrome that uses it as a label. */
    assert.equal(translateText('Windows User', 'zh'), 'Windows 用户');
});

test('every owner default is the same name, in every corner of the desktop', () => {
    const sites = ['../src/main.js', '../src/packages/apps/control-panel.js', '../src/packages/apps/multimedia.js', '../src/packages/games/apps.js', '../src/packages/apps/utilities.js'];
    for (const rel of sites) {
        const source = readFileSync(new URL(rel, import.meta.url), 'utf8');
        assert.match(source, /get\('owner', 'Windows User'\)/, `${rel} falls back to the account name`);
        assert.doesNotMatch(source, /get\('owner', 'You'\)/, `${rel} no longer defaults to a dictionary word`);
    }
    assert.equal(sites.length, 5, 'the About box, the property sheet, the inbox, the cards table and the registry view');
});
