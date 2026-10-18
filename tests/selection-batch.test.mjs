import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * A selection can hold a folder and something inside it. Acting on the folder
 * carries the children with it, so the batch must not try the children again
 * afterwards: deleting used to fail on the file that had just travelled into
 * the Recycle Bin inside its parent, and copying made a second copy of it.
 */
installDom();
register('./win95-resolver.mjs', import.meta.url);
const { VirtualFileSystem } = await import('../src/packages/core/filesystem.js');
const { createFileActions } = await import('../src/packages/apps/explorer.js');

const storage = () => {
    const values = new Map();
    globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
};
const makeSystem = answer => {
    const errors = [];
    return {
        errors,
        fs: new VirtualFileSystem(),
        clipboard: null,
        ui: {
            error: e => errors.push(String(e?.message || e)),
            message: async () => answer ?? 'Yes',
            prompt: async () => null,
            file: async () => null,
        },
    };
};
const made = async answer => {
    storage();
    const s = makeSystem(answer);
    await s.fs.init();
    s.fs.mkdir('C:\\Proj');
    s.fs.write('C:\\Proj\\a.txt', 'a');
    s.fs.write('C:\\Proj\\b.txt', 'b');
    s.fs.mkdir('C:\\Dest');
    return s;
};

test('deleting a folder together with a file inside it reports no error', async () => {
    const s = await made();
    await createFileActions(s).remove(['C:\\Proj', 'C:\\Proj\\a.txt']);
    assert.deepEqual(s.errors, [], 'the file travelled with its folder, so it is not deleted twice');
    assert.equal(s.fs.exists('C:\\Proj'), false);
    assert.deepEqual(s.fs.list('C:\\Recycled').map(n => n.path), ['C:\\Recycled\\Proj'], 'one entry, not two');
});

test('cutting a folder together with a file inside it moves one folder', async () => {
    const s = await made();
    const files = createFileActions(s);
    s.clipboard = { type: 'files', paths: ['C:\\Proj', 'C:\\Proj\\a.txt'], cut: true };
    files.paste('C:\\Dest');
    assert.deepEqual(s.errors, []);
    assert.deepEqual(s.fs.list('C:\\Dest').map(n => n.path), ['C:\\Dest\\Proj']);
    assert.equal(s.fs.read('C:\\Dest\\Proj\\a.txt'), 'a');
    assert.equal(s.fs.exists('C:\\Proj'), false);
});

test('copying a folder together with a file inside it does not duplicate the file', async () => {
    const s = await made();
    const files = createFileActions(s);
    s.clipboard = { type: 'files', paths: ['C:\\Proj', 'C:\\Proj\\a.txt'], cut: false };
    files.paste('C:\\Dest');
    assert.deepEqual(s.errors, []);
    assert.deepEqual(s.fs.list('C:\\Dest').map(n => n.path), ['C:\\Dest\\Proj'], 'the file arrives once, inside the copy');
    assert.equal(s.fs.read('C:\\Dest\\Proj\\a.txt'), 'a');
});

test('an unrelated file in the same selection is still handled', async () => {
    const s = await made();
    s.fs.write('C:\\loose.txt', 'x');
    await createFileActions(s).remove(['C:\\Proj', 'C:\\Proj\\a.txt', 'C:\\loose.txt']);
    assert.deepEqual(s.errors, []);
    assert.deepEqual(s.fs.list('C:\\Recycled').map(n => n.path).sort(), ['C:\\Recycled\\Proj', 'C:\\Recycled\\loose.txt']);
});

test('a file that vanished with its parent is named, not just "not found"', async () => {
    storage();
    const s = makeSystem('Yes');
    await s.fs.init();
    s.fs.write('C:\\Windows\\gone.txt', 'x');
    s.fs.remove('C:\\Windows\\gone.txt');
    assert.throws(() => s.fs.remove('C:\\Windows\\gone.txt'), /already moved with its parent folder/,
        'a stale path from a batch says why it is gone');
});

test('Down with nothing selected lands on the first item, not the last of row one', async () => {
    /* The starting index used the column count before it was declared, which
       threw on the first keypress in a fresh window. The shim has no layout and
       no attribute selectors, so the selection is read from the status bar -
       the same place the window reports it - after giving the list a width. */
    const { explorer } = await import('../src/packages/apps/explorer.js');
    storage();
    const fs = await new VirtualFileSystem().init();
    for (const name of ['a.txt', 'b.txt', 'c.txt', 'd.txt'])
        fs.write('C:\\Windows\\' + name, name);
    const element = document.createElement('div');
    const statuses = [];
    const win = {
        title: '', titleRaw: false, element,
        get body() { return element; },
        closed: false, onClosed: [], setMenu() { }, status: text => statuses.push(text), close() { },
        setTitle(value, options = {}) { this.title = value; this.titleRaw = !!options.raw; },
    };
    const s = {
        fs, settings: { get: (key, fallback) => fallback, set() { }, addEventListener() { }, removeEventListener() { } },
        wm: { create: () => win },
        ui: { message: async () => 'OK', prompt: async () => null, error() { }, file: async () => null },
        files: { copy() { }, paste() { }, remove() { }, rename() { }, newFolder() { }, newText() { } },
        launch() { }, open() { }, about() { }, clipboard: {},
    };
    document.body.append(element);
    explorer(s, { path: 'C:\\Windows', view: 'large' });
    const list = element.querySelector('.file-list');
    list.clientWidth = 500;
    let threw;
    try {
        element.dispatchEvent({ type: 'keydown', key: 'ArrowDown', target: element, preventDefault() { } });
    }
    catch (error) {
        threw = error;
    }
    assert.equal(threw, undefined, `the key handler throws: ${threw?.message}`);
    assert.match(statuses.at(-1), /^1 object\(s\) selected/, 'one item is selected');
    /* The old code stepped from index -1, so an empty selection landed on the
       last item of the first row. Naming the item is what separates the two. */
    assert.equal(statuses.at(-1), '1 object(s) selected     0 bytes', 'the first item is the one selected');
});
