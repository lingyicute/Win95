/* The three s.pasteText() call sites must treat a null result as a no-op:
   insert('') would delete the selection, so a failed or empty paste must
   never reach insert/execCommand. Driven through the real Edit menus. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

installDom();
register('./win95-resolver.mjs', import.meta.url);
globalThis.requestAnimationFrame = () => 0;
window.getSelection = () => ({ rangeCount: 0 });
const { notepad, wordpad, calculator } = await import('../src/packages/apps/documents.js');

const makeWindow = () => {
    const element = document.createElement('section');
    const body = document.createElement('div');
    element.append(body);
    element.focus = () => { };
    document.body.append(element);
    return {
        element, body, closed: false, rect: {}, onClose: null,
        setTitle() { }, status() { }, setMenu(bar) { element.append(bar); this.menu = bar; },
        close() { this.closed = true; }
    };
};
const makeS = () => ({
    settings: { get: (k, d) => d, set() { }, addEventListener() { }, removeEventListener() { } },
    wm: { create: () => makeWindow(), layout() { } },
    ui: { prompt: async () => null, file: async () => null, message() { }, error() { }, modal: () => makeWindow() },
    copyText() { },
    pasteText: async () => null
});
const clickEditAction = async (w, label) => {
    const edit = [...w.menu.querySelectorAll('button')].find(b => b.textContent === 'Edit');
    edit.dispatchEvent({ type: 'click' });
    const row = [...document.querySelector('#menus').querySelectorAll('.menu-item')].find(b => b.textContent.includes(label));
    row.dispatchEvent({ type: 'click' });
    await new Promise(r => setTimeout(r, 0));
};

test('Notepad paste replaces the selection only when pasteText yields text', async () => {
    const s = makeS();
    const w = notepad(s, { text: 'Hello' });
    const editor = w.body.querySelector('textarea');
    editor.value = 'Hello';
    editor.focus = () => { };
    editor.setRangeText = (text, a, b) => {
        editor.value = editor.value.slice(0, a) + text + editor.value.slice(b);
    };
    editor.selectionStart = 3;
    editor.selectionEnd = 5;

    s.pasteText = async () => null;
    await clickEditAction(w, 'Paste');
    assert.equal(editor.value, 'Hello', 'a failed paste must not wipe the selection');
    assert.equal(editor.selectionEnd - editor.selectionStart, 2, 'and the selection survives');

    s.pasteText = async () => 'XY';
    await clickEditAction(w, 'Paste');
    assert.equal(editor.value, 'HelXY', 'a real paste replaces exactly the selection');
});

test('WordPad paste never calls insertText on a failed paste', async () => {
    const calls = [];
    document.execCommand = (name, _ui, value) => { calls.push([name, value]); return true; };
    const s = makeS();
    const w = wordpad(s);
    const editor = w.body.querySelector('.wordpad-page');
    editor.focus = () => { };

    s.pasteText = async () => null;
    await clickEditAction(w, 'Paste');
    assert.deepEqual(calls, [], 'null must not become insertText("")');

    s.pasteText = async () => 'Z';
    await clickEditAction(w, 'Paste');
    assert.deepEqual(calls, [['insertText', 'Z']]);
});

test('Calculator paste ignores a failed paste and non-numeric text', async () => {
    const s = makeS();
    const w = calculator(s);
    const display = w.body.querySelector('.calculator-display');

    s.pasteText = async () => null;
    await clickEditAction(w, 'Paste');
    assert.equal(display.value, '0', 'a failed paste leaves the entry alone');

    s.pasteText = async () => '42';
    await clickEditAction(w, 'Paste');
    assert.equal(display.value, '42', 'numbers land in the display');

    s.pasteText = async () => 'abc';
    await clickEditAction(w, 'Paste');
    assert.equal(display.value, '42', 'non-numeric text is refused');
});
