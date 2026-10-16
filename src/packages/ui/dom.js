let doubleClickDelay = () => 500;
/** Supplies the double-tap window, in milliseconds, used by onDoubleActivate. */
export const setDoubleClickDelay = fn => { doubleClickDelay = fn; };
/**
 * Runs `action` on a double click with a mouse, and on a double tap with touch or a pen.
 * Touch browsers keep the double-tap gesture for zooming, so a native `dblclick` is not
 * guaranteed to arrive; the pointer path drives the action instead and the `fired` window
 * swallows the native duplicate when the browser does emit one.
 */
export function onDoubleActivate(node, action, delay = doubleClickDelay) {
    let last = 0, fired = 0, origin = null;
    const run = event => {
        const now = Date.now();
        if (now - fired < 700)
            return;
        fired = now;
        action(event);
    };
    node.addEventListener('pointerdown', event => { origin = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY }; });
    node.addEventListener('pointercancel', () => { origin = null; });
    node.addEventListener('pointerup', event => {
        const start = origin;
        origin = null;
        if (event.pointerType === 'mouse' || !start)
            return;
        if (Math.abs(event.clientX - start.x) > 10 || Math.abs(event.clientY - start.y) > 10)
            return;
        const now = Date.now();
        if (now - last > delay()) {
            last = now;
            return;
        }
        last = 0;
        run(event);
    });
    node.addEventListener('dblclick', run);
    return node;
}
export function el(tag, attrs = {}, ...children) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class')
            n.className = v;
        else if (k === 'style')
            Object.assign(n.style, v);
        else if (k === 'ondblclick' && typeof v === 'function')
            onDoubleActivate(n, v);
        else if (k.startsWith('on') && typeof v === 'function')
            n.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'text')
            n.textContent = v;
        else if (v !== undefined && v !== null) {
            if (k in n && k !== 'list')
                n[k] = v;
            else
                n.setAttribute(k, String(v));
        }
    }
    for (const c of children.flat(Infinity)) {
        if (c !== null && c !== undefined)
            n.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return n;
}
export const button = (text, action, attrs = {}) => el('button', { text, onclick: action, ...attrs });
/**
 * Builds a two-column label/value grid. Each pair becomes its own row, so the
 * labels stay in the first column and the values in the second. Passing the
 * text nodes directly to the grid container instead would leave them in a
 * single anonymous grid item, which stacks every label and value together.
 */
export const infoGrid = rows => el('div', { class: 'info-grid' }, ...rows.flatMap(([label, value]) => [el('span', { text: String(label) }), el('span', { text: String(value ?? '') })]));
export const separator = () => el('div', { class: 'separator', role: 'separator' });
export const field = (label, input) => el('label', { class: 'field' }, el('span', { text: label }), input);
export function download(name, content, type = 'text/plain') {
    const a = el('a', { download: name, href: (content.startsWith?.('data:') || content.startsWith?.('blob:')) ? content : URL.createObjectURL(new Blob([content], { type })) });
    a.click();
    if (a.href.startsWith('blob:'))
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const fileInput = (accept, callback) => { const i = el('input', { type: 'file', accept, onchange: () => i.files?.[0] && callback(i.files[0]) }); i.click(); };
export const formatSize = n => n < 1024 ? `${n} bytes` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
export const uniqueId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint32Array(4)), v => v.toString(16).padStart(8, '0')).join('');
