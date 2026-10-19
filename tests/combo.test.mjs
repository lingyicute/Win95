import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDom, keydown } from './dom-shim.mjs';
import { register } from 'node:module';

// Window-manager.js speaks the browser import map's names, so load its resolver.
register('./win95-resolver.mjs', import.meta.url);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { document, window, menus } = installDom();
const { combo, closeCombos } = await import('../src/packages/ui/select.js');

const OPTIONS = ['en-US', 'en-GB', 'pl-PL'];
const setup = options => {
    const node = combo({ ariaLabel: 'Locale', options: OPTIONS, ...options });
    document.body.append(node);
    return node;
};
const popup = () => menus.querySelector('.win95-combo-popup');
const rows = () => popup()?.querySelectorAll('.win95-combo-option') ?? [];
const highlighted = () => rows().findIndex(row => row.classList.contains('highlight'));

test('a closed dropdown shows the current value and no browser widget', () => {
    const node = setup({ value: 'en-GB' });
    assert.equal(node.getAttribute('role'), 'combobox');
    assert.equal(node.getAttribute('aria-expanded'), 'false');
    assert.equal(node.querySelector('.win95-combo-value').textContent, 'en-GB');
    assert.equal(popup(), null);
    node.remove();
});

test('ArrowDown opens the list, arrow keys move the highlight, Enter commits it', () => {
    const node = setup({ value: 'en-US' });
    const seen = [];
    node.onchange = value => seen.push(value);

    keydown(node, 'ArrowDown');
    assert.equal(node.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(rows().map(row => row.textContent), OPTIONS);
    assert.equal(highlighted(), 0, 'the current value is highlighted when the list opens');

    keydown(node, 'ArrowDown');
    assert.equal(highlighted(), 1);
    keydown(node, 'ArrowDown');
    assert.equal(highlighted(), 2);
    keydown(node, 'ArrowUp');
    assert.equal(highlighted(), 1);

    keydown(node, 'Enter');
    assert.equal(node.value, 'en-GB');
    assert.equal(node.querySelector('.win95-combo-value').textContent, 'en-GB');
    assert.deepEqual(seen, ['en-GB']);
    assert.equal(node.getAttribute('aria-expanded'), 'false');
    assert.equal(popup(), null);
    node.remove();
});

test('Home and End jump to the ends of the list', () => {
    const node = setup({ value: 'en-US' });
    keydown(node, 'ArrowDown');
    keydown(node, 'End');
    assert.equal(highlighted(), 2);
    keydown(node, 'Home');
    assert.equal(highlighted(), 0);
    keydown(node, 'Enter');
    assert.equal(node.value, 'en-US');
    node.remove();
});

test('Escape closes the list and keeps the value', () => {
    const node = setup({ value: 'en-US' });
    const seen = [];
    node.onchange = value => seen.push(value);
    keydown(node, 'ArrowDown');
    keydown(node, 'ArrowDown');
    keydown(node, 'Escape');
    assert.equal(node.value, 'en-US');
    assert.deepEqual(seen, []);
    assert.equal(node.getAttribute('aria-expanded'), 'false');
    assert.equal(popup(), null);
    node.remove();
});

test('clicking an option selects it', () => {
    const node = setup({ value: 'en-US' });
    const seen = [];
    node.onchange = value => seen.push(value);
    keydown(node, 'ArrowDown');
    rows()[2].dispatchEvent({ type: 'click' });
    assert.equal(node.value, 'pl-PL');
    assert.equal(seen.at(-1), 'pl-PL');
    assert.equal(popup(), null);
    node.remove();
});

test('typing a letter highlights the matching entry', () => {
    const node = setup({ value: 'en-US' });
    keydown(node, 'ArrowDown');
    keydown(node, 'p');
    assert.equal(highlighted(), 2);
    keydown(node, 'Enter');
    assert.equal(node.value, 'pl-PL');
    node.remove();
});

test('a pointer press outside the list closes it', () => {
    const node = setup({ value: 'en-US' });
    const desktop = document.createElement('div');
    keydown(node, 'ArrowDown');
    assert.equal(node.getAttribute('aria-expanded'), 'true');
    window.dispatchEvent({ type: 'pointerdown', target: desktop });
    assert.equal(node.getAttribute('aria-expanded'), 'false');
    assert.equal(popup(), null);
    node.remove();
});

test('list mode renders rows and picks on click, arrow keys and type-ahead', () => {
    const seen = [];
    const node = combo({ mode: 'list', ariaLabel: 'Wallpaper', options: OPTIONS, value: 'en-GB', onchange: v => seen.push(v) });
    document.body.append(node);
    assert.ok(node.classList.contains('win95-combo-list'));
    assert.equal(node.getAttribute('role'), 'listbox');
    assert.deepEqual(node.children.map(row => row.textContent), OPTIONS);
    assert.equal(node.children[1].classList.contains('selected'), true);
    assert.equal(node.children[1].getAttribute('aria-selected'), 'true');

    keydown(node, 'ArrowDown');
    assert.equal(node.value, 'pl-PL');
    assert.equal(node.children[2].classList.contains('selected'), true);
    assert.equal(node.children[1].classList.contains('selected'), false);

    node.children[0].dispatchEvent({ type: 'click' });
    assert.equal(node.value, 'en-US');
    assert.deepEqual(seen, ['pl-PL', 'en-US']);
    node.remove();
});

test('setOptions replaces the entries and keeps the selection consistent', () => {
    const node = combo({ mode: 'list', ariaLabel: 'Font', options: ['A', 'B'] });
    document.body.append(node);
    node.setOptions(['One', 'Two', 'Three'], 'Two');
    assert.deepEqual(node.children.map(row => row.textContent), ['One', 'Two', 'Three']);
    assert.equal(node.value, 'Two');

    node.setOptions(['Solo']);
    assert.equal(node.value, 'Solo', 'a value that no longer exists falls back to the first entry');
    assert.equal(node.children.length, 1);
    node.remove();
});

test('disabled combos do not open, and disabling closes an open list', () => {
    const node = setup({ value: 'en-US', disabled: true });
    assert.equal(node.tabIndex, -1);
    keydown(node, 'ArrowDown');
    assert.equal(popup(), null);
    node.disabled = false;
    keydown(node, 'ArrowDown');
    assert.equal(popup()?.children.length, 3);
    node.disabled = true;
    assert.equal(popup(), null);
    assert.equal(node.classList.contains('disabled'), true);
    node.remove();
});

test('value and onchange behave like the control they replace', () => {
    const node = setup({ value: 'en-US' });
    const first = [], second = [];
    node.onchange = value => first.push(value);
    node.onchange = value => second.push(value);
    node.value = 'pl-PL';
    assert.equal(node.value, 'pl-PL');
    assert.deepEqual(first, [], 'assigning onchange replaces the previous handler');
    assert.deepEqual(second, [], 'setting value programmatically does not fire change');
    keydown(node, 'ArrowDown');
    keydown(node, 'ArrowUp');
    keydown(node, 'Enter');
    assert.equal(typeof second.at(-1), 'string');
    assert.deepEqual(second, ['en-GB']);
    assert.equal(node.querySelector('.win95-combo-value').textContent, 'en-GB', 'the field shows the label, change carries the value');
    node.remove();
});

test('object options carry a separate value and label', () => {
    const node = combo({
        ariaLabel: 'Font family',
        options: [{ value: 'Times New Roman', label: 'Times New Roman' }, { value: 'Arial', label: 'Arial' }],
        value: 'Arial'
    });
    document.body.append(node);
    keydown(node, 'ArrowDown');
    assert.equal(document.querySelector('.win95-combo-value').textContent, 'Arial');
    assert.equal(rows().length, 2);
    keydown(node, 'Escape');
    closeCombos();
    assert.equal(popup(), null);
    node.remove();
});

// ---------- the controls the desktop actually builds ----------

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

test('no native select is left anywhere in the desktop', async () => {
    const offenders = [];
    for (const file of await sourceFiles(path.join(root, 'src')))
        if ((await readFile(file, 'utf8')).includes("el('select'"))
            offenders.push(path.relative(root, file));
    assert.deepEqual(offenders, []);
});

test('styles.css drops the native select rules and styles the drawn control', async () => {
    const css = await readFile(path.join(root, 'src/styles.css'), 'utf8');
    assert.doesNotMatch(css, /(^|[},])\s*select\b[^{}]*\{/, 'no rule may target the native select element');
    for (const rule of ['.win95-combo{', '.win95-combo-arrow{', '.win95-combo-popup{', '.win95-combo-option{', '.win95-combo-list{'])
        assert.ok(css.includes(rule), `${rule} must be styled`);
    const popupRule = css.match(/\.win95-combo-popup\{[^}]*\}/)[0];
    assert.match(popupRule, /pointer-events:auto/, 'the popup lives in the pointer-events:none layer and must opt back in');
});

