import { el, separator } from './dom.js';
import { icon } from './icons.js';
let openMenus = [], origin = null;
/**
 * Windows 95 answers a right click with a menu of its own or with nothing at
 * all, never with the browser's menu. This listener sits at the very top, so
 * every application has already had the event: one that wanted it has opened
 * its menu, and a right click nobody wanted is dropped here instead of being
 * handed to the browser.
 */
export function swallowNativeMenu(target = document) {
    target.addEventListener('contextmenu', event => event.preventDefault());
}
export function closeMenus() {
    for (const m of openMenus)
        m.remove();
    openMenus = [];
    document.querySelectorAll('.menu-active').forEach(n => n.classList.remove('menu-active'));
    document.querySelector('#start-button')?.setAttribute('aria-expanded', 'false');
}
export function popup(items, x, y, options = {}) {
    if (!options.child) {
        closeMenus();
        origin = options.origin;
    }
    const menu = el('div', { class: 'popup-menu ' + (options.class || ''), role: 'menu', tabIndex: -1 });
    if (options.brand)
        menu.append(el('div', { class: 'start-brand' }, el('div', {}, el('strong', { text: 'Windows' }), el('span', { text: '95' }))));
    const inner = el('div', { class: 'menu-items' });
    menu.append(inner);
    let currentChild = null;
    const closeChild = () => {
        if (!currentChild)
            return;
        const idx = openMenus.indexOf(currentChild);
        /* A child that is already gone must not splice away the menus that
           are still open (`splice(-1)` removes the last one). */
        if (idx >= 0)
            for (const m of openMenus.splice(idx))
                m.remove();
        currentChild = null;
    };
    const rows = [];
    for (const item of items) {
        if (!item || item.separator) {
            inner.append(separator());
            continue;
        }
        const row = el('button', { class: 'menu-item', role: 'menuitem', disabled: !!item.disabled, tabIndex: -1 });
        if (options.large)
            row.append(icon(item.icon || 'document', 32));
        else
            row.append(el('span', { class: 'menu-check', text: item.checked ? '✓' : item.icon ? '' : '' }, item.icon ? icon(item.icon, 16) : null));
        row.append(el('span', { class: 'menu-label', text: item.label }));
        if (item.shortcut)
            row.append(el('span', { class: 'menu-shortcut', text: item.shortcut }));
        if (item.items)
            row.append(el('span', { class: 'submenu-arrow', text: '▶' }));
        const showChild = () => {
            closeChild();
            if (item.items) {
                const r = row.getBoundingClientRect();
                currentChild = popup(typeof item.items === 'function' ? item.items() : item.items, r.right - 2, r.top - 3, { child: true });
            }
        };
        row.addEventListener('pointerenter', () => { rows.forEach(n => n.classList.remove('selected')); row.classList.add('selected'); showChild(); });
        row.addEventListener('click', e => {
            e.stopPropagation();
            if (item.items) {
                showChild();
                currentChild?.querySelector('button:not(:disabled)')?.focus();
            }
            else {
                closeMenus();
                item.action?.();
            }
        });
        row.addEventListener('keydown', e => {
            const active = rows.indexOf(row);
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                let i = (active + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
                for (let n = 0; n < rows.length && rows[i].disabled; n++)
                    i = (i + 1) % rows.length;
                rows[i]?.focus();
            }
            if (e.key === 'ArrowRight' && item.items) {
                e.preventDefault();
                showChild();
                currentChild?.querySelector('button:not(:disabled)')?.focus();
            }
            if (e.key === 'ArrowLeft' && options.child) {
                closeChild();
                menu.remove();
                openMenus = openMenus.filter(m => m !== menu);
                origin?.focus();
            }
            if (e.key === 'Escape') {
                closeMenus();
                origin?.focus();
            }
        });
        inner.append(row);
        rows.push(row);
    }
    document.querySelector('#menus').append(menu);
    openMenus.push(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.max(0, Math.min(x, innerWidth - rect.width)) + 'px';
    menu.style.top = Math.max(0, Math.min(y, innerHeight - 30 - rect.height)) + 'px';
    menu.addEventListener('pointerdown', e => e.stopPropagation());
    return menu;
}
export function menuBar(items) {
    const bar = el('div', { class: 'menu-bar', role: 'menubar', onpointerdown: e => e.stopPropagation() });
    for (const item of items) {
        const b = el('button', { role: 'menuitem', text: item.label, onclick: e => {
                e.stopPropagation();
                if (b.classList.contains('menu-active')) {
                    closeMenus();
                    return;
                }
                const r = b.getBoundingClientRect();
                popup(typeof item.items === 'function' ? item.items() : item.items, r.left, r.bottom, { origin: b });
                b.classList.add('menu-active');
            }, onpointerenter: () => {
                if (document.querySelector('.menu-bar .menu-active') && !b.classList.contains('menu-active'))
                    b.click();
            } });
        bar.append(b);
    }
    return bar;
}
window.addEventListener('pointerdown', () => closeMenus());
window.addEventListener('blur', () => closeMenus());
