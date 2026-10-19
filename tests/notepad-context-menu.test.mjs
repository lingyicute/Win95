import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * Notepad answers a right click in its text with Windows 95's own menu:
 * Undo, a rule, Cut / Copy / Paste / Delete, a rule, Select All. No keyboard
 * hints - those belong to the Edit menu bar - and never the browser's menu.
 * The same commands feed both, so a change to one cannot leave the other
 * behind.
 */
installDom();
register('./win95-resolver.mjs', import.meta.url);
const { notepad } = await import('../src/packages/apps/documents.js');

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
const makeS = clipboard => {
    const s = {
        clipboard,
        settings: { get: (k, d) => d, set() { }, addEventListener() { }, removeEventListener() { } },
        wm: { create: () => makeWindow(), layout() { } },
        ui: { prompt: async () => null, file: async () => null, message() { }, error() { }, modal: () => makeWindow() },
        copyText(text) { s.clipboard = text; },
        pasteText: async () => s.clipboard
    };
    return s;
};
const mount = (text = '') => {
    const s = makeS('');
    const w = notepad(s, { text });
    const editor = w.body.querySelector('textarea');
    editor.value = text;
    editor.selectionStart = editor.selectionEnd = text.length;
    editor.focused = false;
    editor.focus = () => { editor.focused = true; };
    editor.setRangeText = (value, start, end) => {
        editor.value = editor.value.slice(0, start) + value + editor.value.slice(end);
        editor.selectionStart = editor.selectionEnd = start + value.length;
    };
    editor.setSelectionRange = (start, end) => { editor.selectionStart = start; editor.selectionEnd = end; };
    editor.select = () => { editor.selectionStart = 0; editor.selectionEnd = editor.value.length; };
    return { s, w, editor };
};
const rightClick = editor => {
    const event = { type: 'contextmenu', clientX: 40, clientY: 60, preventDefault() { this.defaultPrevented = true; } };
    editor.dispatchEvent(event);
    return event;
};
const menu = () => document.querySelector('#menus').querySelector('.popup-menu');
const rows = () => [...menu().querySelectorAll('.menu-item, .separator')];
const labels = () => rows().map(row => row.classList.contains('separator') ? '—' : row.querySelector('.menu-label').textContent);
const row = label => rows().find(r => r.querySelector('.menu-label')?.textContent === label);
const choose = label => row(label).dispatchEvent({ type: 'click' });
const disabled = node => node.disabled === true || node.getAttribute?.('disabled') === 'true';

test('a right click in the text opens the Windows 95 editing menu, in order', () => {
    const { editor } = mount('Hello');
    const event = rightClick(editor);
    assert.equal(event.defaultPrevented, true, 'the browser is not asked for its own menu');
    assert.deepEqual(labels(), ['Undo', '—', 'Cut', 'Copy', 'Paste', 'Delete', '—', 'Select All']);
    assert.equal(rows().filter(r => r.classList.contains('separator')).length, 2, 'two rules, where Windows 95 puts them');
    assert.equal(menu().querySelectorAll('.menu-shortcut').length, 0, 'a right-click menu carries no keyboard hints');
});

test('Undo is greyed until there is something to undo', () => {
    const { editor } = mount('Hello');
    rightClick(editor);
    assert.equal(disabled(row('Undo')), true, 'a fresh document has nothing to undo');
    choose('Select All');
    assert.equal(menu(), null, 'choosing closes the menu');
    editor.dispatchEvent({ type: 'beforeinput' });
    editor.value = 'Hello!';
    editor.setSelectionRange(6, 6);
    rightClick(editor);
    assert.equal(disabled(row('Undo')), false, 'after a change it can be used');
});

test('Undo puts the text back and leaves the caret in it', () => {
    const { editor } = mount('Hello');
    editor.value = 'Hello';
    /* Every change is remembered before it happens. */
    editor.dispatchEvent({ type: 'beforeinput' });
    editor.value = 'Hello there';
    rightClick(editor);
    choose('Undo');
    assert.equal(editor.value, 'Hello');
    assert.equal(editor.focused, true, 'ready to type again');
});

test('Cut takes the selection away and keeps it; Copy leaves the text alone', () => {
    const { s, editor } = mount('Hello world');
    editor.setSelectionRange(0, 5);
    rightClick(editor);
    choose('Cut');
    assert.equal(editor.value, ' world');
    assert.equal(s.clipboard, 'Hello');

    editor.setSelectionRange(1, 6);
    rightClick(editor);
    choose('Copy');
    assert.equal(editor.value, ' world');
    assert.equal(s.clipboard, 'world');
});

test('Paste and Delete act on the selection, Select All takes the document', async () => {
    const { s, editor } = mount('Hello');
    s.clipboard = 'Hi';
    editor.setSelectionRange(0, 5);
    rightClick(editor);
    choose('Paste');
    await new Promise(r => setTimeout(r, 0));
    assert.equal(editor.value, 'Hi');

    editor.value = 'Hello';
    editor.setSelectionRange(0, 5);
    rightClick(editor);
    choose('Delete');
    assert.equal(editor.value, '', 'Delete removes the selection and nothing else');

    editor.value = 'Hello';
    rightClick(editor);
    choose('Select All');
    assert.equal(editor.selectionStart, 0);
    assert.equal(editor.selectionEnd, 5);
});

test('the Edit menu still shows the shortcuts the right-click menu leaves out', () => {
    const { w } = mount('Hello');
    const edit = [...w.menu.querySelectorAll('button')].find(b => b.textContent === 'Edit');
    edit.dispatchEvent({ type: 'click' });
    const hints = [...menu().querySelectorAll('.menu-shortcut')].map(n => n.textContent);
    assert.deepEqual(hints.slice(0, 5), ['Ctrl+Z', 'Ctrl+X', 'Ctrl+C', 'Ctrl+V', 'Del']);
    assert.deepEqual(labels().slice(0, 8), ['Undo', '—', 'Cut', 'Copy', 'Paste', 'Delete', '—', 'Select All'], 'the same commands in the same order');
});
