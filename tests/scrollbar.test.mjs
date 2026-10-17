import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

test('scrollbar button rules hide the inner arrows at both ends', () => {
    for (const selector of [
        '::-webkit-scrollbar-button:vertical:increment:start',
        '::-webkit-scrollbar-button:vertical:decrement:end',
        '::-webkit-scrollbar-button:horizontal:increment:start',
        '::-webkit-scrollbar-button:horizontal:decrement:end'
    ]) {
        const start = css.indexOf(selector);
        assert.notEqual(start, -1, `missing positional scrollbar rule: ${selector}`);
        const end = css.indexOf('}', start);
        assert.match(css.slice(start, end), /display\s*:\s*none\s*!important/i);
    }
});
