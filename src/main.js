import { VirtualFileSystem, Settings, baseName, parentPath } from './packages/core/filesystem.js';
import { WindowManager } from './packages/shell/window-manager.js';
import { el, button, field, onDoubleActivate, setDoubleClickDelay } from './packages/ui/dom.js';
import { icon, fileIcon } from './packages/ui/icons.js';
import { popup, closeMenus } from './packages/ui/menu.js';
import { createDialogs } from './packages/ui/dialogs.js';
import { DesktopGraphics } from './packages/graphics/renderer.js';
import { createFileActions, explorer } from './packages/apps/explorer.js';
import { notepad, wordpad, calculator } from './packages/apps/documents.js';
import { paint } from './packages/apps/paint.js';
import { controlPanel, settingsApplet, displayProperties, dateTime, systemProperties } from './packages/apps/control-panel.js';
import { findFiles, help, characterMap, clipboardViewer, registryEditor, systemMonitor, diskUtility, backup, briefcase } from './packages/apps/utilities.js';
import { mediaPlayer, volumeControl, soundRecorder, internet, inbox } from './packages/apps/multimedia.js';
import { dosPrompt } from './packages/apps/dos.js';
import { minesweeper, solitaire, hearts } from './packages/games/apps.js';
const s = { fs: new VirtualFileSystem(), settings: new Settings(), wm: new WindowManager(), registry: new Map(), clipboard: null, imageClipboard: null, audio: null, lastActivity: Date.now() };
s.ui = createDialogs(s);
s.files = createFileActions(s);
s.graphics = new DesktopGraphics(s);
s.copyText = text => { s.clipboard = { type: 'text', text: String(text) }; navigator.clipboard?.writeText(String(text)).catch(() => { }); };
s.pasteText = async () => {
    if (s.clipboard?.type === 'text')
        return s.clipboard.text;
    try {
        return await navigator.clipboard.readText();
    }
    catch {
        return '';
    }
};
setDoubleClickDelay(() => s.settings.get('doubleClickMs', 500));
s.recent = path => { const r = s.settings.get('recentDocuments', []).filter(x => x !== path); r.unshift(path); s.settings.set('recentDocuments', r.slice(0, 12)); };
s.beep = (kind = 'click') => {
    if (s.settings.get('muted', false))
        return;
    try {
        if (!s.audio)
            s.audio = new (window.AudioContext || window.webkitAudioContext)();
        if (s.audio.state === 'suspended')
            s.audio.resume();
        const frequencies = kind === 'startup' ? [261.6, 329.6, 392, 523.3] : kind === 'win' ? [523.3, 659.3, 784] : kind === 'error' ? [180] : [700];
        frequencies.forEach((freq, i) => { const osc = s.audio.createOscillator(), gain = s.audio.createGain(), t = s.audio.currentTime + i * .1; osc.type = 'sine'; osc.frequency.value = freq; gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(s.settings.get('volume', 65) / 100 * .075, t + .01); gain.gain.exponentialRampToValueAtTime(.0001, t + .22); osc.connect(gain); gain.connect(s.audio.destination); osc.start(t); osc.stop(t + .23); });
    }
    catch { }
};
s.launch = (id, args = {}) => {
    const app = s.registry.get(id);
    if (!app) {
        s.ui.message(`Cannot find '${id}'. Make sure the name is correct and try again.`, 'Windows', ['OK']);
        return null;
    }
    try {
        const result = app.launch(s, args);
        if (result?.then)
            result.catch(e => s.ui.error(e));
        return result;
    }
    catch (error) {
        s.ui.error(error);
        return null;
    }
};
s.open = path => {
    if (!path)
        return;
    const n = s.fs.get(path);
    if (!n) {
        s.ui.message('The file could not be found: ' + path, 'Windows', ['OK']);
        return;
    }
    if (n.type === 'folder')
        return s.launch('explorer', { path });
    const ext = path.split('.').pop().toLowerCase();
    s.recent(path);
    if (ext === 'lnk') {
        try {
            const link = JSON.parse(n.content);
            if (link.app)
                return s.launch(link.app, link.args);
            if (link.target)
                return s.open(link.target);
        }
        catch { }
        return;
    }
    if (ext === 'exe' || ext === 'com') {
        s.ui.message('Native Windows and DOS binaries require a machine emulator. This desktop runs its built-in JavaScript applications.', 'Cannot Run Program', ['OK'], { icon: 'dos', height: 200 });
        return;
    }
    return s.launch(['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp'].includes(ext) ? 'paint' : ['rtf', 'doc'].includes(ext) ? 'wordpad' : ['wav', 'mp3', 'ogg', 'mp4', 'webm', 'm4a'].includes(ext) ? 'media' : ['htm', 'html'].includes(ext) ? 'internet' : 'notepad', { path });
};
const register = (id, name, ic, launch, group) => s.registry.set(id, { id, name, icon: ic, launch, accessory: group === 'accessory', game: group === 'game', group });
register('explorer', 'Windows Explorer', 'folder', (s, a) => explorer(s, a), 'system');
register('computer', 'My Computer', 'computer', (s, a) => explorer(s, { path: 'computer', ...a }));
register('documents', 'My Documents', 'documents', (s, a) => explorer(s, { path: 'C:\\My Documents', ...a }));
register('recycle', 'Recycle Bin', 'recycle', (s, a) => explorer(s, { path: 'recycle', ...a }));
register('network-neighborhood', 'Network Neighborhood', 'network', (s, a) => explorer(s, { path: 'network', ...a }));
register('notepad', 'Notepad', 'notepad', notepad, 'accessory');
register('wordpad', 'WordPad', 'wordpad', wordpad, 'accessory');
register('paint', 'Paint', 'paint', paint, 'accessory');
register('calculator', 'Calculator', 'calculator', calculator, 'accessory');
register('charmap', 'Character Map', 'font', characterMap, 'accessory');
register('clipbrd', 'Clipboard Viewer', 'document', clipboardViewer, 'accessory');
register('minesweeper', 'Minesweeper', 'minesweeper', minesweeper, 'game');
register('solitaire', 'Solitaire', 'solitaire', solitaire, 'game');
register('freecell', 'FreeCell', 'freecell', (s, a) => solitaire(s, { ...a, freecell: true }), 'game');
register('hearts', 'Hearts', 'hearts', hearts, 'game');
register('control', 'Control Panel', 'control', controlPanel);
register('display', 'Display', 'display', displayProperties);
register('datetime', 'Date/Time', 'clock', dateTime);
register('system', 'System', 'computer', systemProperties);
for (const id of ['mouse', 'keyboard', 'sounds', 'multimedia', 'regional', 'fonts', 'network', 'printers', 'passwords', 'accessibility', 'addremove', 'joystick', 'modems', 'hardware', 'power', 'folder-options'])
    register(id, id, 'settings', s => settingsApplet(s, id));
