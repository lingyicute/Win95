/* Round-5 guards: sub-3-byte files must take the friendly "not a cursor"
   path instead of throwing a raw RangeError out of isGif, and trailGhost
   must escape settings-supplied URLs before they reach innerHTML. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCursorFile, trailGhost } from '../src/packages/shell/cursors.js';

const settingsStub = values => ({ settings: { get: (name, fallback) => values[name] ?? fallback, addEventListener() { }, removeEventListener() { } } });
const fakeFile = (name, bytes) => ({ name, size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });

test('tiny files get the friendly "not a cursor" error, not a RangeError', async () => {
    for (const length of [0, 1, 2]) {
        await assert.rejects(
            () => parseCursorFile(fakeFile('tiny.cur', new Uint8Array(length))),
            err => /not a cursor/.test(err?.message ?? String(err)),
            `${length}-byte file`);
    }
});

test('trailGhost escapes settings URLs before they reach HTML', () => {
    const hostile = trailGhost(settingsStub({ cursorCustom: { normal: { url: 'x" onerror="alert(1)' } } }));
    assert.match(hostile, /&quot;/, 'quotes are escaped');
    assert.doesNotMatch(hostile, /src="x" onerror/, 'the attribute cannot be broken out of');
    const benign = trailGhost(settingsStub({ cursorCustom: { normal: { url: 'data:image/png;base64,QQ==' } } }));
    assert.match(benign, /<img src="data:image\/png;base64,QQ=="/, 'benign URLs pass through untouched');
});
