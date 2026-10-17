import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const manager = await readFile(new URL('../src/packages/shell/window-manager.js', import.meta.url), 'utf8');

test('a configured Windows password gates the initial desktop behind login', () => {
    assert.match(main, /if \(s\.settings\.get\('loginPassword', ''\)\)\s+document\.body\.classList\.add\('logged-off'\);/);
    assert.match(main, /if \(s\.settings\.get\('loginPassword', ''\)\)\s+showLoginDialog\(\{ startup: true \}\);/);
    assert.match(main, /if \(!authenticated\)\s*\{\s*document\.body\.classList\.add\('logged-off'\);\s*queueMicrotask\(\(\) => showLoginDialog\(\{ startup \}\)\);/);
});

test('password-protected startup defers the startup sound until successful login', () => {
    assert.match(main, /if \(!s\.settings\.get\('loginPassword', ''\)\)\s+s\.playSound\('startup'\);/);
    /* A sign-in chimes whether it follows a boot or a log off, so what is
       pinned down here is that the chime waits for the login to succeed. */
    assert.match(main, /if \(!authenticated\)[\s\S]*?return;\s*\}\s*document\.body\.classList\.remove\('logged-off'\);[\s\S]*?s\.playSound\('startup'\);/);
});

test('the sign-in dialog cannot be dismissed: no Cancel button and no close box', () => {
    assert.match(main, /s\.ui\.modal\('Enter Windows Password', \{[^}]*closable: false\s*\}\)/);
    assert.doesNotMatch(main, /button\('Cancel', \(\) => login\.close/);
    assert.match(manager, /if \(o\.closable !== false\)\s*controls\.append\(close\);/);
    assert.match(manager, /if \(o\.closable !== false\)\s*onDoubleActivate\(sys, \(\) => w\.close\(\)\);/);
    assert.match(manager, /disabled: w\.options\.closable === false, action: \(\) => w\.close\(\)/);
});
