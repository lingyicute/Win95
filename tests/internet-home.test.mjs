import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';
import { VirtualFileSystem } from '../src/packages/core/filesystem.js';

installDom();
globalThis.devicePixelRatio = 1;
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-US' }, configurable: true });
const values = new Map();
globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
register('./win95-resolver.mjs', import.meta.url);
const { internet } = await import('../src/packages/apps/multimedia.js');

const textOf = node => (node.textContent ?? '') + (node.children ?? []).map(textOf).join('|');

test('the Internet Explorer home page lists the HTML documents on the C: drive', async () => {
    const fs = await new VirtualFileSystem().init();
    fs.write('C:\\My Documents\\Page.html', '<p>hi</p>');
    fs.write('C:\\My Documents\\Notes.txt', 'plain');
    fs.write('C:\\My Documents\\Old.htm.bak', 'backup');
    const system = {
        fs,
        launch() { },
        wm: { create() { return { body: document.createElement('div'), element: document.createElement('div'), rect: {}, onClosed: [], setMenu() { }, setTitle() { }, status() { }, close() { } }; } }
    };
    const window = internet(system);
    const page = window.body.querySelector?.('.internet-page') ?? window.body.children.find(n => n.className === 'internet-page');
    const text = textOf(page ?? window.body);
    assert.match(text, /Welcome\.htm/, 'the seeded Welcome.htm is a link');
    assert.match(text, /Page\.html/);
    assert.doesNotMatch(text, /Notes\.txt/);
    assert.doesNotMatch(text, /Old\.htm\.bak/);
});
