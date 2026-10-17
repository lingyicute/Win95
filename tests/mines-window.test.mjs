import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function source(relative) {
    return readFile(path.join(root, relative), 'utf8');
}

test('large Minesweeper boards keep their full window size on narrow viewports', async () => {
    const [app, manager, css] = await Promise.all([
        source('src/packages/games/apps.js'),
        source('src/packages/shell/window-manager.js'),
        source('src/styles.css'),
    ]);

    assert.match(app, /resizable: false, allowOverflow: true/);
    assert.match(app, /w\.element\.classList\.add\('mines-window'\)/);
    assert.match(app, /w\.rect\.width = Math\.max\(212, c \* 20 \+ 46\)/, 'board columns still determine the requested width');
    assert.match(app, /w\.rect\.height = r \* 20 \+ 138/, 'board rows still determine the requested height');
    assert.match(manager, /if \(!w\.options\.allowOverflow\)\s*\{\s*w\.rect\.width = Math\.min\(w\.rect\.width, innerWidth\);\s*w\.rect\.height = Math\.min\(w\.rect\.height, innerHeight - 30\);/);
    assert.match(css, /\.window\.mines-window\{max-width:none\}/, 'the mobile max-width cap does not shrink the board window');
});
