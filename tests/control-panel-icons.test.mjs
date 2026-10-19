import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * The Control Panel says which picture each applet wears, the icon table maps
 * that name to two files - one for the window, one for the small places - and
 * the bytes are also inlined so a repaint never waits on the network. Three
 * copies of the same fact, so these checks keep them together:
 *
 *  - Regional Settings wears the world/globe icon, and the Windows 2000 globe
 *    on its stand that used to be there is gone from the repository;
 *  - Modems wears the modem and telephone icon instead of borrowing the
 *    network picture, which Dial-Up Networking still needs.
 *
 * The hashes pin the art itself: swapping in the wrong globe, or a smoothed
 * resample of the right one, fails here rather than in a screenshot.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

const ART = {
    'regional-16': { hash: '5a19288770057e21047e090b1038e4eb36381aadee2d48c8a2aaaca7686793d0', size: 16 },
    'regional-32': { hash: '924fe55b4cf22845d5f8b66cd468a6f8364ce8eca720fc41a704c69566546677', size: 32 },
    'modem-16': { hash: 'e4467040e98fdd62d4ff380f44a35a215751a084b3a0a06616983e5f136037f8', size: 16 },
    'modem-32': { hash: '6d09da89bd36f189a02b44959836278c81dfc0f347c93719cf9eace5d899f194', size: 32 }
};
/* The stand-mounted globe this replaces, and the small version of it. */
const REMOVED = [
    '9d6e46afa2a76d16a2019845739cf1a41cae0ffed031460cea51266601bfb84c',
    '97838776fd1194f2057028715b1304063ffb793a10b87b9fd84b34d12a63abd8'
];

const iconData = async () => {
    const source = await readFile(path.join(root, 'src/packages/ui/icon-data.js'), 'utf8');
    return JSON.parse(/export const ICON_DATA = (\{.*\});/s.exec(source)[1]);
};
const iconBytes = async name => {
    const data = await iconData();
    assert.ok(data[name], `${name} is inlined`);
    return Buffer.from(data[name].split(',')[1], 'base64');
};
const pngSize = bytes => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });

for (const [name, art] of Object.entries(ART)) {
    test(`${name} is the icon asked for, at its own size`, async () => {
        const file = await readFile(path.join(root, `src/assets/icons/${name}.png`));
        assert.equal(sha256(file), art.hash, 'the file is the art from the icon set, not a resample of something else');
        const { width, height } = pngSize(file);
        assert.deepEqual([width, height], [art.size, art.size], 'a 16 px slot is not filled with a 32 px drawing');
        const inline = await iconBytes(name);
        assert.ok(inline.equals(file), 'the copy inlined for repainting is the same file');
    });
}

test('the old Regional Settings globe is out of the repository', async () => {
    const data = await iconData();
    for (const [name, value] of Object.entries(data))
        assert.ok(!REMOVED.includes(sha256(Buffer.from(value.split(',')[1], 'base64'))), `${name} still inlines the removed art`);
    for (const file of await readdir(path.join(root, 'src/assets/icons'))) {
        const bytes = await readFile(path.join(root, 'src/assets/icons', file));
        assert.ok(!REMOVED.includes(sha256(bytes)), `${file} is a copy of the removed art`);
    }
});

test('the Control Panel hands each applet its own picture', async () => {
    const source = await readFile(path.join(root, 'src/packages/apps/control-panel.js'), 'utf8');
    assert.match(source, /\['regional', 'Regional Settings', 'regional'\]/, 'Regional Settings wears the globe');
    assert.match(source, /\['modems', 'Modems', 'modem'\]/, 'Modems wears the modem, not the network picture');
    assert.doesNotMatch(source, /\['modems', 'Modems', 'connection'\]/, 'the borrowed network picture is gone');

    const explorer = await readFile(path.join(root, 'src/packages/apps/explorer.js'), 'utf8');
    assert.match(explorer, /name: 'Dial-Up Networking', icon: 'connection'/, 'Dial-Up Networking keeps the picture it had');
});

test('both names resolve to art the shell can draw', async () => {
    const icons = await readFile(path.join(root, 'src/packages/ui/icons.js'), 'utf8');
    assert.match(icons, /modem: 'modem'/, 'the name has a path entry of its own');
    const data = await iconData();
    for (const name of Object.keys(ART))
        assert.ok(data[name], `${name} has bytes`);
});

test('the Control Panel window shows both pictures', async () => {
    installDom();
    register('./win95-resolver.mjs', import.meta.url);
    const { controlPanel } = await import('../src/packages/apps/control-panel.js');
    const element = document.createElement('section');
    const body = document.createElement('div');
    element.append(body);
    document.body.append(element);
    const w = { element, body, closed: false, setTitle() { }, status() { }, setMenu() { }, close() { } };
    const s = {
        settings: { get: (key, fallback) => fallback, set() { }, addEventListener() { }, removeEventListener() { } },
        wm: { create: () => w },
        graphics: { presenter: { backend: 'canvas2d' } },
        ui: {}
    };
    controlPanel(s);
    const tiles = [...body.querySelectorAll('.control-icon')];
    const picture = label => {
        const tile = tiles.find(tile => tile.querySelector('span')?.textContent === label);
        assert.ok(tile, `${label} is on the panel`);
        return tile.querySelector('img').getAttribute('src');
    };
    assert.ok(picture('Regional Settings').endsWith((await iconBytes('regional-32')).toString('base64')), 'the globe is drawn at 32 px');
    assert.ok(picture('Modems').endsWith((await iconBytes('modem-32')).toString('base64')), 'the modem is drawn at 32 px');
    assert.notEqual(picture('Modems'), picture('Network'), 'Modems no longer looks like Network');
});

test('the two icons bring only the files they need', async () => {
    const files = await readdir(path.join(root, 'src/assets/icons'));
    for (const file of files.filter(name => name.startsWith('regional-') || name.startsWith('modem-')))
        assert.ok(ART[file.replace('.png', '')], `${file} belongs to this change`);
    assert.equal((await stat(path.join(root, 'src/assets/icons/modem-32.png'))).size, 1024, 'the modem file is the downloaded file, not a re-encode');
});
