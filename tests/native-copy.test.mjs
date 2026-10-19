import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * Clipboard Viewer reads the shell's clipboard, but Ctrl+C and Ctrl+X never
 * pass through it: the browser copies the selection itself. The shell has to
 * note those copies as they happen, or a line copied with the keyboard stays
 * invisible in Clipboard Viewer while the same line copied from the Edit menu
 * shows up - which is exactly the bug these tests hold shut.
 *
 * The shim has no bubbling, so the listeners the shell installed on the
 * document are called the way the browser would call them: the copy arrives
 * after the selection is made and before it is taken away.
 */
installDom();
register('./win95-resolver.mjs', import.meta.url);
/* The shell also writes a copy to the system clipboard when one is available. */
Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: { readText: async () => '', writeText: async () => { } } }
});
const { installClipboard } = await import('../src/packages/core/clipboard.js');
const { clipboardViewer } = await import('../src/packages/apps/utilities.js');

const fire = (type, target) => {
    const listeners = document.listeners.get(type) ?? [];
    assert.ok(listeners.length, `the shell listens for ${type}`);
    for (const listener of listeners)
        listener({ type, target });
};
const field = (value, start, end) => {
    const node = document.createElement('textarea');
    node.value = value;
    node.selectionStart = start;
    node.selectionEnd = end;
    document.body.append(node);
    return node;
};
const freshClipboard = () => {
    const s = { clipboard: null };
    installClipboard(s);
    return s;
};

test('a line copied with Ctrl+C is what Clipboard Viewer will show', () => {
    const s = freshClipboard();
    const note = field('first line\nsecond line', 11, 22);
    note.focus();
    fire('copy');
    assert.deepEqual(s.clipboard, { type: 'text', text: 'second line' }, 'the selection, not the whole note');
});

test('a copy made from the Edit menu still follows the selection it was made on', () => {
    const s = freshClipboard();
    const note = field('leave me alone', 0, 5);
    /* The menu took the focus; the text box still holds the selection. */
    fire('pointerdown', note);
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    elsewhere.focus();
    document.getSelection = () => '';
    fire('copy');
    assert.deepEqual(s.clipboard, { type: 'text', text: 'leave' }, 'the last text box the user worked in is the one copied from');
    delete document.getSelection;
});

test('Ctrl+X is recorded too, before the browser takes the text away', () => {
    const s = freshClipboard();
    const note = field('cut me', 0, 3);
    note.focus();
    fire('cut');
    assert.deepEqual(s.clipboard, { type: 'text', text: 'cut' });
});

test('text selected outside a text box is recorded as well', () => {
    const s = freshClipboard();
    field('unused', 0, 0).focus(); // focus sits in a field with no selection
    document.getSelection = () => 'a paragraph in WordPad';
    fire('copy');
    assert.deepEqual(s.clipboard, { type: 'text', text: 'a paragraph in WordPad' });
    delete document.getSelection;
});

test('copy with nothing selected leaves the clipboard alone', () => {
    const s = freshClipboard();
    s.copyText('something copied earlier');
    const note = field('abc', 2, 2);
    note.focus();
    document.getSelection = () => '';
    fire('copy');
    assert.deepEqual(s.clipboard, { type: 'text', text: 'something copied earlier' }, 'Copy with no selection does nothing');
    delete document.getSelection;

    const empty = freshClipboard();
    note.focus();
    document.getSelection = () => '';
    fire('copy');
    assert.equal(empty.clipboard, null, 'and an empty clipboard stays empty');
    delete document.getSelection;
});

test('a file copy is not overwritten by a stray text selection', () => {
    const s = freshClipboard();
    s.clipboard = { type: 'files', paths: ['C:\\My Documents\\note.txt'] };
    const note = field('abc', 0, 1);
    note.focus();
    fire('cut');
    assert.equal(s.clipboard.type, 'text', 'a real selection does replace it, as on a desktop');
});

test('Clipboard Viewer reads the text the keyboard copied', async () => {
    const s = freshClipboard();
    const element = document.createElement('section');
    const body = document.createElement('div');
    element.append(body);
    document.body.append(element);
    element.focus = () => { };
    const w = { element, body, onClosed: [], setMenu(menu) { this.menu = menu; }, close() { this.closed = true; } };
    s.wm = { create: () => w };
    clipboardViewer(s);
    const display = body.querySelector('textarea');
    assert.equal(display.value, 'The Clipboard is empty.', 'it starts out saying so');

    const note = field('hello from the keyboard', 0, 23);
    note.focus();
    fire('copy');

    /* The viewer refreshes on its own every half second. */
    await new Promise(resolve => setTimeout(resolve, 600));
    assert.equal(display.value, 'hello from the keyboard', 'the viewer shows the copied line');
    for (const close of w.onClosed)
        close();
});

test('the viewer keeps up with a copy made while it is open', async () => {
    const s = freshClipboard();
    const element = document.createElement('section');
    const body = document.createElement('div');
    element.append(body);
    document.body.append(element);
    element.focus = () => { };
    const w = { element, body, onClosed: [], setMenu() { }, close() { } };
    s.wm = { create: () => w };
    clipboardViewer(s);
    const display = body.querySelector('textarea');

    const note = field('one', 0, 3);
    note.focus();
    fire('copy');
    await new Promise(resolve => setTimeout(resolve, 600));
    assert.equal(display.value, 'one');

    note.value = 'one two';
    note.selectionStart = 4;
    note.selectionEnd = 7;
    fire('copy');
    await new Promise(resolve => setTimeout(resolve, 600));
    assert.equal(display.value, 'two', 'and shows the newest copy, not the first');
    for (const close of w.onClosed)
        close();
});
