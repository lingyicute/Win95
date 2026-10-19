import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * The command prompt can be standing in a folder that another window deletes
 * (a folder is deleted while the prompt is inside it, or a backup is restored
 * over the volume). Tab then asked the volume for the contents of a folder that
 * is no longer there - the exception escaped the key handler, so the prompt
 * stopped responding to the key at all. Completion is a convenience: with
 * nothing to complete, the line should simply stay as typed.
 */
installDom();
globalThis.requestAnimationFrame = () => 0;
register('./win95-resolver.mjs', import.meta.url);
const { VirtualFileSystem } = await import('../src/packages/core/filesystem.js');
const { dosPrompt } = await import('../src/packages/apps/dos.js');

const values = new Map();
globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };

const mount = async () => {
    values.clear();
    const fs = await new VirtualFileSystem().init();
    fs.mkdir('C:\\Work');
    fs.write('C:\\Work\\alpha.txt', 'x');
    fs.write('C:\\Work\\beta.txt', 'y');
    const element = document.createElement('div');
    document.body.append(element);
    const win = {
        title: '', element, closed: false, onClosed: [], body: element,
        setTitle() { }, close() { },
    };
    const s = { fs, wm: { create: () => win }, settings: { get: (k, f) => f, set() { } }, ui: { message: async () => 'OK' }, run() { }, open() { } };
    dosPrompt(s, {});
    const input = element.querySelector('.dos-input');
    const prompt = element.querySelector('.dos-prompt, .dos-line span');
    return { fs, element, input };
};
const type = async (element, input, text) => {
    input.value = text;
    /* The shim has parentNode, not parentElement; the form is in the window. */
    await element.querySelector('.dos-line').onsubmit({ preventDefault() { } });
    await new Promise(resolve => setImmediate(resolve));
};
const tab = input => input.onkeydown({ key: 'Tab', preventDefault() { }, ctrlKey: false });

test('Tab completes a name in the folder the prompt is in', async () => {
    const { element, input } = await mount();
    await type(element, input, 'cd C:\\Work');
    input.value = 'type al';
    tab(input);
    assert.equal(input.value, 'type alpha.txt');
});

test('Tab in a folder that has been deleted does not throw', async () => {
    const { fs, element, input } = await mount();
    await type(element, input, 'cd C:\\Work');
    fs.remove('C:\\Work', true);
    input.value = 'dir ';
    let threw;
    try {
        tab(input);
    }
    catch (error) {
        threw = error;
    }
    assert.equal(threw, undefined, `Tab threw: ${threw?.message}`);
    assert.equal(input.value, 'dir ', 'the line stays as typed');
});

test('the prompt still runs commands after its folder is deleted', async () => {
    const { fs, element, input } = await mount();
    await type(element, input, 'cd C:\\Work');
    fs.remove('C:\\Work', true);
    await type(element, input, 'dir');
    const output = element.querySelector('.dos-output').textContent;
    assert.match(output, /The system cannot find the path specified\./, 'DIR says the folder is gone instead of breaking the prompt');
    await type(element, input, 'cd \\');
    await type(element, input, 'dir');
    assert.match(element.querySelector('.dos-output').textContent, /Directory of C:\\/, 'and the prompt can still walk back to the drive');
});
