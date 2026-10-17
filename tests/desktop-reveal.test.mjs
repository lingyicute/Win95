import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { installDom } from './dom-shim.mjs';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const { revealDesktopLayers, REVEAL_LAYERS } = await import('../src/packages/shell/desktop-reveal.js');

/** A timer stand-in that records the requested waits and fires on demand. */
function clock() {
    const queue = [];
    return {
        schedule: (run, ms) => {
            queue.push({ run, ms });
            return queue.length;
        },
        /** Runs every timer whose deadline is at or before `ms`, earliest first. */
        runUpTo: async ms => {
            const due = queue.filter(job => job.ms <= ms).sort((a, b) => a.ms - b.ms);
            for (const job of due) {
                queue.splice(queue.indexOf(job), 1);
                job.run();
            }
            await null;
        },
        waits: () => queue.map(job => job.ms)
    };
}

const hiddenLayers = body => REVEAL_LAYERS.map(({ layer }) => layer).filter(layer => body.classList.contains('reveal-' + layer));

test('the reveal waits 150 ms for the icons, 100 ms more for the taskbar and 200 ms more for the windows', () => {
    assert.deepEqual(REVEAL_LAYERS.map(({ layer }) => layer), ['icons', 'taskbar', 'windows'], 'background first, then icons, taskbar, windows');
    assert.deepEqual(REVEAL_LAYERS.map(({ ms }) => ms), [150, 100, 200], 'every wait is measured from the layer before it');
});

test('only the background is on screen when the reveal begins', async () => {
    installDom();
    const body = document.body;
    const timer = clock();
    const revealed = [];
    revealDesktopLayers({ body, onLayer: layer => revealed.push(layer), schedule: timer.schedule });
    assert.deepEqual(hiddenLayers(body), ['icons', 'taskbar', 'windows'], 'nothing but the wallpaper is visible yet');
    assert.ok(body.classList.contains('revealing'), 'the desktop is marked as mid-reveal');
    assert.deepEqual(revealed, [], 'no layer is revealed on its own until a deadline passes');
});

test('the layers arrive one after another on their own deadlines', async () => {
    installDom();
    const body = document.body;
    const timer = clock();
    const revealed = [];
    const done = revealDesktopLayers({ body, onLayer: layer => revealed.push(layer), schedule: timer.schedule });
    assert.deepEqual(timer.waits(), [150, 250, 450], 'the deadlines are cumulative, not three timers of one length');
    await timer.runUpTo(100);
    assert.deepEqual(hiddenLayers(body), ['icons', 'taskbar', 'windows'], '100 ms in, the icons are still waiting');
    await timer.runUpTo(150);
    assert.deepEqual(hiddenLayers(body), ['taskbar', 'windows']);
    await timer.runUpTo(250);
    assert.deepEqual(hiddenLayers(body), ['windows'], 'the taskbar shows 100 ms after the icons');
    await timer.runUpTo(450);
    assert.deepEqual(hiddenLayers(body), [], 'the windows close the sequence 200 ms after the taskbar');
    assert.ok(!body.classList.contains('revealing'), 'a finished reveal leaves no state behind');
    await done;
    assert.deepEqual(revealed, ['icons', 'taskbar', 'windows']);
});

test('the window layer is told before it shows, so windows open into a visible desktop', async () => {
    installDom();
    const body = document.body;
    const timer = clock();
    const order = [];
    const done = revealDesktopLayers({
        body,
        schedule: timer.schedule,
        onLayer: layer => {
            order.push(`${layer}:${hiddenLayers(body).join('|')}`);
        }
    });
    await timer.runUpTo(450);
    assert.deepEqual(order, ['icons:icons|taskbar|windows', 'taskbar:taskbar|windows', 'windows:windows'], 'the callback sees the layer it is about to reveal still hidden');
    await done;
});

