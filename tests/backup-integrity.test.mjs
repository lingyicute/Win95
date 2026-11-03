import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';
import { VirtualFileSystem, parseVolumeBackup } from '../src/packages/core/filesystem.js';

installDom();
register('./win95-resolver.mjs', import.meta.url);
const { backup } = await import('../src/packages/apps/utilities.js');

function storage() {
    const values = new Map();
    globalThis.localStorage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
}

const root = () => ['c:\\', { path: 'C:\\', type: 'folder' }];
const entry = (path, type = 'file', content = 'data') => [path.toLowerCase(), { path, type, ...(type === 'file' ? { content } : {}) }];
const archive = nodes => ({ format: 'win95-volume', version: 1, nodes });

async function selectBackup(fs, data, answer = 'Yes') {
    let finish;
    const completed = new Promise(resolve => { finish = resolve; });
    const prompts = [];
    const win = { body: document.createElement('div'), status() {}, close() {} };
    const s = {
        fs,
        wm: { create: () => win },
        ui: {
            message: async (text, title) => {
                prompts.push(title);
                if (title === 'Restore Backup') return answer;
                finish({ prompts });
                return 'OK';
            },
            error: error => finish({ error, prompts })
        }
    };
    backup(s);
    const create = document.createElement;
    document.createElement = tag => {
        const node = create(tag);
        if (tag === 'input') {
            node.files = [{ text: async () => JSON.stringify(data) }];
            node.click = () => node.dispatchEvent({ type: 'change' });
        }
        return node;
    };
    const restore = [...win.body.querySelectorAll('button')].find(button => button.textContent === 'Restore…');
    restore.dispatchEvent({ type: 'click' });
    document.createElement = create;
    if (answer !== 'Yes') {
        await new Promise(resolve => setImmediate(resolve));
        return { prompts };
    }
    return completed;
}

test('a real exported volume round-trips without losing file or recycle metadata', async () => {
    storage();
    const fs = await new VirtualFileSystem().init();
    fs.write('C:\\My Documents\\memo.txt', 'hello', 'text/plain');
    fs.get('C:\\My Documents\\memo.txt').hidden = true;
    fs.remove('C:\\My Documents\\memo.txt');
    const decoded = parseVolumeBackup(JSON.parse(fs.export()));
    const recycled = decoded.get('c:\\recycled\\memo.txt');
    assert.equal(recycled.content, 'hello');
    assert.equal(recycled.originalPath, 'C:\\My Documents\\memo.txt');
    assert.equal(recycled.hidden, true);
    assert.equal(decoded.size, fs.nodes.size);
});

test('backups reject duplicate case-insensitive paths rather than silently discarding an entry', () => {
    const nodes = [root(), entry('C:\\Note.txt', 'file', 'first'), entry('C:\\NOTE.TXT', 'file', 'second')];
    assert.throws(() => parseVolumeBackup(archive(nodes)), /duplicate/i);
});

test('backups reject file drive roots, inconsistent keys, bad metadata and missing parents', () => {
    const invalid = [
        archive([entry('C:\\', 'file')]),
        archive([root(), entry('D:\\', 'file')]),
        archive([root(), ['c:\\other.txt', { path: 'C:\\real.txt', type: 'file', content: 'x' }]]),
        archive([root(), ['c:\\orphan\\x', { path: 'C:\\orphan\\x', type: 'file', content: 'x' }]]),
        archive([root(), ['c:\\x', { path: 'C:\\x', type: 'file', content: 'x', originalPath: {} }]])
    ];
    for (const data of invalid)
        assert.throws(() => parseVolumeBackup(data));
});

test('the restore dialog rejects malformed archives before confirmation or mutation', async () => {
    storage();
    const fs = await new VirtualFileSystem().init();
    fs.write('C:\\My Documents\\keep.txt', 'do not erase');
    const before = fs.export();
    const revision = fs.revision;
    const result = await selectBackup(fs, archive([entry('C:\\', 'file')]));
    assert.ok(result.error);
    assert.deepEqual(result.prompts, []);
    assert.equal(fs.export(), before);
    assert.equal(fs.revision, revision);
});

test('a valid backup restores after confirmation and cancelling leaves the volume alone', async () => {
    storage();
    const fs = await new VirtualFileSystem().init();
    const before = fs.export();
    const data = archive([root(), entry('C:\\restored.txt', 'file', 'restored')]);
    const cancelled = await selectBackup(fs, data, 'No');
    assert.deepEqual(cancelled.prompts, ['Restore Backup']);
    assert.equal(fs.export(), before);
    const accepted = await selectBackup(fs, data);
    assert.deepEqual(accepted.prompts, ['Restore Backup', 'Microsoft Backup']);
    assert.equal(fs.read('C:\\restored.txt'), 'restored');
    const reopened = await new VirtualFileSystem().init();
    assert.equal(reopened.read('C:\\restored.txt'), 'restored');
});
