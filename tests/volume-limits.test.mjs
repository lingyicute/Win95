import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import { installDom } from './dom-shim.mjs';

/**
 * The volume caps a single name at 255 characters, and several features grow a name to dodge a
 * collision - paste again, import again, send a second file of the same name to the Recycle Bin.
 * Growing must not walk past the cap: an over-long answer is refused on the spot, so the
 * operation fails and the file cannot be put anywhere the folder already occupies.
 */
installDom();
register('./win95-resolver.mjs', import.meta.url);
const { NAME_LIMIT, baseName, nameError, VirtualFileSystem } = await import('../src/packages/core/filesystem.js');

const storage = () => {
    const values = new Map();
    globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
    return values;
};
const volume = async () => {
    storage();
    return await new VirtualFileSystem().init();
};

const binOf = fs => fs.list('C:\\Recycled').map(n => n.path);
const at = (n, ext = '.txt') => 'q'.repeat(n - ext.length) + ext;

test('restore dodges a name that was taken in the meantime, without touching it', async () => {
    const fs = await volume();
    const name = at(NAME_LIMIT);
    fs.write('C:\\My Documents\\' + name, 'the original');
    fs.remove('C:\\My Documents\\' + name);
    fs.write('C:\\My Documents\\' + name, 'what the user made later');
    const to = fs.restore(binOf(fs).find(p => baseName(p) === name));
    assert.equal(fs.read('C:\\My Documents\\' + name), 'what the user made later', 'the file in the way is not overwritten');
    assert.notEqual(to, 'C:\\My Documents\\' + name, 'the restored one lands beside it');
    assert.equal(fs.read(to), 'the original', 'with its own content');
    assert.equal(nameError(baseName(to)), null, 'under a name the volume accepts');
});

test('the limit is a number the whole volume shares, message included', async () => {
    assert.equal(NAME_LIMIT, 255, 'the cap is the one Windows 95 refused');
    assert.equal(nameError(at(NAME_LIMIT)), null, 'a name at the cap is legal');
    assert.match(nameError(at(NAME_LIMIT + 1)), /at most 255 characters/, 'and the refusal says the same number');
});

test('a free name never grows past the cap', async () => {
    const fs = await volume();
    for (let length = NAME_LIMIT - 6; length <= NAME_LIMIT; length++)
        for (const ext of ['.txt', '']) {
            const name = 'q'.repeat(Math.max(1, length - ext.length)) + ext;
            const taken = 'C:\\My Documents\\' + name;
            fs.write(taken, 'one');
            const next = fs.unique(taken, !ext);
            assert.equal(nameError(baseName(next)), null, `${name.length} chars with '${ext}': ${baseName(next)} stays legal`);
            assert.equal(fs.exists(next), false, `${name.length} chars: the answer is actually free`);
            assert.match(baseName(next), / \(\d+\)/, `${name.length} chars: it is still recognisably the counter form`);
            fs.write(next, 'two');
            fs.remove(taken, true);
            fs.remove(next, true);
        }
});

test('the counter still lands before the extension', async () => {
    const fs = await volume();
    fs.write('C:\\My Documents\\Report.txt', 'one');
    assert.equal(baseName(fs.unique('C:\\My Documents\\Report.txt')), 'Report (2).txt', 'short names read the way Explorer writes them');
    fs.write('C:\\My Documents\\Report (2).txt', 'two');
    assert.equal(baseName(fs.unique('C:\\My Documents\\Report.txt')), 'Report (3).txt', 'and it keeps counting past the ones already there');
});

test('a second file at the cap can still be sent to the Recycle Bin', async () => {
    const fs = await volume();
    const name = at(NAME_LIMIT);
    fs.write('C:\\My Documents\\' + name, 'documents copy');
    fs.write('C:\\Windows\\Desktop\\' + name, 'desktop copy');
    fs.remove('C:\\My Documents\\' + name);
    fs.remove('C:\\Windows\\Desktop\\' + name);
    const bin = binOf(fs);
    assert.equal(fs.exists('C:\\Windows\\Desktop\\' + name), false, 'the desktop copy left the desktop');
    assert.equal(bin.filter(p => baseName(p).length === NAME_LIMIT).length, 2, 'both bin names are still at the cap, no longer');
    assert.deepEqual(new Set(bin.filter(p => p.startsWith('C:\\Recycled\\'))).size >= 2, true, 'and they are two different entries');
    const kept = bin.map(p => fs.read(p));
    assert.deepEqual([kept.includes('documents copy'), kept.includes('desktop copy')], [true, true], 'neither copy lost its content');
});
