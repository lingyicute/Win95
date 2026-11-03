import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const explorer = await readFile(new URL('../src/packages/apps/explorer.js', import.meta.url), 'utf8');

test('Up One Level does nothing in the Recycle Bin and Network Neighborhood, like Backspace', () => {
    assert.match(explorer, /const upOneLevel = \(\) => path === 'recycle' \|\| path === 'network' \? undefined : navigate\(/);
    assert.match(explorer, /path !== 'computer' && path !== 'recycle' && path !== 'network'\)\s*navigate\(/, 'Backspace keeps its guard');
});

test('the folder tree hides only the Recycled folder, not names that contain the word', () => {
    assert.doesNotMatch(explorer, /includes\('recycled'\)/);
    assert.match(explorer, /n\.path\.toLowerCase\(\) !== 'c:\\\\recycled'/);
});
