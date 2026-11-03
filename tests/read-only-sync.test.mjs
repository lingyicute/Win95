import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

installDom();
register('./win95-resolver.mjs', import.meta.url);
const { VirtualFileSystem } = await import('../src/packages/core/filesystem.js');
const { DosEngine } = await import('../src/packages/core/dos-engine.js');
const { createFileActions } = await import('../src/packages/apps/explorer.js');

const storage = () => { const values = new Map(); globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) }; };

test('attributes stored on the file win over what ATTRIB noted earlier', async () => {
    storage();
    const fs = await new VirtualFileSystem().init();
    const dos = new DosEngine(fs);
    const run = async line => (await dos.execute(line)).output;
    fs.write('C:\\LOCKED.TXT', 'x');
    await run('ATTRIB +R C:\\LOCKED.TXT');
    assert.match(await run('DEL C:\\LOCKED.TXT'), /read-only/);
    Object.assign(fs.get('C:\\LOCKED.TXT'), { readOnly: false, attributes: 'A' });
    assert.equal(await run('DEL C:\\LOCKED.TXT'), '1 file(s) deleted.');
    assert.equal(fs.exists('C:\\LOCKED.TXT'), false);
});

test('clearing Read-only in Properties also clears the R that ATTRIB stored', async () => {
    storage();
    const errors = [];
    const s = { fs: new VirtualFileSystem(), clipboard: null, ui: { error: e => errors.push(String(e?.message || e)), modal: () => ({ body: document.createElement('div'), close() { } }) } };
    await s.fs.init();
    s.fs.write('C:\\LOCKED.TXT', 'x');
    const dos = new DosEngine(s.fs);
    await dos.execute('ATTRIB +R C:\\LOCKED.TXT');
    const w = createFileActions(s).properties(['C:\\LOCKED.TXT']);
    const box = w.body.querySelectorAll('input').at(-1);
    assert.equal(String(box.checked ?? box.getAttribute('checked')), 'true', 'the box shows the flag ATTRIB set');
    box.checked = false;
    w.body.querySelectorAll('input')[0].value = 'LOCKED.TXT';
    w.body.querySelectorAll('button').find(b => b.textContent === 'OK').dispatchEvent({ type: 'click' });
    assert.deepEqual(errors, []);
    assert.doesNotThrow(() => s.fs.write('C:\\LOCKED.TXT', 'edited'));
    assert.equal((await dos.execute('DEL C:\\LOCKED.TXT')).output, '1 file(s) deleted.');
});
