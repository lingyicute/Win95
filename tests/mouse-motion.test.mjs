import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDom } from './dom-shim.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const panel = await readFile(path.join(root, 'src/packages/apps/control-panel.js'), 'utf8');
const trails = await readFile(path.join(root, 'src/packages/shell/pointer-trails.js'), 'utf8');
const main = await readFile(path.join(root, 'src/main.js'), 'utf8');
const i18n = await readFile(path.join(root, 'src/packages/core/i18n.js'), 'utf8');

test('the mouse sheet carries a Motion tab with the pointer trail group', () => {
    const motion = panel.slice(panel.indexOf("['Motion'"), panel.indexOf("['Pointers'"));
    assert.ok(motion.length > 100, 'the Motion page exists before Pointers');
    assert.match(motion, /legend', \{ text: 'Pointer Trail' \}/);
    assert.match(motion, /Show pointer trails/);
    assert.match(motion, /text: 'Short'/);
    assert.match(motion, /text: 'Long'/);
    assert.match(motion, /ticks: 7/, 'the trail slider carries the tick row from the original');
    assert.match(motion, /trail\.disabled = !/, 'the slider greys out while trails are off');
    assert.match(motion, /settings\.set\('pointerTrails'/);
    assert.match(motion, /settings\.set\('trailLength'/);
});

test('the trail driver leaves copies of the pointer along its recent path', () => {
    assert.match(trails, /export function pointerTrails/);
    assert.match(trails, /class: 'pointer-trails'/);
    assert.match(trails, /class: 'pointer-trail'/);
    assert.match(trails, /mousemove/);
    assert.match(trails, /settings\.get\('pointerTrails'/);
    assert.match(trails, /settings\.get\('trailLength'/);
    assert.match(trails, /requestAnimationFrame/);
});

test('the left-handed configuration really swaps the buttons', () => {
    assert.match(main, /pointerTrails\(s\)/, 'the shell starts the trail driver');
    assert.match(main, /settings\.get\('leftHanded'/);
    assert.match(main, /win95Synthetic/, 'the synthetic context menu is marked');
    assert.match(main, /s\.wm\.primary = e =>/, 'window dragging follows the swapped primary button');
    assert.match(panel, /settings\.set\('leftHanded'/, 'the checkbox commits to a top-level setting');
});

test('the trail wording is translated', () => {
    for (const [en, zh] of [['Motion', '移动'], ['Pointer Trail', '鼠标轨迹'], ['Show pointer trails', '显示鼠标轨迹'], ['Short', '短'], ['Long', '长']])
        assert.match(i18n, new RegExp(`'${en}': '${zh}'`), en);
});

test('the trackbar can carry a custom tick row and a disabled state', async () => {
    installDom();
    globalThis.requestAnimationFrame = () => 0;
    const { trackbar } = await import('../src/packages/ui/trackbar.js');
    const bar = trackbar({ label: 'Pointer trail length', ticks: 7 });
    assert.equal(bar.querySelectorAll('.win95-trackbar-tick').length, 7, 'seven ticks like the original slider');
    assert.equal(bar.disabled, false);
    bar.disabled = true;
    assert.match(bar.getAttribute('class'), /win95-trackbar-disabled/);
    assert.equal(bar.getAttribute('aria-disabled'), 'true');
    assert.equal(bar.tabIndex, -1);
    bar.disabled = false;
    assert.equal(bar.getAttribute('aria-disabled'), 'false');
    assert.equal(bar.tabIndex, 0);
});