register('find', 'Find Files or Folders', 'find', findFiles);
register('help', 'Windows Help', 'help', help);
register('dos', 'MS-DOS Prompt', 'dos', dosPrompt, 'system');
register('regedit', 'Registry Editor', 'control', registryEditor, 'system');
register('monitor', 'System Monitor', 'computer', systemMonitor, 'system');
register('scandisk', 'ScanDisk', 'disk', diskUtility, 'system');
register('defrag', 'Disk Defragmenter', 'disk', (s, a) => diskUtility(s, { ...a, defrag: true }), 'system');
register('backup', 'Backup', 'disk', backup, 'system');
register('briefcase', 'My Briefcase', 'briefcase', briefcase);
register('media', 'Media Player', 'media', mediaPlayer, 'multimedia');
register('cdplayer', 'CD Player', 'cd', (s, a) => mediaPlayer(s, { ...a, cd: true }), 'multimedia');
register('volume', 'Volume Control', 'volume', volumeControl, 'multimedia');
register('recorder', 'Sound Recorder', 'sound', soundRecorder, 'multimedia');
register('internet', 'Internet Explorer', 'internet', internet, 'communication');
register('inbox', 'Microsoft Exchange', 'mail', inbox, 'communication');
const aliases = { 'explorer.exe': 'explorer', explorer: 'explorer', notepad: 'notepad', wordpad: 'wordpad', write: 'wordpad', mspaint: 'paint', pbrush: 'paint', paint: 'paint', calc: 'calculator', calculator: 'calculator', sol: 'solitaire', winmine: 'minesweeper', mshearts: 'hearts', freecell: 'freecell', control: 'control', cmd: 'dos', command: 'dos', 'command.com': 'dos', regedit: 'regedit', sysmon: 'monitor', scandisk: 'scandisk', defrag: 'defrag', mplayer: 'media', sndrec32: 'recorder', sndvol32: 'volume', cdplayer: 'cdplayer', charmap: 'charmap', clipbrd: 'clipbrd', iexplore: 'internet', inbox: 'inbox', winhelp: 'help', help: 'help', winver: 'about', taskman: 'taskman', msbackup: 'backup', welcome: 'welcome', shutdown: 'shutdown' };
s.run = command => {
    const text = String(command || '').trim();
    if (!text)
        return;
    const exact = s.fs.get(text.replace(/^"|"$/g, ''));
    if (exact)
        return s.open(exact.path);
    const match = text.match(/^(?:"([^"]+)"|(\S+))(?:\s+(.*))?$/);
    if (!match)
        return;
    let name = (match[1] || match[2]).toLowerCase(), rest = match[3] || '';
    if (name === 'control' && rest) {
        const cpl = rest.toLowerCase().split(' ')[0];
        return s.launch(({ 'desk.cpl': 'display', 'timedate.cpl': 'datetime', 'sysdm.cpl': 'system', 'main.cpl': 'mouse', 'mmsys.cpl': 'multimedia', 'intl.cpl': 'regional', 'appwiz.cpl': 'addremove', 'access.cpl': 'accessibility', 'netcpl.cpl': 'network', 'password.cpl': 'passwords', 'modem.cpl': 'modems', 'joy.cpl': 'joystick' })[cpl] || rest.toLowerCase());
    }
    if (name.endsWith('.exe'))
        name = name.slice(0, -4);
    const id = aliases[name] || name;
    if (id === 'about')
        return s.about();
    if (id === 'shutdown')
        return s.shutdown();
    const path = rest.replace(/^"|"$/g, '');
    return s.launch(id, path ? { path, tree: id === 'explorer' } : id === 'explorer' ? { path: 'C:\\', tree: true } : {});
};
s.about = (name = 'Windows 95', ic = 'windows') => { const w = s.ui.modal('About ' + name, { width: 412, height: 280, icon: ic }); w.body.append(el('div', { class: 'system-logo', style: { marginBottom: '4px' } }, icon('windows', 48), el('div', {}, el('strong', { text: 'Microsoft', style: { fontSize: '23px' } }), el('p', { text: name, style: { fontSize: '20px' } }))), el('div', { class: 'separator' }), el('div', { style: { lineHeight: '1.6', paddingLeft: '64px' } }, 'Windows 95 desktop recreation', el('br'), 'Version 1.0.0', el('br'), 'Registered to: ', s.settings.get('owner', 'Windows User')), el('div', { class: 'dialog-buttons' }, button('System Info…', () => s.launch('system')), button('OK', () => w.close(), { class: 'default-button' }))); return w; };
function welcome() { const w = s.wm.create({ title: 'Welcome to Windows 95', icon: 'windows', width: 505, height: 336, x: Math.min(innerWidth - 515, Math.max(180, innerWidth * .46)), y: Math.min(innerHeight - 375, Math.max(190, innerHeight * .35)), resizable: false }); w.body.classList.add('welcome-body'); const side = el('div', { class: 'welcome-side' }, icon('windows', 64), el('div', { class: 'welcome-wordmark' }, el('small', { text: 'Microsoft' }), el('strong', { text: 'Windows 95' }))); const main = el('div', { class: 'welcome-main' }, el('h1', {}, 'Where do you want ', el('br'), 'to go ', el('span', { text: 'today?' })), el('p', { text: 'Welcome to Windows 95. There’s a whole new world waiting on your desktop.' }), el('div', { class: 'welcome-actions' }, button('', () => s.launch('help'), { title: 'Explore Windows' }), button('', () => s.launch('documents'), { title: 'Open My Documents' })), el('div', { class: 'welcome-footer' }, el('label', { class: 'checkbox-label' }, el('input', { type: 'checkbox', checked: s.settings.get('showWelcome', true), onchange: e => s.settings.set('showWelcome', e.target.checked) }), 'Show this next time'), button('Close', () => w.close(), { class: 'default-button' }))); main.querySelectorAll('.welcome-actions button')[0].append(icon('help', 16), 'Take a tour of Windows'); main.querySelectorAll('.welcome-actions button')[1].append(icon('folder', 16), 'Open your documents'); w.body.append(side, main); return w; }
register('welcome', 'Welcome to Windows 95', 'windows', welcome);
function runDialog() {
    const w = s.ui.modal('Run', { width: 405, height: 192, icon: 'run' });
    const input = el('input', { 'aria-label': 'Open', value: s.settings.get('lastRun', ''), list: 'run-programs' });
    const options = el('datalist', { id: 'run-programs' }, ...['notepad', 'mspaint', 'calc', 'explorer', 'command', 'winmine', 'sol', 'freecell', 'regedit', 'control', 'winver'].map(x => el('option', { value: x })));
    const submit = () => {
        if (!input.value.trim())
            return;
        const command = input.value;
        s.settings.set('lastRun', command);
        w.close();
        s.run(command);
    };
    const form = el('form', { class: 'stack', onsubmit: e => { e.preventDefault(); submit(); } }, el('div', { class: 'row', style: { alignItems: 'flex-start' } }, icon('run', 32), el('p', { text: 'Type the name of a program, folder, or document, and Windows will open it for you.' })), field('Open:', input), options, el('div', { class: 'dialog-buttons' }, el('button', { text: 'OK', type: 'submit', class: 'default-button' }), button('Cancel', () => w.close(), { type: 'button' }), button('Browse…', async () => {
        const p = await s.ui.file({ owner: w });
        if (p)
            input.value = p;
    }, { type: 'button' })));
    w.body.append(form);
    queueMicrotask(() => { input.focus(); input.select(); });
    return w;
}
register('run', 'Run', 'run', runDialog);
function taskman() {
    const w = s.ui.modal('Close Program', { width: 380, height: 340, icon: 'task' }), list = el('select', { size: 8, 'aria-label': 'Running programs', style: { height: '160px' } });
    for (const win of s.wm.windows.filter(x => x !== w && !x.options.modal))
        list.append(el('option', { text: win.title, value: win.id }));
    w.body.append(list, el('p', { text: 'Select the program you want to close.' }), el('div', { class: 'dialog-buttons' }, button('End Task', () => {
        const win = s.wm.windows.find(x => x.id === list.value);
        if (win)
            win.close();
        w.close();
    }), button('Shut Down…', () => { w.close(); s.shutdown(); }), button('Cancel', () => w.close())));
    return w;
}
register('taskman', 'Close Program', 'task', taskman);
s.shutdown = () => {
    const w = s.ui.modal('Shut Down Windows', { width: 385, height: 259, icon: 'shutdown' });
    let selected = 'shutdown';
    const opts = el('div', { class: 'stack', style: { gap: '9px' } });
    for (const [value, label] of [['shutdown', 'Shut down the computer?'], ['restart', 'Restart the computer?'], ['dos', 'Restart the computer in MS-DOS mode?']])
        opts.append(el('label', {}, el('input', { type: 'radio', name: 'shutdown-option', value, checked: value === 'shutdown', onchange: () => selected = value }), label));
    const go = async () => {
        await w.close();
        for (const win of [...s.wm.windows])
            if (!win.options.modal && !await s.wm.close(win))
                return;
        await s.fs.flush();
        if (selected === 'restart') {
            location.reload();
            return;
        }
        if (selected === 'dos') {
            s.launch('dos', { fullscreen: true });
            return;
        }
        const screen = el('div', { class: 'shutdown-screen' }, el('p', { text: 'It is now safe to turn off your computer.' }), button('Turn on computer', () => location.reload()));
        document.body.append(screen);
    };
    w.body.append(el('div', { class: 'row', style: { alignItems: 'flex-start', gap: '17px' } }, icon('shutdown', 32), el('div', { class: 'stack' }, el('p', { text: 'Are you sure you want to:' }), opts)), el('div', { class: 'dialog-buttons' }, button('Yes', go, { class: 'default-button' }), button('No', () => w.close()), button('Help', () => s.launch('help', { topic: 'windows' }))));
    return w;
};
s.applyAppearance = () => { const schemes = { 'Windows Standard': ['#c0c0c0', '#000080', '#000000'], 'Desert': ['#d5ccbb', '#008080', '#000000'], 'Marine': ['#a6c2c2', '#004080', '#000000'], 'Plum': ['#c4a6b7', '#400040', '#000000'], 'High Contrast Black': ['#000000', '#800080', '#ffffff'], 'High Contrast White': ['#ffffff', '#000000', '#000000'] }; const a = schemes[s.settings.get('scheme', 'Windows Standard')] || schemes['Windows Standard']; document.documentElement.style.setProperty('--face', a[0]); document.documentElement.style.setProperty('--title', a[1]); document.documentElement.style.setProperty('--text', a[2]); };
s.updateClock = () => {
    let locale = s.settings.get('locale', 'en-US'), zone = s.settings.get('timezone', 'Local time');
    let options = { hour: 'numeric', minute: '2-digit', hour12: !s.settings.get('hour24', false) };
    if (zone !== 'Local time')
        options.timeZone = zone;
    const now = new Date(Date.now() + s.settings.get('clockOffset', 0));
    try {
        document.querySelector('#clock').textContent = now.toLocaleTimeString(locale, options);
        document.querySelector('#clock').title = now.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    catch {
        document.querySelector('#clock').textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
};
const allowedApps = group => [...s.registry.values()].filter(a => a.group === group && !s.settings.get('hiddenApps', []).includes(a.id));
const appMenu = group => allowedApps(group).map(a => ({ label: a.name, icon: a.icon, action: () => s.launch(a.id) }));
function startMenu() {
    const b = document.querySelector('#start-button');
    if (b.getAttribute('aria-expanded') === 'true') {
        closeMenus();
        return;
    }
    const accessories = [...appMenu('accessory'), null, { label: 'Multimedia', icon: 'media', items: () => appMenu('multimedia') }, { label: 'System Tools', icon: 'computer', items: () => appMenu('system').filter(x => x.label !== 'Windows Explorer' && x.label !== 'MS-DOS Prompt') }];
    const programs = [{ label: 'Accessories', icon: 'folder', items: accessories }, { label: 'Games', icon: 'folder', items: () => appMenu('game') }, { label: 'Communications', icon: 'folder', items: () => appMenu('communication') }, null, { label: 'MS-DOS Prompt', icon: 'dos', action: () => s.launch('dos') }, { label: 'Windows Explorer', icon: 'folder', action: () => s.launch('explorer', { path: 'C:\\', tree: true }) }];
    const items = [{ label: 'Programs', icon: 'programs', items: programs }, { label: 'Documents', icon: 'documents', items: () => { const docs = s.settings.get('recentDocuments', []).filter(p => s.fs.exists(p)).map(path => ({ label: baseName(path), icon: fileIcon(s.fs.get(path)), action: () => s.open(path) })); return docs.length ? docs : [{ label: '(Empty)', disabled: true }]; } }, { label: 'Settings', icon: 'settings', items: [{ label: 'Control Panel', icon: 'control', action: () => s.launch('control') }, { label: 'Printers', icon: 'printer', action: () => s.launch('printers') }, { label: 'Taskbar…', icon: 'windows', action: () => s.launch('taskbar-properties') }] }, { label: 'Find', icon: 'find', items: [{ label: 'Files or Folders…', icon: 'find', action: () => s.launch('find') }, { label: 'Computer…', icon: 'network', action: () => s.launch('network') }] }, { label: 'Help', icon: 'help', action: () => s.launch('help') }, { label: 'Run…', icon: 'run', action: runDialog }, null, { label: 'Shut Down…', icon: 'shutdown', action: s.shutdown }];
    popup(items, 2, innerHeight - 30 - 310, { large: true, class: 'start-menu', brand: true });
    const m = document.querySelector('.start-menu');
    m.style.top = Math.max(0, innerHeight - 30 - m.offsetHeight) + 'px';
    b.setAttribute('aria-expanded', 'true');
}
const desktop = document.querySelector('#desktop'), desktopIcons = document.querySelector('#desktop-icons');
let selected = new Set();
const fixed = [['computer', 'My Computer', 'computer'], ['network-neighborhood', 'Network Neighborhood', 'network'], ['inbox', 'Inbox', 'mail'], ['recycle', 'Recycle Bin', 'recycle'], ['briefcase', 'My Briefcase', 'briefcase']];
function renderDesktop() {
    desktopIcons.replaceChildren();
    const entries = fixed.map(([app, name, ic]) => ({ app, name, ic, key: app }));
    for (const n of s.fs.list('C:\\Windows\\Desktop'))
        entries.push({ path: n.path, name: baseName(n.path).replace(/\.lnk$/i, ''), ic: fileIcon(n), key: n.path });
    for (const e of entries) {
        const b = el('button', { class: 'desktop-icon' + (selected.has(e.key) ? ' selected' : ''), 'aria-label': e.name, 'data-desktop-key': e.key, draggable: !!e.path }, icon(e.app === 'recycle' && s.fs.list('C:\\Recycled').length ? 'recycleFull' : e.ic, 32), el('span', { text: e.name }));
        const open = () => e.app ? s.launch(e.app) : s.open(e.path);
        onDoubleActivate(b, open);
        b.onclick = event => {
            event.stopPropagation();
            if (!event.ctrlKey && !event.metaKey)
                selected.clear();
            selected.add(e.key);
            desktopIcons.querySelectorAll('[data-desktop-key]').forEach(n => n.classList.toggle('selected', selected.has(n.dataset.desktopKey)));
        };
        b.onkeydown = event => {
            if (event.key === 'Enter')
                open();
            if (event.key === 'Delete' && e.path)
                s.files.remove([e.path], event.shiftKey);
            if (event.key === 'F2' && e.path) {
                event.preventDefault();
                s.files.rename(e.path);
            }
        };
        b.oncontextmenu = event => {
            event.preventDefault();
            event.stopPropagation();
            popup(e.path ? s.files.menu([e.path], 'C:\\Windows\\Desktop') : [{ label: 'Open', action: open }, ...(e.app === 'recycle' ? [{ label: 'Empty Recycle Bin', action: async () => {
                            if (await s.ui.message('Are you sure you want to permanently delete all items in the Recycle Bin?', 'Confirm File Delete', ['Yes', 'No']) === 'Yes')
                                for (const n of s.fs.list('C:\\Recycled'))
                                    s.fs.remove(n.path, true);
                        } }] : []), null, { label: 'Properties', action: () => s.launch(e.app === 'computer' ? 'system' : e.app === 'network-neighborhood' ? 'network' : 'display') }], event.clientX, event.clientY);
        };
        b.ondragstart = event => {
            if (e.path)
                event.dataTransfer.setData('application/x-win95-files', JSON.stringify([e.path]));
        };
        if (e.path?.endsWith('.lnk'))
            b.append(el('span', { class: 'shortcut-overlay', text: '↗' }));
        desktopIcons.append(b);
    }
}
desktop.addEventListener('click', e => {
    if (e.target === desktop || e.target === desktopIcons) {
        selected.clear();
        renderDesktop();
    }
});
desktop.oncontextmenu = e => {
    if (e.defaultPrevented || e.target.closest('.window') || e.target.closest('.desktop-icon'))
        return;
    e.preventDefault();
    popup([{ label: 'Arrange Icons', items: [{ label: 'by Name', action: () => { const children = [...desktopIcons.children]; children.sort((a, b) => a.textContent.localeCompare(b.textContent)); desktopIcons.replaceChildren(...children); } }, { label: 'by Type', action: renderDesktop }, { label: 'Auto Arrange', checked: true, action: renderDesktop }] }, { label: 'Line Up Icons', action: renderDesktop }, null, { label: 'Paste', disabled: s.clipboard?.type !== 'files', action: () => s.files.paste('C:\\Windows\\Desktop') }, { label: 'New', items: [{ label: 'Folder', icon: 'folder', action: () => s.files.newFolder('C:\\Windows\\Desktop') }, { label: 'Shortcut…', icon: 'task', action: async () => {
                        const command = await s.ui.prompt('Command line:', 'notepad', 'Create Shortcut');
                        if (!command)
                            return;
                        const name = await s.ui.prompt('Select a name for the shortcut:', command, 'Create Shortcut');
                        if (name)
                            s.fs.write(s.fs.unique('C:\\Windows\\Desktop\\' + name + '.lnk'), JSON.stringify({ app: aliases[command.toLowerCase()] || command.toLowerCase() }), 'application/x-win95-shortcut');
                    } }, { label: 'Text Document', icon: 'notepad', action: () => s.files.newText('C:\\Windows\\Desktop') }] }, null, { label: 'Properties', action: () => s.launch('display') }], e.clientX, e.clientY);
};
desktop.ondragover = e => {
    if (!e.target.closest('.window'))
        e.preventDefault();
};
desktop.ondrop = async (e) => {
    if (e.target.closest('.window'))
        return;
    e.preventDefault();
    try {
        const data = e.dataTransfer.getData('application/x-win95-files');
        if (data) {
            for (const p of JSON.parse(data)) {
                if (parentPath(p) === 'C:\\Windows\\Desktop')
                    continue;
                const dest = s.fs.unique('C:\\Windows\\Desktop\\' + baseName(p));
                e.ctrlKey ? s.fs.copy(p, dest) : s.fs.move(p, dest);
            }
        }
        else
            await s.files.importFiles(e.dataTransfer.files, 'C:\\Windows\\Desktop');
    }
    catch (err) {
        s.ui.error(err);
    }
};
register('taskbar-properties', 'Taskbar Properties', 'windows', () => { const w = s.ui.modal('Taskbar Properties', { width: 365, height: 235 }); w.body.append(el('fieldset', {}, el('legend', { text: 'Taskbar options' }), el('label', { class: 'checkbox-label' }, el('input', { type: 'checkbox', checked: true, disabled: true }), 'Always on top'), el('label', { class: 'checkbox-label' }, el('input', { type: 'checkbox', checked: s.settings.get('showClock', true), onchange: e => { s.settings.set('showClock', e.target.checked); document.querySelector('#clock').hidden = !e.target.checked; } }), 'Show clock')), el('div', { class: 'dialog-buttons' }, button('Clear Documents', () => s.settings.set('recentDocuments', [])), button('OK', () => w.close()))); return w; });
register('addressbook', 'Address Book', 'mail', () => {
    let contacts = s.settings.get('contacts', []);
    const w = s.wm.create({ title: 'Address Book', icon: 'mail', width: 430, height: 320 }), list = el('div', { class: 'inset', style: { margin: '8px', padding: '8px', flex: 1, overflow: 'auto' } });
    const render = () => {
        list.replaceChildren();
        for (const c of contacts)
            list.append(el('div', { class: 'row', style: { padding: '7px' } }, icon('mail', 16), el('span', { text: c.name, style: { flex: 1 } }), el('span', { text: c.email }), button('Delete', () => { contacts = contacts.filter(x => x !== c); s.settings.set('contacts', contacts); render(); })));
    };
    w.body.append(el('div', { class: 'explorer-toolbar' }, button('New Contact', async () => {
        const name = await s.ui.prompt('Name:', '', 'New Contact', { owner: w });
        if (!name)
            return;
        const email = await s.ui.prompt('Email address:', '', 'New Contact', { owner: w });
        if (email) {
            contacts.push({ name, email });
            s.settings.set('contacts', contacts);
            render();
        }
    })), list);
    render();
    return w;
});
document.querySelector('#start-button').onpointerdown = e => e.stopPropagation();
document.querySelector('#start-button').onclick = e => { e.stopPropagation(); startMenu(); };
onDoubleActivate(document.querySelector('#clock'), () => s.launch('datetime'));
document.querySelector('#clock').oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); popup([{ label: 'Adjust Date/Time', action: () => s.launch('datetime') }], e.clientX, e.clientY - 30); };
document.querySelector('#sound-tray').replaceChildren(icon('volume', 16));
document.querySelector('#sound-tray').onclick = () => s.launch('volume');
document.querySelector('#taskbar').oncontextmenu = e => {
    if (e.target.closest('.task-button'))
        return;
    e.preventDefault();
    popup([{ label: 'Cascade', action: () => s.wm.cascade() }, { label: 'Tile Horizontally', action: () => s.wm.tile(false) }, { label: 'Tile Vertically', action: () => s.wm.tile(true) }, { label: 'Minimize All Windows', action: () => [...s.wm.windows].filter(w => !w.options.modal).forEach(w => w.minimize()) }, null, { label: 'Properties', action: () => s.launch('taskbar-properties') }], e.clientX, e.clientY - 150);
};
document.addEventListener('keydown', e => {
    s.lastActivity = Date.now();
    if (e.ctrlKey && e.key === 'Escape') {
        e.preventDefault();
        startMenu();
    }
    else if (e.key === 'Meta') { /* Wait for a complete chord. */ }
    else if (e.metaKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        runDialog();
    }
    else if (e.metaKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        s.launch('explorer', { path: 'C:\\', tree: true });
    }
    else if (e.key === 'F1') {
        e.preventDefault();
        s.launch('help');
    }
    else if (e.key === 'F3' && !e.target.closest('.window')) {
        e.preventDefault();
        s.launch('find');
    }
    else if (e.ctrlKey && e.altKey && e.key === 'Delete') {
        e.preventDefault();
        taskman();
    }
    else if (e.key === 'Escape')
        closeMenus();
    if (s.settings.get('toggleKeys', false) && e.key === 'CapsLock')
        s.beep();
});
document.addEventListener('pointermove', () => s.lastActivity = Date.now(), { passive: true });
document.addEventListener('pointerdown', () => {
    s.lastActivity = Date.now();
    if (!s.audio) {
        s.beep('startup');
    }
}, { once: true });
let fsFrame = 0;
s.fs.addEventListener('change', () => {
    if (!fsFrame)
        fsFrame = requestAnimationFrame(() => { fsFrame = 0; renderDesktop(); });
});
s.fs.addEventListener('storageerror', () => s.ui.message('The browser could not save your virtual drive. Export a backup to keep a copy of your files.', 'Storage Full', ['OK'], { height: 190 }));
window.addEventListener('error', event => { console.error('Windows desktop error:', event.error); });
window.addEventListener('pagehide', () => s.fs.flush().catch(() => { }));
document.addEventListener('visibilitychange', () => {
    if (document.hidden)
        s.fs.flush().catch(() => { });
});
await s.fs.init();
s.applyAppearance();
await s.graphics.init();
renderDesktop();
s.updateClock();
document.querySelector('#clock').hidden = !s.settings.get('showClock', true);
setInterval(s.updateClock, 1000);
setInterval(() => {
    const minutes = s.settings.get('saverMinutes', 0), kind = s.settings.get('screensaver', 'Mystify');
    if (minutes > 0 && kind !== 'None' && !document.querySelector('.screensaver') && Date.now() - s.lastActivity > minutes * 60000)
        s.graphics.screensaver(kind);
}, 5000);
s.launch('computer', { x: Math.max(100, Math.round(innerWidth * .14)), y: Math.max(55, Math.round(innerHeight * .12)), width: 575, height: 350 });
if (s.settings.get('showWelcome', true))
    welcome();
