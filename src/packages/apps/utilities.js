import { el, button, field, download, fileInput, formatSize } from '@win95/ui/dom.js';
import { icon, fileIcon } from '@win95/ui/icons.js';
import { menuBar, popup } from '@win95/ui/menu.js';
import { combo } from '@win95/ui/select.js';
import { baseName, normalizePath, parentPath } from '@win95/core/filesystem.js';
export function findFiles(s) {
    const w = s.wm.create({ title: 'Find: All Files', icon: 'find', width: 560, height: 365 });
    w.body.classList.add('find-body');
    const name = el('input', { value: '', 'aria-label': 'Named', placeholder: '' }), containing = el('input', { 'aria-label': 'Containing text' }), folder = combo({ ariaLabel: 'Look in', options: ['C:\\', 'C:\\My Documents', 'C:\\Windows', 'C:\\Windows\\Desktop'] }), results = el('div', { class: 'find-results inset' });
    const search = () => {
        results.replaceChildren();
        let nodes = s.fs.search(name.value, folder.value);
        if (containing.value)
            nodes = nodes.filter(n => n.type === 'file' && (n.content || '').toLowerCase().includes(containing.value.toLowerCase()));
        for (const n of nodes)
            results.append(el('button', { class: 'find-result', ondblclick: () => s.open(n.path), onclick: e => { results.querySelectorAll('button').forEach(b => b.classList.remove('pressed')); e.currentTarget.classList.add('pressed'); }, oncontextmenu: e => { e.preventDefault(); popup(s.files.menu([n.path], parentPath(n.path)), e.clientX, e.clientY); } }, icon(fileIcon(n), 16), baseName(n.path), el('span', { text: parentPath(n.path) })));
        w.status(`${nodes.length} file(s) found`);
        if (!nodes.length)
            results.append(el('p', { style: { padding: '12px' }, text: 'No files matched your search.' }));
    };
    w.body.append(el('div', { class: 'tab-strip' }, button('Name & Location', () => { }, { class: 'active' })), el('div', { class: 'row', style: { alignItems: 'flex-start' } }, el('div', { class: 'stack', style: { flex: 1 } }, field('Named:', name), field('Containing text:', containing), field('Look in:', folder)), el('div', { class: 'stack' }, button('Find Now', search, { class: 'default-button' }), button('New Search', () => { name.value = ''; containing.value = ''; results.replaceChildren(); w.status('Ready'); }))), results);
    w.status('Enter the name of a file or folder to find.');
    name.onkeydown = e => {
        if (e.key === 'Enter')
            search();
    };
    return w;
}
const helpTopics = {
    welcome: ['Welcome to Windows 95', '<h1>Welcome to Windows 95</h1><p>Your desktop is the starting point for everything you do. Use the Start menu to run a program, find a file, or change a setting.</p><h2>A few things to try</h2><ul><li>Double-click <b>My Computer</b> to explore your drives.</li><li>Open <b>Notepad</b> and save your first document.</li><li>Draw a picture in <b>Paint</b>.</li><li>Make yourself at home in <b>Control Panel → Display</b>.</li></ul><p>Documents and settings are kept in this browser.</p>'],
    files: ['Working with files', '<h1>Working with files and folders</h1><p>Your personal documents live in <b>C:\\My Documents</b>. Every program uses the same virtual drive.</p><ul><li>Double-click a file to open it in its associated program.</li><li>Right-click to copy, rename, delete, or view properties.</li><li>Drag a file into a folder to move it. Hold <kbd>Ctrl</kbd> to copy.</li><li>Choose <b>File → Import File</b> or drop files from your computer into Explorer.</li><li>Deleted files go to the <b>Recycle Bin</b>. Right-click them and choose <b>Restore</b>.</li></ul><p>Use Microsoft Backup to export a copy of your virtual drive.</p>'],
    windows: ['Managing windows', '<h1>Managing windows</h1><p>Drag the title bar to move a window. Drag an edge or corner to change its size.</p><ul><li>Click the minimize button to put a window on the taskbar.</li><li>Click its taskbar button to bring it back.</li><li>Double-click the title bar to maximize or restore.</li><li>Click the icon at the left of the title bar for its system menu.</li><li>Right-click the taskbar to cascade or tile windows.</li></ul>'],
    applications: ['Programs and accessories', '<h1>Programs at your fingertips</h1><p>Open <b>Start → Programs</b> to find your applications.</p><ul><li><b>Accessories:</b> Notepad, WordPad, Paint, Calculator, Character Map, Clipboard Viewer.</li><li><b>Games:</b> Solitaire, FreeCell, Minesweeper, Hearts.</li><li><b>Multimedia:</b> Media Player, Sound Recorder, Volume Control, CD Player.</li><li><b>System Tools:</b> Backup, ScanDisk, Disk Defragmenter, System Monitor, Registry Editor.</li><li><b>MS-DOS Prompt:</b> a command interpreter over your virtual drive.</li></ul>'],
    notepad: ['Notepad', '<h1>Writing with Notepad</h1><p>Notepad edits plain-text files. Type your text, then choose <b>File → Save</b>.</p><ul><li><kbd>Ctrl+S</kbd> saves the file.</li><li><kbd>Ctrl+O</kbd> opens a file.</li><li><kbd>Ctrl+F</kbd> finds text. <kbd>F3</kbd> finds the next match.</li><li><kbd>F5</kbd> inserts the time and date.</li><li>Choose <b>Edit → Word Wrap</b> to fit long lines.</li><li><b>File → Export</b> downloads a copy to your computer.</li></ul>'],
    wordpad: ['WordPad', '<h1>Writing with WordPad</h1><p>Create formatted documents with bold, italic, underline, fonts, colors, paragraph alignment, and bullet lists.</p><p>Select text before clicking a formatting button. Save documents as RTF in the virtual drive, or export HTML to your computer.</p><p>The RTF text reader supports formatting, fonts, colors, paragraphs, and Unicode. Embedded objects, pictures, and page layout are outside the supported text format.</p>'],
    paint: ['Paint', '<h1>Drawing with Paint</h1><p>Select a tool on the left, choose a color, then draw on the canvas.</p><ul><li>Use the pencil, brush, eraser, spray, line, curve, polygon, rectangle, or ellipse.</li><li>The paint bucket fills connected pixels of one color.</li><li>Right-click a palette color to select the background color.</li><li>Use Select and Edit → Copy/Cut/Paste for picture regions.</li><li>Choose Image → Attributes to resize the picture.</li><li>Invert Colors, flip, and rotate work on the entire picture.</li><li>Save or export as PNG. Set your drawing as the wallpaper from the File menu.</li></ul>'],
    calculator: ['Calculator', '<h1>Calculator</h1><p>Use the keypad or your keyboard. Standard mode evaluates operations as you enter them.</p><p>The memory buttons clear, recall, store, and add to the memory. <b>CE</b> clears the current entry; <b>C</b> clears the calculation.</p><p>Scientific mode adds trigonometric, logarithmic, power, and factorial functions. Choose degrees or radians from View.</p>'],
    settings: ['Changing settings', '<h1>Make Windows your own</h1><p>Open <b>Control Panel</b> from My Computer or Start → Settings.</p><ul><li><b>Display:</b> wallpaper, colors, themes, screen savers.</li><li><b>Date/Time:</b> the desktop clock and time zone.</li><li><b>Sounds:</b> volume and sound scheme.</li><li><b>Regional Settings:</b> time and number conventions.</li><li><b>Add/Remove Programs:</b> choose which components appear in Programs.</li><li><b>System:</b> inspect the renderer, virtual disk, and devices provided by the browser.</li></ul><p>Use Apply to keep a change without closing the dialog.</p>'],
    keyboard: ['Keyboard shortcuts', '<h1>Keyboard shortcuts</h1><ul><li><kbd>Ctrl+Esc</kbd> — Start menu.</li><li><kbd>Alt+F4</kbd> — Close active window.</li><li><kbd>Alt+Space</kbd> — Window menu.</li><li><kbd>Alt+Tab</kbd> — Switch programs.</li><li><kbd>F2</kbd> — Rename a selected file.</li><li><kbd>F3</kbd> — Find.</li><li><kbd>Ctrl+C</kbd>, <kbd>Ctrl+X</kbd>, <kbd>Ctrl+V</kbd> — Copy, cut, paste.</li><li><kbd>Delete</kbd> — Recycle selected files.</li><li><kbd>Shift+Delete</kbd> — Delete files permanently.</li></ul><p>Your browser or computer may reserve some shortcuts. Every operation is also available through menus.</p>'],
    dos: ['MS-DOS Prompt', '<h1>Using the command prompt</h1><p>Type <b>HELP</b> to see available commands. The prompt uses the same C: drive as Explorer.</p><p>Examples:</p><pre>CD "C:\\My Documents"\nDIR\nTYPE "Read Me.txt"\nECHO Hello &gt; hello.txt\nSTART NOTEPAD\nTREE C:\\</pre><p>This is a command interpreter implemented in JavaScript. It does not execute native DOS or Windows binary programs.</p>'],
    about: ['About this desktop', '<h1>About this desktop</h1><p>This is an independent browser-native recreation of the Windows 95 experience, organized into reusable JavaScript packages.</p><p>Classic window controls and text use HTML and CSS. Raster surfaces are presented through WebGPU, with WebGL2 and Canvas 2D fallbacks. Paint includes a WebGPU compute operation for pixel inversion.</p><p>The virtual volume is saved in IndexedDB, with a local-storage fallback. Save a backup before clearing browser data.</p><p>The desktop does not contain the Windows kernel, Win32/Win16 binary loaders, a DOS machine emulator, or native hardware drivers. Networked desktop services and embedded OLE objects are not emulated.</p><p>W95FA is by Alina Sava under the SIL Open Font License. Original Windows icons remain Microsoft artwork. The Chinese pixel font WenQuanYi Bitmap Song is by the WenQuanYi Project under the GNU GPL v2 with the font embedding exception. See the included asset provenance for sources.</p>']
};
export function help(s, args = {}) {
    let topic = args.topic || 'welcome';
    const w = s.wm.create({ title: 'Windows Help', icon: 'help', width: 650, height: 465 });
    const toolbar = el('div', { class: 'explorer-toolbar' }, button('Contents', () => show('welcome')), button('Index', () => show('applications')), button('Search', async () => {
        const q = await s.ui.prompt('Search for:', '', 'Find Help Topics', { owner: w });
        if (q) {
            const t = Object.keys(helpTopics).find(k => helpTopics[k].join(' ').toLowerCase().includes(q.toLowerCase()));
            t ? show(t) : s.ui.message('No topics were found.', 'Windows Help', ['OK'], { owner: w });
        }
    }), el('div', { class: 'toolbar-divider' }), button('Print', () => window.print()));
    const layout = el('div', { class: 'help-layout' }), topics = el('div', { class: 'help-topics inset' }), page = el('article', { class: 'help-page inset' });
    const show = t => { topic = helpTopics[t] ? t : 'welcome'; page.innerHTML = helpTopics[topic][1]; [...topics.children].forEach(n => n.classList.toggle('active', n.dataset.topic === topic)); w.status(helpTopics[topic][0]); };
    for (const [k, [title]] of Object.entries(helpTopics))
        topics.append(button(title, () => show(k), { 'data-topic': k }));
    layout.append(topics, page);
    w.body.append(toolbar, layout);
    w.setMenu(menuBar([{ label: 'File', items: [{ label: 'Exit', action: () => w.close() }] }, { label: 'Help', items: [{ label: 'About Help', action: () => s.about('Windows Help', 'help') }] }]));
    show(topic);
    return w;
}
export function characterMap(s) {
    const w = s.wm.create({ title: 'Character Map', icon: 'font', width: 525, height: 310, resizable: false });
    w.body.style.padding = '10px';
    w.body.style.gap = '8px';
    let selected = '©';
    const grid = el('div', { class: 'char-grid inset' }), font = combo({ ariaLabel: 'Font', options: ['Arial', 'Times New Roman', 'Courier New', 'W95FA'], value: 'Times New Roman' }), copy = el('input', { 'aria-label': 'Characters to copy' }), label = el('span', { text: 'U+00A9 Copyright sign' });
    for (let i = 160; i < 256; i++) {
        const c = String.fromCharCode(i);
        const b = button(c, () => { selected = c; grid.querySelectorAll('button').forEach(n => n.classList.remove('selected')); b.classList.add('selected'); label.textContent = 'U+' + i.toString(16).toUpperCase().padStart(4, '0') + '   ' + c; }, { ondblclick: () => copy.value += c });
        grid.append(b);
    }
    font.onchange = () => grid.querySelectorAll('button').forEach(b => b.style.fontFamily = font.value);
    w.body.append(field('Font:', font), grid, el('div', { class: 'row' }, field('Characters to copy:', copy), button('Select', () => copy.value += selected), button('Copy', () => s.copyText(copy.value))), label);
    return w;
}
export function clipboardViewer(s) { const w = s.wm.create({ title: 'Clipboard Viewer', icon: 'document', width: 450, height: 290 }); const display = el('textarea', { class: 'notepad-editor', readOnly: true, 'aria-label': 'Clipboard contents' }); const refresh = () => display.value = s.clipboard?.type === 'text' ? s.clipboard.text : s.clipboard?.type === 'files' ? s.clipboard.paths.join('\n') : 'The Clipboard is empty.'; w.body.append(display); w.setMenu(menuBar([{ label: 'File', items: [{ label: 'Save As…', action: () => download('Clipboard.txt', display.value) }, { label: 'Exit', action: () => w.close() }] }, { label: 'Edit', items: [{ label: 'Delete', action: () => { s.clipboard = null; refresh(); } }, { label: 'Refresh', action: refresh }] }])); refresh(); const timer = setInterval(refresh, 500); w.onClosed.push(() => clearInterval(timer)); return w; }
export function registryEditor(s) {
    let data = s.settings.get('registry', { 'HKEY_CLASSES_ROOT': { '.txt': 'txtfile', '.rtf': 'rtffile', '.png': 'Paint.Picture' }, 'HKEY_CURRENT_USER': {}, 'HKEY_CURRENT_USER\\Control Panel\\Desktop': { Wallpaper: s.settings.get('wallpaper', 'None'), Color: s.settings.get('desktopColor', '#008080') }, 'HKEY_LOCAL_MACHINE': {}, 'HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion': { ProductName: 'Microsoft Windows 95', Version: '4.00.950', RegisteredOwner: s.settings.get('owner', 'Windows User') }, 'HKEY_USERS': {}, 'HKEY_CURRENT_CONFIG': {}, 'HKEY_DYN_DATA': {} }), key = 'HKEY_CURRENT_USER\\Control Panel\\Desktop', selected = null;
    const w = s.wm.create({ title: 'Registry Editor', icon: 'control', width: 620, height: 390 });
    const layout = el('div', { class: 'registry-layout' }), tree = el('div', { class: 'registry-tree inset' }), values = el('div', { class: 'registry-values inset' });
    layout.append(tree, values);
    w.body.append(layout);
    const persist = () => {
        s.settings.set('registry', data);
        if (key === 'HKEY_CURRENT_USER\\Control Panel\\Desktop') {
            if (data[key].Color)
                s.settings.set('desktopColor', data[key].Color);
            if (data[key].Wallpaper)
                s.settings.set('wallpaper', data[key].Wallpaper);
        }
        render();
    };
    const edit = async (name) => {
        const v = await s.ui.prompt('Value data:', String(data[key][name] ?? ''), 'Edit String', { owner: w });
        if (v !== null) {
            data[key][name] = v;
            persist();
        }
    };
    const render = () => {
        tree.replaceChildren();
        values.replaceChildren(el('div', { class: 'registry-header' }, el('span', { text: 'Name' }), el('span', { text: 'Data' })));
        for (const k of Object.keys(data)) {
            const depth = k.split('\\').length - 1;
            tree.append(el('button', { class: 'tree-item' + (k === key ? ' selected' : ''), style: { paddingLeft: (depth * 10 + 3) + 'px' }, onclick: () => { key = k; selected = null; render(); } }, icon('folder', 16), k.split('\\').at(-1)));
        }
        for (const [n, v] of Object.entries(data[key] || {})) {
            const row = el('div', { class: 'registry-row' + (selected === n ? ' selected' : ''), onclick: () => { selected = n; render(); }, ondblclick: () => edit(n) }, el('span', { text: n || '(Default)' }), el('span', { text: String(v) }));
            row.oncontextmenu = e => { e.preventDefault(); popup([{ label: 'Modify', action: () => edit(n) }, { label: 'Delete', action: () => { delete data[key][n]; persist(); } }], e.clientX, e.clientY); };
            values.append(row);
        }
        w.status('My Computer\\' + key);
    };
    const exportReg = () => {
        let text = 'REGEDIT4\r\n';
        for (const [k, vals] of Object.entries(data)) {
            text += '\r\n[' + k + ']\r\n';
            for (const [n, v] of Object.entries(vals))
                text += JSON.stringify(n) + '=' + JSON.stringify(String(v)) + '\r\n';
        }
        download('Registry.reg', text);
    };
    w.setMenu(menuBar([{ label: 'Registry', items: [{ label: 'Import Registry File…', action: () => fileInput('.reg', async (f) => {
                        const text = await f.text();
                        let k;
                        for (const line of text.split(/\r?\n/)) {
                            const m = line.match(/^\[([^\]]+)\]$/);
                            if (m) {
                                k = m[1];
                                if (!/^HKEY_[A-Z_]+(?:\\[^\x00-\x1f]*)?$/.test(k))
                                    continue;
                                data[k] ??= {};
                            }
                            else if (k && data[k]) {
                                const a = line.match(/^("(?:\\.|[^"\\])*"|@)=("(?:\\.|[^"\\])*"|dword:[0-9a-fA-F]{8})$/);
                                if (a)
                                    try {
                                        const n = a[1] === '@' ? '' : JSON.parse(a[1]), v = a[2].startsWith('dword:') ? parseInt(a[2].slice(6), 16) : JSON.parse(a[2]);
                                        Object.defineProperty(data[k], n, { value: v, writable: true, enumerable: true, configurable: true });
                                    }
                                    catch { }
                            }
                        }
                        persist();
                    }) }, { label: 'Export Registry File…', action: exportReg }, null, { label: 'Exit', action: () => w.close() }] }, { label: 'Edit', items: () => [{ label: 'New', items: [{ label: 'Key', action: async () => {
                                const n = await s.ui.prompt('Key name:', 'New Key', 'Registry Editor', { owner: w });
                                if (n && !/[\\\r\n]/.test(n)) {
                                    const path = key + '\\' + n;
                                    data[path] = {};
                                    key = path;
                                    persist();
                                }
                            } }, { label: 'String Value', action: async () => {
                                const n = await s.ui.prompt('Value name:', 'New Value', 'Registry Editor', { owner: w });
                                if (n) {
                                    Object.defineProperty(data[key], n, { value: '', writable: true, enumerable: true, configurable: true });
                                    persist();
                                    await edit(n);
                                }
                            } }] }, { label: 'Modify', disabled: selected === null, action: () => edit(selected) }, { label: 'Delete', disabled: selected === null, action: () => { delete data[key][selected]; selected = null; persist(); } }, null, { label: 'Find…', action: async () => {
                        const q = await s.ui.prompt('Find what:', '', 'Find', { owner: w });
                        if (q) {
                            const found = Object.keys(data).find(k => (k + JSON.stringify(data[k])).toLowerCase().includes(q.toLowerCase()));
                            if (found) {
                                key = found;
                                render();
                            }
                            else
                                s.ui.message('Finished searching through the registry.', 'Registry Editor', ['OK'], { owner: w });
                        }
                    } }] }, { label: 'View', items: [{ label: 'Refresh', action: render }] }, { label: 'Help', items: [{ label: 'About Registry Editor', action: () => s.about('Registry Editor', 'control') }] }]));
    render();
    return w;
}
export function systemMonitor(s) {
    const w = s.wm.create({ title: 'System Monitor', icon: 'computer', width: 530, height: 305 });
    const canvas = el('canvas', { class: 'monitor-canvas', width: 500, height: 210 }), ctx = canvas.getContext('2d'), samples = [];
    w.body.append(canvas);
    let frame = 0, last = performance.now(), sum = 0, count = 0, elapsed = 0;
    const tick = now => {
        const delta = now - last;
        last = now;
        if (delta < 1000) {
            sum += delta;
            count++;
        }
        elapsed += delta;
        if (elapsed >= 500) {
            const ms = count ? sum / count : 0;
            samples.push(ms);
            if (samples.length > 100)
                samples.shift();
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, 500, 210);
            ctx.strokeStyle = '#003000';
            for (let x = 0; x < 500; x += 25) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, 210);
                ctx.stroke();
            }
            for (let y = 0; y < 210; y += 25) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(500, y);
                ctx.stroke();
            }
            ctx.strokeStyle = '#0f0';
            ctx.beginPath();
            samples.forEach((v, i) => { const x = i * 5, y = 200 - Math.min(190, v * 3); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
            ctx.stroke();
            w.status(`Frame interval: ${ms.toFixed(1)} ms       Windows: ${s.wm.windows.length}       Volume: ${formatSize(s.fs.size('C:\\'))}`);
            elapsed = 0;
            sum = 0;
            count = 0;
        }
        frame = requestAnimationFrame(tick);
    };
    w.setMenu(menuBar([{ label: 'File', items: [{ label: 'Exit', action: () => w.close() }] }, { label: 'View', items: [{ label: 'Clear History', action: () => samples.length = 0 }] }, { label: 'Help', items: [{ label: 'About System Monitor', action: () => s.about('System Monitor', 'computer') }] }]));
    w.body.prepend(el('div', { class: 'row', style: { padding: '7px' } }, el('span', { style: { color: '#008000' }, text: '■' }), 'Browser frame interval (milliseconds)'));
    frame = requestAnimationFrame(tick);
    w.onClosed.push(() => cancelAnimationFrame(frame));
    return w;
}
export function diskUtility(s, args = {}) {
    const defrag = !!args.defrag;
    const w = s.wm.create({ title: defrag ? 'Disk Defragmenter' : 'ScanDisk', icon: 'disk', width: 475, height: 380, resizable: false });
    w.body.style.padding = '12px';
    w.body.style.gap = '10px';
    const map = el('div', { class: 'disk-map' }), progress = el('div', { class: 'progress' }, el('div', { style: { width: '0%' } })), result = el('p', { text: 'Select Start to check the virtual C: drive.' }), nodes = [...s.fs.nodes.values()].filter(n => n.path.startsWith('C:'));
    for (let i = 0; i < 256; i++)
        map.append(el('span', { class: 'disk-block' + (i < nodes.length * 3 ? ' used' : '') }));
    let timer;
    const start = () => {
        let index = 0, errors = [];
        startButton.disabled = true;
        result.textContent = defrag ? 'Organizing the virtual directory…' : 'Checking files and folders…';
        timer = setInterval(async () => {
            if (w.closed)
                return;
            const n = nodes[index];
            if (n && n.path.length > 3 && !s.fs.exists(parentPath(n.path)))
                errors.push(n.path);
            const end = Math.min(256, Math.round((index + 1) / nodes.length * 256));
            for (let i = 0; i < end; i++)
                map.children[i].classList.add('scanned');
            progress.firstChild.style.width = Math.min(100, (index + 1) / nodes.length * 100) + '%';
            index++;
            if (index >= nodes.length) {
                clearInterval(timer);
                if (defrag) {
                    s.fs.nodes = new Map([...s.fs.nodes].sort(([a], [b]) => a.localeCompare(b)));
                    s.fs.changed();
                    await s.fs.flush();
                }
                result.textContent = errors.length ? `${errors.length} invalid directory references found.` : defrag ? 'Virtual directory order optimized and saved.' : `ScanDisk found no errors in ${nodes.length} files and folders.`;
                startButton.disabled = false;
            }
        }, Math.max(25, 1200 / nodes.length));
    };
    const startButton = button('Start', start);
    w.body.append(el('div', { class: 'row' }, icon('disk', 32), el('div', {}, el('b', { text: 'Drive (C:)' }), el('p', { text: `${nodes.length} objects · ${formatSize(s.fs.size('C:\\'))}` }))), result, map, progress, el('p', { class: 'muted', text: defrag ? 'This map represents virtual files. Physical disk placement is managed by your browser.' : 'Checks that each virtual file has a valid parent directory.' }), el('div', { class: 'dialog-buttons' }, startButton, button('Close', () => w.close())));
    w.onClosed.push(() => clearInterval(timer));
    return w;
}
export function backup(s) {
    const w = s.wm.create({ title: 'Microsoft Backup', icon: 'disk', width: 540, height: 355 });
    w.body.style.padding = '12px';
    w.body.style.gap = '12px';
    const list = el('div', { class: 'inset', style: { flex: 1, overflow: 'auto', padding: '9px' } });
    for (const n of s.fs.list('C:\\'))
        list.append(el('div', { class: 'row', style: { padding: '5px' } }, icon(fileIcon(n), 16), n.path, el('span', { class: 'spacer' }), formatSize(s.fs.size(n.path))));
    const restore = () => fileInput('.json', async (f) => {
        try {
            const data = JSON.parse(await f.text());
            if (data.format !== 'win95-volume' || data.version !== 1 || !Array.isArray(data.nodes))
                throw new Error('This is not a Windows 95 desktop backup.');
            if (data.nodes.length > 50000)
                throw new Error('This backup has too many entries.');
            const nodes = new Map();
            for (const pair of data.nodes) {
                if (!Array.isArray(pair) || pair.length !== 2)
                    throw new Error('Invalid backup entry.');
                const n = pair[1];
                if (!n || !['file', 'folder'].includes(n.type) || typeof n.path !== 'string' || !/^C:\\|^A:\\|^D:\\/.test(n.path) || n.type === 'file' && typeof n.content !== 'string')
                    throw new Error('Invalid backup entry.');
                const path = normalizePath(n.path);
                if (path !== n.path)
                    throw new Error('Invalid backup path.');
                nodes.set(path.toLowerCase(), { path, type: n.type, content: n.content, mime: n.mime, created: Number(n.created) || Date.now(), modified: Number(n.modified) || Date.now(), originalPath: n.originalPath });
            }
            if (!nodes.has('c:\\'))
                throw new Error('The C: drive is missing.');
            for (const n of nodes.values())
                if (n.path.length > 3 && nodes.get(normalizePath(parentPath(n.path)).toLowerCase())?.type !== 'folder')
                    throw new Error('A parent directory is missing.');
            if (await s.ui.message('Replace the virtual drive with this backup? Open documents should be saved first.', 'Restore Backup', ['Yes', 'No'], { owner: w, height: 190 }) !== 'Yes')
                return;
            s.fs.nodes = nodes;
            s.fs.changed();
            await s.fs.flush();
            s.ui.message(`Restored ${nodes.size} files and folders.`, 'Microsoft Backup', ['OK'], { owner: w });
        }
        catch (e) {
            s.ui.error(e, w);
        }
    });
    w.body.append(el('div', { class: 'tab-strip' }, button('Backup', () => { }, { class: 'active' }), button('Restore', restore)), el('p', { text: 'Back up your files to a single archive on your computer.' }), list, el('div', { class: 'dialog-buttons' }, button('Start Backup', () => { download('Windows95-Backup-' + new Date().toISOString().slice(0, 10) + '.json', s.fs.export(), 'application/json'); w.status('Backup exported.'); }, { class: 'default-button' }), button('Restore…', restore), button('Close', () => w.close())));
    w.status(`${s.fs.nodes.size} objects on the virtual volume`);
    return w;
}
export function briefcase(s) {
    const path = 'C:\\My Documents\\My Briefcase';
    if (!s.fs.exists(path))
        s.fs.mkdir(path);
    const w = s.launch('explorer', { path });
    s.ui.message('Keep copies of files in My Briefcase. Use File → Export File to take a copy with you, or import a newer version from your computer.', 'My Briefcase', ['OK'], { icon: 'briefcase' });
    return w;
}
