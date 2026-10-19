import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

test('property sheet tabs directly meet the settings panel border', () => {
    assert.match(css, /\.properties-layout\s*\{[^}]*gap\s*:\s*0\s*[;}]/);
    assert.match(css, /\.properties-layout\s*>\.dialog-buttons\s*\{[^}]*margin-top\s*:\s*10px\s*[;}]/);
    assert.doesNotMatch(css, /\.tab-strip\s*\{[^}]*margin-bottom\s*:/);
});

const rule = selector => [...css.matchAll(new RegExp(`(?:^|})${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^}]*)\\}`, 'g'))]
    .map(match => match[1]).join(';');

test('tab cards sit tight on their text with rounded top corners', () => {
    const tab = rule('.tab-strip button');
    assert.match(tab, /padding:3px 6px 1px/, 'the label keeps 6 px at its sides and sits a touch low in its card');
    assert.match(tab, /border-radius:5px 5px 0 0/, 'top-left and top-right corners are rounded, the feet stay square');
    assert.match(tab, /border-bottom:0/, 'the card opens into the panel below');
    assert.match(rule('.tab-strip button.active'), /padding:5px 9px 4px/, 'the active card is wider than its neighbours and its label rides a pixel higher');
    assert.match(rule('.tab-strip button.active'), /height:26px/, 'and taller, rising above them');
    assert.match(rule('.tab-strip button.active'), /margin-top:-5px/, 'the extra height goes above the strip, not into the panel');
    assert.match(rule('.tab-strip button+button'), /margin-left:-1px/, 'neighbouring cards share a single separator line');
    assert.match(rule('.tab-strip'), /padding-left:0/, 'the first card starts flush with the panel');
    assert.match(rule('.tab-strip button:active:not(:disabled)'), /padding:3px 6px 1px/, 'pressing a card does not resize it');
    assert.match(rule('.tab-strip button.active:active:not(:disabled)'), /padding:5px 9px 4px/, 'nor does the active card lose its size while pressed');
});
