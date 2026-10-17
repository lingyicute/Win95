import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTouchFlagHandler } from '../src/packages/games/mines-input.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fakeClock() {
    let time = 0, nextId = 0;
    const timers = new Map();
    return {
        now: () => time,
        setTimeout(fn, delay) {
            const id = ++nextId;
            timers.set(id, { fn, due: time + delay });
            return id;
        },
        clearTimeout(id) { timers.delete(id); },
        tick(milliseconds) {
            const end = time + milliseconds;
            while (true) {
                const due = [...timers.entries()]
                    .filter(([, timer]) => timer.due <= end)
                    .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
                if (!due)
                    break;
                const [id, timer] = due;
                timers.delete(id);
                time = timer.due;
                timer.fn();
            }
            time = end;
        },
    };
}

const touch = (pointerId = 1, clientX = 20, clientY = 30) => ({
    pointerType: 'touch', pointerId, button: 0, isPrimary: true, clientX, clientY,
});

function setup() {
    const clock = fakeClock(), flags = [];
    const input = createTouchFlagHandler(index => flags.push(index), {
        now: clock.now,
        setTimeoutFn: clock.setTimeout,
        clearTimeoutFn: clock.clearTimeout,
    });
    return { input, clock, flags };
}

test('a long touch flags once when the browser also emits contextmenu', () => {
    const { input, clock, flags } = setup();
    input.pointerDown(12, touch());
    clock.tick(500);
    assert.deepEqual(flags, [12], 'the explicit long-press timer flags the square');

    assert.equal(input.contextMenu(), true, 'the native event for the same held touch is consumed');
    input.pointerEnd(1);
    assert.equal(input.contextMenu(), true, 'a delayed duplicate after pointerup is consumed too');
    assert.deepEqual(flags, [12], 'neither contextmenu toggles the flag a second time');
    assert.equal(input.consumeClick(12), true, 'the synthetic click after long-press is swallowed');
    assert.equal(input.consumeClick(12), false, 'only one synthetic click is swallowed');
    assert.equal(input.contextMenu(), false, 'the suppression expires after its duplicate is consumed');
});

test('contextmenu can win the race with the timer without losing or duplicating the flag', () => {
    const { input, clock, flags } = setup();
    input.pointerDown(7, touch(2));
    assert.equal(input.contextMenu(), true);
    assert.deepEqual(flags, [7], 'contextmenu handles the active long-press once and cancels its timer');
    clock.tick(600);
    assert.deepEqual(flags, [7]);
    input.pointerEnd(2);
    assert.equal(input.consumeClick(7), true);
});

test('a short tap remains a reveal gesture and an ordinary mouse contextmenu is left to the app', () => {
    const { input, clock, flags } = setup();
    input.pointerDown(4, touch());
    input.pointerEnd(1);
    clock.tick(600);
    assert.deepEqual(flags, [], 'releasing before the threshold cancels the flag timer');
    assert.equal(input.contextMenu(), false, 'there is no stale touch contextmenu to consume');

    input.pointerDown(4, { pointerType: 'mouse', pointerId: 2, button: 2, isPrimary: true });
    assert.equal(input.contextMenu(), false, 'desktop right-click still reaches the existing flag action');
    assert.deepEqual(flags, []);
});

test('moving off a square cancels its long-press flag, and reset clears pending work', () => {
    const { input, clock, flags } = setup();
    input.pointerDown(3, touch(1, 20, 30));
    input.pointerMove({ pointerId: 1, clientX: 31, clientY: 30 });
    clock.tick(600);
    assert.deepEqual(flags, [], 'a drag is not mistaken for a long-press');
    assert.equal(input.contextMenu(), true, 'a browser contextmenu during the cancelled touch is ignored');
    input.pointerEnd(1);
    assert.equal(input.contextMenu(), true, 'the trailing native event is ignored as well');

    input.pointerDown(9, touch(3));
    input.cancel();
    clock.tick(600);
    assert.deepEqual(flags, [], 'reset/close cancellation prevents a stale timer from touching the new board');
});

test('the Minesweeper view routes touch, contextmenu and click through the gesture guard', async () => {
    const source = await readFile(path.join(root, 'src/packages/games/apps.js'), 'utf8');
    assert.match(source, /import \{ createTouchFlagHandler \} from '\.\/mines-input\.js'/);
    assert.match(source, /const touchFlags = createTouchFlagHandler\(i => \{\s*game\.flag\(i\);\s*render\(\);\s*\}\)/);
    assert.match(source, /if \(!touchFlags\.contextMenu\(\)\)/, 'only non-touch context menus use the direct flag action');
    assert.match(source, /touchFlags\.pointerDown\(i, e\)/);
    assert.match(source, /touchFlags\.pointerEnd\(e\.pointerId\)/);
    assert.match(source, /touchFlags\.pointerMove\(e\)/);
    assert.match(source, /e\.detail > 0 \|\| e\.pointerType === 'touch'/, 'keyboard activation is not mistaken for a synthetic touch click');
    assert.match(source, /touchFlags\.consumeClick\(i\)/);
    assert.match(source, /touchFlags\.cancel\(\)/, 'reset and close clean up a pending gesture');
    assert.doesNotMatch(source, /setTimeout\(\(\) => \{ game\.flag\(i\); render\(\); \}, 500\)/, 'the old uncoordinated timer is gone');
});
