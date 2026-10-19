import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * A folder can be deleted or renamed from another window while Explorer is
 * showing it. The list quietly fell back to C:\ but the title kept the missing
 * folder's name, so the window said "Scratch" over the contents of the drive -
 * and New Folder, Paste and Delete went to C:\ while the caption disagreed. The
 * window has to follow its folder instead of showing one folder under another
 * folder's name.
 */
installDom();
/* The window redraws on the next frame; run it as a microtask so a test can
   wait for the redraw instead of for a real screen. */
globalThis.requestAnimationFrame = fn => { queueMicrotask(fn); return 0; };
register('./win95-resolver.mjs', import.meta.url);
const { VirtualFileSystem } = await import('../src/packages/core/filesystem.js');
const { explorer } = await import('../src/packages/apps/explorer.js');

const values = new Map();
globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };

const mount = async path => {
    values.clear();
    const fs = await new VirtualFileSystem().init();
    fs.write('C:\\loose.txt', 'x');
    fs.mkdir('C:\\Scratch');
    fs.write('C:\\Scratch\\inside.txt', 'y');
    const element = document.createElement('div');
    document.body.append(element);
    const win = {
        title: '', titleRaw: false, element,
        get body() { return element; },
        closed: false, onClosed: [], setMenu() { }, status() { }, close() { },
        setTitle(value, options = {}) { this.title = value; this.titleRaw = !!options.raw; },
    };
    const s = {
        fs, settings: { get: (k, f) => f, set() { }, addEventListener() { }, removeEventListener() { } },
        wm: { create: () => win },
        ui: { message: async () => 'OK', prompt: async () => null, error() { }, file: async () => null },
        files: { copy() { }, paste() { }, remove() { }, rename() { }, newFolder() { }, newText() { } },
        launch() { }, open() { }, about() { }, clipboard: {},
    };
    const w = explorer(s, { path, view: 'large' });
    return { w, fs, element };
};
const names = element => [...element.querySelectorAll('.file-item')].map(n => n.getAttribute('aria-label'));
const refresh = () => new Promise(resolve => setImmediate(resolve));

test('the window shows the drive when its folder is deleted', async () => {
    const { w, fs, element } = await mount('C:\\Scratch');
    assert.equal(w.title, 'Scratch');
    assert.deepEqual(names(element), ['inside.txt']);
    fs.remove('C:\\Scratch', true);
    await refresh();
    const shown = names(element);
    assert.ok(!shown.includes('inside.txt'), 'the deleted folder is gone from the list');
    assert.ok(shown.includes('loose.txt'), 'the drive is listed instead');
    assert.ok(shown.includes('Windows'), 'and it is the whole drive');
    assert.equal(w.title, '(C:)', 'and the title says so');
});

test('the window follows a folder that is renamed away', async () => {
    const { w, fs, element } = await mount('C:\\Scratch');
    fs.rename('C:\\Scratch', 'Renamed');
    await refresh();
    assert.ok(!names(element).includes('inside.txt'), 'the old folder is no longer shown');
    assert.ok(names(element).includes('loose.txt'), 'the drive is');
    assert.equal(w.title, '(C:)');
});

test('a folder that is still there keeps its name', async () => {
    const { w, fs, element } = await mount('C:\\Scratch');
    fs.write('C:\\Scratch\\later.txt', 'z');
    await refresh();
    assert.equal(w.title, 'Scratch');
    assert.deepEqual(names(element), ['inside.txt', 'later.txt']);
});

test('the Recycle Bin opens on a volume restored without it', async () => {
    /* A backup is checked for parents, not for the shell's own folders. */
    const { fs } = await mount('C:\\Scratch');
    for (const key of [...fs.nodes.keys()])
        if (key === 'c:\\recycled' || key.startsWith('c:\\recycled\\'))
            fs.nodes.delete(key);
    const element = document.createElement('div');
    document.body.append(element);
    const win = {
        title: '', element, closed: false, onClosed: [], setMenu() { }, status() { }, close() { },
        get body() { return element; },
        setTitle(value) { this.title = value; },
    };
    const s = {
        fs, settings: { get: (k, f) => f, set() { }, addEventListener() { }, removeEventListener() { } },
        wm: { create: () => win },
        ui: { message: async () => 'OK', prompt: async () => null, error() { }, file: async () => null },
        files: { copy() { }, paste() { }, remove() { }, rename() { }, newFolder() { }, newText() { } },
        launch() { }, open() { }, about() { }, clipboard: {},
    };
    assert.doesNotThrow(() => explorer(s, { path: 'recycle', view: 'large' }));
    assert.equal(win.title, 'Recycle Bin');
    assert.equal(fs.get('C:\\Recycled')?.type, 'folder', 'and the bin exists again');
});
