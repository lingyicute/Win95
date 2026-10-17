import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

test('a configured Windows password gates the initial desktop behind login', () => {
    assert.match(main, /if \(s\.settings\.get\('loginPassword', ''\)\)\s+document\.body\.classList\.add\('logged-off'\);/);
    assert.match(main, /if \(s\.settings\.get\('loginPassword', ''\)\)\s+showLoginDialog\(\{ startup: true \}\);/);
    assert.match(main, /if \(!authenticated\)\s*\{\s*document\.body\.classList\.add\('logged-off'\);\s*queueMicrotask\(\(\) => showLoginDialog\(\{ startup \}\)\);/);
});
