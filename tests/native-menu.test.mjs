import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * A right click belongs to Windows 95: an application answers it with a menu
 * of its own, or with nothing at all, but the browser's own menu never opens.
 * Notepad is the loudest case - its text is the one place the browser was
 * still invited in - so the guard has to cover every part of the desktop, and
 * it has to be the last word rather than the first: anything that wants the
 * click for itself handles it on the way up and opens its menu there.
 */
installDom();
register('./win95-resolver.mjs', import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { swallowNativeMenu } = await import('../src/packages/ui/menu.js');

const target = () => {
    const listeners = [];
    return {
        listeners,
        addEventListener: (type, handler, options) => listeners.push({ type, handler, options }),
        send(event) { for (const listener of listeners) if (listener.type === event.type) listener.handler(event); }
    };
};
const rightClick = () => ({
    type: 'contextmenu',
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; }
});

test('a right click the browser would answer is refused', () => {
    const doc = target();
    swallowNativeMenu(doc);
    assert.deepEqual(doc.listeners.map(listener => listener.type), ['contextmenu'], 'only right clicks are watched');
    const event = rightClick();
    doc.send(event);
    assert.equal(event.defaultPrevented, true, 'the browser is told not to open its menu');
});

test('the click is not swallowed before an application can answer it', () => {
    const doc = target();
    swallowNativeMenu(doc);
    const event = rightClick();
    doc.send(event);
    assert.notEqual(event.propagationStopped, true, 'a menu of our own still gets to open');
    assert.notEqual(doc.listeners[0].options, true, 'watch the click on its way up, after the application has seen it');
});

test('the desktop installs the guard when it starts', async () => {
    const main = await readFile(path.join(root, 'src/main.js'), 'utf8');
    assert.match(main, /swallowNativeMenu\(\)/, 'without it Notepad hands the click to the browser again');
});
