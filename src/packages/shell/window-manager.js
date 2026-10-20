import { el, dataText, onDoubleActivate } from '@win95/ui/dom.js';
import { icon } from '@win95/ui/icons.js';
import { popup, closeMenus } from '@win95/ui/menu.js';
import { closeCombos } from '@win95/ui/select.js';
import { flyTitleBar, rectOf, titleBarRect } from './minimize-animation.js';
import { taskbarHeight } from './taskbar-settings.js';
/**
 * A window's opening box, kept on the desktop.
 *
 * The width is capped to the viewport, so the offset has to be worked out from
 * the capped width, not the requested one: a 555px Notepad on a 360px desktop
 * used to be placed at x=96 from the unclamped width and hung 84px off the
 * right edge, with its Close button among the parts that could not be reached.
 * The familiar 96/25 insets are kept while there is room for them and give way
 * to the desktop edge when there is not; an explicit x or y is honoured the
 * same way.
 */
function placeOnDesktop(o, index = 0) {
    const width = Math.min(o.width, innerWidth - 12);
    const height = Math.min(o.height, innerHeight - 40);
    const cascade = index * 18 % 80;
    const keep = (value, room) => Math.max(0, Math.min(value, room));
    return {
        x: keep(o.x ?? Math.max(96, (innerWidth - width) / 2 + cascade), innerWidth - width),
        y: keep(o.y ?? Math.max(25, (innerHeight - 32 - height) / 2 + cascade), innerHeight - taskbarHeight() - height),
        width,
        height
    };
}
export class WindowManager extends EventTarget {
    constructor() { super(); this.primary = null; this.windows = []; this.sequence = 0; this.z = 10; this.active = null; this.host = document.querySelector('#windows'); this.tasks = document.querySelector('#tasks'); window.addEventListener('resize', () => this.fit()); document.addEventListener('keydown', e => this.keydown(e)); }
    create(options = {}) {
        const o = { width: 500, height: 350, minWidth: 230, minHeight: 130, resizable: true, ...options };
        const id = o.id || 'window-' + (++this.sequence);
        const index = this.windows.length;
        const w = { id, title: o.title || 'Untitled', icon: o.icon || 'task', options: o, minimized: false, maximized: false, closed: false, rect: placeOnDesktop(o, index), onClose: null, onClosed: [] };
        const node = el('section', { class: 'window' + (o.modal ? ' dialog-window' : ''), role: o.modal ? 'dialog' : 'region', 'aria-label': w.title, tabIndex: -1, 'data-window': id });
        const title = el('div', { class: 'title-bar' });
        const sys = el('button', { class: 'system-icon', 'aria-label': 'Window menu' }, icon(w.icon, 16));
        const label = el('span', { class: 'title-text', text: w.title });
        const controls = el('div', { class: 'title-controls' });
        const min = el('button', { class: 'caption-button minimize', 'aria-label': 'Minimize' }), max = el('button', { class: 'caption-button maximize', 'aria-label': 'Maximize' }), close = el('button', { class: 'caption-button close', 'aria-label': 'Close' });
        if (!o.modal) {
            controls.append(min);
            if (o.resizable)
                controls.append(max);
        }
        if (o.closable !== false)
            controls.append(close);
        title.append(sys, label, controls);
        const body = el('div', { class: 'window-body' });
        node.append(title, body);
        w.element = node;
        w.body = body;
        // { raw: true } is for a title that quotes the file system: a folder called System is
        // System, not 系统, in the title bar, on the taskbar and to a screen reader, or the window
        // would name its own contents differently from the list underneath them. Titles made of UI
        // strings - 'My Computer', 'Exploring - C:\' - keep translating, which is why the flag is
        // per call and not derived from the text.
        w.setTitle = (value, { raw = false } = {}) => {
            w.title = value; w.titleRaw = raw;
            label.textContent = value;
            if (raw) label.setAttribute('data-i18n-skip', ''); else label.removeAttribute('data-i18n-skip');
            node.setAttribute('aria-label', value);
            if (raw) node.setAttribute('data-i18n-skip-attrs', 'aria-label'); else node.removeAttribute('data-i18n-skip-attrs');
            const caption = () => w.task?.querySelector('.task-label')?.replaceChildren(raw ? dataText(value) : value);
            caption();
            w.task?.setAttribute('aria-label', value);
            if (raw) w.task?.setAttribute('data-i18n-skip-attrs', 'aria-label'); else w.task?.removeAttribute('data-i18n-skip-attrs');
        };
        w.focus = () => this.focus(w);
        w.minimize = () => this.minimize(w);
        w.maximize = () => this.maximize(w);
        w.restore = () => {
            /* Bringing a window back from the taskbar is not un-maximizing it:
               a window that was maximized when it went away comes back the way
               it was. Only a window that is already on screen is restored in
               the other sense - put back to the size it had before. */
            if (w.maximized && !w.minimized)
                this.maximize(w);
            else
                this.focus(w);
        };
        w.close = () => this.close(w);
        w.setMenu = menus => { w.menu?.remove(); w.menu = menus; body.before(menus); };
        w.status = text => {
            if (!w.statusbar) {
                w.statusbar = el('div', { class: 'status-bar' });
                node.append(w.statusbar);
            }
            w.statusbar.textContent = text;
        };
        sys.addEventListener('click', e => { e.stopPropagation(); const r = sys.getBoundingClientRect(); this.systemMenu(w, r.left, r.bottom); });
        if (o.closable !== false)
            onDoubleActivate(sys, () => w.close());
        title.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); this.systemMenu(w, e.clientX, e.clientY); };
        close.onclick = () => w.close();
        min.onclick = () => w.minimize();
        max.onclick = () => w.maximize();
        onDoubleActivate(title, e => {
            if (o.resizable && e.target !== sys && !controls.contains(e.target))
                w.maximize();
        });
        node.addEventListener('focusin', event => { if (body.contains(event.target))
            w.lastFocused = event.target; });
        node.addEventListener('pointerdown', () => this.focus(w), true);
        title.addEventListener('pointerdown', e => {
            if (!(this.primary ? this.primary(e) : e.button === 0) || controls.contains(e.target) || sys.contains(e.target) || w.maximized)
                return;
            this.drag(w, e, 'move');
        });
        if (o.resizable)
            for (const direction of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
                const handle = el('div', { class: 'resize-handle resize-' + direction });
                handle.addEventListener('pointerdown', e => this.drag(w, e, direction));
                node.append(handle);
            }
        if (!o.modal) {
            w.task = el('button', { class: 'task-button', 'aria-label': w.title, 'data-i18n-skip-attrs': w.titleRaw ? 'aria-label' : undefined }, icon(w.icon, 16), w.titleRaw ? el('span', { class: 'task-label' }, dataText(w.title)) : el('span', { class: 'task-label', text: w.title }));
            w.task.onclick = () => {
                if (this.active === w && !w.minimized)
                    this.minimize(w);
                else
                    this.focus(w);
            };
            w.task.oncontextmenu = e => { e.preventDefault(); this.systemMenu(w, e.clientX, e.clientY); };
            this.tasks.append(w.task);
        }
        if (o.modal && o.owner) {
            o.owner.element.inert = true;
            w.onClosed.push(() => {
                if (!this.windows.some(x => x !== w && !x.closed && x.options.modal && x.options.owner === o.owner))
                    o.owner.element.inert = false;
            });
        }
        this.windows.push(w);
        this.host.append(node);
        this.layout(w);
        this.focus(w);
        this.changed();
        return w;
    }
    frameOf(w) { return w.maximized ? { x: 0, y: 0, width: innerWidth, height: innerHeight - taskbarHeight() } : w.rect; }
    layout(w) { const r = this.frameOf(w); Object.assign(w.element.style, { left: Math.round(r.x) + 'px', top: Math.round(r.y) + 'px', width: Math.round(r.width) + 'px', height: Math.round(r.height) + 'px' }); }
    focus(w) {
        if (w.closed)
            return;
        const modal = this.windows.find(m => m.options.owner === w && m.options.modal && !m.closed);
        if (modal)
            return this.focus(modal);
        w.motion?.cancel();
        w.motion = null;
        const landing = w.minimized;
        /* A window that was sitting on the taskbar has to be kept off the
           screen until its bar arrives; one that is already drawn (it was
           caught in the middle of minimizing) stays drawn throughout. */
        const arriving = landing && w.element.hidden;
        if (w.minimized) {
            w.minimized = false;
            w.element.hidden = false;
        }
        this.active = w;
        w.element.style.zIndex = String(++this.z);
        for (const other of this.windows) {
            other.element.classList.toggle('active', other === w);
            other.task?.classList.toggle('active', other === w);
            other.task?.setAttribute('aria-pressed', String(other === w));
        }
        const settle = () => {
            if (!w.element.contains(document.activeElement)) {
                const target = w.lastFocused?.isConnected ? w.lastFocused : w.element;
                target.focus({ preventScroll: true });
            }
        };
        /* Arriving from the taskbar, the title bar grows back out of the button
           and the window appears under it as it lands, rather than hanging on
           screen while a second copy of its own title bar flies up to it. */
        if (landing) {
            const to = titleBarRect(w.element);
            const flight = flyTitleBar({ windowElement: w.element, from: rectOf(w.task), to, onDone: () => {
                    w.element.hidden = false;
                    w.motion = null;
                    settle();
                } });
            if (flight.animates) {
                if (arriving)
                    w.element.hidden = true;
                w.motion = flight;
            }
            else
                settle();
        }
        else
            settle();
        this.changed();
    }
    minimize(w) {
        if (w.options.modal || w.minimized)
            return;
        /* A window whose bar is still on its way somewhere lands first, so
           this flight starts from the box the window really occupies. */
        w.motion?.cancel();
        w.motion = null;
        const from = w.element.hidden ? null : titleBarRect(w.element);
        const to = rectOf(w.task);
        w.minimized = true;
        w.task?.classList.remove('active');
        if (this.active === w) {
            this.active = null;
            const next = this.windows.filter(x => !x.minimized && x !== w).sort((a, b) => (+b.element.style.zIndex) - (+a.element.style.zIndex))[0];
            if (next)
                this.focus(next);
        }
        /* The window keeps its place while a copy of its title bar travels to
           the button, and is taken off the screen when the copy lands. */
        w.motion?.cancel();
        const flight = flyTitleBar({ windowElement: w.element, from, to, onDone: () => {
                w.motion = null;
                if (w.minimized)
                    w.element.hidden = true;
            } });
        if (flight.animates)
            w.motion = flight;
        else
            w.element.hidden = true;
        this.changed();
    }
    /**
     * Maximizing moves the title bar, not the frame: a copy of the bar travels
     * from where the window stands to the top of the desktop, widening as it
     * goes, and the window takes the larger box at the moment the copy lands.
     * Restoring sends the bar back the same way. A window with nothing to
     * measure, or a reader who asked for less motion, changes box at once.
     */
    maximize(w) {
        if (!w.options.resizable)
            return;
        /* A bar that is still travelling lands first, so this click starts from
           the box the window is really in - and a second click during the
           flight means restore, not a second maximize. */
        w.motion?.cancel();
        w.motion = null;
        /* A window sitting on the taskbar comes back on screen first: there is
           no bar of its own on screen to send to the top otherwise. */
        if (w.minimized) {
            w.minimized = false;
            w.element.hidden = false;
            w.task?.classList.remove('active');
        }
        if (this.active !== w)
            this.focus(w);
        const from = w.element.hidden ? null : titleBarRect(w.element);
        const box = rectOf(w.element);
        const maximizing = !w.maximized;
        /* The flag flips now so the caption button and the menus agree with
           what the window is about to be, while the frame stays put until the
           bar arrives. */
        w.maximized = maximizing;
        w.element.classList.toggle('maximized', maximizing);
        const target = this.frameOf(w);
        /* The bar keeps the offset it has inside the frame, so the copy starts
           and ends exactly where the real bar would sit. */
        const to = from && box ? {
            left: target.x + from.left - box.left,
            top: target.y + from.top - box.top,
            width: Math.max(1, target.width - (box.width - from.width)),
            height: from.height
        } : null;
        const settle = () => {
            if (w.closed)
                return;
            w.motion = null;
            this.layout(w);
            const button = w.element.querySelector('.caption-button.maximize');
            button?.classList.toggle('restore', maximizing);
            button?.setAttribute('aria-label', maximizing ? 'Restore' : 'Maximize');
            this.changed();
        };
        const flight = flyTitleBar({ windowElement: w.element, from, to, onDone: settle });
        if (flight.animates)
            /* Clicking the window while its bar is on the way lands the move
               rather than leaving the frame at its old size. */
            w.motion = { animates: true, cancel: () => { flight.cancel(); settle(); } };
        else
            settle();
    }
    async close(w, force = false) {
        if (w.closed)
            return true;
        if (w.closing)
            return false;
        w.closing = true;
        try {
            if (!force && w.onClose && (await w.onClose()) === false)
                return false;
            for (const child of this.windows.filter(x => x.options.owner === w))
                await this.close(child, true);
            w.motion?.cancel();
            w.motion = null;
            w.closed = true;
            w.element.remove();
            /* A drop-down list is a child of the shared pop-up layer, not of the
               window, so it does not leave with the element it belongs to and
               would hang over whatever the window was covering. */
            closeCombos();
            w.task?.remove();
            w.onClosed.forEach(fn => fn());
            this.windows = this.windows.filter(x => x !== w);
            if (this.active === w) {
                this.active = null;
                const next = this.windows.filter(x => !x.minimized).sort((a, b) => (+b.element.style.zIndex) - (+a.element.style.zIndex))[0];
                if (next)
                    this.focus(next);
            }
            this.changed();
            return true;
        }
        finally {
            w.closing = false;
        }
    }
    drag(w, e, direction) {
        e.preventDefault();
        this.focus(w);
        closeMenus();
        const start = { ...w.rect, x0: e.clientX, y0: e.clientY };
        const target = e.currentTarget;
        try {
            target.setPointerCapture(e.pointerId);
        }
        catch { }
        // The pointer keeps the scheme's Move/Resize cursor for the whole
        // drag, even when the pointer leaves the title bar or the handle.
        if (direction === 'move')
            document.body.classList.add('dragging-cursor');
        else
            document.body.dataset.resize = direction;
        let raf = 0, last = null, done = false;
        const apply = () => {
            raf = 0;
            if (!last)
                return;
            const dx = last.clientX - start.x0, dy = last.clientY - start.y0;
            let { x, y, width, height } = start;
            if (direction === 'move') {
                x = Math.max(-width + 80, Math.min(innerWidth - 50, x + dx));
                y = Math.max(0, Math.min(innerHeight - taskbarHeight() - 35, y + dy));
            }
            else {
                if (direction.includes('e'))
                    width = Math.max(w.options.minWidth, Math.min(innerWidth - x, width + dx));
                if (direction.includes('s'))
                    height = Math.max(w.options.minHeight, Math.min(innerHeight - taskbarHeight() - y, height + dy));
                if (direction.includes('w')) {
                    width = Math.max(w.options.minWidth, Math.min(start.x + start.width, start.width - dx));
                    x = start.x + start.width - width;
                }
                if (direction.includes('n')) {
                    height = Math.max(w.options.minHeight, Math.min(start.y + start.height, start.height - dy));
                    y = start.y + start.height - height;
                }
            }
            w.rect = { x, y, width, height };
            this.layout(w);
        };
        const move = ev => {
            last = ev;
            if (!raf)
                raf = requestAnimationFrame(apply);
        };
        const up = () => {
            if (done)
                return;
            done = true;
            if (raf)
                cancelAnimationFrame(raf);
            apply();
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', up);
            target.removeEventListener('pointercancel', up);
            /* A drag interrupted by a vanishing capture target must still give
               the body its cursor back. */
            target.removeEventListener('lostpointercapture', up);
            document.body.classList.remove('dragging-cursor');
            delete document.body.dataset.resize;
            try {
                target.releasePointerCapture(e.pointerId);
            }
            catch { }
        };
        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', up);
        target.addEventListener('pointercancel', up);
        target.addEventListener('lostpointercapture', up);
    }
    systemMenu(w, x = w.rect.x + 3, y = w.rect.y + 21) { popup([{ label: 'Restore', disabled: !w.maximized && !w.minimized, action: () => w.restore() }, { label: 'Move', disabled: w.maximized, action: () => { w.element.focus(); w.moveKeys = true; } }, { label: 'Size', disabled: w.maximized || !w.options.resizable, action: () => { w.element.focus(); w.sizeKeys = true; } }, { label: 'Minimize', disabled: !!w.options.modal, action: () => w.minimize() }, { label: 'Maximize', disabled: w.maximized || !w.options.resizable, action: () => w.maximize() }, null, { label: 'Close', shortcut: 'Alt+F4', disabled: w.options.closable === false, action: () => w.close() }], x, y); }
    cascade() {
        let i = 0;
        for (const w of this.windows.filter(w => !w.options.modal)) {
            w.motion?.cancel();
            w.motion = null;
            w.maximized = false;
            w.minimized = false;
            w.element.hidden = false;
            w.rect = { ...w.rect, x: 100 + i * 24, y: 35 + i * 24 };
            this.layout(w);
            this.focus(w);
            i++;
        }
    }
    tile(vertical = true) { const wins = this.windows.filter(w => !w.minimized && !w.options.modal); wins.forEach((w, i) => { w.motion?.cancel(); w.motion = null; w.maximized = false; w.rect = vertical ? { x: i * innerWidth / wins.length, y: 0, width: innerWidth / wins.length, height: innerHeight - taskbarHeight() } : { x: 0, y: i * (innerHeight - taskbarHeight()) / wins.length, width: innerWidth, height: (innerHeight - taskbarHeight()) / wins.length }; this.layout(w); }); }
    fit() {
        for (const w of this.windows) {
            if (!w.options.allowOverflow) {
                w.rect.width = Math.min(w.rect.width, innerWidth);
                w.rect.height = Math.min(w.rect.height, innerHeight - taskbarHeight());
            }
            /* The edges are measured against the size the window has now, not
               the 80px of strip the drag lets hang over: shrinking the browser
               used to leave a window 235px past the right edge. */
            w.rect.x = Math.max(0, Math.min(w.rect.x, innerWidth - w.rect.width));
            w.rect.y = Math.max(0, Math.min(w.rect.y, innerHeight - taskbarHeight() - w.rect.height));
            this.layout(w);
        }
    }
    keydown(e) {
        const w = this.active;
        if (e.altKey && e.key === 'F4' && w) {
            e.preventDefault();
            if (w.options.closable !== false)
                w.close();
        }
        else if (e.altKey && e.code === 'Space' && w) {
            e.preventDefault();
            this.systemMenu(w);
        }
        else if (e.altKey && e.key === 'Tab') {
            e.preventDefault();
            const a = this.windows.filter(x => !x.options.modal);
            if (a.length)
                this.focus(a[(a.indexOf(w) + (e.shiftKey ? a.length - 1 : 1)) % a.length]);
        }
        else if (w && (w.moveKeys || w.sizeKeys)) {
            if (e.key.startsWith('Arrow')) {
                e.preventDefault();
                const d = e.shiftKey ? 1 : 8, dx = e.key === 'ArrowRight' ? d : e.key === 'ArrowLeft' ? -d : 0, dy = e.key === 'ArrowDown' ? d : e.key === 'ArrowUp' ? -d : 0;
                /* The same stops the mouse drag uses: a strip of the window
                   must stay on the desktop, or its caption - the handle that
                   would bring it back - is gone with it. */
                if (w.moveKeys) {
                    w.rect.x = Math.max(-w.rect.width + 80, Math.min(innerWidth - 50, w.rect.x + dx));
                    w.rect.y = Math.max(0, Math.min(innerHeight - taskbarHeight() - 35, w.rect.y + dy));
                }
                else {
                    w.rect.width = Math.max(w.options.minWidth, Math.min(innerWidth - w.rect.x, w.rect.width + dx));
                    w.rect.height = Math.max(w.options.minHeight, Math.min(innerHeight - taskbarHeight() - w.rect.y, w.rect.height + dy));
                }
                this.layout(w);
            }
            if (e.key === 'Enter' || e.key === 'Escape') {
                w.moveKeys = false;
                w.sizeKeys = false;
            }
        }
    }
    changed() { this.dispatchEvent(new Event('change')); }
}
