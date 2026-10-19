import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * Maximizing and restoring move the window's title bar, not its frame: a copy
 * of the bar travels from where the window stands to the top of the desktop
 * (widening to the whole screen on the way) and the window takes the larger
 * box when the copy lands; restoring sends the bar back. Nothing is resized
 * piecemeal while it travels.
 *
 * The shim has no layout and no animation engine, so each flight is recorded
 * and lands only when the test says so. That is what makes it possible to
 * look at the window halfway through the move.
 */
installDom();
register('./win95-resolver.mjs', import.meta.url);

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
/* A 460 × 300 window in the middle of the 1024 × 768 desktop. */
const arrival = async () => {
    for (const ghost of document.body.querySelectorAll('.flying-title-bar'))
        ghost.remove();
    const wm = desk();
    const w = wm.create({ title: 'Solitaire', width: 460, height: 300 });
    place(w.element, { left: 282, top: 218, width: 460, height: 300 });
    place(w.element.querySelector('.title-bar'), { left: 300, top: 220, width: 424, height: 19 });
    place(w.task, { left: 24, top: 560, width: 160, height: 24 });
    return { wm, w };
};
const ghost = () => document.body.querySelector('.flying-title-bar');
const lastFlight = () => flights.at(-1);
const frame = f => ({ left: f.left, top: f.top, width: f.width, height: f.height });
const box = w => ({ left: w.element.style.left, top: w.element.style.top, width: w.element.style.width, height: w.element.style.height });

test('maximizing flies a copy of the title bar to the top of the desktop', async () => {
    flights.length = 0;
    const { wm, w } = await arrival();
    wm.maximize(w);
    assert.equal(w.maximized, true, 'the window already knows what it is about to be');
    assert.deepEqual(box(w), { left: '282px', top: '218px', width: '460px', height: '300px' }, 'but it keeps its box while the bar travels');
    const bar = ghost();
    assert.ok(bar, 'a copy of the title bar is on its way');
    assert.match(bar.className, /title-bar/);
    const flight = lastFlight();
    assert.equal(flight.node, bar);
    assert.equal(flight.options.duration, 200);
    assert.deepEqual(frame(flight.frames[0]), { left: '300px', top: '220px', width: '424px', height: '19px' }, 'it starts on the window');
    assert.deepEqual(frame(flight.frames[1]), { left: '18px', top: '2px', width: '988px', height: '19px' }, 'and ends on the bar of a maximized window');
    assert.doesNotMatch(w.element.querySelector('.caption-button.maximize').className, /restore/, 'the button turns while the bar is still flying');
    flight.finish();
    assert.equal(ghost(), null, 'the copy is gone once it lands');
    assert.deepEqual(box(w), { left: '0px', top: '0px', width: '1024px', height: '738px' }, 'and the window takes the whole desktop above the taskbar');
    assert.match(w.element.querySelector('.caption-button.maximize').className, /restore/);
    assert.equal(w.element.querySelector('.caption-button.maximize').getAttribute('aria-label'), 'Restore');
    assert.equal(w.motion, null);
});

test('restoring flies the bar back to the size the window had', async () => {
    flights.length = 0;
    const { wm, w } = await arrival();
    wm.maximize(w);
    lastFlight().finish();
    /* The window now stands maximized; measure the bar where it really is. */
    place(w.element, { left: 0, top: 0, width: 1024, height: 738 });
    place(w.element.querySelector('.title-bar'), { left: 18, top: 2, width: 988, height: 19 });
    flights.length = 0;
    wm.maximize(w);
    assert.equal(w.maximized, false);
    assert.deepEqual(box(w), { left: '0px', top: '0px', width: '1024px', height: '738px' }, 'the desktop stays covered while the bar comes back');
    const flight = lastFlight();
    assert.deepEqual(frame(flight.frames[0]), { left: '18px', top: '2px', width: '988px', height: '19px' }, 'it starts at the top of the screen');
    assert.deepEqual(frame(flight.frames[1]), { left: '300px', top: '220px', width: '424px', height: '19px' }, 'and lands on the window it came from');
    flight.finish();
    assert.deepEqual(box(w), { left: '282px', top: '218px', width: '460px', height: '300px' });
    assert.equal(w.element.querySelector('.caption-button.maximize').getAttribute('aria-label'), 'Maximize');
});

