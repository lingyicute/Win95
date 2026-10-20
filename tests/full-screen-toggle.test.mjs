import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Display Properties used to carry a one-way "Full Screen" button: pressing it
 * entered full screen and left the button saying "Full Screen", so there was no
 * way back except the browser's own Esc. It is a toggle now, and its caption
 * follows the document, because Esc can leave full screen behind the sheet.
 */
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(path.join(root, 'src/packages/apps/control-panel.js'), 'utf8');
const { translateText } = await import('../src/packages/core/i18n.js');

test('the button enters and leaves full screen', () => {
    assert.match(source, /if \(document\.fullscreenElement\)\s*\n\s*await document\.exitFullscreen\?\.\(\);\s*\n\s*else\s*\n\s*await document\.documentElement\.requestFullscreen/);
    assert.doesNotMatch(source, /button\('Full Screen', \(\) => document\.documentElement\.requestFullscreen/, 'the one-way button is gone');
});

test('the caption follows the document, not the last click', () => {
    assert.match(source, /toggle\.textContent = document\.fullscreenElement \? 'Exit Full Screen' : 'Full Screen'/);
    assert.match(source, /document\.addEventListener\('fullscreenchange', sync\)/);
    assert.match(source, /win\.onClosed\.push\(\(\) => document\.removeEventListener\('fullscreenchange', sync\)\)/, 'the listener leaves with the sheet');
    assert.match(source, /fullScreenButton\(win\)/, 'the sheet hands the button its window so it can clean up');
});

test('both captions read as Chinese on a Chinese desktop', () => {
    assert.equal(translateText('Full Screen', 'zh'), '全屏');
    assert.equal(translateText('Exit Full Screen', 'zh'), '取消全屏');
});
