import { VirtualFileSystem, Settings, baseName, parentPath } from './packages/core/filesystem.js';
import { installI18n, uiLocale } from './packages/core/i18n.js';
import { WindowManager } from './packages/shell/window-manager.js';
import { pointerTrails } from './packages/shell/pointer-trails.js';
import { revealDesktopLayers } from './packages/shell/desktop-reveal.js';
import { installCursors, setPointerBusy } from './packages/shell/cursors.js';
import { el, button, field, onDoubleActivate, setDoubleClickDelay } from './packages/ui/dom.js';
import { icon, fileIcon } from './packages/ui/icons.js';
import { popup, closeMenus } from './packages/ui/menu.js';
import { createDialogs } from './packages/ui/dialogs.js';
import { combo } from './packages/ui/select.js';
import { DesktopGraphics } from './packages/graphics/renderer.js';
import { createFileActions, explorer } from './packages/apps/explorer.js';
import { notepad, wordpad, calculator } from './packages/apps/documents.js';
import { paint } from './packages/apps/paint.js';
import { controlPanel, settingsApplet, displayProperties, dateTime, systemProperties } from './packages/apps/control-panel.js';
import { findFiles, help, characterMap, clipboardViewer, registryEditor, systemMonitor, diskUtility, backup, briefcase } from './packages/apps/utilities.js';
import { mediaPlayer, volumeControl, soundRecorder, internet, inbox } from './packages/apps/multimedia.js';
import { dosPrompt } from './packages/apps/dos.js';
import { minesweeper, solitaire, hearts } from './packages/games/apps.js';
const MIN_BOOT_MS = 1700;
const bootEl = document.querySelector('#boot');
const bootSpinnerEl = bootEl?.querySelector('.boot-spinner');
const bootTapEl = bootEl?.querySelector('.boot-tap');
const bootLogoEl = bootEl?.querySelector('.boot-logo');
const bootProgressEl = bootEl?.querySelector('.boot-progress');
let bootReady = false;
let bootPlaying = false;
const s = { fs: new VirtualFileSystem(), settings: new Settings(), wm: new WindowManager(), registry: new Map(), clipboard: null, imageClipboard: null, audio: null, lastActivity: Date.now(), resettingData: false };
if (s.settings.get('loginPassword', ''))
    document.body.classList.add('logged-off');
/* Wallpaper first, desktop icons 150 ms later, taskbar 100 ms after that and
   the windows 200 ms after that. Every way into a session - a start without a
   password, a start gated by one, and a log off followed by a new login - goes
   through this one controller, so all three reveal the desktop in the same
   order. The start-up windows are opened by the last stage rather than up
   front, so a window never shows mid-animation over a bare desktop. */
const startupWindows = () => {
    s.launch('computer', { x: Math.max(100, Math.round(innerWidth * .14)), y: Math.max(55, Math.round(innerHeight * .12)), width: 575, height: 350 });
    if (s.settings.get('showWelcome', true))
        welcome();
};
let desktopReveal = null;
s.revealDesktop = () => {
    if (!desktopReveal) {
        desktopReveal = revealDesktopLayers({ onLayer: layer => { if (layer === 'windows') startupWindows(); } });
        desktopReveal.then(() => { desktopReveal = null; });
    }
    return desktopReveal;
};
installI18n();
s.ui = createDialogs(s);
s.files = createFileActions(s);
s.graphics = new DesktopGraphics(s);
s.sounds = { startup: new Audio('./assets/win95-startup.mp3'), shutdown: new Audio('./assets/win95-shutdown.mp3') };
for (const audio of Object.values(s.sounds))
    audio.preload = 'auto';
