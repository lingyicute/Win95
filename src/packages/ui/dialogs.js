import { el, button, field, onDoubleActivate } from './dom.js';
import { icon } from './icons.js';
import { baseName, parentPath, normalizePath } from '@win95/core/filesystem.js';
export function createDialogs(system) {
    const modal = (title, options = {}) => {
        const owner = options.owner ?? system.wm.active;
        const w = system.wm.create({ title, width: options.width || 380, height: options.height || 180, icon: options.icon || 'windows', resizable: false, modal: true, ...options, owner });
        w.body.classList.add('dialog-content');
        w.element.setAttribute('aria-modal', 'true');
        w.element.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                const fields = [...w.element.querySelectorAll('button:not(:disabled),input,select,textarea,[tabindex="0"]')].filter(n => n.offsetParent);
                const idx = fields.indexOf(document.activeElement);
                if (e.shiftKey && idx <= 0) {
                    e.preventDefault();
                    fields.at(-1)?.focus();
                }
                else if (!e.shiftKey && idx === fields.length - 1) {
                    e.preventDefault();
                    fields[0]?.focus();
                }
            }
        });
        return w;
    };
    const message = (text, title = 'Windows', choices = ['OK'], options = {}) => new Promise(resolve => {
        const w = modal(title, options);
        const row = el('div', { class: 'message-content' }, icon(options.icon || 'help', 32), el('div', { text }));
        const buttons = el('div', { class: 'dialog-buttons' });
        for (const [i, c] of choices.entries())
            buttons.append(button(c, () => { w.result = c; w.close(); }, { class: i === 0 ? 'default-button' : '' }));
        w.body.append(row, buttons);
        w.onClosed.push(() => resolve(w.result || choices.at(-1)));
        w.element.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                w.result = choices.includes('Cancel') ? 'Cancel' : choices.at(-1);
                w.close();
            }
        });
        queueMicrotask(() => buttons.firstElementChild?.focus());
    });
    const prompt = (text, initial = '', title = 'Windows', options = {}) => new Promise(resolve => {
        const w = modal(title, { height: 160, ...options });
        const input = el('input', { value: initial, 'aria-label': text });
        const form = el('form', { class: 'dialog-form' }, field(text, input), el('div', { class: 'dialog-buttons' }, el('button', { type: 'submit', class: 'default-button', text: 'OK' }), button('Cancel', () => w.close(), { type: 'button' })));
        form.onsubmit = e => { e.preventDefault(); w.result = input.value; w.close(); };
        w.body.append(form);
        w.onClosed.push(() => resolve(w.result ?? null));
        w.element.addEventListener('keydown', e => {
            if (e.key === 'Escape')
                w.close();
        });
        queueMicrotask(() => { input.focus(); input.select(); });
    });
    const file = (options = {}) => new Promise(resolve => {
        let path = options.directory || 'C:\\My Documents';
        if (system.fs.get(path)?.type !== 'folder')
            path = system.fs.get('C:\\My Documents')?.type === 'folder' ? 'C:\\My Documents' : 'C:\\';
        const save = !!options.save;
        const w = modal(save ? 'Save As' : 'Open', { width: 460, height: 345, owner: options.owner });
        const dir = el('select', { 'aria-label': 'Look in' });
        const list = el('div', { class: 'file-dialog-list inset', tabIndex: 0 });
        const name = el('input', { value: options.name || '', 'aria-label': 'File name' });
        const type = el('select', { 'aria-label': 'Files of type' }, el('option', { text: options.type || 'All Files (*.*)' }));
        const render = () => {
            if (system.fs.get(path)?.type !== 'folder')
                path = 'C:\\';
            dir.replaceChildren();
            for (const p of ['C:\\', 'C:\\My Documents', 'C:\\Windows\\Desktop', ...([...system.fs.nodes.values()].filter(n => n.type === 'folder' && n.path !== 'C:\\Recycled').map(n => n.path))].filter((v, i, a) => a.indexOf(v) === i))
                dir.append(el('option', { value: p, text: p, selected: p === path }));
            list.replaceChildren();
            for (const n of system.fs.list(path)) {
                const b = el('button', { class: 'file-dialog-item' }, icon(n.type === 'folder' ? 'folder' : 'document', 16), baseName(n.path));
                b.onclick = () => {
                    list.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
                    b.classList.add('selected');
                    if (n.type === 'file')
                        name.value = baseName(n.path);
                };
                onDoubleActivate(b, () => {
                    if (n.type === 'folder') {
                        path = n.path;
                        render();
                    }
                    else {
                        name.value = baseName(n.path);
                        submit();
                    }
                });
                list.append(b);
            }
        };
        const submit = async () => {
            if (!name.value.trim())
                return;
            let dest = normalizePath(name.value, path);
            if (options.extension && !baseName(dest).includes('.'))
                dest += options.extension;
            if (system.fs.get(dest)?.type === 'folder') {
                path = dest;
                render();
                name.value = '';
                return;
            }
            if (!save && !system.fs.exists(dest)) {
                await message('This file could not be found. Check the file name and try again.', w.title, ['OK'], { owner: w });
                return;
            }
            if (save && system.fs.exists(dest)) {
                const r = await message(`${baseName(dest)} already exists. Do you want to replace it?`, 'Save As', ['Yes', 'No'], { owner: w });
                if (r !== 'Yes')
                    return;
            }
            w.result = dest;
            w.close();
        };
        dir.onchange = () => { path = dir.value; render(); };
        const top = el('div', { class: 'file-dialog-top' }, field(save ? 'Save in:' : 'Look in:', dir), button('↰', () => { path = normalizePath(parentPath(path)); render(); }, { title: 'Up one level' }), button('▰', async () => {
            const n = await prompt('New folder name:', 'New Folder', 'New Folder', { owner: w });
            if (n) {
                try {
                    system.fs.mkdir(path + '\\' + n);
                    render();
                }
                catch (e) {
                    message(e.message);
                }
            }
        }, { title: 'Create new folder' }));
        const bottom = el('div', { class: 'file-dialog-bottom' }, field('File name:', name), button(save ? 'Save' : 'Open', submit, { class: 'default-button' }), field('Files of type:', type), button('Cancel', () => w.close()));
        w.body.append(top, list, bottom);
        w.onClosed.push(() => resolve(w.result || null));
        name.onkeydown = e => {
            if (e.key === 'Enter')
                submit();
        };
        w.element.addEventListener('keydown', e => {
            if (e.key === 'Escape')
                w.close();
        });
        render();
        queueMicrotask(() => { name.focus(); name.select(); });
    });
    return { modal, message, prompt, file, error: (error, owner) => message(error.message || String(error), 'Windows', ['OK'], { owner, icon: 'help' }) };
}
