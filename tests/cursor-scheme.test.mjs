import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    POINTER_ROLES, SCHEMES, applyCursorScheme, cssCursor, currentSchemeName,
    cursorArt, installCursors, listSchemes, parseCursorFile, resolveScheme,
    svgDataUrl, trailGhost
} from '../src/packages/shell/cursors.js';
import { translateText } from '../src/packages/core/i18n.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = file => readFile(path.join(root, file), 'utf8');
const [panel, styles, main, shell, windowManager, indexHtml, i18n] = await Promise.all([
    source('src/packages/apps/control-panel.js'),
    source('src/styles.css'),
    source('src/main.js'),
    source('src/packages/shell/pointer-trails.js'),
    source('src/packages/shell/window-manager.js'),
    source('src/index.html'),
    source('src/packages/core/i18n.js')
]);

const settingsStub = values => ({ settings: { get: (name, fallback) => values[name] ?? fallback, addEventListener() {}, removeEventListener() {} } });
const fakeRoot = () => { const props = {}; return { props, style: { setProperty: (key, value) => { props[key] = value; } } }; };
const fakeFile = (name, bytes) => ({ name, size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
const u32le = n => [n & 255, n >> 8 & 255, n >> 16 & 255, n >> 24 & 255];

test('the Pointers tab is a complete scheme dialog, not a placeholder', () => {
    const pointers = panel.slice(panel.indexOf("['Pointers'"), panel.indexOf("else if (id === 'keyboard')"));
    assert.ok(pointers.length > 1000, 'the Pointers page carries real content');
    assert.match(panel, /from '@win95\/shell\/cursors\.js'/, 'the tab uses the cursor engine');
    for (const needle of [
        /field\('Scheme:', schemeCombo\)/,
        /POINTER_ROLES\.map\(r => r\.label\)/,
        /mode: 'list'/,
        /Customize:/,
        /legend', \{ text: 'Preview' \}/,
        /'Browse…'/,
        /'Save As…'/,
        /'Delete'/,
        /parseCursorFile\(file\)/,
        /settings\.set\('cursorCustom'/,
        /settings\.set\('cursorScheme'/,
        /settings\.set\('cursorUserSchemes'/,
        /currentSchemeName\(s\)/
    ])
        assert.match(pointers, needle, String(needle));
    assert.doesNotMatch(panel, /large-pointer/, 'the placeholder class is gone');
    assert.doesNotMatch(panel, /draft\.cursor === 'Crosshair'/, 'the placeholder commit is gone');
    assert.doesNotMatch(panel, /document\.body\.style\.cursor/, 'no inline body cursor remains');
    assert.doesNotMatch(styles, /\.large-pointer/, 'the placeholder stylesheet rule is gone');
});

test('every role of every scheme renders a complete, in-bounds cursor', () => {
    assert.equal(new Set(POINTER_ROLES.map(r => r.id)).size, POINTER_ROLES.length, 'role ids are unique');
    assert.equal(POINTER_ROLES[0].id, 'normal');
    for (const scheme of SCHEMES) {
        for (const role of POINTER_ROLES) {
            const art = cursorArt(role.id, scheme);
            assert.match(art.svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="\d+" viewBox="0 0 \d+ \d+">/, `${scheme.name}/${role.id} has a sized svg root`);
            assert.ok(art.w >= 32 && art.h >= 32, `${scheme.name}/${role.id} canvas`);
            assert.ok(art.x >= 0 && art.x < art.w && art.y >= 0 && art.y < art.h, `${scheme.name}/${role.id} hotspot inside the image`);
            assert.ok(role.fallback && !role.fallback.includes('url('), `${role.id} has a keyword fallback`);
        }
    }
    assert.match(cursorArt('normal', SCHEMES[0]).svg, /M1 1v15l3\.4-3\.2/, 'the classic Windows arrow outline');
    const magnified = cursorArt('normal', SCHEMES.find(s => s.name === 'Magnified'));
    assert.equal(magnified.w, 48, 'Magnified draws on a 48px canvas');
    assert.match(magnified.svg, /viewBox="0 0 48 48"/, 'scaled art is not clipped');
    assert.ok(magnified.x > 1, 'the hotspot scales with the art');
});

test('the engine publishes the committed scheme as --cur-* custom properties', () => {
    const host = fakeRoot();
    applyCursorScheme(settingsStub({}), host);
    assert.match(host.props['--cur-normal'], /^url\("data:image\/svg\+xml/, 'the default scheme is an SVG data URL');
    assert.match(host.props['--cur-normal'], /, default$/);
    assert.match(host.props['--cur-busy'], /, wait$/);
    assert.match(host.props['--cur-text'], /, text$/);
    assert.match(host.props['--cur-precision'], /, crosshair$/);
    assert.match(host.props['--cur-vresize'], /, ns-resize$/);
    assert.match(host.props['--cur-link'], /, pointer$/);
    for (const role of POINTER_ROLES)
        assert.ok(host.props[`--cur-${role.id}`], `--cur-${role.id} is published`);

    const overridden = fakeRoot();
    applyCursorScheme(settingsStub({ cursorScheme: 'Rose', cursorCustom: { normal: { url: 'data:image/png;base64,AAAA', x: 3, y: 4 } } }), overridden);
    assert.match(overridden.props['--cur-normal'], /AAAA"\) 3 4, default/, 'a Browse… assignment beats the scheme');
    assert.doesNotMatch(overridden.props['--cur-busy'], /AAAA/, 'other roles keep the scheme');
    assert.match(overridden.props['--cur-busy'], /svg\+xml/, 'the scheme still paints the rest');
});

test('legacy placeholder names migrate onto real schemes', () => {
    assert.equal(currentSchemeName(settingsStub({})), 'Windows Standard');
    assert.equal(currentSchemeName(settingsStub({ 'applet-mouse': { cursor: 'Large' } })), 'Magnified');
    assert.equal(currentSchemeName(settingsStub({ 'applet-mouse': { cursor: 'Crosshair' } })), 'Crosshair');
    assert.equal(currentSchemeName(settingsStub({ cursorScheme: 'Rose', 'applet-mouse': { cursor: 'Large' } })), 'Rose', 'committed schemes win over the legacy draft');
    const saved = settingsStub({ cursorScheme: 'My Scheme', cursorUserSchemes: { 'My Scheme': { fill: '#123456', outline: '#000000', accent: '#ff0000' } } });
    assert.equal(resolveScheme(saved).fill, '#123456');
    assert.ok(listSchemes(saved).includes('My Scheme'), 'saved schemes join the Scheme list');
    assert.ok(listSchemes(saved).includes('Windows Standard'));
    assert.equal(resolveScheme(settingsStub({}), 'No Such Scheme').name, 'Windows Standard', 'unknown names fall back');
});

test('cssCursor builds an image, a hotspot and a keyword fallback', () => {
    assert.equal(cssCursor('data:image/png;base64,AA==', 2, 3, 'wait'), 'url("data:image/png;base64,AA==") 2 3, wait');
    assert.equal(cssCursor('data:image/svg+xml,x', 7.9, 0, 'default'), 'url("data:image/svg+xml,x") 7 0, default', 'hotspots are integers');
});

test('Browse… reads an embedded-PNG Windows .cur file', async () => {
    // ICONDIR + one ICONDIRENTRY + a PNG whose IHDR says 48×64.
    const png = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
        0, 0, 0, 48, 0, 0, 0, 64, 0, 0, 0, 0, 0
    ]);
    const cur = new Uint8Array([
        0, 0, 2, 0, 1, 0,
        48, 64, 0, 0,
        1, 0, // hotspot x
        2, 0, // hotspot y
        ...u32le(png.byteLength),
        ...u32le(22),
        ...png
    ]);
    const entry = await parseCursorFile(fakeFile('custom.cur', cur));
    assert.match(entry.url, /^data:image\/png;base64,/);
    assert.equal(entry.w, 48);
    assert.equal(entry.h, 64);
    assert.equal(entry.x, 1, 'the cursor header hotspot survives');
    assert.equal(entry.y, 2);
    assert.equal(entry.name, 'custom.cur');
});

test('Browse… decodes the classic BMP cursor through its AND mask', async () => {
    // 4×4, 32 bpp, BI_RGB, bottom-up: the only red pixel is the top-left one,
    // and the AND mask makes the pixel at (1,1) transparent.
    const xor = [];
    for (let y = 3; y >= 0; y--)
        for (let x = 0; x < 4; x++)
            xor.push(...(x === 0 && y === 0 ? [0, 0, 255, 0] : [10, 20, 30, 0]));
    const and = [];
    for (let y = 3; y >= 0; y--)
        and.push(...(y === 1 ? [0x40, 0, 0, 0] : [0, 0, 0, 0]));
    const dib = new Uint8Array([
        ...u32le(40), ...u32le(4), ...u32le(8),
        1, 0, 32, 0,
        ...u32le(0), ...u32le(0), ...u32le(0), ...u32le(0), ...u32le(0), ...u32le(0),
        ...xor, ...and
    ]);
    const cur = new Uint8Array([
        0, 0, 2, 0, 1, 0,
        4, 4, 0, 0,
        1, 0, 1, 0,
        ...u32le(dib.byteLength),
        ...u32le(22),
        ...dib
    ]);
    const entry = await parseCursorFile(fakeFile('classic.cur', cur));
    assert.equal(entry.decoded.w, 4);
    assert.equal(entry.decoded.h, 4);
    const at = (x, y) => [...entry.decoded.rgba.slice((y * 4 + x) * 4, (y * 4 + x) * 4 + 4)];
    assert.deepEqual(at(0, 0), [255, 0, 0, 255], 'the bottom-up red pixel decodes');
    assert.deepEqual(at(1, 1), [30, 20, 10, 0], 'the AND mask clears the alpha');
    assert.equal(entry.x, 1);
    assert.equal(entry.y, 1);
});

test('Browse… decodes a palettised 8 bpp cursor', async () => {
    // 4×4, 8 bpp, two palette entries: red at index 0, blue at index 1. The
    // top-left pixel (stored last, the bitmap is bottom-up) is blue.
    const dib = new Uint8Array([
        ...u32le(40), ...u32le(4), ...u32le(8),
        1, 0, 8, 0,
        ...u32le(0), ...u32le(0), ...u32le(0), ...u32le(0), // BI_RGB, no size
        ...u32le(2), ...u32le(0), // biClrUsed, biClrImportant
        0, 0, 255, 0, // palette 0: red (BGRA)
        255, 0, 0, 0, // palette 1: blue
        ...[3, 2, 1, 0].flatMap(row => [row === 0 ? 1 : 0, 0, 0, 0]), // XOR rows, 4 px each
        ...[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // clear AND mask
    ]);
    const cur = new Uint8Array([
        0, 0, 2, 0, 1, 0,
        4, 4, 0, 0, 1, 0, 1, 0,
        ...u32le(dib.byteLength),
        ...u32le(22),
        ...dib
    ]);
    const entry = await parseCursorFile(fakeFile('palette.cur', cur));
    const at = (x, y) => [...entry.decoded.rgba.slice((y * 4 + x) * 4, (y * 4 + x) * 4 + 4)];
    assert.deepEqual(at(0, 0), [0, 0, 255, 255], 'the palette resolves the blue pixel');
    assert.deepEqual(at(3, 0), [255, 0, 0, 255], 'index 0 is red');
});

test('Browse… decodes a 1 bpp monochrome cursor', async () => {
    // 4×4, 1 bpp: black background, one white pixel at the top-left corner of
    // each row is irrelevant — row bits are read most-significant first.
    const dib = new Uint8Array([
        ...u32le(40), ...u32le(4), ...u32le(8),
        1, 0, 1, 0,
        ...u32le(0), ...u32le(0), ...u32le(0), ...u32le(0),
        ...u32le(2), ...u32le(0),
        0, 0, 0, 0, // palette 0: black
        255, 255, 255, 0, // palette 1: white
        ...[0x80, 0, 0, 0], ...[0x80, 0, 0, 0], ...[0x80, 0, 0, 0], ...[0x80, 0, 0, 0],
        ...[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]);
    const cur = new Uint8Array([0, 0, 2, 0, 1, 0, 4, 4, 0, 0, 1, 0, 1, 0, ...u32le(dib.byteLength), ...u32le(22), ...dib]);
    const entry = await parseCursorFile(fakeFile('mono.cur', cur));
    const at = (x, y) => [...entry.decoded.rgba.slice((y * 4 + x) * 4, (y * 4 + x) * 4 + 4)];
    assert.deepEqual(at(0, 0), [255, 255, 255, 255], 'the most significant bit is the left pixel');
    assert.deepEqual(at(1, 0), [0, 0, 0, 255]);
    assert.deepEqual(at(0, 3), [255, 255, 255, 255], 'only the bottom row uses the 0x80 mask');
    assert.deepEqual(at(1, 3), [0, 0, 0, 255]);
});

test('Browse… rejects animated cursors and non-cursor files with a readable message', async () => {
    await assert.rejects(() => parseCursorFile(fakeFile('busy.ani', new TextEncoder().encode('RIFF....ANIM'))), /Animated cursors \(\.ani\)/);
    await assert.rejects(() => parseCursorFile(fakeFile('notes.txt', new TextEncoder().encode('just text, not a cursor at all'))), /not a cursor/);
    await assert.rejects(() => parseCursorFile(fakeFile('huge.cur', new Uint8Array(301 * 1024))), /larger than 300 KB/);
});

test('the shell installs the scheme and drives the busy and drag cursors', () => {
    assert.match(main, /installCursors\(s\)/, 'the desktop starts with the saved scheme');
    assert.ok((main.match(/setPointerBusy\(true\)/g) || []).length >= 2, 'boot and shutdown show the Busy cursor');
    assert.ok((main.match(/setPointerBusy\(false\)/g) || []).length >= 2, 'both are released');
    assert.match(indexHtml, /"@win95\/shell\/":\s*"\.\/packages\/shell\/"/, 'the import map resolves @win95/shell');
    assert.match(windowManager, /classList\.add\('dragging-cursor'\)/, 'window drags take the Move cursor');
    assert.match(windowManager, /dataset\.resize = direction/, 'resize drags keep their direction cursor');
    assert.match(windowManager, /classList\.remove\('dragging-cursor'\)/);
    assert.match(shell, /trailGhost\(s\)/, 'trails paint the active Normal Select');
    assert.match(shell, /'cursorScheme', 'cursorCustom'/, 'trails repaint when the scheme changes');
});

test('the stylesheet routes every cursor through the scheme variables', () => {
    for (const needle of [
        /cursor:var\(--cur-normal,default\)/,
        /cursor:var\(--cur-text,text\)/,
        /cursor:var\(--cur-precision,crosshair\)/,
        /cursor:var\(--cur-vresize,ns-resize\)/,
        /cursor:var\(--cur-hresize,ew-resize\)/,
        /cursor:var\(--cur-dresize1,nwse-resize\)/,
        /cursor:var\(--cur-dresize2,nesw-resize\)/,
        /cursor:var\(--cur-link,pointer\)/,
        /body\.busy-cursor,body\.busy-cursor \*\{cursor:var\(--cur-busy,wait\)!important\}/,
        /body\.dragging-cursor,body\.dragging-cursor \*\{cursor:var\(--cur-move,move\)!important\}/
    ])
        assert.match(styles, needle, String(needle));
});

test('the trail driver repaints ghosts and installCursors subscribes without a browser', () => {
    assert.match(trailGhost(settingsStub({})), /^<svg xmlns=/, 'default trails use the scheme arrow');
    assert.match(trailGhost(settingsStub({ cursorScheme: 'Rose' })), /#f8bccd/, 'a Rose scheme leaves rose arrows');
    assert.match(trailGhost(settingsStub({ cursorCustom: { normal: { url: 'data:image/png;base64,QQ==' } } })), /<img src="data:image\/png;base64,QQ=="/);
    let listener = null;
    const api = installCursors({ settings: { get: (k, d) => d, addEventListener: (type, fn) => { listener = fn; }, removeEventListener() {} } });
    assert.equal(typeof api.apply, 'function');
    assert.ok(listener, 'scheme changes trigger a reapply');
    assert.doesNotThrow(() => api.apply(), 'applying without a document is a no-op');
});

test('the new dialog strings are translated', async () => {
    for (const [en, zh] of [
        ['Customize:', '自定义：'],
        ['Normal Select', '正常选择'],
        ['Help Select', '帮助选择'],
        ['Working In Background', '后台运行'],
        ['Busy', '忙'],
        ['Precision Select', '精确定位'],
        ['Text Select', '文本选择'],
        ['Handwriting', '手写'],
        ['Vertical Resize', '垂直调整'],
        ['Horizontal Resize', '水平调整'],
        ['Diagonal Resize 1', '对角线调整 1'],
        ['Diagonal Resize 2', '对角线调整 2'],
        ['Alternate Select', '备选选择'],
        ['Unavailable', '不可用'],
        ['Link Select', '链接选择'],
        ['Save this cursor scheme as:', '将此指针方案保存为：']
    ])
        assert.equal(translateText(en, 'zh'), zh, en);
    assert.equal(translateText("Delete the 'Sunset' cursor scheme?", 'zh'), '确实要删除“Sunset”指针方案吗？');
    assert.match(i18n, /'Normal Select': '正常选择'/);
});
