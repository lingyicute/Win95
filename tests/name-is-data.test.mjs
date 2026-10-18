import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom, Element, Node, Text } from './dom-shim.mjs';

/**
 * A file, folder or drive name is data, not a UI string. The dictionary holds chrome
 * ('Desktop': '桌面' for the shell's own labels), and a bare name rendered as text is
 * indistinguishable from chrome to the walker - so the render sites mark names instead,
 * and these tests run the real walker over the real nodes to prove the marks work.
 */
installDom();
globalThis.devicePixelRatio = 1;
Object.defineProperty(globalThis, 'navigator', { value: { language: 'zh-CN', languages: ['zh-CN'] }, configurable: true });
document.documentElement = document.createElement('html');
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };

/* installI18n needs the four DOM details the shared shim stops short of, and nothing else
   inherits them: node type tags, a text node's value, attribute selectors in closest(),
   and an observer constructor it can call but which never has to fire. */
Node.ELEMENT_NODE = 1;
Node.TEXT_NODE = 3;
Object.defineProperty(Element.prototype, 'nodeType', { get: () => Node.ELEMENT_NODE, configurable: true });
Object.defineProperty(Text.prototype, 'nodeType', { get: () => Node.TEXT_NODE, configurable: true });
Object.defineProperty(Text.prototype, 'nodeValue', {
    get() { return this.textContent; },
    set(value) { this.textContent = String(value); },
    configurable: true
});
/* The shim can set an attribute but not read one back, which would make the
   attribute half of the walker (aria-label, title, placeholder) test nothing. */
for (const [name, fn] of [
    ['getAttribute', function (n) { return this.attributes?.[n]; }],
    ['hasAttribute', function (n) { return this.attributes?.[n] !== undefined; }],
    ['removeAttribute', function (n) { if (this.attributes) delete this.attributes[n]; }]
])
    if (!(name in Element.prototype))
        Element.prototype[name] = fn;

/* A browser turns a string child into a text node; the shim only takes nodes, and the
   window manager hands the taskbar caption a plain string for chrome titles. */
const toNode = value => value instanceof Node ? value : new Text(value);
for (const name of ['append', 'replaceChildren']) {
    const original = Node.prototype[name];
    Node.prototype[name] = function (...nodes) { return original.apply(this, nodes.map(toNode)); };
}

/* skipped() asks a text node for its parentElement, which the shim does not model. */
if (!('parentElement' in Node.prototype))
    Object.defineProperty(Node.prototype, 'parentElement', {
        get() { return this.parentNode instanceof Element ? this.parentNode : null; },
        configurable: true
    });

const elementMatches = (node, part) => {
    const attr = /^\[([\w-]+)(?:=("?)([^"\]]*)\2)?\]$/.exec(part);
    if (!attr)
        return false;
    const held = node.attributes?.[attr[1]];
    return held !== undefined && (attr[3] === '' || attr[3] === undefined || held === attr[3]);
};
Element.prototype.closest = function (selector) {
    const parts = selector.split(',').map(part => part.trim());
    for (let node = this; node; node = node.parentNode)
        if (parts.some(part => elementMatches(node, part) || (part.startsWith('.') ? node.classList.contains(part.slice(1)) : part.startsWith('#') ? node.id === part.slice(1) : /^[a-z]/i.test(part) && node.tagName === part.toUpperCase())))
            return node;
    return null;
};
globalThis.MutationObserver = class { observe() { } disconnect() { } takeRecords() { return []; } };

register('./win95-resolver.mjs', import.meta.url);
const { el, dataText } = await import('../src/packages/ui/dom.js');
const { installI18n, translateText } = await import('../src/packages/core/i18n.js');

class Settings extends EventTarget {
    constructor(values = {}) { super(); this.values = { ...values }; }
    get(key, fallback) { return this.values[key] ?? fallback; }
    set(key, value) { this.values[key] = value; }
}

test('the walker leaves marked names alone and still translates the chrome beside them', () => {
    const marked = el('button', { class: 'file-item', 'aria-label': 'Desktop', 'data-i18n-skip-attrs': 'aria-label' },
        dataText('Desktop', { class: 'file-name' }), el('span', { text: 'My Computer' }));
    const unmarked = el('button', { class: 'file-item', 'aria-label': 'Desktop' }, el('span', { text: 'Desktop' }));
    document.body.append(marked, unmarked);
    assert.equal(installI18n(), true, 'the translator installs for a Chinese desktop');
    assert.equal(marked.children[0].textContent, 'Desktop', 'the name cell is untouched');
    assert.equal(marked.getAttribute('aria-label'), 'Desktop', 'the accessible name matches the visible one');
    assert.equal(marked.children[1].textContent, '我的电脑', 'a UI string in the same row still translates');
    assert.equal(unmarked.children[0].textContent, '桌面', 'without the mark the old behaviour is unchanged');
    assert.equal(unmarked.getAttribute('aria-label'), '桌面', 'including its aria-label');
});

