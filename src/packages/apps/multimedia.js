import { el, button, field, fileInput, download, uniqueId } from '@win95/ui/dom.js';
import { icon } from '@win95/ui/icons.js';
import { menuBar } from '@win95/ui/menu.js';
import { baseName } from '@win95/core/filesystem.js';
function waveTone() {
    const sampleRate = 22050, seconds = 5, count = sampleRate * seconds, buffer = new ArrayBuffer(44 + count * 2), v = new DataView(buffer);
    const str = (offset, s) => [...s].forEach((c, i) => v.setUint8(offset + i, c.charCodeAt(0)));
    str(0, 'RIFF');
    v.setUint32(4, 36 + count * 2, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    str(36, 'data');
    v.setUint32(40, count * 2, true);
    const notes = [261.63, 329.63, 392, 523.25, 392, 329.63, 293.66, 261.63];
    for (let i = 0; i < count; i++) {
        const t = i / sampleRate, step = Math.min(7, Math.floor(t / .625)), local = t % 0.625, env = Math.min(1, local / .015) * Math.max(0, 1 - local / .625);
        const n = Math.sin(t * notes[step] * Math.PI * 2) + .2 * Math.sin(t * notes[step] * Math.PI * 4);
        v.setInt16(44 + i * 2, n * env * 5500, true);
    }
    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}
export function mediaPlayer(s, args = {}) {
    const cd = !!args.cd;
    const w = s.wm.create({ title: cd ? 'CD Player' : 'Media Player', icon: cd ? 'cd' : 'media', width: 440, height: 315 });
    w.body.classList.add('media-body');
    const media = el('video', { preload: 'metadata', playsInline: true }), display = el('div', { class: 'media-display' }, media), slider = el('input', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Playback position' }), time = el('span', { text: '00:00 / 00:00' });
    let srcUrl = null;
    const applyVolume = () => { media.volume = s.settings.get('muted', false) ? 0 : s.settings.get('volume', 65) / 100; };
    applyVolume();
    const load = (url, name) => {
        if (srcUrl?.startsWith('blob:'))
            URL.revokeObjectURL(srcUrl);
        srcUrl = url;
        media.src = url;
        w.setTitle(`${name} - ${cd ? 'CD Player' : 'Media Player'}`);
        w.status('Ready');
    };
    const play = () => media.play().then(() => w.status('Playing')).catch(() => s.ui.message('This media cannot be played. Choose an audio or video file supported by your browser.', 'Media Player', ['OK'], { owner: w }));
    const stop = () => { media.pause(); media.currentTime = 0; w.status('Stopped'); };
    const open = async () => {
        const p = await s.ui.file({ owner: w, type: 'Media files (*.wav, *.mp3, *.mp4, *.webm)' });
        if (p) {
            load(s.fs.read(p), baseName(p));
        }
    };
    const format = x => !Number.isFinite(x) ? '00:00' : String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(Math.floor(x % 60)).padStart(2, '0');
    media.ontimeupdate = () => { slider.value = String(media.duration ? media.currentTime / media.duration * 1000 : 0); time.textContent = `${format(media.currentTime)} / ${format(media.duration)}`; };
    media.onloadedmetadata = media.ontimeupdate;
    slider.oninput = () => {
        if (Number.isFinite(media.duration))
            media.currentTime = Number(slider.value) / 1000 * media.duration;
    };
    media.onended = () => w.status('Stopped');
    w.body.append(display, slider, el('div', { class: 'media-controls' }, button('▶', play, { 'aria-label': 'Play' }), button('Ⅱ', () => { media.pause(); w.status('Paused'); }, { 'aria-label': 'Pause' }), button('■', stop, { 'aria-label': 'Stop' }), button('◀◀', () => media.currentTime = Math.max(0, media.currentTime - 10), { 'aria-label': 'Rewind' }), button('▶▶', () => media.currentTime = Math.min(media.duration || 0, media.currentTime + 10), { 'aria-label': 'Fast forward' }), el('span', { class: 'spacer' }), time));
    w.setMenu(menuBar([{ label: 'File', items: [{ label: 'Open…', shortcut: 'Ctrl+O', action: open }, { label: 'Import from Computer…', action: () => fileInput('audio/*,video/*', f => load(URL.createObjectURL(f), f.name)) }, { label: 'Play sample', action: () => { load(waveTone(), 'Windows Chimes'); play(); } }, null, { label: 'Exit', action: () => w.close() }] }, { label: 'Device', items: [{ label: 'Wave Audio', action: () => fileInput('audio/*', f => load(URL.createObjectURL(f), f.name)) }, { label: 'Video', action: () => fileInput('video/*', f => load(URL.createObjectURL(f), f.name)) }, { label: 'CD Audio', action: () => { load(waveTone(), 'Track 01 — Windows Chimes'); } }] }, { label: 'Options', items: () => [{ label: 'Repeat', checked: media.loop, action: () => media.loop = !media.loop }, { label: 'Volume Control…', action: () => s.launch('volume') }] }, { label: 'Help', items: [{ label: 'About Media Player', action: () => s.about(cd ? 'CD Player' : 'Media Player', 'media') }] }]));
    const change = () => applyVolume();
    s.settings.addEventListener('change', change);
    w.onClosed.push(() => {
        media.pause();
        media.src = '';
        if (srcUrl?.startsWith('blob:'))
            URL.revokeObjectURL(srcUrl);
        s.settings.removeEventListener('change', change);
    });
    if (args.path)
        load(s.fs.read(args.path), baseName(args.path));
    else {
        load(waveTone(), cd ? 'Track 01 — Windows Chimes' : 'Windows Chimes');
        display.append(el('div', { class: 'media-title', style: { position: 'absolute', pointerEvents: 'none', textAlign: 'center' } }, icon(cd ? 'cd' : 'media', 32), el('p', { text: 'Windows Chimes', style: { marginTop: '10px', color: '#c0c0c0' } })));
    }
    return w;
}
function win95Trackbar({ label, orientation = 'horizontal', min = 0, max = 100, step = 1, pageStep = 10, value = 0, valueText, onChange }) {
    const vertical = orientation === 'vertical';
    const clamp = next => Math.min(max, Math.max(min, Number(next) || 0));
    let current = clamp(value);
    const thumb = el('div', { class: 'win95-trackbar-thumb', 'aria-hidden': 'true' });
    const ticks = el('div', { class: 'win95-trackbar-ticks', 'aria-hidden': 'true' });
    for (const tickRatio of vertical ? [0, .2, .4, .6, .8, 1] : [0, .5, 1]) {
        if (vertical) {
            for (const side of ['left', 'right']) {
                const tick = el('span', { class: `win95-trackbar-tick ${side}` });
                tick.style.top = `${(1 - tickRatio) * 100}%`;
                ticks.append(tick);
            }
        }
        else {
            const tick = el('span', { class: 'win95-trackbar-tick' });
            tick.style.left = `${tickRatio * 100}%`;
            ticks.append(tick);
        }
    }
    const root = el('div', {
        class: `win95-trackbar ${orientation}`,
        role: 'slider',
        tabindex: '0',
        'aria-label': label,
        'aria-orientation': orientation,
        'aria-valuemin': String(min),
        'aria-valuemax': String(max)
    }, ticks, el('div', { class: 'win95-trackbar-track', 'aria-hidden': 'true' }), thumb);
    const ratio = () => (current - min) / (max - min);
    const render = () => {
        const r = ratio();
        if (vertical) {
            thumb.style.left = '50%';
            thumb.style.top = root.clientHeight ? `${8 + (1 - r) * (root.clientHeight - 16)}px` : `${(1 - r) * 100}%`;
        }
        else {
            thumb.style.top = '50%';
            thumb.style.left = root.clientWidth ? `${11 + r * (root.clientWidth - 22)}px` : `${r * 100}%`;
        }
        root.setAttribute('aria-valuenow', String(current));
        root.setAttribute('aria-valuetext', valueText ? valueText(current) : String(current));
    };
    const setValue = next => {
        const stepped = clamp(Math.round((clamp(next) - min) / step) * step + min);
        const normalized = Object.is(stepped, -0) ? 0 : stepped;
        if (normalized !== current) {
            current = normalized;
            onChange?.(current);
        }
        render();
    };
    const valueFromPointer = event => {
        const rect = root.getBoundingClientRect();
        if (vertical) {
            const travel = Math.max(1, rect.height - 16);
            return min + (rect.bottom - 8 - event.clientY) / travel * (max - min);
        }
        const travel = Math.max(1, rect.width - 22);
        return min + (event.clientX - rect.left - 11) / travel * (max - min);
    };
    let dragging = false;
    root.addEventListener('pointerdown', event => {
        if (event.button !== undefined && event.button !== 0)
            return;
        dragging = true;
        root.setPointerCapture?.(event.pointerId);
        root.focus({ preventScroll: true });
        setValue(valueFromPointer(event));
        event.preventDefault();
    });
    root.addEventListener('pointermove', event => {
        if (dragging)
            setValue(valueFromPointer(event));
    });
    const stopDrag = () => { dragging = false; };
    root.addEventListener('pointerup', stopDrag);
    root.addEventListener('pointercancel', stopDrag);
    root.addEventListener('keydown', event => {
        const increments = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step, PageDown: -pageStep, PageUp: pageStep };
        if (event.key === 'Home') {
            event.preventDefault();
            setValue(min);
        }
        else if (event.key === 'End') {
            event.preventDefault();
            setValue(max);
        }
        else if (Object.hasOwn(increments, event.key)) {
            event.preventDefault();
            setValue(current + increments[event.key]);
        }
    });
    render();
    requestAnimationFrame(render);
    return root;
}
function volumeSpeaker(side) {
    const speaker = el('span', { class: `volume-speaker ${side}`, 'aria-hidden': 'true' });
    speaker.innerHTML = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path d="M1 6h3l4-4v12L4 10H1z" fill="#ffff66" stroke="#000"/><path d="M10 5.5c1.6 1.4 1.6 3.6 0 5" fill="none" stroke="#000"/></svg>';
    return speaker;
}
export function volumeControl(s) {
    const w = s.wm.create({ title: 'Volume Control', icon: 'volume', width: 395, height: 278, resizable: false });
    const area = el('div', { class: 'volume-controls' });
    for (const [name, key] of [['Volume Control', 'volume'], ['Wave', 'waveVolume'], ['MIDI', 'midiVolume'], ['CD Audio', 'cdVolume']]) {
        const muteKey = key === 'volume' ? 'muted' : `${key}Muted`;
        const balanceKey = key === 'volume' ? 'balance' : key.replace(/Volume$/, 'Balance');
        const balance = win95Trackbar({
            label: `${name} balance`,
            orientation: 'horizontal',
            min: -50,
            max: 50,
            value: s.settings.get(balanceKey, 0),
            valueText: value => value === 0 ? 'Center' : value < 0 ? `Left ${-value}` : `Right ${value}`,
            onChange: value => s.settings.set(balanceKey, value)
        });
        const volume = win95Trackbar({
            label: `${name} volume`,
            value: s.settings.get(key, 65),
            orientation: 'vertical',
            valueText: value => `${value} percent`,
            onChange: value => s.settings.set(key, value)
        });
        const muted = el('input', { type: 'checkbox', checked: s.settings.get(muteKey, false), 'aria-label': `${name} mute`, onchange: e => s.settings.set(muteKey, e.target.checked) });
        area.append(el('div', { class: 'volume-channel' },
            el('div', { class: 'volume-channel-title', text: name }),
            el('div', { class: 'volume-control-label', text: 'Balance:' }),
            el('div', { class: 'volume-balance-row' }, volumeSpeaker('left'), balance, volumeSpeaker('right')),
            el('div', { class: 'volume-control-label', text: 'Volume:' }),
            volume,
            el('label', { class: 'volume-mute' }, muted, el('span', { class: 'volume-mute-text', text: key === 'volume' ? 'Mute all' : 'Mute' }))));
    }
    w.body.append(area);
    w.setMenu(menuBar([{ label: 'Options', items: [{ label: 'Properties', action: () => s.launch('sounds') }, { label: 'Exit', action: () => w.close() }] }, { label: 'Help', items: [{ label: 'About Volume Control', action: () => s.about('Volume Control', 'volume') }] }]));
    return w;
}
export function soundRecorder(s) {
    const w = s.wm.create({ title: 'Sound - Sound Recorder', icon: 'sound', width: 405, height: 245, resizable: false });
    w.body.style.padding = '10px';
    w.body.style.gap = '10px';
    const canvas = el('canvas', { class: 'sound-wave', width: 380, height: 75 }), ctx = canvas.getContext('2d'), info = el('div', { class: 'row' }, el('span', { text: 'Position: 0.00 sec.' }), el('span', { class: 'spacer' }), el('span', { text: 'Length: 0.00 sec.' }));
    let recording = null, stream = null, chunks = [], url = null, blob = null, started = 0, frame = 0, analyser = null, audioContext = null;
    const audio = el('audio');
    const draw = () => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 380, 75);
        ctx.strokeStyle = '#00ff00';
        ctx.beginPath();
        if (analyser) {
            const data = new Uint8Array(analyser.fftSize);
            analyser.getByteTimeDomainData(data);
            for (let i = 0; i < 380; i++) {
                const v = data[Math.floor(i / 380 * data.length)] / 255 * 75;
                i ? ctx.lineTo(i, v) : ctx.moveTo(i, v);
            }
            info.firstChild.textContent = 'Position: ' + ((Date.now() - started) / 1000).toFixed(2) + ' sec.';
        }
        else {
            ctx.moveTo(0, 37);
            ctx.lineTo(380, 37);
        }
        ctx.stroke();
        if (recording?.state === 'recording')
            frame = requestAnimationFrame(draw);
    };
    const stop = () => {
        if (recording?.state === 'recording') {
            recording.stop();
            stream?.getTracks().forEach(t => t.stop());
            analyser = null;
            audioContext?.close();
            cancelAnimationFrame(frame);
            draw();
        }
        audio.pause();
    };
    const record = async () => {
        if (recording?.state === 'recording')
            return;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new AudioContext();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 512;
            audioContext.createMediaStreamSource(stream).connect(analyser);
            recording = new MediaRecorder(stream);
            chunks = [];
            recording.ondataavailable = e => chunks.push(e.data);
            recording.onstop = () => {
                blob = new Blob(chunks, { type: recording.mimeType || 'audio/webm' });
                if (url)
                    URL.revokeObjectURL(url);
                url = URL.createObjectURL(blob);
                audio.src = url;
                info.lastChild.textContent = 'Length: ' + ((Date.now() - started) / 1000).toFixed(2) + ' sec.';
            };
            started = Date.now();
            recording.start();
            draw();
        }
        catch (e) {
            stream?.getTracks().forEach(t => t.stop());
            s.ui.message('The microphone could not be opened. Allow microphone access in your browser and try again.', 'Sound Recorder', ['OK'], { owner: w, height: 185 });
        }
    };
    const save = async () => {
        if (!blob) {
            s.ui.message('Record a sound first.', 'Sound Recorder', ['OK'], { owner: w });
            return;
        }
        const p = await s.ui.file({ save: true, name: 'Sound.webm', extension: '.webm', type: 'Recorded Audio (*.webm)', owner: w });
        if (p) {
            const data = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
            s.fs.write(p, data, blob.type);
            w.setTitle(baseName(p) + ' - Sound Recorder');
        }
    };
    w.body.append(canvas, info, el('div', { class: 'media-controls' }, button('◀◀', () => { audio.currentTime = 0; }, { 'aria-label': 'Rewind' }), button('▶▶', () => {
        if (Number.isFinite(audio.duration))
            audio.currentTime = audio.duration;
    }, { 'aria-label': 'Go to end' }), button('▶', () => {
        if (url)
            audio.play().catch(() => { });
    }, { 'aria-label': 'Play' }), button('■', stop, { 'aria-label': 'Stop' }), button('●', record, { 'aria-label': 'Record', style: { color: '#f00' } })));
    w.setMenu(menuBar([{ label: 'File', items: [{ label: 'New', action: () => { stop(); blob = null; audio.src = ''; w.setTitle('Sound - Sound Recorder'); info.lastChild.textContent = 'Length: 0.00 sec.'; } }, { label: 'Save As…', action: save }, { label: 'Export…', action: () => {
                        if (url)
                            download('Sound.webm', url, blob.type);
                    } }, null, { label: 'Exit', action: () => w.close() }] }, { label: 'Options', items: [{ label: 'Audio Properties', action: () => s.launch('multimedia') }] }, { label: 'Help', items: [{ label: 'About Sound Recorder', action: () => s.about('Sound Recorder', 'sound') }] }]));
    draw();
    w.onClosed.push(() => {
        stop();
        if (url)
            URL.revokeObjectURL(url);
    });
    return w;
}
export function internet(s, args = {}) {
    const w = s.wm.create({ title: 'Microsoft Internet Explorer', icon: 'internet', width: 705, height: 475 });
    const toolbar = el('div', { class: 'internet-toolbar' }), address = el('input', { 'aria-label': 'Address', value: 'about:home' }), page = el('div', { class: 'internet-page' });
    let history = [], index = -1;
    const navigate = (url, push = true) => {
        if (push) {
            history = history.slice(0, index + 1);
            history.push(url);
            index++;
        }
        address.value = url;
        page.replaceChildren();
        if (url === 'about:home' || !url) {
            page.innerHTML = '<h1>Welcome to the Internet</h1><hr><h2>Microsoft Internet Explorer</h2><p>The world is at your fingertips.</p><p>Enter an address above to explore the World Wide Web, or open an HTML document from your C: drive.</p><hr><h3>Your computer</h3>';
            for (const n of s.fs.search('\\.htm')) {
                const a = el('a', { href: '#', text: baseName(n.path), onclick: e => { e.preventDefault(); navigate(n.path); } });
                page.append(el('p', {}, a));
            }
            page.append(el('p', {}, el('a', { href: '#', text: 'Browse your documents', onclick: e => { e.preventDefault(); s.launch('explorer', { path: 'C:\\My Documents' }); } })));
        }
        else if (s.fs.exists(url)) {
            const frame = el('iframe', { title: baseName(url), sandbox: '', srcdoc: s.fs.read(url), style: { width: '100%', height: '100%', border: 0 } });
            page.append(frame);
        }
        else {
            let parsed;
            try {
                parsed = new URL(url.includes('://') ? url : 'https://' + url);
                if (!['https:', 'http:'].includes(parsed.protocol))
                    throw new Error();
            }
            catch {
                s.ui.message('The Internet address is not valid.', 'Internet Explorer', ['OK'], { owner: w });
                return;
            }
            address.value = parsed.href;
            page.style.padding = '0';
            const notice = el('div', { style: { padding: '5px 8px', background: '#ffffe1', font: '12px var(--ui-font)' } }, 'If the website does not allow embedded viewing, ', el('a', { href: parsed.href, target: '_blank', rel: 'noopener noreferrer', text: 'open it in a browser tab' }), '.');
            page.append(notice, el('iframe', { title: 'Website', src: parsed.href, sandbox: 'allow-scripts allow-forms allow-popups', referrerPolicy: 'no-referrer', style: { width: '100%', height: 'calc(100% - 34px)', border: 0, background: '#fff' } }));
        }
        w.status(url === 'about:home' ? 'Done' : url);
    };
    toolbar.append(button('Back', () => {
        if (index > 0)
            navigate(history[--index], false);
    }), button('Forward', () => {
        if (index < history.length - 1)
            navigate(history[++index], false);
    }), button('Home', () => navigate('about:home')), button('Refresh', () => navigate(address.value, false)), button('Open…', async () => {
        const p = await s.ui.file({ owner: w, type: 'HTML Files (*.htm, *.html)' });
        if (p)
            navigate(p);
    }));
    const bar = el('form', { class: 'internet-address', onsubmit: e => { e.preventDefault(); navigate(address.value); } }, el('label', { text: 'Address:' }), address, el('button', { text: 'Go', type: 'submit' }));
    w.body.append(toolbar, bar, page);
    w.setMenu(menuBar([{ label: 'File', items: [{ label: 'Open…', action: async () => {
                        const a = await s.ui.prompt('Open:', 'https://', 'Open', { owner: w });
                        if (a)
                            navigate(a);
                    } }, { label: 'Close', action: () => w.close() }] }, { label: 'View', items: [{ label: 'Refresh', action: () => navigate(address.value, false) }, { label: 'Source', action: () => {
                        if (s.fs.exists(address.value))
                            s.launch('notepad', { path: address.value });
                    } }] }, { label: 'Favorites', items: () => [{ label: 'Add to Favorites…', action: () => {
                        const fav = s.settings.get('favorites', []);
                        if (!fav.includes(address.value)) {
                            fav.push(address.value);
                            s.settings.set('favorites', fav);
                        }
                    } }, null, ...s.settings.get('favorites', []).map(url => ({ label: url, action: () => navigate(url) }))] }, { label: 'Help', items: [{ label: 'About Internet Explorer', action: () => s.about('Internet Explorer', 'internet') }] }]));
    navigate(args.path || 'about:home');
    return w;
}
export function inbox(s) {
    const w = s.wm.create({ title: 'Inbox - Microsoft Exchange', icon: 'mail', width: 685, height: 430 });
    let folder = 'Inbox';
    const messages = s.settings.get('mailMessages', [{ id: 'welcome', folder: 'Inbox', from: 'Windows 95', to: 'Windows User', subject: 'Welcome to your Inbox', body: 'Welcome to Microsoft Exchange.\n\nCompose messages and keep drafts here. Messages placed in the Outbox remain local until a mail transport is configured.\n\nYour Windows 95 desktop' }]);
    const toolbar = el('div', { class: 'explorer-toolbar' }), layout = el('div', { class: 'mail-layout' }), folders = el('div', { class: 'mail-folders inset' }), content = el('div', { class: 'mail-messages inset' }), list = el('div', { class: 'mail-list' }), preview = el('div', { class: 'mail-preview' });
    let selected = null;
    const render = () => {
        folders.replaceChildren();
        for (const f of ['Inbox', 'Outbox', 'Sent Items', 'Deleted Items', 'Drafts'])
            folders.append(el('button', { class: 'tree-item' + (f === folder ? ' selected' : ''), onclick: () => { folder = f; selected = null; render(); } }, icon('folder', 16), f));
        list.replaceChildren();
        const items = messages.filter(m => m.folder === folder);
        for (const m of items)
            list.append(button(`${m.from || m.to}    ${m.subject}`, () => { selected = m; render(); }, { class: selected === m ? 'pressed' : '' }));
        if (!selected && items.length)
            selected = items[0];
        preview.replaceChildren();
        if (selected)
            preview.append(el('p', {}, el('b', { text: 'From: ' }), selected.from || 'Windows User'), el('p', {}, el('b', { text: 'To: ' }), selected.to), el('p', {}, el('b', { text: 'Subject: ' }), selected.subject), el('div', { class: 'separator' }), el('div', { text: selected.body, style: { whiteSpace: 'pre-wrap' } }));
        else
            preview.append(el('p', { text: 'There are no items in this folder.' }));
        w.status(`${items.length} item(s)`);
    };
    const save = () => { s.settings.set('mailMessages', messages); render(); };
    const compose = () => {
        const c = s.wm.create({ title: 'Untitled - Message', icon: 'mail', width: 550, height: 355 });
        c.body.style.padding = '8px';
        c.body.style.gap = '6px';
        const to = el('input', { 'aria-label': 'To' }), subject = el('input', { 'aria-label': 'Subject' }), body = el('textarea', { class: 'notepad-editor', 'aria-label': 'Message body' });
        let saved = false;
        const store = target => {
            messages.push({ id: uniqueId(), from: s.settings.get('owner', 'Windows User'), to: to.value, subject: subject.value || '(No subject)', body: body.value, folder: target });
            saved = true;
            save();
            c.close();
            if (target === 'Outbox')
                s.ui.message('The message is saved in the Outbox. A mail transport is required to deliver it.', 'Microsoft Exchange', ['OK'], { owner: w, height: 185 });
        };
        c.body.append(el('div', { class: 'row' }, button('Send', () => store('Outbox')), button('Save Draft', () => store('Drafts'))), field('To:', to), field('Subject:', subject), body);
        c.onClose = async () => {
            if (saved || !body.value)
                return true;
            const r = await s.ui.message('Save this message in Drafts?', 'Microsoft Exchange', ['Yes', 'No', 'Cancel'], { owner: c });
            if (r === 'Yes') {
                messages.push({ id: uniqueId(), from: s.settings.get('owner', 'Windows User'), to: to.value, subject: subject.value || '(No subject)', body: body.value, folder: 'Drafts' });
                save();
                return true;
            }
            return r === 'No';
        };
    };
    toolbar.append(button('New Message', compose), button('Delete', () => {
        if (selected) {
            selected.folder = 'Deleted Items';
            selected = null;
            save();
        }
    }), button('Reply', () => compose()), button('Address Book', () => s.launch('addressbook')));
    content.append(list, preview);
    layout.append(folders, content);
    w.body.append(toolbar, layout);
    w.setMenu(menuBar([{ label: 'File', items: [{ label: 'New Message', action: compose }, { label: 'Close', action: () => w.close() }] }, { label: 'View', items: [{ label: 'Refresh', action: render }] }, { label: 'Help', items: [{ label: 'About Microsoft Exchange', action: () => s.about('Microsoft Exchange', 'mail') }] }]));
    render();
    return w;
}
