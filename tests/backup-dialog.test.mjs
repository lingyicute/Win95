import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/packages/apps/utilities.js', import.meta.url), 'utf8');
const start = source.indexOf('export function backup');
const next = source.indexOf('export function', start + 1);
const backup = source.slice(start, next);

test('the backup dialog offers its actions once, in the button row', () => {
    assert.ok(backup.length > 1000, 'the backup function was found');
    assert.doesNotMatch(backup, /class: 'tab-strip'/, 'no cards above the file list - they pretended to be pages');
    assert.doesNotMatch(backup, /\(\) => \{ \}/, 'and no tab handler left doing nothing');
    assert.match(backup, /dialog-buttons[\s\S]*button\('Start Backup'[\s\S]*button\('Restore…', restore\)[\s\S]*button\('Close'/, 'back up, restore and close, once each');
    assert.equal([...backup.matchAll(/button\('Restore…', restore\)/g)].length, 1, 'restore is wired exactly once, in the button row');
});
