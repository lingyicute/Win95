import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * A right click belongs to Windows 95: an application answers it with a menu
 * of its own, or with nothing at all, but the browser's own menu never opens.
 * The rule is installed twice over - once in the page's own head, before a
 * single module loads, and once by the desktop itself - and the guard sits at
 * the very top, so anything that wants the click has already had it.
 *
 * "Everywhere" is a claim about the whole source tree, so the checks below
 * look at all of it: every handler that eats a right click must refuse the
 * browser's menu as well, and every embedded page must be guarded too.
 */
installDom();
register('./win95-resolver.mjs', import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { swallowNativeMenu, swallowNativeMenuInFrame } = await import('../src/packages/ui/menu.js');

const target = () => {
    const listeners = [];
    return {
        listeners,
        addEventListener: (type, handler, options) => listeners.push({ type, handler, options }),
        send(event) { for (const listener of listeners) if (listener.type === event.type) listener.handler(event); }
    };
};
const rightClick = () => ({
    type: 'contextmenu',
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; }
});
const read = file => readFile(path.join(root, file), 'utf8');

/* --- the rule itself --------------------------------------------------- */

test('a right click the browser would answer is refused', () => {
    const doc = target();
    swallowNativeMenu(doc);
    assert.deepEqual(doc.listeners.map(listener => listener.type), ['contextmenu'], 'only right clicks are watched');
    const event = rightClick();
    doc.send(event);
    assert.equal(event.defaultPrevented, true, 'the browser is told not to open its menu');
});

test('the click is not swallowed before an application can answer it', () => {
    const doc = target();
    swallowNativeMenu(doc);
    const event = rightClick();
    doc.send(event);
    assert.notEqual(event.propagationStopped, true, 'a menu of our own still gets to open');
    assert.notEqual(doc.listeners[0].options, true, 'watch the click on its way up, after the application has seen it');
});

