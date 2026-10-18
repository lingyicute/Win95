import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

installDom();
register('./win95-resolver.mjs', import.meta.url);
const { VirtualFileSystem } = await import('../src/packages/core/filesystem.js');
const { createFileActions } = await import('../src/packages/apps/explorer.js');

const storage = () => {
    const values = new Map();
    globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
    return values;
};

const makeSystem = () => {
    const errors = [], messages = [];
    return {
        errors,
        messages,
        fs: new VirtualFileSystem(),
        clipboard: null,
        ui: {
            error: e => errors.push(String(e?.message || e)),
            message: async (...args) => { messages.push(args); return 'OK'; },
            prompt: async () => null,
            file: async () => null
        }
    };
};

test('pasting a cut item into its own folder leaves it alone instead of renaming it', async () => {
    storage();
    const s = makeSystem();
    await s.fs.init();
    s.fs.write('C:\\My Documents\\note.txt', 'x');
    const files = createFileActions(s);
    s.clipboard = { type: 'files', paths: ['C:\\My Documents\\note.txt'], cut: true };
    files.paste('C:\\My Documents');
    assert.ok(s.fs.exists('C:\\My Documents\\note.txt'), 'the file keeps its name');
    assert.equal(s.fs.list('C:\\My Documents').filter(n => /note/i.test(n.path)).length, 1, 'no " (2)" twin appears');
    assert.equal(s.clipboard, null);
});

test('pasting a cut item into another folder still moves it', async () => {
    storage();
    const s = makeSystem();
    await s.fs.init();
    s.fs.write('C:\\My Documents\\note.txt', 'x');
    const files = createFileActions(s);
    s.clipboard = { type: 'files', paths: ['C:\\My Documents\\note.txt'], cut: true };
    files.paste('C:\\Windows');
    assert.ok(!s.fs.exists('C:\\My Documents\\note.txt'));
    assert.ok(s.fs.exists('C:\\Windows\\note.txt'));
});

test('a cut-and-pasted folder keeps a dotted name intact when the target name is taken', async () => {
    storage();
    const s = makeSystem();
    await s.fs.init();
    s.fs.mkdir('C:\\My Documents\\My.Stuff');
    s.fs.mkdir('C:\\Windows\\My.Stuff');
    const files = createFileActions(s);
    s.clipboard = { type: 'files', paths: ['C:\\My Documents\\My.Stuff'], cut: true };
    files.paste('C:\\Windows');
    assert.ok(s.fs.exists('C:\\Windows\\My.Stuff (2)'), 'the twin is numbered after the full name');
    assert.ok(!s.fs.exists('C:\\Windows\\My (2).Stuff'));
});

test('importing keeps going past a failing file and mangles hostile host names', async () => {
    storage();
    const s = makeSystem();
    await s.fs.init();
    const files = createFileActions(s);
    const fake = (name, text) => ({ name, size: 4, type: 'text/plain', text: typeof text === 'function' ? text : async () => text ?? 'data' });
    await files.importFiles([
        fake('good.txt', 'one'),
        fake('bad:name. ', 'two'),
        fake('broken.txt', () => { throw new Error('boom'); }),
        fake('tail.txt', 'three')
    ], 'C:\\My Documents');
    assert.ok(s.fs.exists('C:\\My Documents\\good.txt'));
    assert.ok(s.fs.exists('C:\\My Documents\\bad_name'), 'hostile characters are replaced and trailing dots stripped');
    assert.ok(s.fs.exists('C:\\My Documents\\tail.txt'), 'the file after the failure still imports');
    assert.ok(!s.fs.exists('C:\\My Documents\\broken.txt'));
    assert.equal(s.errors.length, 1);
    assert.match(s.errors[0], /boom/);
});

test('new folder, new text and rename share one name validator', async () => {
    storage();
    const s = makeSystem();
    await s.fs.init();
    const files = createFileActions(s);

    s.ui.prompt = async () => '..\\hacked';
    await files.newFolder('C:\\My Documents');
    assert.equal(s.fs.exists('C:\\hacked'), false, 'a .. name cannot climb out of the folder');
    assert.match(s.messages.at(-1)[0], /cannot contain/, 'the charset message explains the refusal');

    s.ui.prompt = async () => '   ';
    await files.newFolder('C:\\My Documents');
    assert.match(s.messages.at(-1)[0], /^Please type a name\.$/, 'a blank name gets its own message');

    s.ui.prompt = async () => 'Sub';
    await files.newFolder('C:\\My Documents');
    assert.equal(s.fs.exists('C:\\My Documents\\Sub'), true, 'a good name still creates the folder');

    s.fs.write('C:\\My Documents\\a.txt', 'x');
    s.ui.prompt = async () => '...';
    await files.rename('C:\\My Documents\\a.txt');
    assert.match(s.messages.at(-1)[0], /^The file name is not valid\.$/, 'a dot run is refused with the right words');
    assert.equal(s.fs.exists('C:\\My Documents\\a.txt'), true, 'and the file keeps its old name');

    s.ui.prompt = async () => '..\\evil.txt';
    await files.newText('C:\\My Documents');
    assert.equal(s.fs.exists('C:\\evil.txt'), false, 'new text documents get the same guard');
});
