import test from 'node:test';
import assert from 'node:assert/strict';
import { installClipboard } from '../src/packages/core/clipboard.js';

const stubSystemClipboard = readText => {
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { clipboard: { readText, writeText: async () => { } } }
    });
};

test('a failed or empty paste is a no-op, never a wipe', async () => {
    const s = {};
    stubSystemClipboard(async () => { throw new Error('denied'); });
    installClipboard(s);
    s.copyText('hello');
    assert.equal(await s.pasteText(), 'hello', 'the internal clipboard holds the copy');
    s.clipboard = null;
    assert.equal(await s.pasteText(), null, 'a denied system read yields null, not the empty string');
    stubSystemClipboard(async () => '');
    assert.equal(await s.pasteText(), null, 'an empty system read is null as well');
    stubSystemClipboard(async () => 'sys');
    assert.equal(await s.pasteText(), 'sys', 'a real system read still comes through');
});
