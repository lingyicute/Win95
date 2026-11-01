import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSize } from '../src/packages/ui/dom.js';

test('formatSize never prints NaN', () => {
    assert.equal(formatSize(NaN), '0 bytes');
    assert.equal(formatSize(Infinity), '0 bytes');
    assert.equal(formatSize(0), '0 bytes');
    assert.equal(formatSize(500), '500 bytes');
    assert.equal(formatSize(2048), '2.0 KB');
    assert.equal(formatSize(1048524), '1023.9 KB');
    assert.equal(formatSize(1048575), '1.0 MB', 'never 1024.0 KB');
    assert.equal(formatSize(1048576), '1.0 MB');
});
