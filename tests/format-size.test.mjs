import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSize } from '../src/packages/ui/dom.js';

test('formatSize never prints NaN', () => {
    assert.equal(formatSize(NaN), '0 bytes');
    assert.equal(formatSize(Infinity), '0 bytes');
    assert.equal(formatSize(0), '0 bytes');
    assert.equal(formatSize(500), '500 bytes');
    assert.equal(formatSize(2048), '2.0 KB');
});
