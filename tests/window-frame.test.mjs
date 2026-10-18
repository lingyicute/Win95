import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const rule = selector => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(match => match[1].trim() === selector)
    .map(match => match[2]).join(';');

// The light and dark bevels are geometrically equal, but the dark edge reads
// thinner. Keep the approved extra half pixel of face colour on the right, rather
// than changing the shared bevel colours or moving/resizing the outer box.
test('windows reserve half a pixel more face colour on the right', () => {
    const frame = rule('.window');
    assert.match(frame, /(?:^|;)padding:3px 3\.5px 3px 3px(?:;|$)/,
        'top, bottom and left stay at 3px; only the right grows, to 3.5px');
    assert.match(frame, /box-shadow:var\(--window-edge\)/,
        'retain the existing window bevel');
    assert.match(rule('*'), /box-sizing:border-box/,
        'the extra padding comes from the client area, not the outer size');
});

test('the extra window padding does not widen menus or preview windows', () => {
    for (const selector of ['.popup-menu', '.mini-window']) {
        assert.match(rule(selector), /(?:^|;)padding:3px(?:;|$)/, selector);
        assert.doesNotMatch(rule(selector), /padding-right:/, selector);
    }
    assert.match(rule('button'), /box-shadow:var\(--raised\)/,
        'buttons retain their separate raised bevel');
});
