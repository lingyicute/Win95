import { htmlToRtf, rtfToHtml } from '@win95/core/rtf.js';
import { el, button, download, fileInput } from '@win95/ui/dom.js';
import { menuBar } from '@win95/ui/menu.js';
import { combo } from '@win95/ui/select.js';
import { baseName, parentPath } from '@win95/core/filesystem.js';
const printDocument = (content, html = false) => {
    document.querySelector('.print-area')?.remove();
    const area = el('div', { class: 'print-area' });
    if (html)
        area.innerHTML = sanitizeRichHTML(content);
    else
        area.textContent = content;
    document.body.append(area);
    window.print();
};
function sanitizeRichHTML(html) {
    const d = new DOMParser().parseFromString(html, 'text/html');
    const allowed = new Set(['P', 'DIV', 'SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'BR', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'FONT', 'SUB', 'SUP']);
    for (const n of [...d.body.querySelectorAll('*')]) {
        if (!allowed.has(n.tagName)) {
            n.replaceWith(d.createTextNode(n.textContent || ''));
            continue;
        }
        for (const a of [...n.attributes])
            if (!['style', 'face', 'size', 'color'].includes(a.name))
                n.removeAttribute(a.name);
        if (n.hasAttribute('style')) {
            const css = n.style;
            const safe = {};
            for (const key of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecoration', 'textAlign', 'color', 'backgroundColor', 'marginLeft', 'whiteSpace', 'tabSize'])
                if (css[key])
                    safe[key] = css[key];
            n.removeAttribute('style');
            Object.assign(n.style, safe);
        }
    }
    return d.body.innerHTML;
}
export function notepad(s, args = {}) {
    const initialText = args.path ? s.fs.read(args.path) : (args.text || '');
    let path = args.path || null, dirty = false, generation = 0, wrap = s.settings.get('notepadWrap', false), findText = '', undo = [];
    const w = s.wm.create({ title: 'Untitled - Notepad', icon: 'notepad', width: 555, height: 370, x: args.x, y: args.y });
    const editor = el('textarea', { class: 'notepad-editor' + (wrap ? ' wrap' : ''), spellcheck: false, 'aria-label': 'Notepad document', value: initialText });
    w.body.append(editor);
    const title = () => w.setTitle(`${path ? baseName(path) : 'Untitled'} - Notepad`);
    const save = async (as = false) => {
        try {
            let next = path;
            if (as || !next)
                next = await s.ui.file({ save: true, name: path ? baseName(path) : 'Untitled.txt', directory: path ? parentPath(path) : 'C:\\My Documents', extension: '.txt', type: 'Text Documents (*.txt)', owner: w });
            if (!next)
                return false;
            const savedGeneration = generation;
            const savedText = editor.value;
            s.fs.write(next, savedText, 'text/plain');
            await s.fs.flush();
            if (generation !== savedGeneration || w.closed)
                return false;
            path = next;
            dirty = editor.value !== savedText;
            title();
            s.recent(path);
            return !dirty;
        }
        catch (e) {
            s.ui.error(e, w);
            return false;
        }
    };
    const confirm = async () => {
        if (!dirty)
            return true;
        const r = await s.ui.message(`The text in the ${path ? baseName(path) : 'Untitled'} file has changed.\nDo you want to save the changes?`, 'Notepad', ['Yes', 'No', 'Cancel'], { owner: w, height: 190 });
        return r === 'Yes' ? save() : r === 'No';
    };
    const load = async (p) => {
        if (!(await confirm()))
            return;
        if (!p)
            p = await s.ui.file({ owner: w, type: 'Text Documents (*.txt)' });
        if (p) {
            try {
                const content = s.fs.read(p);
                generation++;
                editor.value = content;
                path = p;
                dirty = false;
                undo = [];
                title();
                s.recent(path);
            }
            catch (e) {
                s.ui.error(e, w);
            }
        }
    };
    const fresh = async () => {
        if (await confirm()) {
            generation++;
            editor.value = '';
            path = null;
            dirty = false;
            undo = [];
            title();
        }
    };
    const insert = text => { undo.push(editor.value); editor.setRangeText(text, editor.selectionStart, editor.selectionEnd, 'end'); dirty = true; editor.focus(); };
    const cut = () => {
        const t = editor.value.slice(editor.selectionStart, editor.selectionEnd);
        if (t) {
            s.copyText(t);
            insert('');
        }
    };
    const copy = () => s.copyText(editor.value.slice(editor.selectionStart, editor.selectionEnd));
    const paste = async () => {
        const text = await s.pasteText();
        if (text !== null)
            insert(text);
    };
    const find = async (next = false) => {
        if (!next || !findText) {
            const val = await s.ui.prompt('Find what:', findText, 'Find', { owner: w });
            if (val === null || !val)
                return;
            findText = val;
        }
        const start = editor.selectionEnd;
        let index = editor.value.toLowerCase().indexOf(findText.toLowerCase(), start);
        if (index < 0)
            index = editor.value.toLowerCase().indexOf(findText.toLowerCase());
        if (index < 0) {
            s.ui.message(`Cannot find "${findText}"`, 'Notepad', ['OK'], { owner: w });
            return;
        }
        editor.focus();
        editor.setSelectionRange(index, index + findText.length);
        const line = editor.value.slice(0, index).split('\n').length;
        editor.scrollTop = Math.max(0, (line - 4) * 18);
    };
    const undoAction = () => {
        const last = undo.pop();
        if (last !== undefined) {
            editor.value = last;
            dirty = true;
        }
    };
    editor.addEventListener('beforeinput', () => {
        undo.push(editor.value);
        if (undo.length > 100)
            undo.shift();
    });
    editor.oninput = () => { dirty = true; };
    w.setMenu(menuBar([{ label: 'File', items: [{ label: 'New', shortcut: 'Ctrl+N', action: fresh }, { label: 'Open…', shortcut: 'Ctrl+O', action: () => load() }, { label: 'Save', shortcut: 'Ctrl+S', action: () => save() }, { label: 'Save As…', action: () => save(true) }, null, { label: 'Page Setup…', action: () => s.ui.message('Paper: A4\nMargins: 20 mm\n\nChoose a printer and adjust paper options in the print dialog.', 'Page Setup', ['OK'], { owner: w }) }, { label: 'Print…', shortcut: 'Ctrl+P', action: () => printDocument(editor.value) }, null, { label: 'Import from computer…', action: () => fileInput('.txt,.ini,.log,.md', async (f) => {
                        if (await confirm()) {
                            const content = await f.text();
                            generation++;
                            editor.value = content;
                            path = null;
                            dirty = true;
                            title();
                        }
                    }) }, { label: 'Export…', action: () => download(path ? baseName(path) : 'Untitled.txt', editor.value) }, null, { label: 'Exit', action: () => w.close() }] }, { label: 'Edit', items: () => [{ label: 'Undo', shortcut: 'Ctrl+Z', disabled: !undo.length, action: undoAction }, null, { label: 'Cut', shortcut: 'Ctrl+X', action: cut }, { label: 'Copy', shortcut: 'Ctrl+C', action: copy }, { label: 'Paste', shortcut: 'Ctrl+V', action: paste }, { label: 'Delete', shortcut: 'Del', action: () => insert('') }, null, { label: 'Select All', shortcut: 'Ctrl+A', action: () => { editor.focus(); editor.select(); } }, { label: 'Time/Date', shortcut: 'F5', action: () => insert(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString()) }, null, { label: 'Word Wrap', checked: wrap, action: () => { wrap = !wrap; editor.classList.toggle('wrap', wrap); s.settings.set('notepadWrap', wrap); } }] }, { label: 'Search', items: [{ label: 'Find…', action: () => find() }, { label: 'Find Next', shortcut: 'F3', action: () => find(true) }] }, { label: 'Help', items: [{ label: 'Help Topics', action: () => s.launch('help', { topic: 'notepad' }) }, { label: 'About Notepad', action: () => s.about('Notepad', 'notepad') }] }]));
    editor.onkeydown = e => {
        if (e.key === 'Tab') {
            e.preventDefault();
            insert('\t');
        }
    };
    w.element.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && ['s', 'o', 'n', 'p', 'f'].includes(k)) {
            e.preventDefault();
            ({ s: () => save(e.shiftKey), o: () => load(), n: fresh, p: () => printDocument(editor.value), f: () => find() })[k]();
        }
        if (e.key === 'F3') {
            e.preventDefault();
            find(true);
        }
        if (e.key === 'F5') {
            e.preventDefault();
            insert(new Date().toLocaleString());
        }
    });
    w.onClose = confirm;
    title();
    queueMicrotask(() => editor.focus());
    return w;
}
export function wordpad(s, args = {}) {
    const decode = value => value.trimStart().startsWith('{\\rtf') ? rtfToHtml(value) : sanitizeRichHTML(value);
    const initialHTML = args.path ? decode(s.fs.read(args.path)) : args.text ? '<p>' + String(args.text).replaceAll('&', '&amp;').replaceAll('<', '&lt;') + '</p>' : '<p><br></p>';
    let path = args.path || null, dirty = false, generation = 0, lastRange = null;
    const w = s.wm.create({ title: 'Document - WordPad', icon: 'wordpad', width: 665, height: 440, x: args.x, y: args.y });
    const toolbar = el('div', { class: 'wordpad-toolbar' }), format = el('div', { class: 'wordpad-toolbar' });
    const editor = el('div', { class: 'wordpad-page', contentEditable: 'true', role: 'textbox', 'aria-label': 'WordPad document', 'aria-multiline': 'true', spellcheck: false });
    editor.innerHTML = initialHTML;
    const title = () => w.setTitle(`${path ? baseName(path) : 'Document'} - WordPad`);
    const cmd = (name, value) => {
        editor.focus();
        if (lastRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(lastRange);
        }
        document.execCommand(name, false, value);
        dirty = true;
        remember();
    };
    const remember = () => {
        const selection = window.getSelection();
        if (selection?.rangeCount && editor.contains(selection.anchorNode))
            lastRange = selection.getRangeAt(0).cloneRange();
    };
    editor.addEventListener('keyup', remember);
    editor.addEventListener('mouseup', remember);
    editor.oninput = () => { dirty = true; remember(); };
    const save = async (as = false) => {
        try {
            let next = path;
            if (as || !next)
                next = await s.ui.file({ save: true, name: path ? baseName(path) : 'Document.rtf', extension: '.rtf', owner: w, type: 'Rich Text Format (*.rtf)' });
            if (!next)
                return false;
            const savedGeneration = generation;
            const savedHTML = sanitizeRichHTML(editor.innerHTML);
            s.fs.write(next, htmlToRtf(savedHTML), 'application/rtf');
            await s.fs.flush();
            if (generation !== savedGeneration || w.closed)
                return false;
            path = next;
            dirty = sanitizeRichHTML(editor.innerHTML) !== savedHTML;
            title();
            s.recent(path);
            return !dirty;
        }
        catch (e) {
            s.ui.error(e, w);
            return false;
        }
    };
    const confirm = async () => {
        if (!dirty)
            return true;
        const r = await s.ui.message('Save changes to ' + (path ? baseName(path) : 'Document') + '?', 'WordPad', ['Yes', 'No', 'Cancel'], { owner: w });
        return r === 'Yes' ? save() : r === 'No';
    };
    const fresh = async () => {
        if (await confirm()) {
            generation++;
            lastRange = null;
            editor.innerHTML = '<p><br></p>';
            path = null;
            dirty = false;
            title();
        }
    };
    const open = async () => {
        if (!await confirm())
            return;
        const p = await s.ui.file({ owner: w, type: 'Rich Text Documents (*.rtf)' });
        if (p) {
            try {
                const content = decode(s.fs.read(p));
                generation++;
                editor.innerHTML = content;
                path = p;
                dirty = false;
                lastRange = null;
                title();
                s.recent(path);
            }
            catch (error) {
                s.ui.error(error, w);
            }
        }
    };
    const copy = () => { remember(); s.copyText(window.getSelection()?.toString() || ''); };
    const paste = async () => {
        const text = await s.pasteText();
        if (text !== null)
            cmd('insertText', text);
    };
    toolbar.append(button('New', fresh), button('Open', open), button('Save', () => save()), el('div', { class: 'toolbar-divider' }), button('Print', () => printDocument(editor.innerHTML, true)), el('div', { class: 'toolbar-divider' }), button('Cut', () => { copy(); cmd('delete'); }), button('Copy', copy), button('Paste', paste), button('Undo', () => cmd('undo')));
    const fonts = combo({ ariaLabel: 'Font family', options: ['Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia'], value: 'Times New Roman', onchange: value => cmd('fontName', value) });
    const sizes = combo({ class: 'font-size', ariaLabel: 'Font size', options: [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72].map(String), value: '12', onchange: value => { cmd('fontSize', '7'); editor.querySelectorAll('font[size="7"]').forEach(n => { n.removeAttribute('size'); n.style.fontSize = value + 'pt'; }); } });
    format.append(fonts, sizes, button('B', () => cmd('bold'), { title: 'Bold', style: { fontWeight: 'bold' } }), button('I', () => cmd('italic'), { title: 'Italic', style: { fontStyle: 'italic' } }), button('U', () => cmd('underline'), { title: 'Underline', style: { textDecoration: 'underline' } }), el('div', { class: 'toolbar-divider' }), button('≡', () => cmd('justifyLeft'), { title: 'Align left' }), button('≡', () => cmd('justifyCenter'), { title: 'Center', style: { textAlign: 'center' } }), button('≡', () => cmd('justifyRight'), { title: 'Align right', style: { textAlign: 'right' } }), button('•', () => cmd('insertUnorderedList'), { title: 'Bullet list' }), el('input', { type: 'color', value: '#000000', 'aria-label': 'Text color', oninput: e => cmd('foreColor', e.target.value) }));
    format.onpointerdown = e => {
        if (e.target.tagName === 'BUTTON')
            e.preventDefault();
    };
    toolbar.onpointerdown = e => {
        if (e.target.tagName === 'BUTTON')
            e.preventDefault();
    };
    w.body.append(toolbar, format, el('div', { class: 'ruler' }, ...Array.from({ length: 7 }, (_, i) => el('span', { text: String(i + 1) }))), editor);
    w.status('For Help, press F1');
    const textNodes = () => {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode())
            if (walker.currentNode.nodeValue)
                nodes.push(walker.currentNode);
        return nodes;
    };
    /* Search and select inside the editor only: a page-wide search matches
       the whole document and would select its first hit in other windows. */
    const selectRange = (nodes, from, to) => {
        let pos = 0, start = null, end = null;
        for (const n of nodes) {
            const len = n.nodeValue.length;
            if (!start && from < pos + len)
                start = { node: n, offset: from - pos };
            if (to <= pos + len) {
                end = { node: n, offset: to - pos };
                break;
            }
            pos += len;
        }
        if (!start || !end)
            return false;
        const range = document.createRange();
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        const sel = window.getSelection();
        if (!sel)
            return false;
        sel.removeAllRanges();
        sel.addRange(range);
        start.node.parentElement?.scrollIntoView?.({ block: 'nearest' });
        return true;
    };
    const find = async () => {
        const str = await s.ui.prompt('Find what:', '', 'Find', { owner: w });
        if (str) {
            editor.focus();
            const nodes = textNodes();
            const text = nodes.map(n => n.nodeValue).join('');
            const at = text.toLowerCase().indexOf(str.toLowerCase());
            if (at < 0 || !selectRange(nodes, at, at + str.length))
                s.ui.message('WordPad has finished searching the document.', 'WordPad', ['OK'], { owner: w });
        }
    };
    w.setMenu(menuBar([{ label: 'File', items: [{ label: 'New', shortcut: 'Ctrl+N', action: fresh }, { label: 'Open…', shortcut: 'Ctrl+O', action: open }, { label: 'Save', shortcut: 'Ctrl+S', action: () => save() }, { label: 'Save As…', action: () => save(true) }, null, { label: 'Print…', shortcut: 'Ctrl+P', action: () => printDocument(editor.innerHTML, true) }, { label: 'Export as RTF…', action: () => download((path ? baseName(path) : 'Document').replace(/\.[^.]+$/, '') + '.rtf', htmlToRtf(sanitizeRichHTML(editor.innerHTML)), 'application/rtf') }, { label: 'Export as HTML…', action: () => download((path ? baseName(path) : 'Document').replace(/\.[^.]+$/, '') + '.html', '<!doctype html><meta charset="utf-8">' + sanitizeRichHTML(editor.innerHTML), 'text/html') }, null, { label: 'Exit', action: () => w.close() }] }, { label: 'Edit', items: [{ label: 'Undo', shortcut: 'Ctrl+Z', action: () => cmd('undo') }, { label: 'Redo', shortcut: 'Ctrl+Y', action: () => cmd('redo') }, null, { label: 'Cut', shortcut: 'Ctrl+X', action: () => { copy(); cmd('delete'); } }, { label: 'Copy', shortcut: 'Ctrl+C', action: copy }, { label: 'Paste', shortcut: 'Ctrl+V', action: paste }, { label: 'Select All', shortcut: 'Ctrl+A', action: () => cmd('selectAll') }, null, { label: 'Find…', shortcut: 'Ctrl+F', action: find }, { label: 'Replace…', action: async () => {
                        const a = await s.ui.prompt('Find what:', '', 'Replace', { owner: w });
                        if (!a)
                            return;
                        const b = await s.ui.prompt('Replace with:', '', 'Replace', { owner: w });
                        if (b !== null) {
                            const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
                            let n;
                            while (n = walker.nextNode())
                                n.nodeValue = n.nodeValue.split(a).join(b);
                            dirty = true;
                        }
                    } }] }, { label: 'View', items: () => [{ label: 'Toolbar', checked: !toolbar.hidden, action: () => toolbar.hidden = !toolbar.hidden }, { label: 'Format Bar', checked: !format.hidden, action: () => format.hidden = !format.hidden }] }, { label: 'Insert', items: [{ label: 'Date and Time…', action: () => cmd('insertText', new Date().toLocaleString()) }, { label: 'Picture…', action: () => s.ui.message('Use Paint to work with pictures. Rich documents currently contain formatted text.', 'WordPad', ['OK'], { owner: w }) }] }, { label: 'Format', items: [{ label: 'Font…', action: () => fonts.focus() }, { label: 'Bold', shortcut: 'Ctrl+B', action: () => cmd('bold') }, { label: 'Italic', shortcut: 'Ctrl+I', action: () => cmd('italic') }, { label: 'Underline', shortcut: 'Ctrl+U', action: () => cmd('underline') }, null, { label: 'Bullet Style', action: () => cmd('insertUnorderedList') }, { label: 'Paragraph', items: [{ label: 'Left', action: () => cmd('justifyLeft') }, { label: 'Center', action: () => cmd('justifyCenter') }, { label: 'Right', action: () => cmd('justifyRight') }, { label: 'Indent', action: () => cmd('indent') }, { label: 'Outdent', action: () => cmd('outdent') }] }] }, { label: 'Help', items: [{ label: 'Help Topics', action: () => s.launch('help', { topic: 'wordpad' }) }, { label: 'About WordPad', action: () => s.about('WordPad', 'wordpad') }] }]));
    editor.addEventListener('paste', e => { e.preventDefault(); const text = e.clipboardData.getData('text/plain'); cmd('insertText', text); });
    w.element.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && ['s', 'o', 'n', 'p', 'f'].includes(e.key.toLowerCase())) {
            e.preventDefault();
            ({ s: () => save(e.shiftKey), o: open, n: fresh, p: () => printDocument(editor.innerHTML, true), f: find })[e.key.toLowerCase()]();
        }
    });
    w.onClose = confirm;
    title();
    return w;
}
export function calculator(s) {
    const w = s.wm.create({ title: 'Calculator', icon: 'calculator', width: 294, height: 287, resizable: false });
    w.body.classList.add('calculator-body');
    let value = '0', acc = null, op = null, newEntry = true, memory = 0, lastOp = null, lastArg = null, scientific = false, degrees = true;
    const display = el('input', { class: 'calculator-display', value: '0', readOnly: true, 'aria-label': 'Calculator display' }), mem = el('span', { class: 'memory-indicator' });
    const format = n => !Number.isFinite(n) ? 'Error' : String(Number(n.toPrecision(13)));
    const update = () => { display.value = value; mem.textContent = memory ? 'M' : ''; };
    const calculate = (a, b, o) => o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : o === '÷' ? a / b : b;
    const apply = key => {
        if (value === 'Error')
            value = '0';
        if (/^\d$/.test(key)) {
            value = newEntry ? key : value === '0' ? key : value.length < 17 ? value + key : value;
            newEntry = false;
        }
        else if (key === '.') {
            if (newEntry) {
                value = '0.';
                newEntry = false;
            }
            else if (!value.includes('.'))
                value += '.';
        }
        else if (key === 'C') {
            value = '0';
            acc = null;
            op = null;
            newEntry = true;
            lastOp = null;
            lastArg = null;
        }
        else if (key === 'CE') {
            value = '0';
            newEntry = true;
        }
        else if (key === 'Back') {
            value = value.length > 1 ? value.slice(0, -1) : '0';
        }
        else if (['+', '−', '×', '÷'].includes(key)) {
            if (op && !newEntry)
                value = format(calculate(acc, Number(value), op));
            acc = Number(value);
            op = key;
            newEntry = true;
        }
        else if (key === '=') {
            if (op) {
                lastOp = op;
                lastArg = Number(value);
                value = format(calculate(acc, lastArg, op));
                op = null;
            }
            else if (lastOp)
                value = format(calculate(Number(value), lastArg, lastOp));
            newEntry = true;
        }
        else if (key === '±')
            value = format(-Number(value));
        else if (key === '√') {
            value = format(Math.sqrt(Number(value)));
            newEntry = true;
        }
        else if (key === '1/x') {
            value = format(1 / Number(value));
            newEntry = true;
        }
        else if (key === '%') {
            value = format(op === '+' || op === '−' ? acc * Number(value) / 100 : Number(value) / 100);
            newEntry = true;
        }
        else if (key === 'MC')
            memory = 0;
        else if (key === 'MR') {
            value = format(memory);
            newEntry = true;
        }
        else if (key === 'MS') {
            memory = Number(value);
            newEntry = true;
        }
        else if (key === 'M+')
            memory += Number(value);
        else {
            let n = Number(value), fn = { sin: () => Math.sin(n * (degrees ? Math.PI / 180 : 1)), cos: () => Math.cos(n * (degrees ? Math.PI / 180 : 1)), tan: () => Math.tan(n * (degrees ? Math.PI / 180 : 1)), log: () => Math.log10(n), ln: () => Math.log(n), 'x²': () => n * n, 'x³': () => n * n * n, '10ˣ': () => 10 ** n, 'n!': () => {
                    if (n < 0 || n > 170 || n % 1)
                        return NaN;
                    let r = 1;
                    for (let i = 2; i <= n; i++)
                        r *= i;
                    return r;
                }, 'π': () => Math.PI };
            if (fn[key]) {
                value = format(fn[key]());
                newEntry = true;
            }
        }
        update();
    };
    const actions = el('div', { class: 'calculator-memory' }, mem, button('Backspace', () => apply('Back'), { style: { color: '#800000' } }), button('CE', () => apply('CE'), { style: { color: '#f00' } }), button('C', () => apply('C'), { style: { color: '#f00' } }));
    const scientificKeys = el('div', { class: 'calculator-scientific', hidden: true }, ...['sin', 'cos', 'tan', 'log', 'ln', 'x²', 'x³', '10ˣ', 'n!', 'π'].map(k => button(k, () => apply(k))));
    const keys = el('div', { class: 'calculator-keys', style: { gridTemplateColumns: 'repeat(5,1fr)' } });
    const layout = ['MC', '7', '8', '9', '÷', 'MR', '4', '5', '6', '×', 'MS', '1', '2', '3', '−', 'M+', '0', '±', '.', '+', '√', '1/x', '%', '='];
    for (const k of layout)
        keys.append(button(k, () => apply(k), { class: (['+', '−', '×', '÷', '='].includes(k) ? 'operator ' : '') + (k.startsWith('M') ? 'memory ' : '') + (k === '=' ? 'wide' : '') }));
    w.body.append(display, actions, scientificKeys, keys);
    const setMode = mode => { scientific = mode; scientificKeys.hidden = !mode; w.rect.height = mode ? 365 : 287; w.rect.width = mode ? 354 : 294; s.wm.layout(w); };
    w.setMenu(menuBar([{ label: 'Edit', items: [{ label: 'Copy', shortcut: 'Ctrl+C', action: () => s.copyText(value) }, { label: 'Paste', shortcut: 'Ctrl+V', action: async () => {
                        const v = await s.pasteText();
                        if (v !== null && Number.isFinite(Number(v))) {
                            value = format(Number(v));
                            newEntry = true;
                            update();
                        }
                    } }] }, { label: 'View', items: () => [{ label: 'Standard', checked: !scientific, action: () => setMode(false) }, { label: 'Scientific', checked: scientific, action: () => setMode(true) }, null, { label: 'Degrees', checked: degrees, action: () => degrees = true }, { label: 'Radians', checked: !degrees, action: () => degrees = false }] }, { label: 'Help', items: [{ label: 'Help Topics', action: () => s.launch('help', { topic: 'calculator' }) }, { label: 'About Calculator', action: () => s.about('Calculator', 'calculator') }] }]));
    w.element.addEventListener('keydown', e => {
        const k = ({ 'Enter': '=', 'Escape': 'C', 'Backspace': 'Back', 'Delete': 'CE', '*': '×', '/': '÷', '-': '−' })[e.key] || e.key;
        if (/^[0-9.+−×÷=%]$/.test(k) || ['C', 'CE', 'Back'].includes(k)) {
            e.preventDefault();
            apply(k);
        }
    });
    update();
    queueMicrotask(() => w.element.focus());
    return w;
}
