import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * The desktop and the Recycle Bin are the shell's own folders, but they live on
 * the same volume as everything else, so Explorer can delete or rename them.
 * When that happened the shell asked the volume for a folder that was no longer
 * there, threw on every change, and left the desktop as an empty strip: the
 * icons were cleared before the list that failed. What is read has to survive a
 * missing folder, and the folder itself is the shell's to put back.
 */
installDom();
register('./win95-resolver.mjs', import.meta.url);
const { VirtualFileSystem } = await import('../src/packages/core/filesystem.js');
const { shellFolder } = await import('../src/packages/shell/shell-folders.js');

const values = new Map();
globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };

const volume = async () => {
    /* Every test starts on a fresh volume, not on whatever the last one left
       behind in the shared storage. */
    values.clear();
    const fs = await new VirtualFileSystem().init();
    fs.mkdir('C:\\Windows\\Desktop\\Papers');
    fs.write('C:\\Windows\\Desktop\\note.txt', 'hi');
    fs.write('C:\\Recycled\\old.txt', 'gone');
    return fs;
};

test('a shell folder lists its contents while it is there', async () => {
    const fs = await volume();
    assert.deepEqual(shellFolder(fs, 'C:\\Windows\\Desktop').map(n => n.path), ['C:\\Windows\\Desktop\\Papers', 'C:\\Windows\\Desktop\\note.txt']);
    assert.deepEqual(shellFolder(fs, 'C:\\Recycled').map(n => n.path), ['C:\\Recycled\\old.txt']);
});

test('deleting the desktop folder puts the shell\'s folder back', async () => {
    const fs = await volume();
    fs.remove('C:\\Windows\\Desktop');
    assert.equal(fs.get('C:\\Windows\\Desktop'), undefined, 'the folder really went to the Recycle Bin');
    assert.deepEqual(shellFolder(fs, 'C:\\Windows\\Desktop'), [], 'the shell draws an empty desktop instead of throwing');
    assert.equal(fs.get('C:\\Windows\\Desktop')?.type, 'folder', 'the desktop folder exists again');
    assert.deepEqual(fs.list('C:\\Windows\\Desktop'), [], 'and it is empty');
    assert.equal(fs.get('C:\\Recycled\\Desktop')?.originalPath, 'C:\\Windows\\Desktop', 'the deleted folder is still in the Recycle Bin');
});

test('a folder whose parent is gone does not come back on its own', async () => {
    /* Renaming C:\Windows moves everything under it on purpose. Recreating
       C:\Windows\Desktop would leave an empty Windows folder behind and take
       the desktop away from the folder the user renamed. */
    const fs = await volume();
    fs.rename('C:\\Windows', 'Win');
    assert.deepEqual(shellFolder(fs, 'C:\\Windows\\Desktop'), []);
    assert.equal(fs.get('C:\\Windows'), undefined, 'no stray C:\\Windows is created');
    assert.equal(fs.get('C:\\Win\\Desktop\\note.txt')?.type, 'file', 'the renamed folder kept its contents');
});

test('a volume restored without the Recycle Bin gets one back', async () => {
    /* A backup is checked for parents, not for the shell's own folders: a
       restore may well arrive without a Recycle Bin. */
    const fs = await volume();
    for (const key of [...fs.nodes.keys()])
        if (key === 'c:\\recycled' || key.startsWith('c:\\recycled\\'))
            fs.nodes.delete(key);
    assert.deepEqual(shellFolder(fs, 'C:\\Recycled'), []);
    assert.equal(fs.get('C:\\Recycled')?.type, 'folder', 'the bin exists again');
});

test('a file holding the name is not replaced by a folder', async () => {
    const fs = await volume();
    fs.remove('C:\\Windows\\Desktop', true);
    fs.write('C:\\Windows\\Desktop', 'not a folder');
    assert.deepEqual(shellFolder(fs, 'C:\\Windows\\Desktop'), []);
    assert.equal(fs.get('C:\\Windows\\Desktop').type, 'file', 'the file survives');
});