test('the real timers take the whole 450 ms and no layer stays hidden', async () => {
    installDom();
    const body = document.body;
    const revealed = [];
    const started = Date.now();
    await revealDesktopLayers({ body, onLayer: layer => revealed.push(layer) });
    assert.ok(Date.now() - started >= 440, 'the reveal is not early');
    assert.deepEqual(hiddenLayers(body), []);
    assert.deepEqual(revealed, ['icons', 'taskbar', 'windows']);
});

test('a layer whose reveal throws does not strand the layers after it', async () => {
    installDom();
    const body = document.body;
    const timer = clock();
    const seen = [];
    const errors = [];
    const warn = console.error;
    console.error = (...args) => errors.push(args[0]);
    try {
        const done = revealDesktopLayers({
            body,
            schedule: timer.schedule,
            onLayer: layer => {
                seen.push(layer);
                if (layer === 'icons')
                    throw new Error('the icons layer exploded');
            }
        });
        await timer.runUpTo(450);
        await done;
    }
    finally {
        console.error = warn;
    }
    assert.deepEqual(seen, ['icons', 'taskbar', 'windows'], 'the failure stops the icons callback only');
    assert.deepEqual(hiddenLayers(body), []);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /icons layer/);
});

test('the reveal hides the layers through the body classes the stylesheet styles', async () => {
    installDom();
    const body = document.body;
    const timer = clock();
    const done = revealDesktopLayers({ body, schedule: timer.schedule });
    for (const { layer } of REVEAL_LAYERS)
        assert.match(css, new RegExp(`\\.reveal-${layer} [^{]+\\{visibility:hidden\\}`), `.${layer} must hide its layer`);
    await timer.runUpTo(450);
    await done;
});

test('a passwordless start reveals the desktop once the boot screen is gone, not before', () => {
    assert.match(main, /setTimeout\(\(\) => \{\s*bootEl\.remove\(\);\s*if \(!s\.settings\.get\('loginPassword', ''\)\)\s+s\.revealDesktop\(\);/, 'the reveal waits for the splash to be removed and skips a sign-in waiting for its password');
    assert.doesNotMatch(main, /else \{\s*s\.launch\('computer'/, 'the start-up windows are no longer opened behind the boot screen');
    assert.match(main, /else if \(!bootEl\)\s*[\s\S]{0,200}?s\.revealDesktop\(\);/, 'without a boot screen the reveal starts straight away');
});

test('a sign-in and a log off both run the same staged reveal', () => {
    assert.match(main, /if \(s\.settings\.get\('loginPassword', ''\)\)\s+document\.body\.classList\.add\('logged-off'\);/);
    assert.match(main, /document\.body\.classList\.remove\('logged-off'\);\s+renderDesktop\(\);\s+s\.updateClock\(\);[\s\S]*?s\.playSound\('startup'\);\s+s\.revealDesktop\(\);/, 'the desktop is revealed in stages after the password is accepted');
    assert.match(main, /s\.revealDesktop = \(\) => \{[\s\S]*?if \(layer === 'windows'\) startupWindows\(\);/, 'the windows layer opens the start-up windows of that sign-in, be it a boot or a new login');
});

test('a reveal already in flight is not restarted by the next sign-in', () => {
    assert.match(main, /if \(!desktopReveal\) \{\s*desktopReveal = revealDesktopLayers\(/);
    assert.match(main, /desktopReveal\.then\(\(\) => \{ desktopReveal = null; \}\);/, 'the finished reveal frees the way for the next one');
});

test('a log off and a new sign-in open the start-up windows just like a boot does', () => {
    assert.match(main, /s\.playSound\('startup'\);\s+s\.revealDesktop\(\);/, 'every accepted sign-in chimes and then reveals');
    assert.doesNotMatch(main, /if \(startup && authenticated\)/, 'no first-login-only gate is left on the windows or the chime');
    assert.match(main, /const startupWindows = \(\) => \{[\s\S]*?if \(s\.settings\.get\('showWelcome', true\)\)/, 'the Welcome window still obeys its own setting');
});
