import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/packages/games/apps.js', import.meta.url), 'utf8');

test('Minesweeper settles the clock before it records a best time', () => {
    const finish = app.slice(app.indexOf('const finish = () => {'), app.indexOf('const reveal = i =>'));
    const settle = finish.indexOf('seconds = Math.floor((Date.now() - startTime) / 1000)');
    const record = finish.indexOf('best[key] = seconds');
    assert.ok(settle > 0, 'finish reads the clock when the game ends');
    assert.ok(record > settle, 'the record uses the settled time, not the last timer tick');
    assert.match(finish, /if \(startTime\)\s+seconds =/, 'a game that never started keeps 0 seconds');
});
