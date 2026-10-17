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

test('login reset asks twice, and both warnings are bold with the second one heavier', () => {
    assert.match(main, /el\('strong', \{ text: 'Resetting Windows will erase all files and settings\. Continue\?' \}\)/);
    assert.match(main, /el\('strong', \{ text: 'This is your last warning: every file and setting will be permanently erased\. This cannot be undone\.' \}\)/);
    assert.match(main, /text: 'Really reset Windows\?'/);
    assert.match(main, /\) !== 'Yes'\)\s*return;\s*resetting = true;/, 'the heavier second prompt must gate the reset on an explicit Yes');
});