test('each converted call site uses the drawn control', async () => {
    const sites = {
        'src/packages/apps/control-panel.js': 11,
        'src/packages/apps/utilities.js': 2,
        'src/packages/apps/documents.js': 2,
        'src/packages/ui/dialogs.js': 2,
        'src/main.js': 2
    };
    for (const [file, count] of Object.entries(sites)) {
        const text = await readFile(path.join(root, file), 'utf8');
        assert.equal([...text.matchAll(/\bcombo\(\{/g)].length, count, file);
        assert.match(text, /from '@win95\/ui\/select\.js'|from '\.\.\/ui\/select\.js'|from '\.\/packages\/ui\/select\.js'|from '\.\/select\.js'/, `${file} must import the control`);
    }
});

test('the editable combo keeps typed text and commits list choices through the drawn popup', () => {
    const node = combo({ editable: true, ariaLabel: 'Open', value: 'notepad' });
    document.body.append(node);
    node.setOptions(['notepad', 'calc', 'mspaint']);
    const inputEl = node.querySelector('.win95-combo-input');
    assert.ok(inputEl, 'a real text field sits inside the drawn combo');
    assert.equal(node.value, 'notepad');
    node.value = 'calc';
    assert.equal(inputEl.value, 'calc', 'the field follows the value');
    node.value = 'regedit';
    node.setOptions(['notepad', 'calc']);
    assert.equal(node.value, 'regedit', 'typed text is never snapped onto the suggestion list');

    keydown(inputEl, 'ArrowDown');
    assert.equal(node.getAttribute('aria-expanded'), 'true', 'the arrow key opens the drawn list, not a browser one');
    keydown(inputEl, 'ArrowDown');
    keydown(inputEl, 'Enter');
    assert.equal(node.value, 'notepad', 'Enter commits the highlighted suggestion');
    assert.equal(node.getAttribute('aria-expanded'), 'false');
    node.remove();
});

test('no dialog falls back to the browser datalist suggestions', async () => {
    const offenders = [];
    for (const file of await sourceFiles(path.join(root, 'src')))
        if ((await readFile(file, 'utf8')).includes('datalist'))
            offenders.push(path.relative(root, file));
    assert.deepEqual(offenders, []);
});

test('the file dialog fills its folder list through the control, not with native options', async () => {
    const text = await readFile(path.join(root, 'src/packages/ui/dialogs.js'), 'utf8');
    assert.match(text, /import \{ combo \} from '\.\/select\.js'/, 'dialogs.js must import the control it calls');
    assert.match(text, /dir\.setOptions\(folders, path\)/, 'the render loop repopulates the combo');
    assert.doesNotMatch(text, /dir\.append\(el\('option'/, 'native option elements do nothing here');
});

test('the display properties preview belongs to the page that draws it', async () => {
    const text = await readFile(path.join(root, 'src/packages/apps/control-panel.js'), 'utf8');
    assert.doesNotMatch(text, /let sample;/, 'a shared preview reference is overwritten by the second tab');
    assert.match(text, /monitor\.preview\.style\.backgroundImage/);
});

test('Chinese and Latin text share one apparent size', async () => {
    const css = await readFile(path.join(root, 'src/styles.css'), 'utf8');
    const face = css.match(/@font-face\{[^}]*WenQuanYi Bitmap Song 12px[^}]*\}/)[0];
    assert.match(face, /size-adjust:108%/, 'the bitmap song face is scaled to match the Latin face');
    assert.match(css, /--ui-font:W95FA,Roboto,'WenQuanYi Bitmap Song 12px'/);
    assert.match(css, /body\{font-family:var\(--ui-font\);font-size:12px/);
});

test('scrolling the open list keeps it open', () => {
    /* The list scrolls itself: the wheel, the scrollbar, and scrollIntoView when
       the arrow keys walk past the visible rows. A capture-phase scroll listener
       that closed every combo on any scroll killed all three, so a list long
       enough to scroll could never be browsed. */
    const node = setup({ value: 'en-US' });
    keydown(node, 'ArrowDown');
    const list = popup();
    assert.ok(list, 'the list is open');
    window.dispatchEvent({ type: 'scroll', target: list });
    assert.equal(popup(), list, 'scrolling the list does not close it');
    assert.equal(node.getAttribute('aria-expanded'), 'true');
    node.remove();
    closeCombos();
});

test('a scroll that moves the field closes the list', () => {
    /* The list is placed against the viewport, so when the container around the
       field scrolls the list would be left pointing at the wrong place. */
    const node = setup({ value: 'en-US' });
    keydown(node, 'ArrowDown');
    window.dispatchEvent({ type: 'scroll', target: document });
    assert.equal(popup(), null, 'a page scroll takes the field away from the list');
    node.remove();
});

test('a scroll somewhere else leaves the list alone', () => {
    /* Another window's list scrolling has nothing to do with this field, and the
       list has not moved, so closing it would be surprising. */
    const node = setup({ value: 'en-US' });
    keydown(node, 'ArrowDown');
    const elsewhere = document.createElement('div');
    window.dispatchEvent({ type: 'scroll', target: elsewhere });
    assert.ok(popup(), 'the list stays where it was put');
    node.remove();
    closeCombos();
});

test('pressing the list scrollbar keeps the list open', () => {
    /* Pressing a scrollbar moves focus off the combo, and a blur listener used
       to take that as "the user is done" and shut the list the moment the
       thumb was grabbed. The press belongs to the popup, so it must survive. */
    const node = setup({ value: 'en-US' });
    keydown(node, 'ArrowDown');
    const list = popup();
    node.dispatchEvent({ type: 'blur' });
    assert.equal(popup(), list, 'losing focus to the scrollbar does not close the list');
    window.dispatchEvent({ type: 'pointerdown', target: list });
    assert.equal(popup(), list, 'a press on the popup itself is not a press outside');
    rows().at(-1).dispatchEvent({ type: 'click' });
    assert.equal(node.value, 'pl-PL', 'an entry that was scrolled into view can still be chosen');
    node.remove();
});

test('the list closes when the page itself loses focus', () => {
    const node = setup({ value: 'en-US' });
    keydown(node, 'ArrowDown');
    assert.ok(popup());
    window.dispatchEvent({ type: 'blur' });
    assert.equal(popup(), null);
    node.remove();
});

test('an editable combo keeps its list when the field loses focus to the list', () => {
    const node = setup({ editable: true, value: 'en-US' });
    keydown(node.querySelector('.win95-combo-input'), 'ArrowDown');
    assert.ok(popup());
    node.querySelector('.win95-combo-input').dispatchEvent({ type: 'blur' });
    assert.ok(popup(), 'the scrollbar of the list is not somewhere else to be');
    node.remove();
    closeCombos();
});

test('closing the window takes an open list with it', async () => {
    /* Alt+F4 and the taskbar menu shut a window without a pointer press, so
       nothing else would dismiss a list still floating over a window that no
       longer exists - it would stay behind, over whatever is beneath. */
    for (const id of ['windows', 'tasks'])
        if (!document.querySelector('#' + id))
            document.body.append(Object.assign(document.createElement('div'), { id }));
    const { WindowManager } = await import('../src/packages/shell/window-manager.js');
    const wm = new WindowManager();
    const w = wm.create({ title: 'Regional Settings' });
    const node = combo({ ariaLabel: 'Locale', options: OPTIONS, value: 'en-US' });
    w.body.append(node);
    keydown(node, 'ArrowDown');
    assert.ok(popup(), 'the list is open before the window goes away');
    await wm.close(w);
    assert.equal(popup(), null, 'the list closes with its window');
});

test('scrolling the container around the field closes the list', () => {
    const node = setup({ value: 'en-US' });
    const scroller = document.createElement('div');
    document.body.append(scroller);
    scroller.append(node);
    keydown(node, 'ArrowDown');
    assert.ok(popup());
    window.dispatchEvent({ type: 'scroll', target: scroller });
    assert.equal(popup(), null, 'the field moved, so the list no longer points at it');
    node.remove();
    scroller.remove();
});

test('a long list is capped to the room the viewport leaves', () => {
    /* The list is what scrolls, so it has to end inside the screen: a fixed
       202px box hung off a field near the bottom edge would put its scrollbar
       under the taskbar, where it cannot be grabbed. */
    const many = Array.from({ length: 60 }, (_, i) => 'item-' + i);
    const node = setup({ options: many, value: 'item-0' });
    const viewport = globalThis.innerHeight;
    try {
        globalThis.innerHeight = 200;
        node.getBoundingClientRect = () => ({ top: 90, bottom: 112, left: 40, right: 140, width: 100, height: 22 });
        keydown(node, 'ArrowDown');
        // A 200px screen leaves 88px above the field and 86px below it, so the
        // list is cut to the roomier side and scrolls inside itself.
        assert.equal(popup().style.maxHeight, '88px', 'cut down to the room above the field');
    }
    finally {
        globalThis.innerHeight = viewport;
        node.remove();
        closeCombos();
    }
});
