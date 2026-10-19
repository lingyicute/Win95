import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * Minimizing a window shrinks its title bar down to the taskbar button it is
 * going to live on, and restoring it grows the bar back out of that button. The
 * shim has no animation engine and no layout, so this file supplies a
 * controllable one: a flight records its frames and only lands when the test
 * says so, which is what makes it possible to look at the window halfway
 * through the move.
 */
installDom();
register('./win95-resolver.mjs', import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { WindowManager } = await import('../src/packages/shell/window-manager.js');

const flights = [];
globalThis.Element.prototype.animate = function (frames, options) {
    const flight = {
        node: this,
        frames,
        options,
        cancelled: false,
        finish() {
            if (this.cancelled)
                return;
            this.onfinish?.();
        },
        cancel() { this.cancelled = true; }
    };
    flights.push(flight);
    return flight;
};
let motionPreference = false;
globalThis.matchMedia = () => ({ matches: motionPreference });

const place = (node, rect) => {
    node.getBoundingClientRect = () => ({ ...rect, x: rect.left, y: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height });
};
const desk = () => {
    for (const id of ['windows', 'tasks'])
        if (!document.querySelector('#' + id))
            document.body.append(Object.assign(document.createElement('div'), { id }));
    return new WindowManager();
};
const arrival = async (options = {}) => {
    /* Each test starts with a clean page: a flight left in the air by the
       previous one would still be findable on the body. */
    for (const ghost of document.body.querySelectorAll('.flying-title-bar'))
        ghost.remove();
    const wm = desk();
    const w = wm.create({ title: 'Solitaire', ...options });
    place(w.element.querySelector('.title-bar'), { left: 120, top: 90, width: 420, height: 19 });
    place(w.task, { left: 24, top: 560, width: 160, height: 24 });
    return { wm, w };
};
const ghost = () => document.body.querySelector('.flying-title-bar');
const lastFlight = () => flights.at(-1);
const px = frame => ({ left: frame.left, top: frame.top, width: frame.width, height: frame.height });

test('minimizing flies a copy of the title bar down to the taskbar button', async () => {
    flights.length = 0;
    const { wm, w } = await arrival();
    wm.minimize(w);
    assert.equal(w.minimized, true, 'the window is minimized at once');
    assert.equal(w.element.hidden, false, 'it stays drawn while its title bar travels');
    const bar = ghost();
    assert.ok(bar, 'a copy of the title bar is on its way');
    assert.match(bar.className, /title-bar/, 'and it is the title bar, styled as one');
    const flight = lastFlight();
    assert.equal(flight.node, bar);
    assert.equal(flight.options.duration, 200);
    assert.deepEqual(px(flight.frames[0]), { left: '120px', top: '90px', width: '420px', height: '19px' }, 'it starts where the window is');
    assert.deepEqual(px(flight.frames[1]), { left: '24px', top: '560px', width: '160px', height: '24px' }, 'and ends on the button');
    flight.finish();
    assert.equal(ghost(), null, 'the copy is gone once it lands');
    assert.equal(w.element.hidden, true, 'and the window goes with it');
    assert.equal(w.motion, null);
});

test('the copy carries the window name and none of its buttons', async () => {
    flights.length = 0;
    const { wm, w } = await arrival();
    wm.minimize(w);
    const bar = ghost();
    assert.equal(bar.querySelectorAll('button').length, 0, 'nothing in the copy can be clicked');
    assert.equal(bar.getAttribute('aria-hidden'), 'true', 'and nothing in it is read out');
    assert.equal(bar.querySelector('.title-text')?.textContent, 'Solitaire');
    lastFlight().finish();
});

test('a restored window grows its title bar out of the button', async () => {
    flights.length = 0;
    const { wm, w } = await arrival();
    wm.minimize(w);
    lastFlight().finish();
    assert.equal(w.element.hidden, true);
    flights.length = 0;
    wm.focus(w);
    assert.equal(w.minimized, false);
    assert.equal(w.element.hidden, true, 'the window waits, unseen, for its title bar');
    const flight = lastFlight();
    assert.deepEqual(px(flight.frames[0]), { left: '24px', top: '560px', width: '160px', height: '24px' }, 'it starts on the button');
    assert.deepEqual(px(flight.frames[1]), { left: '120px', top: '90px', width: '420px', height: '19px' }, 'and lands on the window');
    flight.finish();
    assert.equal(w.element.hidden, false, 'the window appears as the bar lands');
    assert.equal(ghost(), null);
});

test('restoring in the middle of a minimize cancels the flight', async () => {
    flights.length = 0;
    const { wm, w } = await arrival();
    wm.minimize(w);
    const flight = lastFlight();
    wm.focus(w);
    assert.equal(flight.cancelled, true, 'the trip down is called off');
    assert.equal(flight.node.parentNode, null, 'and the copy that was flying disappears');
    assert.equal(w.element.hidden, false, 'the window never leaves the screen');
    const up = lastFlight();
    assert.notEqual(up, flight, 'a bar now travels back out of the button');
    assert.deepEqual(px(up.frames[0]), { left: '24px', top: '560px', width: '160px', height: '24px' });
    flight.finish();
    assert.equal(w.element.hidden, false, 'a cancelled flight cannot hide it after the fact');
    up.finish();
    assert.equal(ghost(), null, 'both copies are gone once the window is back');
    assert.equal(w.element.hidden, false);
});

test('closing a window in the middle of a flight leaves nothing behind', async () => {
    flights.length = 0;
    const { wm, w } = await arrival();
    wm.minimize(w);
    const flight = lastFlight();
    await wm.close(w);
    assert.equal(flight.cancelled, true);
    assert.equal(ghost(), null, 'no copy of a closed window is left flying');
});

test('a window cannot leave two copies in the air', async () => {
    flights.length = 0;
    const { wm, w } = await arrival();
    wm.minimize(w);
    wm.minimize(w);
    assert.equal(document.body.querySelectorAll('.flying-title-bar').length, 1);
    assert.equal(flights.length, 1);
    lastFlight().finish();
});

test('a reader who asked for less motion gets the window at once', async () => {
    flights.length = 0;
    motionPreference = true;
    try {
        const { wm, w } = await arrival();
        wm.minimize(w);
        assert.equal(flights.length, 0, 'nothing flies');
        assert.equal(ghost(), null);
        assert.equal(w.element.hidden, true, 'the window simply arrives');
        wm.focus(w);
        assert.equal(flights.length, 0);
        assert.equal(w.element.hidden, false);
    }
    finally {
        motionPreference = false;
    }
});

test('a window without a layout to measure does not fly', async () => {
    const wm = desk();
    const w = wm.create({ title: 'No Layout' });
    /* The shim's default rect is all zeroes: nothing to start from or land on. */
    wm.minimize(w);
    assert.equal(w.element.hidden, true, 'it is simply minimized');
    assert.equal(ghost(), null);
});

test('restoring a maximized window from the taskbar brings it back maximized', async () => {
    flights.length = 0;
    const { wm, w } = await arrival();
    wm.maximize(w);
    assert.equal(w.maximized, true);
    wm.minimize(w);
    lastFlight().finish();
    w.restore();
    assert.equal(w.minimized, false, 'the window is back');
    assert.equal(w.maximized, true, 'and still fills the desktop');
    lastFlight()?.finish();
    /* A window that is on screen is un-maximized by Restore, as before. */
    w.restore();
    assert.equal(w.maximized, false);
});

test('the flight layer sits over the taskbar and under the menus', async () => {
    const css = await readFile(path.join(root, 'src/styles.css'), 'utf8');
    const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(match => match[1].trim() === '.flying-title-bar')?.[2] ?? '';
    assert.match(rule, /position:fixed/, 'it is placed in viewport coordinates');
    assert.match(rule, /pointer-events:none/, 'it must never swallow a click');
    const z = Number(/z-index:(\d+)/.exec(rule)?.[1] ?? 0);
    assert.ok(z > 200000, 'above the taskbar it lands on');
    assert.ok(z < 210000, 'below the menus, which are always on top');
});
