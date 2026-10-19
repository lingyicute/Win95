import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * The keyboard can move and size a window from its system menu. The arrow keys
 * walked the window by their own step and never looked at the screen, so a
 * window could be pushed entirely off the desktop and could not be dragged back
 * (the caption that drags it was off screen too); the size keys could likewise
 * grow it past the edge. The mouse path has always kept a strip on screen and
 * stopped at the viewport, and the keyboard has to agree with it.
 */
installDom();
register('./win95-resolver.mjs', import.meta.url);
const { WindowManager } = await import('../src/packages/shell/window-manager.js');

const desk = () => {
    for (const id of ['windows', 'tasks'])
        if (!document.querySelector('#' + id))
            document.body.append(Object.assign(document.createElement('div'), { id }));
    return new WindowManager();
};
const key = (wm, name, shiftKey = false) => wm.keydown({ key: name, shiftKey, altKey: false, preventDefault() { } });

test('holding an arrow key cannot walk a window off the desktop', () => {
    const wm = desk();
    const w = wm.create({ title: 'Move Me', x: 100, y: 100, width: 400, height: 300 });
    w.element.focus();
    w.moveKeys = true;
    for (let i = 0; i < 400; i++)
        key(wm, 'ArrowRight');
    assert.ok(w.rect.x <= innerWidth - 50, `left edge stays on screen: x=${w.rect.x}`);
    for (let i = 0; i < 400; i++)
        key(wm, 'ArrowLeft');
    assert.ok(w.rect.x >= -w.rect.width + 80, `right edge stays on screen: x=${w.rect.x}`);
    for (let i = 0; i < 400; i++)
        key(wm, 'ArrowUp');
    assert.ok(w.rect.y >= 0, `the caption stays reachable: y=${w.rect.y}`);
    for (let i = 0; i < 400; i++)
        key(wm, 'ArrowDown');
    assert.ok(w.rect.y <= innerHeight - 65, `the caption stays above the taskbar: y=${w.rect.y}`);
});

test('the size keys stop at the edges of the desktop', () => {
    const wm = desk();
    const w = wm.create({ title: 'Size Me', x: 200, y: 120, width: 400, height: 300 });
    w.sizeKeys = true;
    for (let i = 0; i < 400; i++)
        key(wm, 'ArrowRight');
    assert.ok(w.rect.width <= innerWidth - w.rect.x, `width stops at the right edge: ${w.rect.width}`);
    for (let i = 0; i < 400; i++)
        key(wm, 'ArrowDown');
    assert.ok(w.rect.height <= innerHeight - 30 - w.rect.y, `height stops above the taskbar: ${w.rect.height}`);
    for (let i = 0; i < 400; i++)
        key(wm, 'ArrowLeft');
    assert.equal(w.rect.width, w.options.minWidth, 'and never falls below the minimum width');
    for (let i = 0; i < 400; i++)
        key(wm, 'ArrowUp');
    assert.equal(w.rect.height, w.options.minHeight, 'nor below the minimum height');
});

test('the keyboard lets go of the window when the menu is left', () => {
    const wm = desk();
    const w = wm.create({ title: 'Leave Me', x: 100, y: 100 });
    w.moveKeys = true;
    key(wm, 'Escape');
    const settled = w.rect.x;
    key(wm, 'ArrowRight');
    assert.equal(w.rect.x, settled, 'arrows are the desktop\'s again after Escape');
});
