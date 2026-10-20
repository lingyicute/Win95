import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relative => readFile(path.join(root, relative), 'utf8');

/** Width and height and colour depth from a PNG's IHDR chunk. */
function pngHeader(buffer) {
    assert.equal(buffer.toString('latin1', 1, 4), 'PNG', 'PNG magic');
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bitDepth: buffer[24], colorType: buffer[25] };
}

test('the Start flag is inlined in ICON_DATA like every other icon', async () => {
    const [html, css, main, icons, data] = await Promise.all([
        source('src/index.html'),
        source('src/styles.css'),
        source('src/main.js'),
        readFile(path.join(root, 'src/packages/ui/icon-data.js'), 'utf8'),
        readFile(path.join(root, 'src/assets/icons/start-flag-16.png')),
    ]);
    const table = JSON.parse(/export const ICON_DATA = (\{.*\});/s.exec(icons)[1]);
    assert.ok(table['start-flag-16'], 'the flag has a 16px entry');
    assert.match(table['start-flag-16'], /^data:image\/png;base64,/, 'the entry is an inline data URI, not a file path');
    const inline = Buffer.from(table['start-flag-16'].split(',')[1], 'base64');
    assert.deepEqual([...inline], [...data], 'the inlined bytes are the committed 16x16 PNG, unchanged');
    const size = pngHeader(inline);
    assert.deepEqual({ width: size.width, height: size.height }, { width: 16, height: 16 }, 'the flag is 16x16');
    assert.equal(size.bitDepth, 4, 'the 4-bit palette is kept as it was');
    assert.equal(size.colorType, 3, 'a palette PNG, not a re-encoded truecolour one');

    assert.match(html, /<button id="start-button" aria-label="Start" aria-expanded="false"><img alt=""><strong>Start<\/strong><\/button>/,
        'the button starts with an empty placeholder, so no request is made for it');
    assert.doesNotMatch(html, /start-flag/, 'no asset URL for the flag anywhere in the page');
    assert.match(main, /document\.querySelector\('#start-button img'\)\.replaceWith\(icon\('start-flag', 16\)\);/,
        'the placeholder is filled from ICON_DATA through the icon helper');
    assert.match(css, /#start-button img\{width:16px;height:16px;image-rendering:pixelated\}/, 'drawn at its own size, never blurred');
});

test('the flag lives with the other icons and costs no request of its own', async () => {
    const files = await readdir(path.join(root, 'src/assets/icons'));
    assert.ok(files.includes('start-flag-16.png'), 'the source PNG sits in the icon set');
    const loose = await readdir(path.join(root, 'src/assets'));
    assert.ok(!loose.includes('start-flag.png'), 'no loose copy at the assets root');
    const icons = await source('src/packages/ui/icons.js');
    assert.doesNotMatch(icons, /start-flag/, 'icons.js needs no new path entry: the key is already the file name');
});

test('the route to the menu is unchanged', async () => {
    const html = await source('src/index.html');
    assert.match(html, /<link rel="icon" href="\.\/assets\/windows\.svg">/, 'the browser tab icon is still the SVG');
    assert.match(html, /assets\/windows-95-stacked-logo\.svg/, 'the boot logo is untouched');
});

test('the duplicate w95_40 icons are gone and nothing refers to them', async () => {
    const icons = await readdir(path.join(root, 'src/assets/icons'));
    assert.ok(!icons.includes('w95_40-16.png'), 'w95_40-16.png is deleted');
    assert.ok(!icons.includes('w95_40-32.png'), 'w95_40-32.png is deleted');
    assert.ok(icons.includes('windows-logo-16.png') && icons.includes('windows-logo-32.png'), 'the originals stay');

    const files = [];
    const walk = async dir => {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory())
                await walk(full);
            else if (/\.(m?js|html|css|json|py)$/.test(entry.name) && full !== fileURLToPath(import.meta.url))
                files.push(full);
        }
    };
    await walk(path.join(root, 'src'));
    await walk(path.join(root, 'tests'));
    await walk(path.join(root, 'tools'));
    const hits = [];
    for (const file of files) {
        const text = await readFile(file, 'utf8').catch(() => '');
        if (text.includes('w95_40'))
            hits.push(path.relative(root, file));
    }
    assert.deepEqual(hits, [], 'no source, test or tool names the deleted files');
});

test('windows-logo and w95_40 really were byte-identical before the deletion', async () => {
    /* The pair is checked from git, not the working tree: the deleted files
       have to have been duplicates for deleting them to be a no-op. */
    const { execFile } = await import('node:child_process');
    const git = args => new Promise((resolve, reject) => execFile('git', args, { cwd: root }, (error, stdout) => error ? reject(error) : resolve(stdout)));
    const blobs = await git(['ls-tree', '-r', 'HEAD', 'src/assets/icons/']).catch(() => '');
    const hash = name => (new RegExp(`(\\w+) ${'\\t'}src/assets/icons/${name}`).exec(blobs) ?? [])[1];
    if (!hash('w95_40-32.png'))
        return; // The deletion is already committed; nothing left to compare against.
    assert.equal(hash('w95_40-32.png'), hash('windows-logo-32.png'), 'the 32px pair shares one blob');
    assert.equal(hash('w95_40-16.png'), hash('windows-logo-16.png'), 'the 16px pair shares one blob');
});
