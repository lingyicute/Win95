import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildSite } from '../tools/build-site.mjs';

async function fixture(t) {
    const root = await mkdtemp(path.join(os.tmpdir(), 'win95-build-safety-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    return root;
}

test('a missing source never deletes the existing published site', async t => {
    const root = await fixture(t), output = path.join(root, 'site');
    await mkdir(output);
    await writeFile(path.join(output, 'index.html'), 'previous release');
    await assert.rejects(buildSite({ source: path.join(root, 'missing'), output, version: 'test' }));
    assert.equal(await readFile(path.join(output, 'index.html'), 'utf8'), 'previous release');
});

test('a symlinked output alias cannot erase the source directory', async t => {
    const root = await fixture(t), source = path.join(root, 'source');
    await mkdir(source);
    await writeFile(path.join(source, 'index.html'), 'source must survive');
    await symlink(root, path.join(root, 'alias'), 'dir');
    await assert.rejects(buildSite({ source, output: path.join(root, 'alias', 'source'), version: 'test' }), /separate/i);
    assert.equal(await readFile(path.join(source, 'index.html'), 'utf8'), 'source must survive');
});

test('a new output under a symlinked source is also refused', async t => {
    const root = await fixture(t), source = path.join(root, 'source');
    await mkdir(source);
    await writeFile(path.join(source, 'index.html'), 'source');
    await symlink(source, path.join(root, 'alias'), 'dir');
    await assert.rejects(buildSite({ source, output: path.join(root, 'alias', 'nested', 'site'), version: 'test' }), /separate/i);
    assert.deepEqual(await readdir(source), ['index.html']);
});

test('a read failure during staging preserves the old release', async t => {
    if (!process.getuid || process.getuid() === 0) {
        t.skip('file permissions cannot reliably block reads for this user');
        return;
    }
    const { chmod } = await import('node:fs/promises');
    const root = await fixture(t), source = path.join(root, 'source'), output = path.join(root, 'site');
    await mkdir(source);
    await mkdir(output);
    await writeFile(path.join(source, 'unreadable.js'), 'export const data = 1;');
    await chmod(path.join(source, 'unreadable.js'), 0);
    await writeFile(path.join(output, 'index.html'), 'previous release');
    await assert.rejects(buildSite({ source, output, version: 'test' }), { code: 'EACCES' });
    assert.equal(await readFile(path.join(output, 'index.html'), 'utf8'), 'previous release');
    assert.deepEqual((await readdir(root)).sort(), ['site', 'source']);
});

test('a successful build replaces the old release without leaving temporary directories', async t => {
    const root = await fixture(t), source = path.join(root, 'source'), output = path.join(root, 'site');
    await mkdir(source);
    await mkdir(output);
    await writeFile(path.join(source, 'index.html'), '<script src="./main.js"></script>');
    await writeFile(path.join(source, 'main.js'), 'export const ok = true;');
    await writeFile(path.join(output, 'old.html'), 'stale');
    await buildSite({ source, output, version: 'release' });
    assert.match(await readFile(path.join(output, 'index.html'), 'utf8'), /main\.js\?v=release/);
    assert.deepEqual((await readdir(output)).sort(), ['index.html', 'main.js']);
    assert.deepEqual((await readdir(root)).sort(), ['site', 'source']);
});
