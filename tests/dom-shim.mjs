/**
 * Minimal DOM test double: just enough element, event and selector behaviour for
 * the UI controls that run without a browser. It is deliberately small — the
 * real rendering and hit-testing is verified in a browser, this only exists so
 * `npm test` can exercise the control logic (open, move, commit, Escape).
 */

class ClassList {
    constructor(node) { this.node = node; }

    get #list() { return this.node.className.split(/\s+/).filter(Boolean); }

    #write(list) { this.node.className = [...new Set(list)].join(' '); }

    add(...names) { this.#write([...this.#list, ...names]); }

    remove(...names) { this.#write(this.#list.filter(n => !names.includes(n))); }

    contains(name) { return this.#list.includes(name); }

    toggle(name, force) {
        const on = force === undefined ? !this.contains(name) : !!force;
        if (on)
            this.add(name);
        else
            this.remove(name);
        return on;
    }

    toString() { return this.node.className; }
}

export class Node {
    constructor() {
        this.childNodes = [];
        this.listeners = new Map();
    }

    get children() { return this.childNodes.filter(n => n instanceof Element); }

    append(...nodes) {
        for (const node of nodes) {
            node.parentNode = this;
            this.childNodes.push(node);
        }
    }

    replaceChildren(...nodes) {
        for (const child of this.childNodes)
            child.parentNode = null;
        this.childNodes = [...nodes];
        for (const child of this.childNodes)
            child.parentNode = this;
    }

    remove() {
        if (!this.parentNode)
            return;
        this.parentNode.childNodes = this.parentNode.childNodes.filter(n => n !== this);
        this.parentNode = null;
    }

    contains(node) {
        if (node === this)
            return true;
        return this.childNodes.some(child => child.contains?.(node) ?? false);
    }

    addEventListener(type, handler) {
        if (!this.listeners.has(type))
            this.listeners.set(type, []);
        this.listeners.get(type).push(handler);
    }

    dispatchEvent(event) {
        event.target = event.target || this;
        event.preventDefault = event.preventDefault || (() => { event.defaultPrevented = true; });
        event.stopPropagation = event.stopPropagation || (() => { event.propagationStopped = true; });
        const inline = this['on' + event.type];
        if (typeof inline === 'function')
            inline(event);
        for (const handler of this.listeners.get(event.type) ?? [])
            handler(event);
        return true;
    }

    focus() {
        const root = ownerDocument(this);
        if (root.activeElement === this)
            return;
        root.activeElement?.dispatchEvent({ type: 'blur' });
        root.activeElement = this;
        this.dispatchEvent({ type: 'focus' });
    }

    blur() {
        const root = ownerDocument(this);
        if (root.activeElement !== this)
            return;
        root.activeElement = null;
        this.dispatchEvent({ type: 'blur' });
    }
}

const ownerDocument = node => node.ownerDocument ?? node;

export class Element extends Node {
    constructor(tagName) {
        super();
        this.tagName = tagName.toUpperCase();
        this.ownerDocument = null;
        this.attributes = {};
        this.style = {};
        this.dataset = {};
        this.className = '';
        this.classList = new ClassList(this);
        this.tabIndex = 0;
        this.offsetWidth = 0;
        this.offsetHeight = 0;
    }

    set className(value) { this._className = String(value ?? ''); }

    get className() { return this._className ?? ''; }

    set id(value) { this.setAttribute('id', value); }

    get id() { return this.attributes.id ?? ''; }

    set textContent(value) {
        this.replaceChildren();
        if (value !== '' && value !== undefined && value !== null)
            this.append(ownerDocument(this).createTextNode(String(value)));
    }

    get textContent() { return this.childNodes.map(n => n.textContent ?? '').join(''); }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name.startsWith('data-'))
            this.dataset[camel(name.slice(5))] = String(value);
        if (name === 'class')
            this.className = String(value);
        if (name === 'tabindex')
            this.tabIndex = Number(value);
    }

    getAttribute(name) {
        if (name === 'class')
            return this.className;
        return this.attributes[name] ?? null;
    }

    getBoundingClientRect() {
        return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    }

    scrollIntoView() {}

    closest(selector) {
        for (let node = this; node instanceof Element; node = node.parentNode) {
            if (matches(node, selector))
                return node;
        }
        return null;
    }

    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }

    querySelectorAll(selector) {
        const found = [];
        const walk = node => {
            for (const child of node.children) {
                if (matches(child, selector))
                    found.push(child);
                walk(child);
            }
        };
        walk(this);
        return found;
    }
}

export class Text extends Node {
    constructor(text) {
        super();
        this.textContent = String(text);
    }
}

const camel = name => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

const matches = (node, selector) => selector.split(',').some(part => {
    const test = part.trim();
    if (test.startsWith('#'))
        return node.id === test.slice(1);
    if (test.startsWith('.'))
        return node.classList.contains(test.slice(1));
    const dot = test.indexOf('.');
    if (dot > 0)
        return node.tagName === test.slice(0, dot).toUpperCase() && node.classList.contains(test.slice(dot + 1));
    return node.tagName === test.toUpperCase();
});

/** Installs globals and returns the document root. */
export function installDom() {
    const document = {
        activeElement: null,
        listeners: new Map(),
        createElement: tag => {
            const node = new Element(tag);
            node.ownerDocument = document;
            return node;
        },
        createTextNode: text => {
            const node = new Text(text);
            node.ownerDocument = document;
            return node;
        },
        addEventListener: (type, handler) => {
            if (!document.listeners.has(type))
                document.listeners.set(type, []);
            document.listeners.get(type).push(handler);
        },
        querySelector: selector => document.body.querySelector(selector),
        querySelectorAll: selector => document.body.querySelectorAll(selector)
    };
    document.body = document.createElement('body');
    const menus = document.createElement('div');
    menus.setAttribute('id', 'menus');
    document.body.append(menus);
    const window = {
        listeners: new Map(),
        devices: {},
        addEventListener: (type, handler) => {
            if (!window.listeners.has(type))
                window.listeners.set(type, []);
            window.listeners.get(type).push(handler);
        },
        dispatchEvent: event => {
            event.target = event.target ?? window;
            for (const handler of window.listeners.get(event.type) ?? [])
                handler(event);
        }
    };
    globalThis.window = window;
    globalThis.document = document;
    globalThis.Node = Node;
    globalThis.Element = Element;
    globalThis.innerWidth = 1024;
    globalThis.innerHeight = 768;
    return { document, window, menus };
}

/** Dispatches a bubbling-ish pointer event the way a click on the desktop does. */
export const pointerdown = (target, node) => target.dispatchEvent({ type: 'pointerdown', target: node ?? target });

export const keydown = (target, key) => target.dispatchEvent({ type: 'keydown', key, preventDefault() { this.defaultPrevented = true; } });
