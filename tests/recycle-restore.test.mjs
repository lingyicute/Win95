import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDom } from './dom-shim.mjs';

/**
 * Restoring an item from the Recycle Bin has to survive what the user did in the meantime: the
 * folder it came from may be gone, and something may have taken its name. Both used to end in an
 * error the menu threw away, leaving the item in the bin and the click looking like nothing happened.
 */
installDom();
register('./win95-resolver.mjs', import.meta.url);
const { NAME_LIMIT, baseName, nameError, VirtualFileSystem } = await import('../src/packages/core/filesystem.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const storage = () => {
    const values = new Map();
    globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
    return values;
};
const volume = async () => {
    storage();
    return await new VirtualFileSystem().init();
};

const binOf = fs => fs.list('C:\\Recycled').map(n => n.path);
const at = (n, ext = '.txt') => 'q'.repeat(n - ext.length) + ext;

test('restoring recreates a folder the user deleted in the meantime', async () => {
    const fs = await volume();
    fs.mkdir('C:\\My Documents\\Sub');
    fs.write('C:\\My Documents\\Sub\\note.txt', 'keep me');
    fs.remove('C:\\My Documents\\Sub\\note.txt');
    fs.remove('C:\\My Documents\\Sub');
    assert.equal(fs.exists('C:\\My Documents\\Sub'), false, 'the folder is gone as well');
    const orphan = binOf(fs).find(p => baseName(p).toLowerCase() === 'note.txt');
    const to = fs.restore(orphan);
    assert.equal(to, 'C:\\My Documents\\Sub\\note.txt', 'the file goes back where it came from');
    assert.equal(fs.read(to), 'keep me', 'with its content');
    assert.equal(fs.get('C:\\My Documents\\Sub').type, 'folder', 'the folder came back too');
    assert.equal(binOf(fs).includes(orphan), false, 'and it left the bin');
});

test('restore refuses rather than replacing a file standing where a folder should be', async () => {
    const fs = await volume();
    fs.mkdir('C:\\My Documents\\Sub');
    fs.write('C:\\My Documents\\Sub\\note.txt', 'data');
    fs.remove('C:\\My Documents\\Sub\\note.txt');
    fs.remove('C:\\My Documents\\Sub');
    fs.write('C:\\My Documents\\Sub', 'I am a file now');
    const orphan = binOf(fs).find(p => baseName(p).toLowerCase() === 'note.txt');
    assert.throws(() => fs.restore(orphan), /destination folder does not exist/, 'the blocked path is reported, not paved over');
    assert.equal(fs.read('C:\\My Documents\\Sub'), 'I am a file now', 'and the file that got in the way is intact');
    assert.equal(binOf(fs).includes(orphan), true, 'the item stays in the bin for another try');
});

test('the Recycle Bin menu reports a failed restore like every other action does', async () => {
    const source = readFileSync(path.join(root, 'src/packages/apps/explorer.js'), 'utf8');
    const start = source.indexOf("label: 'Restore'");
    assert.notEqual(start, -1, 'the Restore action exists');
    // 截到下一个菜单项为止，而不是猜一个窗口宽度
    const action = source.slice(start, source.indexOf("label: 'Delete'", start));
    assert.match(action, /try \{/, 'it does not let an error escape into the menu');
    assert.match(action, /s\.ui\.error\(e, w\)/, 'and shows it the way rename and delete do');
});