document.querySelector('#boot').classList.add('hidden');
setTimeout(() => document.querySelector('#boot')?.remove(), 200);
window.win95 = s;
const model = document.modelContext;
if (model?.registerTool) {
    const scope = new AbortController();
    const add = tool => Promise.resolve(model.registerTool(tool, { signal: scope.signal })).catch(() => { });
    add({ name: 'list_desktop_windows', description: 'Read currently open Windows 95 desktop windows.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => ({ windows: s.wm.windows.map(w => ({ id: w.id, title: w.title, minimized: w.minimized })), renderer: s.graphics.presenter.backend }) });
    add({ name: 'open_desktop_application', description: 'Open a built-in application on the Windows 95 desktop.', inputSchema: { type: 'object', properties: { application: { type: 'string', enum: [...s.registry.keys()] } }, required: ['application'], additionalProperties: false }, execute: async (input) => {
            if (!input || typeof input.application !== 'string' || !s.registry.has(input.application))
                throw new Error('Unknown application');
            const w = await s.launch(input.application);
            return { opened: true, title: w?.title };
        } });
    add({ name: 'list_virtual_files', description: 'Read a folder on the local Windows 95 virtual drive.', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false }, annotations: { readOnlyHint: true }, execute: input => {
            if (!input || typeof input.path !== 'string')
                throw new Error('A folder path is required');
            return { files: s.fs.list(input.path).map(n => ({ path: n.path, type: n.type, size: s.fs.size(n.path) })) };
        } });
    window.addEventListener('pagehide', () => scope.abort(), { once: true });
}