s.playSound = name => {
    if (s.settings.get('muted', false))
        return null;
    const audio = s.sounds[name];
    if (!audio)
        return null;
    try {
        audio.volume = Math.min(1, Math.max(0, s.settings.get('volume', 65) / 100));
        audio.currentTime = 0;
        const playing = audio.play();
        if (playing?.catch)
            playing.catch(() => { });
        return audio;
    }
    catch {
        return null;
    }
};
const waitForSoundEnd = audio => {
    if (!audio || audio.ended)
        return Promise.resolve();
    const timeout = Number.isFinite(audio.duration) && audio.duration > 0 ? Math.min(audio.duration * 1000 + 300, 4000) : 2000;
    return Promise.race([
        new Promise(resolve => {
            audio.addEventListener('ended', resolve, { once: true });
            audio.addEventListener('error', resolve, { once: true });
        }),
        new Promise(resolve => setTimeout(resolve, timeout))
    ]);
};
const showBootTap = () => {
    if (!bootEl || bootReady || bootPlaying)
        return;
    bootReady = true;
    if (bootSpinnerEl)
        bootSpinnerEl.hidden = true;
    if (bootTapEl)
        bootTapEl.hidden = false;
    bootEl.classList.add('boot-ready');
};
const startBoot = () => {
    if (!bootEl || !bootReady || bootPlaying)
        return;
    bootPlaying = true;
    setPointerBusy(true);
    if (bootSpinnerEl)
        bootSpinnerEl.hidden = true;
    if (bootTapEl)
        bootTapEl.hidden = true;
    if (bootLogoEl)
        bootLogoEl.hidden = false;
    if (bootProgressEl)
        bootProgressEl.hidden = false;
    bootEl.classList.remove('boot-ready');
    bootEl.classList.add('boot-playing');
    setTimeout(() => {
        bootEl.classList.add('hidden');
        setPointerBusy(false);
        if (!s.settings.get('loginPassword', ''))
            s.playSound('startup');
        /* The staged reveal waits for the boot screen to be gone: a layer that
           is hidden behind an opaque splash has nothing to reveal. */
        setTimeout(() => {
            bootEl.remove();
            if (!s.settings.get('loginPassword', ''))
                s.revealDesktop();
        }, 200);
    }, MIN_BOOT_MS);
};
bootEl?.addEventListener('click', startBoot);
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
    if (kind === 'startup' || kind === 'shutdown') {
        s.playSound(kind);
        return;
    }
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
register('scandisk', 'ScanDisk', 'scandisk', diskUtility, 'system');
register('defrag', 'Disk Defragmenter', 'defrag', (s, a) => diskUtility(s, { ...a, defrag: true }), 'system');
register('backup', 'Backup', 'backup', backup, 'system');
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
s.about = (name = 'Windows 95', ic = 'windows') => { const w = s.ui.modal('About ' + name, { width: 412, height: 280, icon: ic }); w.body.append(el('div', { class: 'system-logo', style: { marginBottom: '4px' } }, icon(ic, 48), el('div', {}, el('strong', { text: 'Microsoft', style: { fontSize: '23px' } }), el('p', { text: name, style: { fontSize: '20px' } }))), el('div', { class: 'separator' }), el('div', { style: { lineHeight: '1.6', paddingLeft: '64px' } }, 'Pure Javascript recreation of Windows 95 desktop experience', el('br'), 'Version 1.0.0', el('br'), 'Registered to: ', s.settings.get('owner', 'Windows User')), el('div', { class: 'dialog-buttons' }, button('System Info…', () => s.launch('system')), button('OK', () => w.close(), { class: 'default-button' }))); return w; };
function welcome() { const w = s.wm.create({ title: 'Welcome to Windows 95', icon: 'windows', width: 505, height: 336, x: Math.min(innerWidth - 515, Math.max(180, innerWidth * .46)), y: Math.min(innerHeight - 375, Math.max(190, innerHeight * .35)), resizable: false }); w.body.classList.add('welcome-body'); const side = el('div', { class: 'welcome-side' }, icon('windows', 64), el('div', { class: 'welcome-wordmark' }, el('small', { text: 'Microsoft' }), el('strong', { text: 'Windows 95' }))); const main = el('div', { class: 'welcome-main' }, el('h1', {}, 'Where do you want ', el('br'), 'to go ', el('span', { text: 'today?' })), el('p', { text: 'Welcome to Windows 95. There’s a whole new world waiting on your desktop.' }), el('div', { class: 'welcome-actions' }, button('', () => s.launch('help'), { title: 'Explore Windows' }), button('', () => s.launch('documents'), { title: 'Open My Documents' })), el('div', { class: 'welcome-footer' }, el('label', { class: 'checkbox-label' }, el('input', { type: 'checkbox', checked: s.settings.get('showWelcome', true), onchange: e => s.settings.set('showWelcome', e.target.checked) }), 'Show this next time'), button('Close', () => w.close(), { class: 'default-button' }))); main.querySelectorAll('.welcome-actions button')[0].append(icon('help', 16), 'Take a tour of Windows'); main.querySelectorAll('.welcome-actions button')[1].append(icon('folder', 16), 'Open your documents'); w.body.append(side, main); return w; }
register('welcome', 'Welcome to Windows 95', 'windows', welcome);
function runDialog() {
    const w = s.ui.modal('Run', { width: 405, height: 192, icon: 'run' });
    const input = combo({ editable: true, ariaLabel: 'Open', value: s.settings.get('lastRun', '') });
    input.setOptions(['notepad', 'mspaint', 'calc', 'explorer', 'command', 'winmine', 'sol', 'freecell', 'regedit', 'control', 'winver']);
    const submit = () => {
        if (!input.value.trim())
            return;
        const command = input.value;
        s.settings.set('lastRun', command);
        w.close();
        s.run(command);
    };
    const form = el('form', { class: 'stack', onsubmit: e => { e.preventDefault(); submit(); } }, el('div', { class: 'row', style: { alignItems: 'flex-start' } }, icon('run', 32), el('p', { text: 'Type the name of a program, folder, or document, and Windows will open it for you.' })), field('Open:', input), el('div', { class: 'dialog-buttons' }, el('button', { text: 'OK', type: 'submit', class: 'default-button' }), button('Cancel', () => w.close(), { type: 'button' }), button('Browse…', async () => {
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
    const w = s.ui.modal('Close Program', { width: 380, height: 340, icon: 'task' }), list = combo({ mode: 'list', ariaLabel: 'Running programs', style: { height: '160px' } });
    list.setOptions(s.wm.windows.filter(x => x !== w && !x.options.modal).map(win => ({ value: win.id, label: win.title })));
    w.body.append(list, el('p', { text: 'Select the program you want to close.' }), el('div', { class: 'dialog-buttons' }, button('End Task', () => {
        const win = s.wm.windows.find(x => x.id === list.value);
        if (win)
            win.close();
        w.close();
    }), button('Shut Down…', () => { w.close(); s.shutdown(); }), button('Cancel', () => w.close())));
    return w;
}
register('taskman', 'Close Program', 'task', taskman);
s.restart = async (ownerWindow = null) => {
    if (ownerWindow && !await ownerWindow.close())
        return false;
    for (const win of [...s.wm.windows])
        if (!await s.wm.close(win))
            return false;
    await s.fs.flush();
    await waitForSoundEnd(s.playSound('shutdown'));
    location.reload();
    return true;
};
s.shutdown = () => {
    const w = s.ui.modal('Shut Down Windows', { width: 385, height: 259, icon: 'shutdown' });
    let selected = 'shutdown';
    const opts = el('div', { class: 'stack', style: { gap: '9px' } });
    for (const [value, label] of [['shutdown', 'Shut down the computer?'], ['restart', 'Restart the computer?'], ['dos', 'Restart the computer in MS-DOS mode?']])
        opts.append(el('label', {}, el('input', { type: 'radio', name: 'shutdown-option', value, checked: value === 'shutdown', onchange: () => selected = value }), label));
    const go = async () => {
        await w.close();
        if (selected === 'restart') {
            await s.restart();
            return;
        }
        setPointerBusy(true);
        for (const win of [...s.wm.windows])
            if (!await s.wm.close(win))
                return setPointerBusy(false);
        await s.fs.flush();
        setPointerBusy(false);
        s.playSound('shutdown');
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
function showLoginDialog({ startup = false } = {}) {
    const login = s.ui.modal('Enter Windows Password', { width: 470, height: 250, icon: 'login', closable: false });
    let authenticated = false, resetting = false;
    const user = el('input', { value: s.settings.get('owner', 'Windows User'), readOnly: true, 'aria-label': 'User name', autocomplete: 'username' });
    const password = el('input', { type: 'password', 'aria-label': 'Password', autocomplete: 'current-password' });
    const resetData = async () => {
        const answer = await s.ui.message(el('strong', { text: 'Resetting Windows will erase all files and settings. Continue?' }), 'Reset Windows', ['Yes', 'No'], { owner: login, icon: 'help' });
        if (answer !== 'Yes')
            return;
        if (await s.ui.message(el('div', {}, el('strong', { text: 'This is your last warning: every file and setting will be permanently erased. This cannot be undone.' }), el('div', { text: 'Really reset Windows?' })), 'Reset Windows', ['Yes', 'No'], { owner: login, icon: 'help' }) !== 'Yes')
            return;
        resetting = true;
        s.resettingData = true;
        try {
            s.fs.db?.close();
            s.fs.db = null;
            if (typeof indexedDB !== 'undefined') {
                await new Promise((resolve, reject) => {
                    const request = indexedDB.deleteDatabase('win95-desktop');
                    request.onsuccess = resolve;
                    request.onerror = () => reject(request.error || new Error('Could not delete the virtual disk.'));
                    request.onblocked = () => reject(new Error('Close other Windows 95 tabs before resetting.'));
                });
            }
            for (const key of ['win95-settings', 'win95-volume', 'win95-journal']) {
                try { localStorage.removeItem(key); } catch { }
            }
            s.settings.values = {};
            s.fs.nodes.clear();
            s.fs.revision = 0;
            s.fs.lastSaved = 0;
            s.fs.persistence = 'memory';
            await login.close();
            await waitForSoundEnd(s.playSound('shutdown'));
            location.reload();
        }
        catch (error) {
            resetting = false;
            s.resettingData = false;
            if (!s.fs.db)
                await s.fs.init().catch(() => { });
            await s.ui.message(error.message || 'Windows could not reset its data.', 'Reset Windows', ['OK'], { owner: login, icon: 'help' });
        }
    };
    const form = el('form', { class: 'login-layout', onsubmit: async event => {
        event.preventDefault();
        const expectedPassword = s.settings.get('loginPassword', '');
        if (password.value !== expectedPassword) {
            password.value = '';
            await s.ui.message('The password you entered is incorrect. Try again.', 'Enter Windows Password', ['OK'], { owner: login, icon: 'help' });
            password.focus();
            return;
        }
        authenticated = true;
        await login.close();
    } }, icon('login', 48),
    el('div', { class: 'login-copy' },
        el('div', { text: 'Type a name to identify yourself to Windows. Enter a password if you want to.' }),
        el('div', { class: 'login-tip', text: "Tip: If you don't enter a password, you won't get this prompt again at startup." })),
    el('div', { class: 'login-buttons' }, el('button', { type: 'submit', class: 'default-button', text: 'OK' }), button('Reset', resetData, { type: 'button' })),
    el('div', { class: 'login-fields' }, el('label', { for: 'login-user', text: 'User name:' }), user, el('label', { for: 'login-password', text: 'Password:' }), password));
    user.id = 'login-user';
    password.id = 'login-password';
    login.body.append(form);
    login.onClosed.push(() => {
        if (resetting)
            return;
        if (!authenticated) {
            document.body.classList.add('logged-off');
            queueMicrotask(() => showLoginDialog({ startup }));
            return;
        }
        document.body.classList.remove('logged-off');
        renderDesktop();
        s.updateClock();
        /* Signing back in is a sign-in like any other: the chime and the
           start-up windows belong to it too, not only to the first one after a
           boot. The background was already painted behind the login box, so the
           reveal starts at the icons. */
        s.playSound('startup');
        s.revealDesktop();
    });
    queueMicrotask(() => password.focus());
    return login;
}
s.logoff = () => {
    const confirm = s.ui.modal('Log Off Windows', { width: 300, height: 140, icon: 'logoff' });
    const logoffNow = async () => {
        await confirm.close();
        for (const win of [...s.wm.windows]) {
            if (!await s.wm.close(win))
                return;
        }
        await s.fs.flush();
        document.body.classList.add('logged-off');
        showLoginDialog();
    };
    confirm.body.append(el('div', { class: 'row', style: { alignItems: 'center', gap: '18px', padding: '12px 16px 8px' } }, icon('logoff', 32), el('p', { text: 'Are you sure you want to log off?' })),
        el('div', { class: 'dialog-buttons' }, button('Yes', logoffNow, { class: 'default-button' }), button('No', () => confirm.close())));
    return confirm;
};
s.applyAppearance = () => { const schemes = { 'Windows Standard': ['#c0c0c0', '#000080', '#000000'], 'Desert': ['#d5ccbb', '#008080', '#000000'], 'Marine': ['#a6c2c2', '#004080', '#000000'], 'Plum': ['#c4a6b7', '#400040', '#000000'], 'High Contrast Black': ['#000000', '#800080', '#ffffff'], 'High Contrast White': ['#ffffff', '#000000', '#000000'] }; const a = schemes[s.settings.get('scheme', 'Windows Standard')] || schemes['Windows Standard']; document.documentElement.style.setProperty('--face', a[0]); document.documentElement.style.setProperty('--title', a[1]); document.documentElement.style.setProperty('--text', a[2]); };
s.updateClock = () => {
    let locale = s.settings.get('locale', uiLocale), zone = s.settings.get('timezone', 'Local time');
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
    const items = [{ label: 'Programs', icon: 'programs', items: programs }, { label: 'Documents', icon: 'documents', items: () => { const docs = s.settings.get('recentDocuments', []).filter(p => s.fs.exists(p)).map(path => ({ label: baseName(path), icon: fileIcon(s.fs.get(path)), action: () => s.open(path) })); return docs.length ? docs : [{ label: '(Empty)', disabled: true }]; } }, { label: 'Settings', icon: 'settings', items: [{ label: 'Control Panel', icon: 'control', action: () => s.launch('control') }, { label: 'Printers', icon: 'printer', action: () => s.launch('printers') }, { label: 'Taskbar…', icon: 'windows', action: () => s.launch('taskbar-properties') }] }, { label: 'Find', icon: 'find', items: [{ label: 'Files or Folders…', icon: 'find', action: () => s.launch('find') }, { label: 'Computer…', icon: 'network', action: () => s.launch('network') }] }, { label: 'Help', icon: 'help', action: () => s.launch('help') }, { label: 'Run…', icon: 'run', action: runDialog }, null, { label: 'Log Off…', icon: 'logoff', action: s.logoff }, { label: 'Shut Down…', icon: 'shutdown', action: s.shutdown }];
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
});
let fsFrame = 0;
s.fs.addEventListener('change', () => {
    if (!fsFrame)
        fsFrame = requestAnimationFrame(() => { fsFrame = 0; renderDesktop(); });
});
s.fs.addEventListener('storageerror', () => s.ui.message('The browser could not save your virtual drive. Export a backup to keep a copy of your files.', 'Storage Full', ['OK'], { height: 190 }));
window.addEventListener('error', event => { console.error('Windows desktop error:', event.error); });
window.addEventListener('pagehide', () => { if (!s.resettingData) s.fs.flush().catch(() => { }); });
document.addEventListener('visibilitychange', () => {
    if (document.hidden && !s.resettingData)
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
if (s.settings.get('loginPassword', ''))
    showLoginDialog({ startup: true });
else if (!bootEl)
    /* Without a boot screen there is nothing to wait for, so the reveal starts
       here; with one, startBoot() runs it the moment the splash is gone. */
    s.revealDesktop();
if (document.readyState === 'complete')
    showBootTap();
else
    window.addEventListener('load', showBootTap, { once: true });
pointerTrails(s);
installCursors(s);
// The left-handed configuration swaps the roles of the two buttons: the
// physical left button becomes the secondary one (context menus) and the
// physical right button becomes the primary one (select, activate, drag).
{
    const lefty = () => s.settings.get('leftHanded', false);
    let swallowClick = false;
    document.addEventListener('pointerdown', e => {
        if (lefty() && e.isTrusted && e.button === 0)
            e.stopPropagation();
    }, true);
    document.addEventListener('mousedown', e => {
        if (!lefty() || !e.isTrusted || e.button !== 0)
            return;
        swallowClick = true;
        const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: e.clientX, clientY: e.clientY });
        menu.win95Synthetic = true;
        e.target.dispatchEvent(menu);
    }, true);
    // Chrome emits no click for the right button, so the new primary button
    // gets its activation events synthesised on release, doubles included.
    let lastRight = { t: 0, target: null };
    document.addEventListener('mouseup', e => {
        if (!lefty() || !e.isTrusted || e.button !== 2)
            return;
        const init = { bubbles: true, cancelable: true, button: 2, clientX: e.clientX, clientY: e.clientY };
        const click = new MouseEvent('click', init);
        click.win95Synthetic = true;
        e.target.dispatchEvent(click);
        const now = performance.now();
        if (lastRight.target === e.target && now - lastRight.t < s.settings.get('doubleClickMs', 500)) {
            const dbl = new MouseEvent('dblclick', init);
            dbl.win95Synthetic = true;
            e.target.dispatchEvent(dbl);
            lastRight = { t: 0, target: null };
        }
        else
            lastRight = { t: now, target: e.target };
    }, true);
    document.addEventListener('contextmenu', e => {
        if (!lefty() || e.win95Synthetic)
            return;
        if (e.isTrusted && e.button === 2) {
            e.stopPropagation();
            e.preventDefault();
        }
    }, true);
    for (const type of ['click', 'dblclick'])
        document.addEventListener(type, e => {
            if (!lefty() || !e.isTrusted || e.button !== 0)
                return;
            if (type === 'click' && !swallowClick)
                return;
            swallowClick = false;
            e.stopPropagation();
            e.preventDefault();
        }, true);
    s.wm.primary = e => (lefty() ? e.button === 2 : e.button === 0);
}
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
