import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = await readFile(path.join(root, 'src/styles.css'), 'utf8');

async function sourceFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory())
            files.push(...await sourceFiles(full));
        else if (entry.name.endsWith('.js'))
            files.push(full);
    }
    return files;
}

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The declarations of every rule whose selector list is exactly `selector`. */
const rule = selector => [...css.matchAll(new RegExp(`(?:^|})${escape(selector)}\\{([^}]*)\\}`, 'g'))]
    .map(match => match[1]).join(';');

test('no check box or radio is left to the browser', () => {
    assert.doesNotMatch(css, /input\[type=(?:checkbox|radio)\][^{}]*\{[^}]*accent-color/, 'the browser widget is replaced, not tinted');
    assert.doesNotMatch(css, /input\[type=(?:checkbox|radio)\][^{}]*\{[^}]*appearance:auto/);
    const shared = rule('input[type=checkbox],input[type=radio]');
    assert.ok(shared, 'both widgets share one rule');
    assert.match(shared, /appearance:none/);
    assert.match(shared, /-webkit-appearance:none/);
    assert.match(shared, /background:#fff/, 'the box is a white well');
    assert.match(shared, /box-shadow:inset -1px -1px #fff,inset 1px 1px #808080,inset -2px -2px #dfdfdf,inset 2px 2px #000/, 'sunken bevel');
    assert.match(shared, /vertical-align:middle/);
});

test('the check box is drawn: a white well, a bevel and a 7 px check mark', () => {
    assert.match(rule('input[type=checkbox],input[type=radio]'), /width:13px;height:13px;min-height:13px/);
    assert.match(rule('input[type=checkbox],input[type=radio]'), /background:#fff/);
    assert.match(rule('input[type=checkbox],input[type=radio]'), /background-repeat:no-repeat;background-position:center/);
    const check = rule('input[type=checkbox]:checked');
    assert.match(check, /background-image:url\("data:image\/svg\+xml;charset=utf-8,/);
    assert.match(decodeURIComponent(check), /<svg width='7' height='7'/, 'the check mark is a drawn 7 px glyph');
    assert.match(decodeURIComponent(check), /fill='#000'/);
    assert.match(rule('input[type=checkbox]:active'), /background-color:#c0c0c0/, 'pressed boxes fill with the face colour');
    assert.match(rule('input[type=checkbox]:disabled,input[type=radio]:disabled'), /background-color:#c0c0c0/);
    assert.match(decodeURIComponent(rule('input[type=checkbox]:disabled:checked')), /fill='gray'/, 'a disabled check mark is grey');
    assert.match(rule('input[type=checkbox]:focus-visible,input[type=radio]:focus-visible'), /outline:1px dotted #000/);
});

test('the radio is a drawn 12 px well with a 4 px dot', () => {
    const base = rule('input[type=radio]');
    assert.match(base, /width:12px;height:12px;min-height:12px/);
    assert.match(decodeURIComponent(base), /<svg width='12' height='12'/);
    assert.match(decodeURIComponent(base), /fill='gray'/, 'the halo');
    assert.match(decodeURIComponent(base), /fill='#000'/, 'the ring');
    assert.match(decodeURIComponent(base), /fill='#DFDFDF'/, 'the inner shading');
    assert.doesNotMatch(base, /border-radius|clip-path/, 'the well is drawn, not a styled round div');
    assert.match(base, /box-shadow:none/, 'the square bevel belongs to the check box, not the radio');
    assert.match(base, /background-color:transparent/, 'no square plate behind the drawn well');
    const checked = decodeURIComponent(rule('input[type=radio]:checked'));
    assert.match(checked, /<svg width='4' height='4'/, 'the dot is its own drawn glyph');
    assert.match(checked, /background-size:4px 4px,12px 12px/, 'the dot is the top layer, the well underneath');
    assert.match(decodeURIComponent(rule('input[type=radio]:disabled:checked')), /fill='gray'/);
});

test('a disabled row greys its label', () => {
    assert.match(rule('.checkbox-label:has(input:disabled)'), /color:#808080/);
});

test('every check box in the desktop is one of these inputs', async () => {
    const sites = [];
    for (const file of await sourceFiles(path.join(root, 'src'))) {
        const text = await readFile(file, 'utf8');
        for (const [i, line] of text.split('\n').entries())
            sites.push(...[...line.matchAll(/type: '(?:checkbox|radio)'/g)].map(() => `${path.relative(root, file)}:${i + 1}`));
    }
    // the shared helper in the control panel builds ten more of them at runtime
    const panel = await readFile(path.join(root, 'src/packages/apps/control-panel.js'), 'utf8');
    const viaHelper = [...panel.matchAll(/check\(p, '[^']+'/g)].length;
    assert.ok(viaHelper >= 10, `the control panel builds its rows through one helper, found ${viaHelper}`);
    assert.ok(sites.length + viaHelper >= 16, `expected the desktop's check boxes and radios, found ${sites.length} literal + ${viaHelper} helper`);
    // none of them may opt out of the shared drawing, and none needs a class to get it
    for (const file of await sourceFiles(path.join(root, 'src'))) {
        const text = await readFile(file, 'utf8');
        assert.doesNotMatch(text, /win95-checkbox/, `${path.relative(root, file)} still opts in by hand`);
        assert.doesNotMatch(text, /type: 'checkbox'[^)]*appearance/, 'no site draws its own box');
    }
});

test('the rendered widget keeps the browser semantics it came with', async () => {
    const sources = (await Promise.all((await sourceFiles(path.join(root, 'src'))).map(async file => [file, await readFile(file, 'utf8')])));
    for (const [file, text] of sources) {
        for (const match of text.matchAll(/el\('input', \{([^}]*)\}/g)) {
            if (!/type: 'checkbox'|type: 'radio'/.test(match[1]))
                continue;
            assert.match(match[1], /type: '(checkbox|radio)'/, path.relative(root, file));
            assert.doesNotMatch(match[1], /\brole: 'button'|tabIndex: -1/, 'a real input keeps its own keyboard and screen-reader behaviour');
        }
    }
});
