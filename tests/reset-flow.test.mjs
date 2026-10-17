import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

test('login reset confirms first, clears app data, then plays shutdown audio before reload', () => {
    assert.match(main, /button\('Reset', resetData/);
    assert.match(main, /Resetting Windows will erase all files and settings\. Continue\?/);
    for (const key of ['win95-settings', 'win95-volume', 'win95-journal'])
        assert.ok(main.includes(`'${key}'`), `reset must remove ${key}`);
    assert.match(main, /indexedDB\.deleteDatabase\('win95-desktop'\)/);
    assert.match(main, /await waitForSoundEnd\(s\.playSound\('shutdown'\)\);\s+location\.reload\(\);/);
});
