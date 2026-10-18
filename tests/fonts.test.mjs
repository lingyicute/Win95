/**
 * The interface must draw every glyph with a bundled face.
 *
 * The rule has three parts, and each is checked here:
 *
 *  1. Every character the sources can put on screen is in the cmap of a
 *     bundled face. CSS cannot stop a browser from reaching for a system
 *     font when a face lacks a glyph, so the only real guarantee is that
 *     no gap exists. The cmaps live in src/packages/ui/font-glyphs.js,
 *     which tools/font-glyphs.py regenerates from the .woff2 files.
 *  2. Outside the handful of places that show text the user types
 *     themselves, no font stack names a system family or a generic family.
 *  3. The same holds for the two canvas call sites, which do not inherit
 *     CSS and have to name their font in script.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT_GLYPHS } from '../src/packages/ui/font-glyphs.js';

const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '..');
const assets = path.join(root, 'src/assets');

const SYSTEM_FAMILIES =
    /(?:^|[,'"`\s])(Arial|Times New Roman|Courier New|Verdana|Georgia|MS Sans Serif|serif|sans-serif|monospace)(?:[,'"`\s]|$)/;

// Places that deliberately show text the user types, or preview the fonts the
// machine has. They are the only selectors allowed to name a system family.
const EXEMPT_SELECTORS = [
    '.notepad-editor',
    '.ruler',
    '.wordpad-page',
    '.dos-body',
    '.char-grid button',
    '.print-area',
];
const EXEMPT_SCRIPTS = new Set(['control-panel.js', 'documents.js', 'paint.js', 'utilities.js', 'rtf.js']);

async function sourceFiles(dir = path.join(root, 'src'), suffix = ['.js', '.html', '.css']) {
    const found = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory())
            found.push(...await sourceFiles(full, suffix));
        else if (suffix.includes(path.extname(entry.name)))
            found.push(full);
    }
    return found;
}

function rangesToSet(spans) {
    const set = new Set();
    for (const [low, high] of spans)
        for (let point = low; point <= high; point++)
            set.add(point);
    return set;
}

const bundled = new Set();
for (const spans of Object.values(FONT_GLYPHS))
    for (const point of rangesToSet(spans))
        bundled.add(point);

test('every character the sources can show is drawn by a bundled face', async () => {
    const missing = new Map();
    for (const file of await sourceFiles()) {
        const text = await readFile(file, 'utf8');
        for (const char of text) {
            const point = char.codePointAt(0);
            if (point < 0x20 || bundled.has(point))
                continue;
            const where = missing.get(char) || new Set();
            where.add(path.relative(root, file));
            missing.set(char, where);
        }
    }
    const report = [...missing].map(([char, where]) =>
        `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} ${JSON.stringify(char)} in ${[...where].join(', ')}`);
    assert.deepEqual(missing.size, 0,
        'a system font would draw these; add them to a bundled subset and rerun tools/font-glyphs.py:\n' + report.join('\n'));
});

test('only the self-text areas name a system font in CSS', async () => {
    const css = await readFile(path.join(root, 'src/styles.css'), 'utf8');
    const offenders = [];
    for (const [, selector, body] of css.matchAll(/([^{}]{1,200})\{([^{}]*)\}/g)) {
        for (const [, value] of body.matchAll(/(?:^|;)\s*(?:font-family|font)\s*:\s*([^;}]+)/g)) {
            if (SYSTEM_FAMILIES.test(value))
                offenders.push({ selector: selector.trim(), value: value.trim() });
        }
    }
    assert.deepEqual(offenders.map(o => o.selector).sort(), [...EXEMPT_SELECTORS].sort(),
        'system fonts must stay inside the areas that show the user\'s own text');
    const stack = css.match(/--ui-font:([^;}]+)/)[1];
    assert.doesNotMatch(stack, SYSTEM_FAMILIES, 'the interface stack falls back only to bundled faces');
    assert.match(stack, /'W95 Symbols'$/, 'the symbol face closes the interface stack');
});

test('only the self-text areas name a system font in script', async () => {
    const offenders = [];
    for (const file of await sourceFiles(path.join(root, 'src'), ['.js'])) {
        const text = await readFile(file, 'utf8');
        const hits = text.split('\n').filter(line => SYSTEM_FAMILIES.test(line));
        if (hits.length)
            offenders.push(path.basename(file));
    }
    assert.deepEqual(offenders.sort(), [...EXEMPT_SCRIPTS].sort(),
        'canvas and font-list code must stay inside the areas that show the user\'s own text');
    for (const file of await sourceFiles(path.join(root, 'src'), ['.js'])) {
        if (EXEMPT_SCRIPTS.has(path.basename(file)))
            continue;
        const text = await readFile(file, 'utf8');
        for (const [, value] of text.matchAll(/ctx\.font\s*=\s*[`'"]([^`'"]+)[`'"]/g))
            assert.doesNotMatch(value, SYSTEM_FAMILIES, `${path.basename(file)} canvas font names a system family`);
    }
});

test('the date strings the clock can print are drawn by a bundled face too', async () => {
    // The taskbar clock, the Date/Time settings page and the DOS DATE command
    // format dates with Intl, so their text never appears in the sources and
    // the scan above cannot see it. These are the locales the settings page
    // offers, and the same formats the clock uses.
    const settings = await readFile(path.join(root, 'src/packages/apps/control-panel.js'), 'utf8');
    const locales = JSON.parse(settings.match(/'Locale:', 'locale', (\[[^\]]*\])/)[1].replace(/'/g, '"'));
    const missing = new Map();
    const note = (text, locale) => {
        for (const char of text) {
            const point = char.codePointAt(0);
            if (point < 0x20 || bundled.has(point))
                continue;
            if (!missing.has(char))
                missing.set(char, new Set());
            missing.get(char).add(locale);
        }
    };
    for (const locale of locales) {
        for (let month = 0; month < 12; month++) {
            const date = new Date(2026, month, 19, 15, 4, 5);
            note(date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true }), locale);
            note(date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: false }), locale);
            note(date.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), locale);
            note(date.toLocaleString(locale), locale);
            note(date.toLocaleDateString(locale), locale);
        }
    }
    const report = [...missing].map(([char, where]) =>
        `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} ${JSON.stringify(char)} in ${[...where].join(', ')}`);
    assert.deepEqual(missing.size, 0,
        'a locale date string would fall back to a system font:\n' + report.join('\n'));
});

test('the bundled faces are declared, blocked until loaded, and preloaded', async () => {
    const css = await readFile(path.join(root, 'src/styles.css'), 'utf8');
    const faces = [...css.matchAll(/@font-face\{([^}]*)\}/g)].map(m => m[1]);
    assert.equal(faces.length, 7, 'three original faces plus two symbol, one serif and one mono face');
    for (const face of faces) {
        assert.match(face, /font-display:block/,
            'a swap period would show system glyphs before the bundled face arrives');
        assert.doesNotMatch(face, /font-display:swap/);
    }
    assert.match(css, /@font-face\{font-family:'W95 Symbols';src:url\('\.\/assets\/w95-symbols\.woff2'\)/);
    assert.match(css, /font-family:'W95 Symbols';src:url\('\.\/assets\/w95-symbols-tech\.woff2'\)[^}]*unicode-range:U\+2315/,
        'the magnifier glyph exists only in the mono face, so it is scoped to it');
    assert.match(css, /@font-face\{font-family:'W95 Serif';src:url\('\.\/assets\/w95-serif\.woff2'\)/);
    assert.match(css, /@font-face\{font-family:'W95 Mono';src:url\('\.\/assets\/w95-mono\.woff2'\)/);

    const html = await readFile(path.join(root, 'src/index.html'), 'utf8');
    for (const name of ['w95fa.woff2', 'roboto-regular-ascii.woff2', 'w95-symbols.woff2', 'w95-serif.woff2', 'w95-mono.woff2'])
        assert.match(html, new RegExp(`<link rel="preload" as="font" type="font/woff2" href="./assets/${name.replace('.', '\\.')}"`),
            `${name} is preloaded so the first paint never waits for it`);
    await readFile(path.join(assets, 'w95-symbols.woff2'));
    await readFile(path.join(assets, 'w95-symbols-tech.woff2'));
    await readFile(path.join(assets, 'w95-serif.woff2'));
    await readFile(path.join(assets, 'w95-mono.woff2'));
});

test('the symbol-only chrome really is drawn by the symbol face', async () => {
    const css = await readFile(path.join(root, 'src/styles.css'), 'utf8');
    for (const selector of ['.submenu-arrow', '.paint-tools button', '.media-controls button', '.card-pips', '.icon-fallback']) {
        const rule = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{[^}]*\\}`));
        assert.ok(rule, `${selector} rule is present`);
        assert.match(rule[0], /'W95 Symbols'/, `${selector} is drawn by the bundled symbol face`);
        assert.doesNotMatch(rule[0], SYSTEM_FAMILIES);
    }
});
