import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * Where a window opens, and where it goes when the browser shrinks.
 *
 * The opening box was worked out from the requested width instead of the width
 * the desktop could give it, and its x had a hard floor of 96px. On a narrow
 * screen that put the right-hand edge - the Close button with it - off the
 * desktop: Notepad hung 84px off a 360px window. The resize path had the same
 * blind spot: it clamped the corner to 80px of strip and then capped the width,
 * so shrinking the browser left a 555px window 235px past the right edge and
 * its status bar under the taskbar.
 */
installDom();
register('./win95-resolver.mjs', import.meta.url);
const { WindowManager } = await import('../src/packages/shell/window-manager.js');

const desk = (width = 1024, height = 768) => {
    globalThis.innerWidth = width;
    globalThis.innerHeight = height;
    for (const id of ['windows', 'tasks'])
        if (!document.querySelector('#' + id))
            document.body.append(Object.assign(document.createElement('div'), { id }));
    return new WindowManager();
};

test('on a roomy desktop a window keeps the familiar centered box', () => {
    const wm = desk(1024, 768);
    const w = wm.create({ title: 'Notepad', width: 555, height: 370 });
    assert.equal(w.rect.width, 555);
    assert.equal(w.rect.height, 370);
    assert.equal(w.rect.x, (1024 - 555) / 2, 'centred, not pushed right by the 96px floor');
    assert.equal(w.rect.y, (768 - 32 - 370) / 2);
    assert.equal(wm.create({ title: 'Second', width: 555, height: 370 }).rect.x, (1024 - 555) / 2 + 18, 'the cascade still steps sideways');
});

test('a window opens wholly inside a narrow desktop', () => {
    const wm = desk(360, 640);
    const w = wm.create({ title: 'Notepad', width: 555, height: 370 });
    assert.equal(w.rect.width, 348, 'the width is still capped to the viewport');
    assert.ok(w.rect.x >= 0 && w.rect.x + w.rect.width <= 360, `the whole box is on screen: x=${w.rect.x}, right=${w.rect.x + w.rect.width}`);
    assert.equal(w.rect.x, 12, 'and it sits in the 12px margin the cap leaves');
});

test('a window taller than the desktop stops above the taskbar', () => {
    const wm = desk(1024, 480);
    const w = wm.create({ title: 'Tall', width: 500, height: 700 });
    assert.equal(w.rect.height, 440, 'the height is capped to the desktop');
    assert.ok(w.rect.y + w.rect.height <= 480 - 30, `the bottom clears the taskbar: y=${w.rect.y}, bottom=${w.rect.y + w.rect.height}`);
    assert.equal(w.rect.y, 10);
});

test('an explicit position is honoured while it fits and pulled in when it does not', () => {
    const wide = desk(1024, 768).create({ title: 'Placed', x: 100, y: 90, width: 575, height: 350 });
    assert.deepEqual([wide.rect.x, wide.rect.y], [100, 90], 'a deliberate corner is left alone');
    const narrow = desk(360, 640).create({ title: 'Placed', x: 100, y: 90, width: 575, height: 350 });
    assert.ok(narrow.rect.x + narrow.rect.width <= 360, `the box is brought back on screen: right=${narrow.rect.x + narrow.rect.width}`);
});

test('shrinking the browser brings the window back with it', () => {
    const wm = desk(1024, 768);
    const w = wm.create({ title: 'Notepad', width: 555, height: 370 });
    globalThis.innerWidth = 480;
    globalThis.innerHeight = 500;
    wm.fit();
    assert.equal(w.rect.width, 480, 'the width follows the desktop');
    assert.ok(w.rect.x + w.rect.width <= 480, `the right edge is back on screen: right=${w.rect.x + w.rect.width}`);
    assert.ok(w.rect.y + w.rect.height <= 500 - 30, `and the bottom sits above the taskbar: bottom=${w.rect.y + w.rect.height}`);
    const shrunk = { ...w.rect };
    globalThis.innerWidth = 1024;
    globalThis.innerHeight = 768;
    wm.fit();
    assert.deepEqual({ ...w.rect }, shrunk, 'growing again does not move a window that already fits, and does not put back the size the user lost');
});

test('a board that is allowed to overflow keeps its size and gains its corner', () => {
    const wm = desk(360, 640);
    const w = wm.create({ title: 'Minesweeper', width: 600, height: 500, resizable: false, allowOverflow: true });
    assert.equal(w.rect.width, 348, 'the opening box is still capped to the desktop');
    globalThis.innerWidth = 1024;
    globalThis.innerHeight = 768;
    wm.fit();
    assert.equal(w.rect.width, 348, 'an overflow board is not resized behind the field\'s back');
    assert.ok(w.rect.x + w.rect.width <= 1024, `and its caption stays where it can be reached: x=${w.rect.x}`);
});
