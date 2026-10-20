import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relative => readFile(path.join(root, relative), 'utf8');

/** The System Properties registration, General page included. */
async function systemSheet() {
    const panel = await source('src/packages/apps/control-panel.js');
    const start = panel.indexOf('export function systemProperties');
    return panel.slice(start, panel.indexOf('\nexport function settingsApplet', start));
}

const generalPage = block => block.slice(block.indexOf("['General'"), block.indexOf("['Device Manager'"));

test('the General page is a monitor and three facts, as Windows 95 drew it', async () => {
    const general = generalPage(await systemSheet());
    for (const part of ['system-monitor-screen', 'system-monitor-neck', 'system-monitor-base', 'system-monitor-led'])
        assert.ok(general.includes(part), `${part} is drawn`);
    assert.match(general, /icon\('windows', 80\)/, 'the screen shows the Windows flag');
    for (const label of ['System:', 'Registered to:', 'Hardware architecture:'])
        assert.ok(general.includes(`text: '${label}'`), `${label} is one of the three labels`);
    assert.equal((general.match(/class: 'system-fact'/g) || []).length, 3, 'exactly three facts, not a list of them');
    assert.match(general, /el\('dd', \{ text: 'Microsoft Windows 95' \}\)/, 'System names the product');
    assert.match(general, /dataText\(s\.settings\.get\('owner', 'Windows User'\)\)/, 'Registered to is the owner, not UI text');
});

test('Hardware architecture reads "Browser", then the logical cores on their own line', async () => {
    const general = generalPage(await systemSheet());
    assert.match(general, /const cores = navigator\.hardwareConcurrency \|\| 1;/, 'the core count falls back to one');
    assert.match(general, /el\('dd', \{ 'aria-label': `Browser, \$\{cores\} logical cores` \}, 'Browser', el\('br'\), `\$\{cores\} logical cores`\)/,
        'a line break separates the two, and the pair is one label for a screen reader');
});

test('the facts that moved to Performance are gone from General', async () => {
    const block = await systemSheet();
    const general = generalPage(block);
    for (const gone of ['Display adapter:', 'Disk:', 'Volume size:', 'Version:', 'Processors:'])
        assert.ok(!general.includes(gone), `${gone} left the General page`);
    assert.ok(block.includes("['Display adapter:', s.graphics.presenter.backend]"), 'Performance still shows the adapter');
});

test('Performance names the store and splits the space into its own row', async () => {
    const block = await systemSheet();
    const perf = block.slice(block.indexOf("['Performance'"));
    assert.match(perf, /\['Virtual disk:', s\.fs\.persistence\]/, 'Virtual disk names the backing store');
    assert.match(perf, /\['Used space:', formatSize\(s\.fs\.size\('C:\\\\'\)\)\]/, 'Used space holds the size');
    assert.doesNotMatch(perf, /Virtual disk used:/, 'the combined row is gone');
    const rows = [...perf.matchAll(/\['([^']+)'/g)].map(m => m[1]).slice(1);
    assert.deepEqual(rows, ['Display adapter:', 'Open windows:', 'Logical CPUs:', 'Files and folders:', 'Virtual disk:', 'Used space:', 'Storage revision:'], 'the rows keep their order');
});

test('the General page and both new Performance labels are translated', async () => {
    const i18n = await source('src/packages/core/i18n.js');
    for (const [key, value] of [['System:', '系统：'], ['Hardware architecture:', '硬件架构：'], ['Virtual disk:', '虚拟磁盘：'], ['Used space:', '已用空间：']])
        assert.ok(i18n.includes(`'${key}': '${value}'`), `${key} is in the dictionary`);
    for (const dead of ["'Version:'", "'Processors:'", "'Disk:'", "'Volume size:'", "'Virtual disk used:'"])
        assert.ok(!i18n.includes(dead), `${dead} was translated but nothing renders it now`);
});

test('the monitor is drawn from element edges, not a bitmap', async () => {
    const css = await source('src/styles.css');
    assert.match(css, /\.system-monitor\{position:relative;flex:0 0 auto;width:150px;padding:9px 9px 7px;background:var\(--face\);box-shadow:inset 2px 2px #fff,inset -2px -2px #808080,2px 2px #000\}/);
    assert.match(css, /\.system-monitor-screen\{height:96px;[^}]*background:var\(--desktop\);border:2px solid #000/, 'the screen is the desktop colour');
    assert.match(css, /\.system-monitor-screen img\{image-rendering:pixelated\}/, 'the flag stays a crisp bitmap');
    assert.match(css, /\.system-monitor-base\{width:96px;height:9px;/, 'the stand has its own base');
    assert.match(css, /\.system-fact dd\{margin:3px 0 0 40px;line-height:17px\}/, 'values are indented under their label');
    assert.match(css, /\.system-general\{display:flex;align-items:flex-start;gap:26px/, 'picture and facts sit side by side');
});
