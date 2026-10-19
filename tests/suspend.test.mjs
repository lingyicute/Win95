import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * Suspend puts the desktop to sleep behind a black screen. The way back is the
 * first thing the user does - a press anywhere or any key - and that press or
 * key is spent waking the screen: it must not also click a window that was
 * hidden under the black or type a character into a note left focused.
 *
 * The shim keeps one listener list per event type and no phases, so the tests
 * call the listeners the shell installed and check what the event was told.
 */
installDom();
register('./win95-resolver.mjs', import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { installSuspend } = await import('../src/packages/shell/suspend.js');

const event = () => ({
    defaultPrevented: false,
    stopped: false,
    immediate: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.stopped = true; },
    stopImmediatePropagation() { this.immediate = true; }
});
const fire = (type, e) => {
    for (const listener of document.listeners.get(type) ?? [])
        listener(e ?? event());
};
const screen = () => document.body.querySelector('.suspend-screen');
const sleeping = () => screen().hidden === false;

const fresh = () => {
    document.body.replaceChildren();
    document.listeners = new Map();
    const s = { suspended: false, lastActivity: 0 };
    const suspend = installSuspend(s);
    return { s, suspend };
};

test('the screen is black from the moment the desktop is suspended', () => {
    const { s, suspend } = fresh();
    assert.equal(sleeping(), false, 'the desktop starts awake');
    suspend();
    assert.equal(sleeping(), true, 'the black screen covers everything');
    assert.equal(s.suspended, true, 'and the rest of the shell can tell');
    assert.equal(screen().getAttribute('aria-hidden'), 'true', 'there is nothing to read on a black screen');
    assert.ok(s.lastActivity > 0, 'the inactivity clock starts again, so no screensaver follows the black screen');
});

test('a press wakes it, and that press goes no further', () => {
    const { s, suspend } = fresh();
    suspend();
    const press = event();
    fire('pointerdown', press);
    assert.equal(sleeping(), false, 'the desktop is back');
    assert.equal(s.suspended, false);
    assert.equal(press.defaultPrevented, true, 'the press does not also reach the window it was covering');
    assert.equal(press.immediate, true, 'nothing else hears the press either');
});

test('any key wakes it, and is not typed into a note', () => {
    const { s, suspend } = fresh();
    suspend();
    const key = event();
    fire('keydown', key);
    assert.equal(sleeping(), false);
    assert.equal(s.suspended, false);
    assert.equal(key.defaultPrevented, true, 'a key that wakes the desktop types nothing');
    assert.equal(key.immediate, true);
});

test('the click built from the waking press is let go, the next one is not', () => {
    const { suspend } = fresh();
    suspend();
    fire('pointerdown', event());
    const wakeClick = event();
    fire('click', wakeClick);
    assert.equal(wakeClick.defaultPrevented, true, 'the press was on the black screen, not on what it covered');
    const realClick = event();
    fire('click', realClick);
    assert.equal(realClick.defaultPrevented, false, 'the very next click is the user’s own');
});

test('an awake desktop ignores all of it', () => {
    fresh();
    const press = event(), key = event(), click = event();
    fire('pointerdown', press);
    fire('keydown', key);
    fire('click', click);
    assert.equal(press.defaultPrevented, false);
    assert.equal(key.defaultPrevented, false);
    assert.equal(click.defaultPrevented, false);
    assert.equal(sleeping(), false);
});

test('suspending twice does not stack screens', () => {
    const { s, suspend } = fresh();
    suspend();
    suspend();
    assert.equal(document.body.querySelectorAll('.suspend-screen').length, 1);
    assert.equal(sleeping(), true);
});

test('the desktop puts Suspend between Log Off and Shut Down, with the moon on its screen', async () => {
    const main = await readFile(path.join(root, 'src/main.js'), 'utf8');
    const line = main.split('\n').find(text => text.includes("'Log Off…'")) ?? '';
    const at = label => line.indexOf(`label: '${label}'`);
    assert.ok(at('Log Off…') >= 0 && at('Suspend') > at('Log Off…') && at('Shut Down…') > at('Suspend'), 'the new command sits between the two');
    assert.match(line, /\{ label: 'Suspend', icon: 'suspend', action: s\.suspend \}/, 'it hangs up the desktop');

    const icons = await readFile(path.join(root, 'src/packages/ui/icons.js'), 'utf8');
    assert.match(icons, /suspend: 'suspend'/, 'the icon name resolves to its own art');
    const data = await readFile(path.join(root, 'src/packages/ui/icon-data.js'), 'utf8');
    assert.match(data, /"suspend-32":"data:image\/png;base64,/, 'the moon screen is inlined like the other icons');
    assert.match(data, /"suspend-16":"data:image\/png;base64,/);

    const i18n = await readFile(path.join(root, 'src/packages/core/i18n.js'), 'utf8');
    assert.match(i18n, /'Suspend': '挂起'/, 'and it is called 挂起 in Chinese');
});

test('the black screen is above everything else on the page', async () => {
    const css = await readFile(path.join(root, 'src/styles.css'), 'utf8');
    const rule = /\.suspend-screen\{([^}]*)\}/.exec(css)?.[1] ?? '';
    assert.match(rule, /position:fixed/, 'it covers the viewport, not a window');
    assert.match(rule, /inset:0/);
    assert.match(rule, /background:#000/, 'black');
    const z = Number(/z-index:(\d+)/.exec(rule)?.[1] ?? 0);
    const screensaver = Number(/\.screensaver\{[^}]*z-index:(\d+)/.exec(css)?.[1] ?? 0);
    const boot = Number(/#boot\{[^}]*z-index:(\d+)/.exec(css)?.[1] ?? 0);
    assert.ok(z > screensaver && z > boot, 'nothing of the desktop can be seen through it');
    assert.match(css, /\.suspend-screen\[hidden\]\{display:none\}/, 'and it is gone the moment the desktop wakes');
});