test('the page installs the rule before any module loads', async () => {
    const html = await read('src/index.html');
    const inline = /<script>([\s\S]*?)<\/script>/.exec(html);
    assert.ok(inline, 'the entry point carries the rule inline, so it is in force before the first paint');
    assert.ok(html.indexOf(inline[0]) < html.indexOf('type="module"'), 'and before the desktop starts');
    assert.match(inline[1], /addEventListener\(["']contextmenu["']/, 'it watches right clicks');
    assert.match(inline[1], /preventDefault\(\)/, 'and refuses them');

    /* Run the page's own script: the splash screen and a start that fails are
       covered by exactly this code, so the test uses no other copy of it. */
    const watched = [];
    const fake = {
        documentElement: { setAttribute() { } },
        addEventListener: (type, handler) => watched.push({ type, handler })
    };
    new Function('document', inline[1])(fake);
    assert.deepEqual(watched.map(w => w.type), ['contextmenu']);
    const event = rightClick();
    watched[0].handler(event);
    assert.equal(event.defaultPrevented, true);
});

test('the page and the desktop never install the rule twice', () => {
    const attributes = new Map();
    const doc = {
        documentElement: {
            getAttribute: name => attributes.get(name) ?? null,
            setAttribute: (name, value) => attributes.set(name, value)
        },
        listeners: [],
        addEventListener(type, handler) { this.listeners.push({ type, handler }); }
    };
    attributes.set('data-native-menu', 'off'); // what index.html leaves behind
    swallowNativeMenu(doc);
    assert.equal(doc.listeners.length, 0, 'the rule is already in force');
    delete doc.documentElement;
});

/* --- pages shown inside the desktop ------------------------------------ */

test('a page shown inside a window is guarded as well', () => {
    const docs = [], frames = [];
    const frame = {
        contentDocument: { addEventListener: (type, handler) => docs.push({ type, handler }) },
        addEventListener: (type, handler) => frames.push({ type, handler })
    };
    swallowNativeMenuInFrame(frame);
    assert.deepEqual(docs.map(l => l.type), ['contextmenu'], 'the frame document is watched at once');
    assert.deepEqual(frames.map(l => l.type), ['load'], 'and again every time it loads a new page');
    const event = rightClick();
    docs[0].handler(event);
    assert.equal(event.defaultPrevented, true);

    /* A second navigation replaces the document, so the load must re-arm it. */
    const later = [];
    frame.contentDocument = { addEventListener: (type, handler) => later.push({ type, handler }) };
    frames[0].handler();
    assert.equal(later.length, 1);
});

test('a page from another origin is left to its own browser', () => {
    const frame = {
        get contentDocument() { throw new Error('Blocked a frame with origin from accessing a cross-origin frame.'); },
        addEventListener() { }
    };
    assert.doesNotThrow(() => swallowNativeMenuInFrame(frame), 'the browser stops the guard, and that is not a crash');
});

test('Internet guards a local page, and keeps its scripts off', async () => {
    const source = await read('src/packages/apps/multimedia.js');
    assert.match(source, /sandbox: 'allow-same-origin'/, 'the frame stays readable, which is what makes the guard possible');
    assert.doesNotMatch(source, /sandbox: '[^']*allow-scripts[^']*'[^)]*srcdoc/, 'a local page still cannot run scripts');
    assert.match(source, /swallowNativeMenuInFrame\(frame\)/, 'and its right clicks are refused');
    assert.ok(source.indexOf('swallowNativeMenuInFrame(frame)') < source.indexOf('page.append(frame)'), 'before the frame is shown');
});

/* --- the hand-written menus -------------------------------------------- */

/** Every `contextmenu` handler body in the source tree. */
const handlers = source => {
    const bodies = [];
    for (const match of source.matchAll(/oncontextmenu\s*=\s*|['"]contextmenu['"]\s*,/g)) {
        let index = match.index + match[0].length;
        const brace = source.indexOf('{', index), semicolon = source.indexOf(';', index);
        if (brace === -1 || (semicolon !== -1 && semicolon < brace)) {
            bodies.push(source.slice(index, semicolon === -1 ? source.length : semicolon));
            continue;
        }
        let depth = 0, end = brace;
        for (; end < source.length; end++) {
            if (source[end] === '{')
                depth++;
            else if (source[end] === '}' && --depth === 0) {
                end++;
                break;
            }
        }
        bodies.push(source.slice(index, end));
    }
    return bodies;
};

test('every handler that eats a right click also refuses the browser menu', async () => {
    const files = [
        'src/main.js',
        'src/packages/apps/documents.js',
        'src/packages/apps/explorer.js',
        'src/packages/apps/paint.js',
        'src/packages/apps/utilities.js',
        'src/packages/games/apps.js',
        'src/packages/shell/window-manager.js',
        'src/packages/ui/menu.js'
    ];
    let seen = 0;
    for (const file of files) {
        for (const body of handlers(await read(file))) {
            if (!body.includes('stopPropagation'))
                continue;
            seen++;
            assert.match(body, /preventDefault/, `${file}: a handler that stops the click must refuse the browser menu too, or the click goes nowhere and the menu still opens`);
        }
    }
    assert.ok(seen >= 4, 'the scan found the handlers it is meant to check');
});

test('nothing turns the browser menu back on', async () => {
    const files = [
        'src/main.js',
        'src/packages/apps/documents.js',
        'src/packages/apps/explorer.js',
        'src/packages/apps/multimedia.js',
        'src/packages/apps/paint.js',
        'src/packages/apps/utilities.js',
        'src/packages/games/apps.js',
        'src/packages/shell/window-manager.js',
        'src/packages/ui/menu.js'
    ];
    for (const file of files) {
        const source = await read(file);
        assert.doesNotMatch(source, /oncontextmenu\s*=\s*(?:null|undefined)/, `${file}`);
        assert.doesNotMatch(source, /removeEventListener\(\s*['"]contextmenu['"]/, `${file}`);
        assert.doesNotMatch(source, /contextmenu['"]\s*,\s*[^,)]+,\s*(?:true|false)\s*\)/, `${file}: the guard is installed once, on the way up`);
    }
});
