import { el, button, field, download, fileInput, formatSize, infoGrid } from '@win95/ui/dom.js';
import { icon } from '@win95/ui/icons.js';
import { menuBar } from '@win95/ui/menu.js';
import { combo } from '@win95/ui/select.js';
import { saverWaitMinutes, saverWaitOptions } from './saver-wait.js';
const applets = [['display', 'Display', 'display'], ['sounds', 'Sounds', 'volume'], ['keyboard', 'Keyboard', 'keyboard'], ['mouse', 'Mouse', 'mouse'], ['datetime', 'Date/Time', 'clock'], ['regional', 'Regional Settings', 'windows'], ['fonts', 'Fonts', 'font'], ['printers', 'Printers', 'printer'], ['network', 'Network', 'network'], ['system', 'System', 'computer'], ['addremove', 'Add/Remove Programs', 'task'], ['accessibility', 'Accessibility Options', 'control'], ['multimedia', 'Multimedia', 'media'], ['passwords', 'Passwords', 'settings'], ['modems', 'Modems', 'connection'], ['joystick', 'Joystick', 'task'], ['hardware', 'Add New Hardware', 'control'], ['power', 'Power', 'computer']];
export function controlPanel(s) {
    const w = s.wm.create({ title: 'Control Panel', icon: 'control', width: 573, height: 388 });
    w.setMenu(menuBar([{ label: 'File', items: [{ label: 'Close', action: () => w.close() }] }, { label: 'View', items: [{ label: 'Large Icons', checked: true }, { label: 'Refresh', action: () => { } }] }, { label: 'Help', items: [{ label: 'Help Topics', action: () => s.launch('help', { topic: 'settings' }) }, { label: 'About Windows 95', action: () => s.about() }] }]));
    const grid = el('div', { class: 'control-grid' });
    for (const [id, title] of applets)
        grid.append(button('', () => { }, { class: 'control-icon', ondblclick: () => s.launch(id), 'aria-label': title }));
    for (let i = 0; i < applets.length; i++) {
        const [id, title, ic] = applets[i], b = grid.children[i];
        b.append(icon(ic, 32), el('span', { text: title }));
        b.onkeydown = e => {
            if (e.key === 'Enter')
                s.launch(id);
        };
    }
    w.body.append(grid);
    w.status(`${applets.length} object(s)`);
    return w;
}
function propertySheet(s, title, ic, tabs, width = 420, height = 420) {
    const w = s.wm.create({ title, icon: ic, width, height, resizable: false });
    w.body.classList.add('properties-layout');
    const strip = el('div', { class: 'tab-strip' }), panel = el('div', { class: 'tab-panel' }), buttons = el('div', { class: 'dialog-buttons' });
    let tabIndex = 0;
    const panels = tabs.map(([name, build], i) => { const p = el('div', { class: 'control-settings' }); build(p, w); const b = button(name, () => { tabIndex = i; render(); }); strip.append(b); return p; });
    const render = () => { [...strip.children].forEach((b, i) => b.classList.toggle('active', i === tabIndex)); panel.replaceChildren(panels[tabIndex]); };
    buttons.append(button('OK', async () => {
        if (w.apply)
            await w.apply();
        w.close();
    }, { class: 'default-button' }), button('Cancel', () => w.close()), button('Apply', async () => w.apply?.()));
    w.body.append(strip, panel, buttons);
    w.element.addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 'Tab') {
            e.preventDefault();
            tabIndex = (tabIndex + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length;
            render();
        }
        if (e.key === 'Escape')
            w.close();
    });
    render();
    return w;
}
export function displayProperties(s) {
    let wallpaper = s.settings.get('wallpaper', 'None'), color = s.settings.get('desktopColor', '#008080'), saver = s.settings.get('screensaver', 'Mystify'), saverMinutes = saverWaitMinutes(s.settings.get('saverMinutes', 0)), scheme = s.settings.get('scheme', 'Windows Standard'), backend = s.settings.get('renderer', 'auto');
    // Each page keeps its own monitor: a shared reference would be overwritten by the
    // Appearance page, whose preview is detached while the Background tab is active.
    const makeMonitor = () => { const preview = el('div', { class: 'display-preview', style: { background: color } }, el('div', { class: 'mini-window' })); return { element: el('div', { class: 'display-monitor' }, preview), preview }; };
    const w = propertySheet(s, 'Display Properties', 'display', [
        ['Background', p => { const monitor = makeMonitor(); p.append(monitor.element); const list = combo({ mode: 'list', ariaLabel: 'Wallpaper', options: ['None', 'Bricks', 'Clouds', 'Tiles', 'Weave'], value: wallpaper }); list.onchange = () => { wallpaper = list.value; monitor.preview.style.backgroundImage = wallpaper === 'Weave' ? 'repeating-linear-gradient(45deg,transparent 0 2px,#004040 2px 4px)' : wallpaper === 'Bricks' ? 'repeating-linear-gradient(0deg,transparent 0 15px,#004040 15px 16px)' : 'none'; }; p.append(el('div', { class: 'display-options' }, el('div', {}, el('p', { text: 'Wallpaper' }), list), el('div', { class: 'stack' }, button('Browse…', () => fileInput('image/*', f => { const reader = new FileReader(); reader.onload = () => { wallpaper = String(reader.result); sample.style.backgroundImage = `url(${wallpaper})`; sample.style.backgroundSize = 'cover'; }; reader.readAsDataURL(f); })), el('label', {}, 'Color:', el('input', { type: 'color', value: color, 'aria-label': 'Desktop color', oninput: e => { color = e.target.value; sample.style.backgroundColor = color; } }))))); p.append(el('div', { class: 'color-swatches' }, ...['#008080', '#004040', '#000080', '#008000', '#800000', '#800080', '#000000', '#808080', '#c0c0c0', '#ffffff'].map(c => button('', () => { color = c; sample.style.backgroundColor = c; }, { style: { background: c }, 'aria-label': 'Desktop color ' + c })))); }],
        ['Screen Saver', (p, win) => {
                p.append(el('div', { class: 'display-monitor' }, el('div', { class: 'display-preview', style: { background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00ffff' }, text: 'Windows 95' })));
                const choose = combo({ ariaLabel: 'Screen saver', options: ['None', 'Mystify', 'Starfield', 'Marquee'], value: saver, onchange: value => saver = value });
                const wait = el('input', { type: 'number', min: 0, max: 120, value: saverMinutes, 'aria-label': 'Wait minutes', oninput: e => saverMinutes = Math.min(120, saverWaitMinutes(e.target.value)), style: { width: '60px' } });
                p.append(field('Screen Saver:', choose), el('div', { class: 'row' }, button('Preview', () => s.graphics.screensaver(saver === 'None' ? 'Mystify' : saver)), button('Settings…', async () => {
                    const text = await s.ui.prompt('Text:', s.settings.get('saverText', 'Windows 95'), 'Marquee Settings', { owner: w });
                    if (text !== null)
                        s.settings.set('saverText', text);
                })), field('Wait (minutes):', wait), el('p', { class: 'muted', text: 'Set the wait time to 0 to turn off the automatic screen saver.' }));
                const sync = event => {
                    if (event.detail?.name !== 'saverMinutes')
                        return;
                    saverMinutes = saverWaitMinutes(event.detail.value);
                    wait.value = String(saverMinutes);
                };
                s.settings.addEventListener?.('change', sync);
                win.onClosed.push(() => s.settings.removeEventListener?.('change', sync));
            }],
        ['Appearance', p => { const monitor = makeMonitor(); p.append(monitor.element); const select = combo({ ariaLabel: 'Color scheme', options: ['Windows Standard', 'Desert', 'Marine', 'Plum', 'High Contrast Black', 'High Contrast White'], value: scheme, onchange: value => scheme = value }); p.append(field('Scheme:', select), el('p', { text: 'Choose the colors used for window titles, menus, and controls.' }), el('fieldset', {}, el('legend', { text: 'Item' }), el('div', { class: 'row' }, icon('windows', 32), el('span', { text: 'Active Title Bar' })), el('p', { style: { marginTop: '12px' }, text: 'Windows Standard uses the original Windows 95 colors.' }))); }],
        ['Settings', p => { p.append(el('div', { class: 'row', style: { marginBottom: '10px' } }, icon('display', 32), el('div', {}, el('b', { text: 'Display' }), el('p', { text: 'Browser display adapter' }))), el('fieldset', {}, el('legend', { text: 'Desktop area' }), el('p', { text: `${innerWidth} by ${innerHeight} pixels` }), el('p', { text: `Scale: ${devicePixelRatio}× device pixels` })), el('fieldset', {}, el('legend', { text: 'Graphics acceleration' }), el('p', { text: 'Current renderer: ' + s.graphics.presenter.backend }), field('Preferred:', combo({ ariaLabel: 'Renderer', options: [['auto', 'Automatic'], ['webgpu', 'WebGPU'], ['webgl2', 'WebGL2'], ['canvas2d', 'Canvas 2D']].map(([value, label]) => ({ value, label })), value: backend, onchange: value => backend = value }))), el('p', { text: 'A change to the renderer takes effect after restarting.' }), button('Full Screen', () => document.documentElement.requestFullscreen?.().catch(() => { }))); }]
    ], 430, 438);
    w.apply = () => { s.settings.set('desktopColor', color); s.settings.set('wallpaper', wallpaper); s.settings.set('screensaver', saver); s.settings.set('saverMinutes', saverMinutes); s.settings.set('scheme', scheme); s.settings.set('renderer', backend); s.applyAppearance(); };
    return w;
}
export function powerProperties(s) {
    let minutes = saverWaitMinutes(s.settings.get('saverMinutes', 0));
    const w = propertySheet(s, 'Power Properties', 'computer', [
        ['Power', (p, win) => {
                const wait = combo({
                    ariaLabel: 'Screen saver wait',
                    options: saverWaitOptions(minutes),
                    value: String(minutes),
                    onchange: value => minutes = saverWaitMinutes(value)
                });
                p.append(field('Screen saver wait:', wait), el('p', { class: 'muted', text: 'This is the same wait time as the Screen Saver tab in Display Properties; host sleep stays under your computer’s control.' }));
                const sync = event => {
                    if (event.detail?.name !== 'saverMinutes')
                        return;
                    minutes = saverWaitMinutes(event.detail.value);
                    wait.setOptions(saverWaitOptions(minutes), String(minutes));
                };
                s.settings.addEventListener?.('change', sync);
                win.onClosed.push(() => s.settings.removeEventListener?.('change', sync));
            }]
    ], 430, 390);
    w.apply = () => s.settings.set('saverMinutes', minutes);
    return w;
}
export function dateTime(s) {
    let date = new Date(Date.now() + s.settings.get('clockOffset', 0)), chosen = date.toISOString().slice(0, 10), clock = date.toTimeString().slice(0, 5), zone = s.settings.get('timezone', 'Local time');
    const w = propertySheet(s, 'Date/Time Properties', 'clock', [
        ['Date & Time', (p, w) => {
                const layout = el('div', { class: 'row', style: { alignItems: 'flex-start' } }), calendar = el('div', { style: { flex: 1 } }), dial = el('div', { class: 'analog-clock' });
                const year = el('input', { type: 'number', min: 1970, max: 2100, value: date.getFullYear(), style: { width: '65px' }, 'aria-label': 'Year' }), month = combo({ ariaLabel: 'Month', options: Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: new Date(2000, i).toLocaleString(undefined, { month: 'long' }) })), value: String(date.getMonth()) }), grid = el('div', { class: 'calendar-grid inset' });
                const draw = () => {
                    grid.replaceChildren(...['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(v => el('span', { class: 'weekday', text: v })));
                    const first = new Date(+year.value, +month.value, 1).getDay(), days = new Date(+year.value, +month.value + 1, 0).getDate();
                    for (let i = 0; i < first; i++)
                        grid.append(el('span'));
                    for (let i = 1; i <= days; i++)
                        grid.append(button(String(i), () => { date = new Date(+year.value, +month.value, i); chosen = `${year.value}-${String(+month.value + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`; draw(); }, { class: i === date.getDate() ? 'today' : '' }));
                };
                year.oninput = draw;
                month.onchange = draw;
                calendar.append(el('div', { class: 'calendar-head' }, month, year), grid, el('p', { class: 'muted', style: { marginTop: '10px' }, text: 'Calendar' }));
                for (let i = 1; i <= 12; i++) {
                    const a = i * Math.PI / 6;
                    dial.append(el('span', { class: 'clock-number', text: String(i), style: { left: (62 + Math.sin(a) * 48) + 'px', top: (62 - Math.cos(a) * 48) + 'px' } }));
                }
                const hour = el('span', { class: 'clock-hand clock-hour' }), minute = el('span', { class: 'clock-hand clock-minute' }), second = el('span', { class: 'clock-hand clock-second' });
                dial.append(hour, minute, second);
                const tick = () => { const now = new Date(Date.now() + s.settings.get('clockOffset', 0)); hour.style.transform = `rotate(${now.getHours() * 30 + now.getMinutes() / 2}deg)`; minute.style.transform = `rotate(${now.getMinutes() * 6}deg)`; second.style.transform = `rotate(${now.getSeconds() * 6}deg)`; };
                const timer = setInterval(tick, 1000);
                w.onClosed.push(() => clearInterval(timer));
                tick();
                draw();
                layout.append(calendar, el('div', { style: { width: '142px' } }, dial, el('input', { type: 'time', value: clock, 'aria-label': 'Time', oninput: e => clock = e.target.value, style: { width: '110px', margin: '16px' } })));
                p.append(layout, el('p', { text: 'Changes apply to the clock on this desktop.' }));
            }],
        ['Time Zone', p => p.append(field('Time Zone:', combo({ ariaLabel: 'Time zone', options: ['Local time', 'UTC', 'Europe/Warsaw', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo'], value: zone, onchange: value => zone = value })), el('p', { text: 'Choose how the taskbar clock displays the time.' }))]
    ], 450, 365);
    w.apply = () => {
        const target = new Date(`${chosen}T${clock}:00`);
        if (!Number.isNaN(target.getTime()))
            s.settings.set('clockOffset', target.getTime() - Date.now());
        s.settings.set('timezone', zone);
        s.updateClock();
    };
    return w;
}
export function systemProperties(s) {
    return propertySheet(s, 'System Properties', 'computer', [
        ['General', p => p.append(el('div', { class: 'system-logo' }, icon('windows', 64), el('div', {}, el('strong', { text: 'Microsoft' }), el('p', { text: 'Windows 95' }))), infoGrid([['System:', 'Browser-native desktop'], ['Version:', '1.0.0'], ['Registered to:', s.settings.get('owner', 'Windows User')], ['Computer:', `${navigator.hardwareConcurrency || 1} logical processors`], ['Graphics:', s.graphics.presenter.backend], ['File storage:', s.fs.persistence], ['Volume size:', formatSize(s.fs.size('C:\\'))]]), el('div', { class: 'separator' }), el('p', { text: 'Windows applications here run as JavaScript packages. Native Windows and DOS executable formats are not executed.' }))],
        ['Device Manager', p => {
                const list = el('div', { class: 'inset', style: { padding: '10px', minHeight: '200px' } });
                for (const [ic, label] of [['computer', 'Computer'], ['display', 'Display adapter — ' + s.graphics.presenter.backend], ['disk', 'Virtual C: drive — ' + s.fs.persistence], ['keyboard', 'Browser keyboard'], ['mouse', 'Browser pointing device'], ['volume', 'Web Audio output'], ['network', navigator.onLine ? 'Network — connected' : 'Network — offline']])
                    list.append(el('div', { class: 'row', style: { padding: '6px' } }, icon(ic, 16), label));
                p.append(list);
            }],
        ['Performance', p => p.append(infoGrid([['Graphics:', s.graphics.presenter.backend], ['Open windows:', String(s.wm.windows.length)], ['Logical CPUs:', String(navigator.hardwareConcurrency || 1)], ['Files and folders:', String(s.fs.nodes.size)], ['Virtual disk used:', formatSize(s.fs.size('C:\\'))], ['Storage revision:', String(s.fs.revision)]]), button('System Monitor…', () => s.launch('monitor')), button('Export Volume…', () => download('Windows95-Backup.json', s.fs.export(), 'application/json')))]
    ], 440, 400);
}
export function settingsApplet(s, id) {
    if (id === 'display')
        return displayProperties(s);
    if (id === 'datetime')
        return dateTime(s);
    if (id === 'system')
        return systemProperties(s);
    if (id === 'power')
        return powerProperties(s);
    const meta = applets.find(a => a[0] === id) || [id, id[0].toUpperCase() + id.slice(1), 'settings'];
    const draft = { ...s.settings.get('applet-' + id, {}) };
    const commits = [];
    let w;
    const select = (p, label, key, values, value) => { const input = combo({ ariaLabel: label, options: values.map(x => ({ value: x, label: x })), value: draft[key] ?? value, onchange: next => draft[key] = next }); p.append(field(label, input)); };
    const check = (p, label, key, value = false) => p.append(el('label', { class: 'checkbox-label' }, el('input', { type: 'checkbox', checked: draft[key] ?? value, onchange: e => draft[key] = e.target.checked }), label));
    const range = (p, label, key, value = 50) => p.append(field(label, el('input', { type: 'range', min: 0, max: 100, value: draft[key] ?? value, 'aria-label': label, oninput: e => draft[key] = Number(e.target.value) })));
    const pages = [];
    if (id === 'mouse') {
        pages.push(['Buttons', p => { p.append(el('div', { class: 'row' }, icon('mouse', 32), el('p', { text: 'Customize your pointing device.' }))); check(p, 'Left-handed button configuration', 'leftHanded'); range(p, 'Double-click speed:', 'doubleClick', 50); const test = button('Double-click to test', () => { }, { ondblclick: e => { e.target.classList.toggle('pressed'); e.target.textContent = e.target.classList.contains('pressed') ? 'Folder opened' : 'Double-click to test'; } }); p.append(el('fieldset', {}, el('legend', { text: 'Test area' }), icon('folder', 32), test)); commits.push(() => s.settings.set('doubleClickMs', Math.round(800 - (draft.doubleClick ?? 50) * 6))); }], ['Pointers', p => { select(p, 'Scheme:', 'cursor', ['Windows Standard', 'Large', 'Crosshair'], 'Windows Standard'); commits.push(() => { document.body.style.cursor = draft.cursor === 'Crosshair' ? 'crosshair' : 'default'; document.body.classList.toggle('large-pointer', draft.cursor === 'Large'); }); }]);
    }
    else if (id === 'keyboard') {
        pages.push(['Speed', p => { range(p, 'Repeat delay:', 'delay'); range(p, 'Repeat rate:', 'repeat'); p.append(field('Click here to test:', el('input', { 'aria-label': 'Keyboard test', placeholder: '' })), el('p', { class: 'muted', text: 'Key repeat for browser text fields follows your computer’s keyboard settings.' })); }], ['Language', p => select(p, 'Language:', 'language', ['English (United States)', 'Polski', 'Deutsch', 'Français'], 'English (United States)')]);
    }
    else if (id === 'regional') {
        pages.push(['Regional Settings', p => { select(p, 'Locale:', 'locale', ['en-US', 'en-GB', 'pl-PL', 'de-DE', 'fr-FR', 'ja-JP'], s.settings.get('locale', 'en-US')); p.append(el('fieldset', {}, el('legend', { text: 'Samples' }), el('p', { text: 'Number: ' + new Intl.NumberFormat(draft.locale || s.settings.get('locale', 'en-US')).format(1234567.89) }), el('p', { text: 'Date: ' + new Date().toLocaleDateString(draft.locale || s.settings.get('locale', 'en-US')) }))); commits.push(() => { s.settings.set('locale', draft.locale || 'en-US'); s.updateClock(); }); }], ['Time', p => { check(p, 'Use 24-hour time', 'hour24'); commits.push(() => { s.settings.set('hour24', !!draft.hour24); s.updateClock(); }); }]);
    }
    else if (id === 'sounds' || id === 'multimedia') {
        pages.push(['Audio', p => { select(p, 'Scheme:', 'scheme', ['Windows Default', 'No Sounds'], 'Windows Default'); range(p, 'Volume:', 'volume', s.settings.get('volume', 65)); check(p, 'Mute all sounds', 'muted', s.settings.get('muted', false)); p.append(button('Test', () => s.beep('startup')), button('Volume Control…', () => s.launch('volume'))); commits.push(() => { s.settings.set('volume', draft.volume ?? 65); s.settings.set('muted', draft.muted || draft.scheme === 'No Sounds'); }); }], ['Recording', p => p.append(el('p', { text: 'Record sound through the microphone selected by your browser.' }), button('Sound Recorder…', () => s.launch('recorder')))]);
    }
    else if (id === 'accessibility') {
        pages.push(['Keyboard', p => { check(p, 'Use StickyKeys', 'sticky'); check(p, 'Use ToggleKeys', 'toggle'); p.append(el('p', { text: 'ToggleKeys plays a tone when Caps Lock changes.' })); commits.push(() => s.settings.set('toggleKeys', !!draft.toggle)); }], ['Display', p => { check(p, 'Use High Contrast', 'highContrast'); select(p, 'Scheme:', 'contrast', ['High Contrast Black', 'High Contrast White'], 'High Contrast Black'); commits.push(() => { s.settings.set('scheme', draft.highContrast ? (draft.contrast || 'High Contrast Black') : 'Windows Standard'); s.applyAppearance(); }); }], ['Sound', p => { check(p, 'Show captions for system sounds', 'captions'); commits.push(() => s.settings.set('soundCaptions', !!draft.captions)); }]);
    }
    else if (id === 'addremove') {
        pages.push(['Install/Uninstall', p => {
                p.append(el('p', { text: 'Select a Windows component to show or hide it in the Start menu.' }));
                const installed = el('div', { class: 'inset stack', style: { padding: '10px', height: '210px', overflow: 'auto' } });
                const hidden = new Set(s.settings.get('hiddenApps', []));
                for (const app of s.registry.values()) {
                    if (!app.accessory && !app.game)
                        continue;
                    const c = el('input', { type: 'checkbox', checked: !hidden.has(app.id), onchange: e => { e.target.checked ? hidden.delete(app.id) : hidden.add(app.id); } });
                    installed.append(el('label', { class: 'checkbox-label' }, c, app.name));
                }
                p.append(installed);
                commits.push(() => s.settings.set('hiddenApps', [...hidden]));
            }], ['Windows Setup', p => p.append(el('p', { text: 'This desktop includes Accessories, Games, Communications, and System Tools.' }), button('Show components', () => s.launch('help', { topic: 'applications' })))]);
    }
    else if (id === 'network') {
        pages.push(['Configuration', p => { p.append(el('p', { text: 'The following network components are available:' }), el('div', { class: 'inset stack', style: { padding: '10px' } }, el('div', { class: 'row' }, icon('network', 16), 'Browser Network Adapter'), el('div', { class: 'row' }, icon('network', 16), 'TCP/IP — Browser HTTPS'), el('div', { class: 'row' }, icon('network', 16), 'Local virtual filesystem')), el('p', { text: navigator.onLine ? 'Connection status: Online' : 'Connection status: Offline' }), button('Internet Explorer…', () => s.launch('internet'))); }], ['Identification', p => { p.append(field('Computer name:', el('input', { value: draft.computer || 'WINDOWS95', oninput: e => draft.computer = e.target.value })), field('Workgroup:', el('input', { value: draft.workgroup || 'WORKGROUP', oninput: e => draft.workgroup = e.target.value })), el('p', { text: 'These names identify your local desktop. Browser networking uses the host computer’s connection.' })); }]);
    }
    else if (id === 'passwords') {
        pages.push(['User Profiles', p => { p.append(field('User name:', el('input', { value: s.settings.get('owner', 'Windows User'), oninput: e => draft.owner = e.target.value })), el('p', { text: 'Documents and preferences belong to this browser profile.' })); commits.push(() => s.settings.set('owner', draft.owner || 'Windows User')); }], ['Privacy', p => p.append(el('p', { text: 'Your virtual drive is stored in this browser. Export a backup before clearing browser storage.' }), button('Back Up Files…', () => s.launch('backup')))]);
    }
    else if (id === 'printers') {
        pages.push(['Printers', p => p.append(el('div', { class: 'row' }, icon('printer', 32), el('div', {}, el('b', { text: 'Browser Print Service' }), el('p', { text: 'Default printer' }))), el('p', { text: 'Use File → Print in Notepad or WordPad to choose a printer or save as PDF.' }), button('Print Test Page', () => { s.launch('notepad', { text: 'Windows 95 Printer Test Page\n\nBrowser Print Service\n\nThe quick brown fox jumps over the lazy dog.\n0123456789\n\n' + new Date().toLocaleString() }); })),]);
    }
    else if (id === 'fonts') {
        pages.push(['Fonts', p => {
                const list = el('div', { class: 'inset stack', style: { padding: '12px', maxHeight: '220px', overflow: 'auto' } });
                for (const name of ['W95FA', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'])
                    list.append(el('div', { class: 'row' }, icon('font', 16), button(name, () => { s.launch('wordpad', { text: name }); s.ui.message('The quick brown fox jumps over the lazy dog.\n0123456789', name, ['OK'], { owner: w }); }, { style: { fontFamily: name, textAlign: 'left', background: '#fff', boxShadow: 'none' } })));
                p.append(list, el('p', { text: 'Font availability is provided by this browser and the Windows 95 desktop font package.' }));
            }]);
    }
    else if (id === 'joystick') {
        pages.push(['General', p => { const list = el('div', { class: 'inset', style: { minHeight: '100px', padding: '10px' } }); const scan = () => { const pads = [...(navigator.getGamepads?.() || [])].filter(Boolean); list.replaceChildren(...(pads.length ? pads.map(g => el('p', { text: g.id })) : [el('p', { text: 'No game controller detected. Connect a controller and press a button.' })])); }; p.append(list, button('Refresh', scan)); scan(); }]);
    }
    else if (id === 'modems' || id === 'hardware') {
        pages.push(['General', p => p.append(el('div', { class: 'row' }, icon('computer', 32), el('p', { text: 'Browser hardware services' })), el('p', { text: 'The desktop uses your browser’s display, keyboard, pointer, audio, and network connection.' }), el('p', { text: id === 'modems' ? 'Serial modems and telephone calls require a physical device bridge, which is not installed.' : 'Native Windows drivers cannot be installed in this JavaScript environment.' }), button('Device Manager…', () => s.launch('system')))]);
    }
    else if (id === 'folder-options') {
        pages.push(['Folder', p => { check(p, 'Display full path in the title bar', 'fullPath'); check(p, 'Show all files', 'allFiles', true); check(p, 'Show file extensions', 'extensions', true); }]);
    }
    else
        pages.push(['General', p => p.append(el('p', { text: meta[1] + ' settings are stored for this desktop.' }))]);
    w = propertySheet(s, meta[1] + ' Properties', meta[2], pages, 430, 390);
    w.apply = () => { s.settings.set('applet-' + id, draft); commits.forEach(f => f()); };
    return w;
}
