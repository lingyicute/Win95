import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Every icon in ICON_DATA has to be requested by something.
 *
 * The table is inlined base64 in every page load, so an entry nothing names is
 * bytes on the wire for a picture that can never be drawn. This test rebuilds
 * the set of names the shell can ask for and fails when the table holds one
 * that is not in it.
 *
 * A name counts as requested when the source mentions it where an icon name is
 * expected, and the places are:
 *   icon('name', size)      anywhere in the argument list, including ternaries
 *                           such as icon(open ? 'folderOpen' : 'folder', 32)
 *   icon: 'name'            a property, as menus, windows and dialogs take them
 *   register('id', 'N', 'name', …)  the third argument of an app registration
 *   ['id', 'Name', 'name']  a Control Panel applet row
 *   fileIcon()'s extension map
 *
 * The alias table in icons.js is applied last: 'folderOpen' is how the call
 * sites spell it, folder-open is the name in the table.
 */
async function shellSources() {
    const files = [];
    const walk = async dir => {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory())
                await walk(full);
            else if (entry.name.endsWith('.js') && entry.name !== 'icon-data.js')
                files.push(full);
        }
    };
    await walk(path.join(root, 'src'));
    return Promise.all(files.map(async file => ({
        file: path.relative(root, file),
        text: await readFile(file, 'utf8'),
    })));
}

async function iconTable() {
    const source = await readFile(path.join(root, 'src/packages/ui/icon-data.js'), 'utf8');
    const marker = 'export const ICON_DATA = ';
    const start = source.indexOf(marker);
    assert.ok(start >= 0, 'icon-data.js is one exported literal');
    return JSON.parse(source.slice(start + marker.length, source.lastIndexOf('};') + 1));
}

async function aliasTable() {
    const source = await readFile(path.join(root, 'src/packages/ui/icons.js'), 'utf8');
    const literal = source.match(/const paths = (\{.*?\});/s)?.[1];
    assert.ok(literal, 'icons.js declares the alias table');
    const aliases = {};
    for (const match of literal.matchAll(/(\w+):\s*'([^']+)'/g))
        aliases[match[1]] = match[2];
    return aliases;
}

/** The balanced argument list of every icon(...) call in one file. */
function iconCallArguments(text) {
    const calls = [];
    for (const match of text.matchAll(/\bicon\(/g)) {
        let i = match.index + match[0].length, depth = 1;
        while (i < text.length && depth > 0) {
            if (text[i] === '(')
                depth++;
            else if (text[i] === ')')
                depth--;
            i++;
        }
        calls.push(text.slice(match.index + match[0].length, i - 1));
    }
    return calls;
}

/** All icon names the source can ask for, aliases resolved to table names. */
async function requestedNames(known, aliases) {
    const knownName = name => known.has(name) || Object.hasOwn(aliases, name);
    const add = (name, into) => { if (knownName(name)) into.add(aliases[name] || name); };
    const requested = new Set();

    for (const { text } of await shellSources()) {
        for (const args of iconCallArguments(text)) {
            for (const literal of args.matchAll(/'([^']+)'|"([^"]+)"/g))
                add(literal[1] ?? literal[2], requested);
        }
        for (const match of text.matchAll(/icon:\s*'([^']+)'/g))
            add(match[1], requested);
        for (const match of text.matchAll(/register\(\s*'[^']+'\s*,\s*'[^']*'\s*,\s*'([^']+)'/g))
            add(match[1], requested);
        for (const match of text.matchAll(/\['[a-z-]+'\s*,\s*'[^']*'\s*,\s*'([^']+)'\]/g))
            add(match[1], requested);
        const fileIconMap = text.match(/return \(\{[^}]*\}\)\[ext\]/s)?.[0];
        if (fileIconMap)
            for (const literal of fileIconMap.matchAll(/'([^']+)'/g))
                add(literal[1], requested);
    }
    return requested;
}

const nameOf = key => key.replace(/-(16|32|48)$/, '');

test('every icon in ICON_DATA is requested by the shell', async () => {
    const [table, aliases] = await Promise.all([iconTable(), aliasTable()]);
    const known = new Set(Object.keys(table).map(nameOf));
    const requested = await requestedNames(known, aliases);
    const dead = [...known].filter(name => !requested.has(name)).sort();
    assert.deepEqual(dead, [], 'icons nothing asks for, remove them from ICON_DATA: ' + dead.join(', '));
});

test('the icon table still covers the icons the Start menu and registry need', async () => {
    const table = await iconTable();
    for (const key of ['start-flag-16', 'windows-logo-32', 'my-computer-32', 'folder-32', 'recycle-bin-empty-32', 'text-document-32'])
        assert.ok(table[key], `${key} is inlined`);
    /* text-document-32 is icon()'s last resort when a name or size is missing,
       so it has to survive even though no call site names it directly. */
    const icons = await readFile(path.join(root, 'src/packages/ui/icons.js'), 'utf8');
    assert.match(icons, /ICON_DATA\['text-document-32'\]/, 'the fallback is still what icon() reaches for');
});

test('every entry is a data URI, never a file path', async () => {
    const table = await iconTable();
    for (const [key, value] of Object.entries(table)) {
        assert.match(value, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/, `${key} is inlined as PNG base64`);
        assert.ok(value.length > 100, `${key} holds a real picture`);
    }
});

test('the detector would catch a table entry nothing names', async () => {
    /* The rule is only worth having if a stray entry fails it: add one to the
       real sources in memory and check that it comes out as dead. */
    const [table, aliases] = await Promise.all([iconTable(), aliasTable()]);
    const known = new Set([...Object.keys(table).map(nameOf), 'ghost-icon']);
    const requested = await requestedNames(known, aliases);
    const dead = [...known].filter(name => !requested.has(name)).sort();
    assert.deepEqual(dead, ['ghost-icon']);
});
