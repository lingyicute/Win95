import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The Calculator was born too short: its window was 287px tall while its own
 * contents needed 315, so the display was squeezed by three pixels and the
 * bottom row of keys - √, 1/x, %, = - was cut off by the window's edge. The
 * window has no scrollbar, so nothing hinted that anything was missing.
 *
 * These checks recompute the height the calculator needs from the stylesheet
 * and compare it with the height the application asks for, so changing a
 * button's height, a gap or the frame's padding fails here instead of quietly
 * clipping the keypad again. The scientific view is checked the same way: it
 * adds a row of functions and the gap above them.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const [css, app] = await Promise.all([
    readFile(path.join(root, 'src/styles.css'), 'utf8'),
    readFile(path.join(root, 'src/packages/apps/documents.js'), 'utf8')
]);

const rule = selector => {
    const pattern = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '\\s+') + '\\{([^}]*)\\}');
    return pattern.exec(css)?.[1] ?? '';
};
const px = (value, name) => {
    const found = new RegExp('(?:^|;)' + name + ':\\s*(\\d+(?:\\.\\d+)?)px').exec(';' + value)?.[1];
    assert.ok(found !== undefined, `${name} is spelled out in pixels in ${value.slice(0, 40)}…`);
    return Number(found);
};
const short = (padding, which) => {
    const parts = padding.trim().split(/\s+/).map(parseFloat);
    const [top, right = top, bottom = top, left = right] = parts;
    return { top, right, bottom, left }[which];
};
const padding = (value, which) => {
    const found = /(?:^|;)padding:\s*([^;}]+)/.exec(';' + value)?.[1];
    return found ? short(found, which) : 0;
};

const frame = padding(rule('.window'), 'top') + padding(rule('.window'), 'bottom')
    + px(rule('.title-bar'), 'height') + px(rule('.menu-bar'), 'height');
const body = 2 * padding(rule('.calculator-body'), 'top')
    + px(rule('.calculator-display'), 'height')
    + 2 * px(rule('.calculator-body'), 'gap')
    + px(rule('.calculator-memory .memory-indicator'), 'height');

/* The keys: the standard pad is written out as one list, and '=' spans two
   cells, so the rows follow from the count and the number of columns. */
const layout = /const layout = \[([^\]]*)\]/.exec(app)?.[1] ?? '';
const keys = layout.split(',').map(entry => entry.trim()).filter(Boolean);
const wide = (app.match(/k === '=' \? 'wide'/g) ?? []).length;
const columns = Number(/gridTemplateColumns: 'repeat\((\d+),1fr\)'/.exec(app)?.[1]);
const keyRows = Math.ceil((keys.length + wide) / columns);
const keypad = keyRows * px(rule('.calculator-keys button'), 'height') + (keyRows - 1) * px(rule('.calculator-keys'), 'gap');

const scientificButtons = /const scientificKeys = el\('div', \{[^}]*\}, \.\.\.\[([^\]]*)\]/.exec(app)?.[1] ?? '';
const scientificCount = scientificButtons.split(',').filter(Boolean).length;
const scientificRows = Math.ceil(scientificCount / 5);
const scientificGrid = scientificRows * px(rule('button'), 'min-height')
    + (scientificRows - 1) * px(rule('.calculator-scientific'), 'gap');

const needed = frame + body + keypad;
const neededScientific = needed + px(rule('.calculator-body'), 'gap') + scientificGrid;

/* Both sizes are written together, as a pair of constants. */
const numbers = Object.fromEntries([...app.matchAll(/CALCULATOR_[A-Z_]+ = (\d+)/g)]
    .map(m => [m[0].slice('CALCULATOR_'.length, m[0].indexOf(' = ')), Number(m[1])]));

test('the standard view is tall enough for its own keypad', () => {
    assert.equal(keyRows, 5, 'five rows of keys make the calculator as tall as it is');
    assert.equal(keys.length, 24, 'the standard pad has twenty-four keys');
    assert.equal(columns, 5, 'and lays them out in five columns, with = covering two cells');
    assert.equal(needed, 315, 'frame, body and keypad add up to this');
    assert.equal(numbers.HEIGHT, needed, 'the window is born this tall, so nothing is squeezed or cut off');
});

test('the scientific view leaves room for the extra row and the gap above it', () => {
    assert.equal(scientificRows, 2, 'ten functions fit in two rows of five');
    assert.equal(scientificGrid, 50, 'two rows of twenty-three-pixel buttons with four pixels between them');
    assert.equal(neededScientific, 373);
    assert.equal(numbers.SCIENTIFIC_HEIGHT, neededScientific, 'switching to Scientific grows the window by exactly this much');
});

test('both sizes are the ones the window uses', () => {
    assert.match(app, /height: CALCULATOR_HEIGHT,/, 'the window is created with the measured height');
    assert.equal(numbers.WIDTH, 294, 'the width needed no change: the five columns already fit');
    assert.equal(numbers.SCIENTIFIC_WIDTH, 354);
    assert.match(app, /w\.rect\.height = mode \? CALCULATOR_SCIENTIFIC_HEIGHT : CALCULATOR_HEIGHT/, 'and switching views uses them too');
    assert.doesNotMatch(app, /height: 287|w\.rect\.height = mode \? 365 : 287/, 'the short sizes are gone');
});

test('the body cannot scroll its way out of a short window', async () => {
    const manager = await readFile(path.join(root, 'src/packages/shell/window-manager.js'), 'utf8');
    assert.match(rule('.window-body'), /overflow:hidden/, 'a short window hides what does not fit rather than offering a scrollbar');
    assert.match(manager, /height = Math\.min\(o\.height, innerHeight - 40\)/, 'and the window keeps the height it asked for');
});
