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
    assert.match(app, /w\.rect\.width = c \* 20 \+ 46\.5/, 'board columns still determine the requested width');
    assert.match(app, /w\.rect\.height = r \* 20 \+ 138/, 'board rows still determine the requested height');
    assert.match(manager, /if \(!w\.options\.allowOverflow\)\s*\{\s*w\.rect\.width = Math\.min\(w\.rect\.width, innerWidth\);\s*w\.rect\.height = Math\.min\(w\.rect\.height, innerHeight - taskbarHeight\(\)\);/);
    assert.match(css, /\.window\.mines-window\{max-width:none\}/, 'the mobile max-width cap does not shrink the board window');
});

test('the field fills the window, so no grey strip is left beside it', async () => {
    const [app, css] = await Promise.all([source('src/packages/games/apps.js'), source('src/styles.css')]);
    const rule = name => (css.match(new RegExp('\\.' + name + '\\{[^}]*\\}')) ?? [''])[0];
    const padded = name => {
        const m = rule(name).match(/padding:([^;}]+)/);
        if (!m)
            return 0;
        const v = m[1].trim().split(/\s+/).map(parseFloat);
        return v.length === 1 ? v[0] * 2 : v.length > 3 ? v[1] + v[3] : v[1] * 2;
    };
    const bordered = name => ((rule(name).match(/(?:^|;)border(?:-width)?:\s*(\d+)px/) ?? [])[1] ?? 0) * 2;
    const cell = Number((rule('mine-cell').match(/width:(\d+)px/) ?? [])[1]);
    const chrome = padded('window') + bordered('window') + padded('mines-body') + bordered('mines-body')
        + padded('mines-frame') + bordered('mines-frame') + bordered('mines-board');

    assert.equal(cell, 20, 'a cell is a fixed square, so a board is cell × columns across');
    assert.equal(chrome, 46.5, 'the bevels and paddings between the window edge and the board add up to this');
    assert.match(app, new RegExp('width: cols \\* ' + cell + ' \\+ ' + chrome), 'the window is born as wide as the beginner field');
    assert.match(app, new RegExp('w\\.rect\\.width = c \\* ' + cell + ' \\+ ' + chrome + ';'), 'and stays as wide as the field at 16 and 30 columns');
    assert.doesNotMatch(app, /Math\.max\(\d+, c \*/, 'no minimum width pads the field out towards one side');
});
