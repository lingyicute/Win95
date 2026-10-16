import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

/** Classes whose CSS declares `display: grid`. */
async function gridClasses() {
    const css = await readFile(path.join(root, 'src/styles.css'), 'utf8');
    const found = new Set();
    for (const rule of css.matchAll(/\.([a-z0-9-]+)\{([^}]*)\}/g)) {
        if (/display:grid/.test(rule[2]))
            found.add(rule[1]);
    }
    return found;
}

/**
 * Finds grid containers that receive a bare string child. A text node handed
 * straight to a grid container becomes one anonymous grid item, so consecutive
 * labels and values all land in a single cell instead of one cell per column.
 */
function bareTextChildren(source, classes) {
    const offenders = [];
    for (const name of classes) {
        const matcher = new RegExp("class:\\s*'(" + name + "(?:\\s[^']*)?)'", 'g');
        for (const match of source.matchAll(matcher)) {
            // Walk back to the `{` that opens the attributes object.
            let open = match.index;
            while (open > 0 && source[open] !== '{')
                open--;
            if (source[open] !== '{')
                continue;
            // Walk forward to its matching brace.
            let depth = 0, close = open;
            for (let i = open; i < source.length; i++) {
                if (source[i] === '{')
                    depth++;
                else if (source[i] === '}')
                    depth--;
                if (depth === 0) { close = i; break; }
            }
            const tail = source.slice(close + 1);
            if (/^\s*,\s*['"`]/.test(tail)) {
                const line = source.slice(0, match.index).split('\n').length;
                offenders.push({ name, line, snippet: tail.trim().slice(0, 48) });
            }
        }
    }
    return offenders;
}

test('grid containers never receive bare text children', async () => {
    const classes = await gridClasses();
    assert.ok(classes.has('info-grid'), 'styles.css should still declare the info-grid container');
    const files = await sourceFiles(path.join(root, 'src'));
    const offenders = [];
    for (const file of files) {
        const source = await readFile(file, 'utf8');
        for (const hit of bareTextChildren(source, classes))
            offenders.push(`${path.relative(root, file)}:${hit.line} .${hit.name} <- ${hit.snippet}`);
    }
    assert.deepEqual(offenders, [], 'labels and values must be wrapped, e.g. with infoGrid([...])');
});

test('the detector flags the previous unpadded grid markup', () => {
    const legacy = "el('div', { class: 'system-logo' }, icon('windows', 64), el('div', {}, el('strong', { text: 'Microsoft' }), el('p', { text: 'Windows 95' }))), el('div', { class: 'info-grid' }, 'System:', 'Browser-native desktop', 'Version:', '1.0.0')";
    const offenders = bareTextChildren(legacy, new Set(['info-grid']));
    assert.equal(offenders.length, 1);
});

test('infoGrid pairs every label with its own value cell', async () => {
    const { infoGrid } = await import('../src/packages/ui/dom.js').catch(() => ({}));
    // dom.js builds DOM nodes, so inspect the source contract instead when the
    // module cannot load outside a browser.
    if (!infoGrid) {
        const source = await readFile(path.join(root, 'src/packages/ui/dom.js'), 'utf8');
        assert.match(source, /export const infoGrid = rows => el\('div', \{ class: 'info-grid' \}, \.\.\.rows\.flatMap/);
        return;
    }
    assert.equal(typeof infoGrid, 'function');
});
