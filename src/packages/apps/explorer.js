import { dataText, el, button, download, fileInput, formatSize, infoGrid, onDoubleActivate } from '@win95/ui/dom.js';
import { icon, fileIcon } from '@win95/ui/icons.js';
import { menuBar, popup } from '@win95/ui/menu.js';
import { NAME_LIMIT, normalizePath, parentPath, baseName, displayName, nameError } from '@win95/core/filesystem.js';
/**
 * A host file name has to fit the volume's cap. The extension survives the cut
 * when it is short enough to be worth keeping; a 300 character "extension" is
 * not data, and keeping it would hand back a name longer than the one we cut.
 */
const clampName = name => {
    if (name.length <= NAME_LIMIT)
        return name;
    const dot = name.lastIndexOf('.'), ext = dot > 0 && name.length - dot <= NAME_LIMIT - 1 ? name.slice(dot) : '';
    return (name.slice(0, NAME_LIMIT - ext.length) + ext).replace(/[. ]+$/, '');
};
export function createFileActions(s) {
    const properties = (paths) => {
        if (!paths?.length)
            return;
        const n = s.fs.get(paths[0]);
        if (!n)
            return;
        const w = s.ui.modal(baseName(n.path) + ' Properties', { width: 385, height: 340 });
        const size = paths.reduce((a, p) => a + s.fs.size(p), 0);
        const name = el('input', { value: baseName(n.path), 'aria-label': 'File name' });
        w.body.append(el('div', { class: 'tab-strip' }, button('General', () => { }, { class: 'active' })), el('div', { class: 'tab-panel' }, el('div', { class: 'row', style: { gap: '20px', marginBottom: '15px' } }, icon(fileIcon(n), 32), name), el('div', { class: 'separator' }), infoGrid([['Type:', n.type === 'folder' ? 'File Folder' : (n.mime || 'File')], ['Location:', parentPath(n.path)], ['Size:', formatSize(size)], ['Contains:', n.type === 'folder' ? `${s.fs.list(n.path).length} objects` : `${paths.length} file(s)`], ['Created:', new Date(n.created).toLocaleString()], ['Modified:', new Date(n.modified).toLocaleString()]]), el('div', { class: 'separator' }), el('label', { class: 'checkbox-label' }, el('input', { type: 'checkbox', checked: !!n.readOnly, onchange: e => { n.readOnly = e.target.checked; s.fs.changed(); } }), 'Read-only')));
        w.body.append(el('div', { class: 'dialog-buttons' }, button('OK', () => {
            try {
                if (name.value !== baseName(n.path))
                    s.fs.rename(n.path, name.value);
                w.close();
            }
            catch (e) {
                s.ui.error(e, w);
            }
        }), button('Cancel', () => w.close())));
        return w;
    };
    const rename = async (path) => {
        const n = await s.ui.prompt('Type a new name:', baseName(path), 'Rename');
        if (n && n !== baseName(path)) {
            const problem = nameError(n);
            if (problem) {
                s.ui.message(problem, 'Rename', ['OK']);
                return;
            }
            try {
                s.fs.rename(path, n);
            }
            catch (e) {
                s.ui.error(e);
            }
        }
    };
    const remove = async (paths, permanent = false) => {
        if (!paths.length)
            return;
        const text = paths.length === 1 ? `'${baseName(paths[0])}'` : `these ${paths.length} items`;
        if (await s.ui.message(`Are you sure you want to ${permanent ? 'permanently delete' : 'send to the Recycle Bin'} ${text}?`, 'Confirm File Delete', ['Yes', 'No'], { icon: 'recycle' }) === 'Yes')
            for (const p of paths)
                try {
                    s.fs.remove(p, permanent);
                }
                catch (e) {
                    s.ui.error(e);
                }
    };
    const copy = (paths, cut = false) => { s.clipboard = { type: 'files', paths: [...paths], cut }; };
    const paste = path => {
        if (s.clipboard?.type !== 'files')
            return;
        for (const src of [...s.clipboard.paths])
            try {
                /* A cut item already in this folder stays where it is instead
                   of being renamed to a " (2)" copy of itself. */
                if (s.clipboard.cut && parentPath(src).toLowerCase() === normalizePath(path).toLowerCase())
                    continue;
                const to = s.fs.unique(path + '\\' + baseName(src), s.fs.get(src)?.type === 'folder');
                if (s.clipboard.cut)
                    s.fs.move(src, to);
                else
                    s.fs.copy(src, to);
            }
            catch (e) {
                s.ui.error(e);
            }
        if (s.clipboard.cut)
            s.clipboard = null;
    };
    const newFolder = async (path) => {
        const name = await s.ui.prompt('Name:', 'New Folder', 'New Folder');
        if (name) {
            const problem = nameError(name);
            if (problem) {
                s.ui.message(problem, 'New Folder', ['OK']);
                return;
            }
            try {
                s.fs.mkdir(path + '\\' + name);
            }
            catch (e) {
                s.ui.error(e);
            }
        }
    };
    const newText = async (path) => {
        const name = await s.ui.prompt('Name:', 'New Text Document.txt', 'New Text Document');
        if (name) {
            const problem = nameError(name);
            if (problem) {
                s.ui.message(problem, 'New Text Document', ['OK']);
                return;
            }
            try {
                s.fs.write(path + '\\' + name, '');
            }
            catch (e) {
                s.ui.error(e);
            }
        }
    };
    const importFiles = async (files, path) => {
        for (const f of files) {
            try {
                if (f.size > 16 * 1024 * 1024) {
                    await s.ui.message('This file is larger than the 16 MB import limit.', 'Import');
                    continue;
                }
                /* Host file names can carry characters the volume rejects, so
                   they are mangled into a legal name instead of failing the
                   whole import. */
                const name = clampName(f.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '') || 'Document');
                const text = f.type.startsWith('text/') || /\.(txt|ini|bat|sys|csv|json|rtf|md)$/i.test(f.name) ? await f.text() : await new Promise((r, j) => { const reader = new FileReader(); reader.onload = () => r(reader.result); reader.onerror = j; reader.readAsDataURL(f); });
                s.fs.write(s.fs.unique(path + '\\' + name), text, f.type || 'application/octet-stream');
            }
            catch (e) {
                s.ui.error(e);
            }
        }
    };
    const menu = (paths, path) => [{ label: 'Open', disabled: paths.length !== 1, action: () => s.open(paths[0]) }, { label: 'Explore', disabled: paths.length !== 1 || s.fs.get(paths[0])?.type !== 'folder', action: () => s.launch('explorer', { path: paths[0], tree: true }) }, null, { label: 'Cut', shortcut: 'Ctrl+X', disabled: !paths.length, action: () => copy(paths, true) }, { label: 'Copy', shortcut: 'Ctrl+C', disabled: !paths.length, action: () => copy(paths) }, { label: 'Paste', shortcut: 'Ctrl+V', disabled: s.clipboard?.type !== 'files', action: () => paste(path) }, null, { label: 'Create Shortcut', disabled: !paths.length, action: () => {
                for (const p of paths)
                    s.fs.write(s.fs.unique(path + '\\Shortcut to ' + baseName(p) + '.lnk'), JSON.stringify({ target: p }), 'application/x-win95-shortcut');
            } }, { label: 'Delete', shortcut: 'Del', disabled: !paths.length, action: () => remove(paths) }, { label: 'Rename', shortcut: 'F2', disabled: paths.length !== 1, action: () => rename(paths[0]) }, null, { label: 'Properties', shortcut: 'Alt+Enter', disabled: !paths.length, action: () => properties(paths) }];
    return { properties, rename, remove, copy, paste, newFolder, newText, importFiles, menu };
}
export function explorer(s, args = {}) {
    let path = args.path || 'computer', tree = !!args.tree, view = args.view || 'large', selection = new Set(), sort = 'name', showToolbar = tree, hist = [path], hIndex = 0;
    const w = s.wm.create({ title: 'My Computer', icon: path === 'recycle' ? 'recycle' : 'computer', width: args.width || 575, height: args.height || 360, x: args.x, y: args.y });
    const toolbar = el('div', { class: 'explorer-toolbar' });
    const content = el('div', { class: 'explorer-content' }), treeHost = el('div', { class: 'folder-tree inset' }), list = el('div', { class: 'file-list inset', tabIndex: 0, 'aria-label': 'Files' });
    content.append(treeHost, list);
    w.body.append(toolbar, content);
    const computer = [{ name: '3½ Floppy (A:)', icon: 'floppy', path: 'A:\\' }, { name: '(C:)', icon: 'disk', path: 'C:\\' }, { name: 'Windows 95 (D:)', icon: 'cd', path: 'D:\\' }, { name: 'Control Panel', icon: 'control', app: 'control' }, { name: 'Printers', icon: 'printer', app: 'printers' }, { name: 'Dial-Up Networking', icon: 'connection', app: 'network' }];
    let entries = [];
    const realPath = () => path === 'recycle' ? 'C:\\Recycled' : path === 'desktop' ? 'C:\\Windows\\Desktop' : s.fs.exists(path) ? path : 'C:\\';
    const selectedPaths = () => [...selection].filter(p => s.fs.exists(p));
    const openEntry = e => e.app ? s.launch(e.app) : e.path && s.fs.get(e.path)?.type === 'folder' ? navigate(e.path) : s.open(e.path);
    const navigate = p => {
        const same = p === path;
        path = p;
        selection.clear();
        if (!same) {
            hist = hist.slice(0, hIndex + 1);
            hist.push(p);
            hIndex++;
        }
        render();
    };
    const go = delta => {
        const next = hIndex + delta;
        if (next < 0 || next >= hist.length)
            return;
        hIndex = next;
        path = hist[hIndex];
        selection.clear();
        render();
    };
    const upOneLevel = () => navigate(path === 'computer' ? 'desktop' : path === 'desktop' ? 'computer' : normalizePath(parentPath(realPath())));
    const paintSelection = () => { list.querySelectorAll('[data-path]').forEach(n => n.classList.toggle('selected', selection.has(n.dataset.path))); w.status(selection.size ? `${selection.size} object(s) selected     ${formatSize(selectedPaths().reduce((a, p) => a + s.fs.size(p), 0))}` : `${entries.length} object(s)${path === 'computer' ? '' : `     ${formatSize(s.fs.size(realPath()))}`}`); };
    const addTree = (title, ic, p, depth = 0) => treeHost.append(el('button', { class: 'tree-item' + (p === path ? ' selected' : ''), style: { paddingLeft: (3 + depth * 13) + 'px' }, onclick: () => navigate(p) }, icon(ic, 16), title));
    const render = () => {
        if (w.closed)
            return;
        const folderOptions = s.settings.get('applet-folder-options', {});
        const rawTitle = path !== 'computer' && path !== 'recycle' && path !== 'network' && path !== 'desktop' && !tree && path.length > 3;
        w.setTitle(path === 'computer' ? 'My Computer' : path === 'recycle' ? 'Recycle Bin' : path === 'network' ? 'Network Neighborhood' : path === 'desktop' ? 'Desktop' : tree ? `Exploring - ${folderOptions.fullPath ? realPath() : baseName(path)}` : path.length <= 3 ? `(${path[0]}:)` : folderOptions.fullPath ? realPath() : baseName(path), { raw: rawTitle });
        treeHost.hidden = !tree;
        treeHost.replaceChildren();
        addTree('Desktop', 'computer', 'desktop');
        addTree('My Computer', 'computer', 'computer', 1);
        for (const drive of ['A:\\', 'C:\\', 'D:\\']) {
            addTree(`(${drive[0]}:)`, drive[0] === 'A' ? 'floppy' : drive[0] === 'D' ? 'cd' : 'disk', drive, 2);
            if (drive === 'C:\\')
                for (const n of s.fs.list(drive).filter(n => n.type === 'folder' && !n.path.toLowerCase().includes('recycled'))) {
                    addTree(dataText(baseName(n.path)), 'folder', n.path, 3);
                    if (path.toLowerCase().startsWith(n.path.toLowerCase()))
                        for (const c of s.fs.list(n.path).filter(n => n.type === 'folder'))
                            addTree(dataText(baseName(c.path)), 'folder', c.path, 4);
                }
        }
        addTree('Recycle Bin', 'recycle', 'recycle', 1);
        toolbar.hidden = !showToolbar;
        toolbar.replaceChildren(button('↰', upOneLevel, { title: 'Up One Level' }), el('div', { class: 'toolbar-divider' }), button('Cut', () => s.files.copy(selectedPaths(), true)), button('Copy', () => s.files.copy(selectedPaths())), button('Paste', () => s.files.paste(realPath())), el('div', { class: 'toolbar-divider' }), button('Large Icons', () => { view = 'large'; render(); }), button('Details', () => { view = 'details'; render(); }));
        entries = path === 'computer' ? computer : path === 'network' ? [{ name: 'Entire Network', icon: 'network', app: 'network' }, { name: 'My Computer', icon: 'computer', path: 'C:\\' }] : (folderOptions.allFiles === false ? s.fs.list(realPath()).filter(n => !n.hidden) : s.fs.list(realPath())).map(n => ({ name: displayName(n, folderOptions.extensions === false), icon: fileIcon(n), path: n.path, node: n, nameIsData: true }));
        if (sort === 'type')
            entries.sort((a, b) => (a.node?.type || '').localeCompare(b.node?.type || ''));
        else if (sort === 'size')
            entries.sort((a, b) => s.fs.size(b.path || 'C:\\') - s.fs.size(a.path || 'C:\\'));
        list.className = 'file-list inset ' + view;
        list.replaceChildren();
        if (view === 'details')
            list.append(el('div', { class: 'details-header' }, el('span', { text: 'Name' }), el('span', { text: 'Size' }), el('span', { text: 'Type' }), el('span', { text: 'Modified' })));
        for (const e of entries) {
            const id = e.path || e.app;
            const b = el('button', { class: 'file-item', draggable: !!e.path, 'data-path': id, 'aria-label': e.name, 'data-i18n-skip-attrs': e.nameIsData ? 'aria-label' : undefined }, icon(e.icon, 32), e.nameIsData ? dataText(e.name, { class: 'file-name' }) : el('span', { class: 'file-name', text: e.name }), el('span', { class: 'file-detail', text: e.node?.type === 'file' ? formatSize(s.fs.size(e.path)) : '' }), el('span', { class: 'file-detail', text: e.node?.type === 'folder' ? 'File Folder' : e.node ? 'File' : '' }), el('span', { class: 'file-detail', text: e.node ? new Date(e.node.modified).toLocaleDateString() : '' }));
            b.onclick = ev => {
                ev.stopPropagation();
                if (ev.ctrlKey || ev.metaKey) {
                    selection.has(id) ? selection.delete(id) : selection.add(id);
                }
                else if (ev.shiftKey && selection.size) {
                    const start = entries.findIndex(x => (x.path || x.app) === [...selection][0]), end = entries.indexOf(e);
                    entries.slice(Math.min(start, end), Math.max(start, end) + 1).forEach(x => selection.add(x.path || x.app));
                }
                else {
                    selection.clear();
                    selection.add(id);
                }
                paintSelection();
            };
            onDoubleActivate(b, () => openEntry(e));
            b.oncontextmenu = ev => {
                ev.preventDefault();
                ev.stopPropagation();
                if (!selection.has(id)) {
                    selection.clear();
                    selection.add(id);
                    paintSelection();
                }
                const items = path === 'recycle' ? [{ label: 'Restore', action: () => {
                            for (const p of selectedPaths())
                                s.fs.restore(p);
                        } }, { label: 'Delete', action: () => s.files.remove(selectedPaths(), true) }, { label: 'Properties', action: () => s.files.properties(selectedPaths()) }] : e.app ? [{ label: 'Open', action: () => openEntry(e) }] : s.files.menu(selectedPaths(), realPath());
                popup(items, ev.clientX, ev.clientY);
            };
            b.ondragstart = ev => {
                if (!selection.has(id)) {
                    selection.clear();
                    selection.add(id);
                }
                ev.dataTransfer.setData('application/x-win95-files', JSON.stringify(selectedPaths()));
                ev.dataTransfer.effectAllowed = 'copyMove';
            };
            if (e.node?.type === 'folder' || e.path?.length === 3) {
                b.ondragover = ev => { ev.preventDefault(); b.classList.add('selected'); };
                b.ondragleave = () => paintSelection();
                b.ondrop = async (ev) => { ev.stopPropagation(); await drop(ev, e.path); };
            }
            list.append(b);
        }
        if (!entries.length)
            list.append(el('div', { class: 'empty-folder', text: 'This folder is empty.' }));
        paintSelection();
    };
    const drop = async (ev, to) => {
        ev.preventDefault();
        const data = ev.dataTransfer.getData('application/x-win95-files');
        try {
            if (data) {
                for (const p of JSON.parse(data)) {
                    if (parentPath(p).toLowerCase() === to.toLowerCase() && !ev.ctrlKey)
                        continue;
                    const dest = s.fs.unique(to + '\\' + baseName(p), s.fs.get(p)?.type === 'folder');
                    ev.ctrlKey ? s.fs.copy(p, dest) : s.fs.move(p, dest);
                }
            }
            else if (ev.dataTransfer.files.length)
                await s.files.importFiles(ev.dataTransfer.files, to);
        }
        catch (e) {
            s.ui.error(e, w);
        }
        render();
    };
    list.ondragover = e => e.preventDefault();
    list.ondrop = e => drop(e, realPath());
    list.onclick = e => {
        if (e.target === list) {
            selection.clear();
            paintSelection();
        }
    };
    list.oncontextmenu = e => {
        if (e.target.closest('.file-item'))
            return;
        e.preventDefault();
        popup([{ label: 'View', items: ['large', 'small', 'list', 'details'].map(v => ({ label: ({ large: 'Large Icons', small: 'Small Icons', list: 'List', details: 'Details' })[v], checked: view === v, action: () => { view = v; render(); } })) }, { label: 'Arrange Icons', items: [{ label: 'by Name', action: () => { sort = 'name'; render(); } }, { label: 'by Type', action: () => { sort = 'type'; render(); } }, { label: 'by Size', action: () => { sort = 'size'; render(); } }] }, null, { label: 'Refresh', action: render }, { label: 'Paste', disabled: s.clipboard?.type !== 'files', action: () => s.files.paste(realPath()) }, null, { label: 'New', items: [{ label: 'Folder', icon: 'folder', action: () => s.files.newFolder(realPath()) }, { label: 'Text Document', icon: 'notepad', action: () => s.files.newText(realPath()) }] }, { label: 'Properties', action: () => s.files.properties([realPath()]) }], e.clientX, e.clientY);
    };
    w.setMenu(menuBar([{ label: 'File', items: () => [{ label: 'Open', disabled: !selection.size, action: () => {
                        const e = entries.find(e => (e.path || e.app) === [...selection][0]);
                        if (e)
                            openEntry(e);
                    } }, { label: 'New', items: [{ label: 'Folder', icon: 'folder', action: () => s.files.newFolder(realPath()) }, { label: 'Text Document', icon: 'notepad', action: () => s.files.newText(realPath()) }] }, { label: 'Import File…', action: () => fileInput('', f => s.files.importFiles([f], realPath())) }, { label: 'Export File…', disabled: selectedPaths().length !== 1 || s.fs.get(selectedPaths()[0])?.type !== 'file', action: () => { const p = selectedPaths()[0]; download(baseName(p), s.fs.read(p), s.fs.get(p).mime); } }, null, { label: 'Delete', action: () => s.files.remove(selectedPaths()) }, { label: 'Rename', action: () => selectedPaths()[0] && s.files.rename(selectedPaths()[0]) }, { label: 'Properties', action: () => s.files.properties(selectedPaths()) }, null, { label: 'Close', action: () => w.close() }] }, { label: 'Edit', items: () => [{ label: 'Undo', disabled: true }, null, { label: 'Cut', shortcut: 'Ctrl+X', action: () => s.files.copy(selectedPaths(), true) }, { label: 'Copy', shortcut: 'Ctrl+C', action: () => s.files.copy(selectedPaths()) }, { label: 'Paste', shortcut: 'Ctrl+V', disabled: s.clipboard?.type !== 'files', action: () => s.files.paste(realPath()) }, null, { label: 'Select All', shortcut: 'Ctrl+A', action: () => { entries.forEach(e => selection.add(e.path || e.app)); paintSelection(); } }, { label: 'Invert Selection', action: () => {
                        for (const e of entries) {
                            const k = e.path || e.app;
                            selection.has(k) ? selection.delete(k) : selection.add(k);
                        }
                        paintSelection();
                    } }] }, { label: 'View', items: () => [{ label: 'Toolbar', checked: showToolbar, action: () => { showToolbar = !showToolbar; render(); } }, { label: 'Folders', checked: tree, action: () => { tree = !tree; render(); } }, null, ...['large', 'small', 'list', 'details'].map(v => ({ label: ({ large: 'Large Icons', small: 'Small Icons', list: 'List', details: 'Details' })[v], checked: view === v, action: () => { view = v; render(); } })), null, { label: 'Refresh', shortcut: 'F5', action: render }, { label: 'Options…', action: () => s.launch('folder-options') }] }, { label: 'Go', items: () => [{ label: 'Back', disabled: hIndex <= 0, action: () => go(-1) }, { label: 'Forward', disabled: hIndex >= hist.length - 1, action: () => go(1) }, { label: 'Up One Level', action: upOneLevel }] }, { label: 'Help', items: [{ label: 'Help Topics', action: () => s.launch('help', { topic: 'files' }) }, null, { label: 'About Windows 95', action: () => s.about() }] }]));
    w.element.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT')
            return;
        const key = e.key.toLowerCase();
        if (e.ctrlKey || e.metaKey) {
            if (['a', 'c', 'x', 'v'].includes(key))
                e.preventDefault();
            if (key === 'a') {
                entries.forEach(e => selection.add(e.path || e.app));
                paintSelection();
            }
            if (key === 'c')
                s.files.copy(selectedPaths());
            if (key === 'x')
                s.files.copy(selectedPaths(), true);
            if (key === 'v')
                s.files.paste(realPath());
        }
        else if (e.key === 'Delete') {
            e.preventDefault();
            s.files.remove(selectedPaths(), e.shiftKey);
        }
        else if (e.key === 'F2' && selectedPaths()[0]) {
            e.preventDefault();
            s.files.rename(selectedPaths()[0]);
        }
        else if (e.key === 'F5') {
            e.preventDefault();
            render();
        }
        else if (e.key === 'Backspace') {
            e.preventDefault();
            navigate(normalizePath(parentPath(realPath())));
        }
        else if (e.altKey && e.key === 'Enter') {
            e.preventDefault();
            s.files.properties(selectedPaths());
        }
        else if (e.key === 'Enter' && selection.size) {
            const entry = entries.find(x => (x.path || x.app) === [...selection][0]);
            if (entry)
                openEntry(entry);
        }
        else if (e.key.startsWith('Arrow')) {
            e.preventDefault();
            let i = entries.findIndex(x => (x.path || x.app) === [...selection].at(-1));
            const columns = view === 'large' ? Math.max(1, Math.floor(list.clientWidth / 88)) : 1;
            i = Math.max(0, Math.min(entries.length - 1, i + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? columns : -columns)));
            if (entries[i]) {
                selection.clear();
                selection.add(entries[i].path || entries[i].app);
                paintSelection();
            }
        }
    });
    let frame = 0;
    const onChange = () => {
        if (!frame)
            frame = requestAnimationFrame(() => { frame = 0; render(); });
    };
    const onOptions = e => { if (String(e.detail?.name || '').startsWith('applet-folder-options')) onChange(); };
    s.fs.addEventListener('change', onChange);
    s.settings.addEventListener?.('change', onOptions);
    w.onClosed.push(() => { s.fs.removeEventListener('change', onChange); s.settings.removeEventListener?.('change', onOptions); cancelAnimationFrame(frame); });
    render();
    return w;
}
