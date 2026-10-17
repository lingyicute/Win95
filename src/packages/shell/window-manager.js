import { el, onDoubleActivate } from '@win95/ui/dom.js';
import { icon } from '@win95/ui/icons.js';
import { popup, closeMenus } from '@win95/ui/menu.js';
export class WindowManager extends EventTarget {
    constructor() { super(); this.primary = null; this.windows = []; this.sequence = 0; this.z = 10; this.active = null; this.host = document.querySelector('#windows'); this.tasks = document.querySelector('#tasks'); window.addEventListener('resize', () => this.fit()); document.addEventListener('keydown', e => this.keydown(e)); }
    create(options = {}) {
        const o = { width: 500, height: 350, minWidth: 230, minHeight: 130, resizable: true, ...options };
        const id = o.id || 'window-' + (++this.sequence);
        const index = this.windows.length;
        const w = { id, title: o.title || 'Untitled', icon: o.icon || 'task', options: o, minimized: false, maximized: false, closed: false, rect: { x: o.x ?? Math.max(96, (innerWidth - o.width) / 2 + index * 18 % 80), y: o.y ?? Math.max(25, (innerHeight - 32 - o.height) / 2 + index * 18 % 80), width: Math.min(o.width, innerWidth - 12), height: Math.min(o.height, innerHeight - 40) }, onClose: null, onClosed: [] };
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
        w.setTitle = value => { w.title = value; label.textContent = value; node.setAttribute('aria-label', value); w.task?.querySelector('.task-label')?.replaceChildren(value); w.task?.setAttribute('aria-label', value); };
        w.focus = () => this.focus(w);
        w.minimize = () => this.minimize(w);
        w.maximize = () => this.maximize(w);
        w.restore = () => {
            if (w.minimized) {
                w.minimized = false;
                node.hidden = false;
            }
            if (w.maximized)
                this.maximize(w);
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
            w.task = el('button', { class: 'task-button', 'aria-label': w.title }, icon(w.icon, 16), el('span', { class: 'task-label', text: w.title }));
            w.task.onclick = () => { if (this.active === w && !w.minimized)
                this.minimize(w);
            else {
                w.minimized = false;
                w.element.hidden = false;
                this.focus(w);
            } };
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
    layout(w) { const r = w.maximized ? { x: 0, y: 0, width: innerWidth, height: innerHeight - 30 } : w.rect; Object.assign(w.element.style, { left: Math.round(r.x) + 'px', top: Math.round(r.y) + 'px', width: Math.round(r.width) + 'px', height: Math.round(r.height) + 'px' }); }
    focus(w) {
        if (w.closed)
            return;
        const modal = this.windows.find(m => m.options.owner === w && m.options.modal && !m.closed);
        if (modal)
            return this.focus(modal);
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
        if (!w.element.contains(document.activeElement)) {
            const target = w.lastFocused?.isConnected ? w.lastFocused : w.element;
            target.focus({ preventScroll: true });
        }
        this.changed();
    }
    minimize(w) {
        if (w.options.modal)
            return;
        w.minimized = true;
        w.element.hidden = true;
        w.task?.classList.remove('active');
        if (this.active === w) {
            this.active = null;
            const next = this.windows.filter(x => !x.minimized && x !== w).sort((a, b) => (+b.element.style.zIndex) - (+a.element.style.zIndex))[0];
            if (next)
                this.focus(next);
        }
        this.changed();
    }
    maximize(w) {
        if (!w.options.resizable)
            return;
        w.maximized = !w.maximized;
        w.element.classList.toggle('maximized', w.maximized);
        const b = w.element.querySelector('.caption-button.maximize');
        b?.classList.toggle('restore', w.maximized);
        b?.setAttribute('aria-label', w.maximized ? 'Restore' : 'Maximize');
        this.layout(w);
        this.focus(w);
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
            w.closed = true;
            w.element.remove();
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
        target.setPointerCapture(e.pointerId);
        // The pointer keeps the scheme's Move/Resize cursor for the whole
        // drag, even when the pointer leaves the title bar or the handle.
        if (direction === 'move')
            document.body.classList.add('dragging-cursor');
        else
            document.body.dataset.resize = direction;
        let raf = 0, last = null;
        const apply = () => {
            raf = 0;
            if (!last)
                return;
            const dx = last.clientX - start.x0, dy = last.clientY - start.y0;
            let { x, y, width, height } = start;
            if (direction === 'move') {
                x = Math.max(-width + 80, Math.min(innerWidth - 50, x + dx));
                y = Math.max(0, Math.min(innerHeight - 65, y + dy));
            }
            else {
                if (direction.includes('e'))
                    width = Math.max(w.options.minWidth, Math.min(innerWidth - x, width + dx));
                if (direction.includes('s'))
                    height = Math.max(w.options.minHeight, Math.min(innerHeight - 30 - y, height + dy));
                if (direction.includes('w')) {
                    width = Math.max(w.options.minWidth, start.width - dx);
                    x = start.x + start.width - width;
                }
                if (direction.includes('n')) {
                    height = Math.max(w.options.minHeight, start.height - dy);
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
            if (raf)
                cancelAnimationFrame(raf);
            apply();
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', up);
            target.removeEventListener('pointercancel', up);
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
    }
    systemMenu(w, x = w.rect.x + 3, y = w.rect.y + 21) { popup([{ label: 'Restore', disabled: !w.maximized && !w.minimized, action: () => w.restore() }, { label: 'Move', disabled: w.maximized, action: () => { w.element.focus(); w.moveKeys = true; } }, { label: 'Size', disabled: w.maximized || !w.options.resizable, action: () => { w.element.focus(); w.sizeKeys = true; } }, { label: 'Minimize', disabled: !!w.options.modal, action: () => w.minimize() }, { label: 'Maximize', disabled: w.maximized || !w.options.resizable, action: () => w.maximize() }, null, { label: 'Close', shortcut: 'Alt+F4', disabled: w.options.closable === false, action: () => w.close() }], x, y); }
    cascade() {
        let i = 0;
        for (const w of this.windows.filter(w => !w.options.modal)) {
            w.maximized = false;
            w.minimized = false;
            w.element.hidden = false;
            w.rect = { ...w.rect, x: 100 + i * 24, y: 35 + i * 24 };
            this.layout(w);
            this.focus(w);
            i++;
        }
    }
    tile(vertical = true) { const wins = this.windows.filter(w => !w.minimized && !w.options.modal); wins.forEach((w, i) => { w.maximized = false; w.rect = vertical ? { x: i * innerWidth / wins.length, y: 0, width: innerWidth / wins.length, height: innerHeight - 30 } : { x: 0, y: i * (innerHeight - 30) / wins.length, width: innerWidth, height: (innerHeight - 30) / wins.length }; this.layout(w); }); }
    fit() {
        for (const w of this.windows) {
            w.rect.x = Math.max(0, Math.min(w.rect.x, innerWidth - 80));
            w.rect.y = Math.max(0, Math.min(w.rect.y, innerHeight - 70));
            if (!w.options.allowOverflow) {
                w.rect.width = Math.min(w.rect.width, innerWidth);
                w.rect.height = Math.min(w.rect.height, innerHeight - 30);
            }
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
                if (w.moveKeys) {
                    w.rect.x += dx;
                    w.rect.y += dy;
                }
                else {
                    w.rect.width = Math.max(w.options.minWidth, w.rect.width + dx);
                    w.rect.height = Math.max(w.options.minHeight, w.rect.height + dy);
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