test('a second click during the flight turns the window around', async () => {
    flights.length = 0;
    const { wm, w } = await arrival();
    wm.maximize(w);
    const first = lastFlight();
    const firstGhost = ghost();
    wm.maximize(w);
    assert.equal(first.cancelled, true, 'the trip to the top is called off');
    assert.equal(firstGhost.parentNode, null, 'and the copy that was flying disappears');
    assert.equal(w.maximized, false, 'the window is back to its own size');
    assert.deepEqual(box(w), { left: '0px', top: '0px', width: '1024px', height: '738px' }, 'the cancelled move still lands, so the frame is where the bar left it');
    const second = lastFlight();
    assert.notEqual(second, first);
    assert.deepEqual(frame(second.frames[1]), { left: '300px', top: '220px', width: '424px', height: '19px' }, 'a bar now travels back to the window');
    second.finish();
    assert.deepEqual(box(w), { left: '282px', top: '218px', width: '460px', height: '300px' });
});

test('clicking a window while its bar is in the air lands the move', async () => {
    flights.length = 0;
    const { wm, w } = await arrival();
    wm.maximize(w);
    const flight = lastFlight();
    wm.focus(w);
    assert.equal(flight.cancelled, true);
    assert.equal(ghost(), null);
    assert.equal(w.motion, null, 'the window is no longer following a bar');
    assert.deepEqual(box(w), { left: '0px', top: '0px', width: '1024px', height: '738px' }, 'it is maximized at once rather than left half way');
});

test('a reader who asked for less motion gets the new box at once', async () => {
    flights.length = 0;
    motionPreference = true;
    try {
        const { wm, w } = await arrival();
        wm.maximize(w);
        assert.equal(flights.length, 0, 'nothing flies');
        assert.equal(ghost(), null);
        assert.deepEqual(box(w), { left: '0px', top: '0px', width: '1024px', height: '738px' }, 'the window simply changes box');
        wm.maximize(w);
        assert.equal(flights.length, 0);
        assert.deepEqual(box(w), { left: '282px', top: '218px', width: '460px', height: '300px' });
    }
    finally {
        motionPreference = false;
    }
});

test('a window with nothing to measure changes box without flying', async () => {
    const wm = desk();
    const w = wm.create({ title: 'No Layout' });
    wm.maximize(w);
    assert.equal(ghost(), null);
    assert.equal(w.maximized, true);
});

test('a window closed in the middle of the move leaves nothing behind', async () => {
    flights.length = 0;
    const { wm, w } = await arrival();
    wm.maximize(w);
    const flight = lastFlight();
    await wm.close(w);
    assert.equal(flight.cancelled, true);
    assert.equal(ghost(), null);
});

test('a window on the taskbar is brought forward before it fills the desktop', async () => {
    flights.length = 0;
    const { wm, w } = await arrival();
    wm.active = null;
    wm.maximize(w);
    assert.equal(wm.active, w, 'the window is the one in front');
    lastFlight().finish();
    assert.equal(w.maximized, true);
});

test('maximizing a window that was on the taskbar brings it back on screen', async () => {
    flights.length = 0;
    const { wm, w } = await arrival();
    wm.minimize(w);
    lastFlight().finish();
    assert.equal(w.element.hidden, true);
    flights.length = 0;
    wm.maximize(w);
    assert.equal(w.minimized, false, 'the window leaves the taskbar');
    assert.equal(w.element.hidden, false, 'and is on screen for the move');
    assert.equal(w.maximized, true);
    lastFlight()?.finish();
    assert.deepEqual(box(w), { left: '0px', top: '0px', width: '1024px', height: '738px' });
});