test('messages that quote a path or a file name keep the name intact', () => {
    for (const [source, want] of [
        ['Exploring - System', '正在浏览 - System'],
        ['Exploring - My Documents', '正在浏览 - My Documents'],
        ['Exploring - C:\\Windows\\Desktop', '正在浏览 - C:\\Windows\\Desktop'],
        ['Read Me.txt - Sound Recorder', 'Read Me.txt - 录音机']
    ])
        assert.equal(translateText(source, 'zh'), want, source);
    // The chrome side of the same shapes still goes through the dictionary.
    for (const [source, want] of [
        ['Display Properties', '显示属性'],
        ['Mouse Properties', '鼠标 属性'],
        ['About Paint', '关于画图'],
        ['Draw with the Airbrush tool.', '使用喷枪工具绘图。']
    ])
        assert.equal(translateText(source, 'zh'), want, source);
});

test('a window title that quotes a folder name is marked raw', async () => {
    const { WindowManager } = await import('../src/packages/shell/window-manager.js');
    document.body.append(el('div', { id: 'windows' }), el('div', { id: 'tasks' }));
    const wm = new WindowManager();
    const w = wm.create({ title: 'My Computer' });
    w.setTitle('System', { raw: true });
    assert.equal(w.element.getAttribute('data-i18n-skip-attrs'), 'aria-label', 'the frame aria-label is exempt');
    assert.equal(w.title, 'System', 'the title itself is exactly the name');
    const caption = w.element.querySelector('.title-text');
    assert.equal(caption?.getAttribute('data-i18n-skip'), '', 'the title bar caption is exempt');
    w.setTitle('My Computer');
    assert.equal(w.element.hasAttribute('data-i18n-skip-attrs'), false, 'a chrome title takes the mark back off');
    assert.equal(caption?.hasAttribute('data-i18n-skip'), false, 'the caption too');
});

const renderExplorer = async (path, tree) => {
    const { VirtualFileSystem } = await import('../src/packages/core/filesystem.js');
    const fs = await new VirtualFileSystem().init();
    const win = {
        title: '', titleRaw: false, body: document.createElement('div'), element: document.createElement('div'),
        closed: false, onClosed: [], setMenu() { }, status() { }, close() { },
        setTitle(value, options = {}) { this.title = value; this.titleRaw = !!options.raw; }
    };
    const s = {
        fs, settings: new Settings(), wm: { create: () => win },
        ui: { message: async () => 'OK', confirm: async () => true, prompt: async () => null, error: async () => { }, file: async () => null },
        files: { copy() { }, paste() { }, remove() { }, rename() { }, newFolder() { }, newText() { } },
        launch() { }, open() { }, about() { }, clipboard: {}
    };
    const { explorer } = await import('../src/packages/apps/explorer.js');
    explorer(s, { path, tree, view: 'details' });
    return win;
};

test("explorer rows carry names as data, and the shell own entries do not", async () => {
    const windows = await renderExplorer('C:\\Windows', true);
    const names = windows.body.querySelectorAll('.file-name');
    const desktop = names.find(n => n.textContent === 'Desktop');
    assert.ok(desktop, 'the volume really does hold C:\\Windows\\Desktop');
    assert.equal(desktop.getAttribute('data-i18n-skip'), '', 'the row name is a content node');
    assert.equal(desktop.closest('.file-item').getAttribute('data-i18n-skip-attrs'), 'aria-label', 'its accessible name is exempt too');
    const treeItem = windows.body.querySelectorAll('.tree-item').find(n => n.textContent.includes('My Documents'));
    assert.ok(treeItem, 'a folder from the volume shows in the tree');
    assert.equal(treeItem.querySelector('span')?.getAttribute('data-i18n-skip'), '', 'the tree label is a content node');
    assert.match(windows.title, /^Exploring - /, 'the title quotes the folder');
    assert.equal(windows.titleRaw, false, 'a mixed title keeps translating: the pattern leaves the name out');

    const computer = await renderExplorer('network', true);
    const myComputer = computer.body.querySelectorAll('.file-name').find(n => n.textContent === 'My Computer');
    assert.ok(myComputer, 'My Computer is listed as a shell entry');
    assert.equal(myComputer.hasAttribute('data-i18n-skip'), false, 'shell entries are chrome, not names');
    assert.equal(computer.title, 'Network Neighborhood', 'the shell view has a UI-string title');
    assert.equal(computer.titleRaw, false);
});
