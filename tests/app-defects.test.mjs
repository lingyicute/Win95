import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFile(path.join(root, f), 'utf8');
const main = await read('src/main.js');
const docs = await read('src/packages/apps/documents.js');
const paint = await read('src/packages/apps/paint.js');
const utils = await read('src/packages/apps/utilities.js');
const mm = await read('src/packages/apps/multimedia.js');
const apps = await read('src/packages/games/apps.js');
const dos = await read('src/packages/apps/dos.js');
const explorer = await read('src/packages/apps/explorer.js');

test('a failed or empty paste is a no-op, never insert(\'\') fodder', () => {
    const paste = main.slice(main.indexOf('s.pasteText = async'), main.indexOf('s.recent ='));
    assert.ok(paste.length > 80, 'pasteText exists');
    assert.match(paste, /return s\.clipboard\.text \|\| null/);
    assert.match(paste, /await navigator\.clipboard\.readText\(\)\) \|\| null/);
    assert.match(paste, /return null/);
    assert.doesNotMatch(paste, /return ''/, "no ''-returning path survives");
});

test('WordPad Find searches only inside the editor', () => {
    assert.doesNotMatch(docs, /window\.find\(/, 'the page-wide search would select other windows');
    assert.match(docs, /createTreeWalker\(editor, NodeFilter\.SHOW_TEXT\)/);
    assert.match(docs, /const text = nodes\.map\(n => n\.nodeValue\)\.join\(''\)/);
    assert.match(docs, /sel\.addRange\(range\)/);
});

test('calculator percent ends the entry like the other unary keys', () => {
    assert.match(docs, /key === '%'[\s\S]{0,220}newEntry = true;/);
});

test('paint drafts do not outlive their tool', () => {
    const choose = paint.slice(paint.indexOf('const choose = t =>'), paint.indexOf('const definitions'));
    assert.match(choose, /if \(t !== tool\)/);
    assert.match(choose, /curveLine = null;/);
    assert.match(choose, /polygon = \[\];/);
});

test('a paint stroke cannot stick after a lost pointer', () => {
    assert.match(paint, /try \{\s*canvas\.setPointerCapture\(e\.pointerId\);\s*\}\s*catch \{ \}/);
    assert.match(paint, /surface\.addEventListener\('lostpointercapture', finish\)/);
    assert.match(paint, /if \(!\(e\.buttons & 3\)\) \{\s*\/\* Heal a stroke/);
});

test('the Paint presenter is destroyed exactly once on close', () => {
    assert.equal((paint.match(/w\.onClosed\.push\(\(\) => presenter\.destroy\(\)\)/g) || []).length, 1);
});

test('Ctrl+A runs the same handler as the Select All menu item', () => {
    assert.match(paint, /action: selectAll/);
    assert.match(paint, /a: selectAll/);
});

test('ScanDisk accepts only folder parents, like backup restore', () => {
    assert.match(utils, /s\.fs\.get\(parentPath\(n\.path\)\)\?\.type !== 'folder'/);
});

test('the desktop drop guard is case-insensitive like the explorer drop', () => {
    assert.match(main, /parentPath\(p\)\.toLowerCase\(\) === 'c:\\\\windows\\\\desktop'/);
    assert.doesNotMatch(main, /parentPath\(p\) === 'C:/);
});

test('Sound Recorder retires the old clip on New and never exports a null blob', () => {
    assert.match(mm, /'New', action: \(\) => \{ stop\(\); blob = null; if \(url\) \{ URL\.revokeObjectURL\(url\); url = null; \}/);
    assert.match(mm, /if \(url && blob\)/);
    assert.doesNotMatch(mm, /if \(url\)\s*download\('Sound\.webm', url, blob\.type\)/);
});

test('the minesweeper end tone plays exactly once, win or loss', () => {
    assert.match(apps, /if \(!ended\)/);
    assert.match(apps, /ended = false;/);
    /* The beep sits outside the won-only block, so a loss beeps too. */
    assert.match(apps, /\}\n                s\.beep\(game\.state === 'won' \? 'win' : 'error'\);/);
});

test('the media seek hold cannot leak a second loop', () => {
    assert.match(mm, /let frame = 0, stamp = 0, holding = false;/);
    assert.match(mm, /if \(holding\)\n                return;/);
});

test('DOS history skips empty lines', () => {
    assert.match(dos, /if \(command\.trim\(\)\)\n            history\.push\(command\);/);
});

test('Folder Options settings drive the folder views', () => {
    assert.match(explorer, /folderOptions\.fullPath \? realPath\(\) : baseName\(path\)/);
    assert.match(explorer, /folderOptions\.allFiles === false \? s\.fs\.list\(realPath\(\)\)\.filter\(n => !n\.hidden\)/);
    assert.match(explorer, /displayName\(n, folderOptions\.extensions === false\)/);
    assert.match(explorer, /startsWith\('applet-folder-options'\)/);
    assert.match(main, /displayName\(n, folderOptions\.extensions === false\)/);
    assert.match(main, /folderOptions\.allFiles === false && n\.hidden/);
    assert.match(main, /startsWith\('applet-folder-options'\)/);
});
