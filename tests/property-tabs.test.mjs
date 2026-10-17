import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

test('property sheet tabs directly meet the settings panel border', () => {
    assert.match(css, /\.properties-layout\s*\{[^}]*gap\s*:\s*0\s*[;}]/);
    assert.match(css, /\.properties-layout\s*>\.dialog-buttons\s*\{[^}]*margin-top\s*:\s*10px\s*[;}]/);
    assert.doesNotMatch(css, /\.tab-strip\s*\{[^}]*margin-bottom\s*:/);
});
