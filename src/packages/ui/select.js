import { el } from './dom.js';

/**
 * Windows 95 drop-down and list-box controls.
 *
 * The native `<select>` renders a browser widget that ignores the desktop
 * styling, so the shell draws its own: a sunken field with a raised arrow
 * button for `mode: 'dropdown'`, and a scrolling list for `mode: 'list'`
 * (the equivalent of `<select size="8">`).
 *
 * The returned node accepts `options`, exposes `value`, `onchange` and
 * `disabled` like the control it replaces, and adds `setOptions(items,
 * selectedValue)` for the lists that are filled while the dialog is open.
 */
const openCombo = [];

/** Closes every open combo list. */
export function closeCombos() {
    for (const entry of [...openCombo])
        entry.close();
}

const toItem = item => (typeof item === 'string' || typeof item === 'number')
    ? { value: String(item), label: String(item) }
    : { value: String(item.value ?? item.label ?? ''), label: String(item.label ?? item.value ?? '') };

export function combo(options = {}) {
    const listMode = options.mode === 'list';
    const state = { items: [], value: '', disabled: !!options.disabled, change: options.onchange || null };
    let popup = null, highlighted = null, typeAhead = '', typeTimer = 0;

    const valueLabel = listMode ? null : el('span', { class: 'win95-combo-value' });
    const node = el('div', {
        class: 'win95-combo' + (listMode ? ' win95-combo-list' : '') + (options.class ? ' ' + options.class : ''),
        tabIndex: state.disabled ? -1 : 0,
        role: listMode ? 'listbox' : 'combobox',
        'aria-label': options.ariaLabel,
        'aria-expanded': listMode ? undefined : 'false'
    });
    if (!listMode)
        node.append(valueLabel, el('span', { class: 'win95-combo-arrow', 'aria-hidden': 'true' }));
    if (options.style)
        Object.assign(node.style, options.style);

    const itemFor = value => state.items.find(i => i.value === value);
    const emit = () => { state.change?.(state.value); };

    const paint = () => {
        if (valueLabel)
            valueLabel.textContent = itemFor(state.value)?.label ?? '';
        for (const row of node.children) {
            if (row.dataset.value === undefined)
                continue;
            const on = row.dataset.value === state.value;
            row.classList.toggle('selected', on);
            row.setAttribute('aria-selected', String(on));
        }
    };

    const choose = value => {
        if (state.value === value)
            return;
        state.value = value;
        paint();
        emit();
    };

    const move = step => {
        const index = state.items.findIndex(i => i.value === (highlighted ?? state.value));
        const next = state.items[Math.min(state.items.length - 1, Math.max(0, (index < 0 ? -1 : index) + step))];
        if (!next)
            return;
        if (listMode) {
            highlighted = next.value;
            choose(next.value);
        }
        else {
            highlighted = next.value;
            highlightRow();
        }
    };

    const playTypeAhead = key => {
        typeAhead += key.toLowerCase();
        clearTimeout(typeTimer);
        typeTimer = setTimeout(() => { typeAhead = ''; }, 600);
        const match = state.items.find(i => (i.text ?? i.label).toLowerCase().startsWith(typeAhead));
        if (!match)
            return;
        if (listMode) {
            highlighted = match.value;
            choose(match.value);
        }
        else {
            highlighted = match.value;
            if (popup)
                highlightRow();
        }
    };

    const highlightRow = () => {
        for (const row of popup?.children ?? []) {
            const on = row.dataset.value === highlighted;
            row.classList.toggle('highlight', on);
            if (on)
                row.scrollIntoView({ block: 'nearest' });
        }
    };

    const buildPopup = () => {
        const list = el('div', { class: 'win95-combo-popup', role: 'listbox', 'aria-label': options.ariaLabel });
        for (const item of state.items) {
            const row = el('div', { class: 'win95-combo-option', role: 'option', 'data-value': item.value }, item.label);
            row.addEventListener('pointerdown', e => e.preventDefault());
            row.addEventListener('pointerenter', () => { highlighted = item.value; highlightRow(); });
            row.addEventListener('click', () => { choose(item.value); closePopup(); node.focus(); });
            list.append(row);
        }
        return list;
    };

    const positionPopup = () => {
        if (!popup)
            return;
        const rect = node.getBoundingClientRect();
        popup.style.minWidth = Math.ceil(rect.width) + 'px';
        const width = popup.offsetWidth, height = popup.offsetHeight;
        const fits = innerHeight - rect.bottom - 2;
        popup.style.left = Math.max(0, Math.min(rect.left, innerWidth - width - 2)) + 'px';
        popup.style.top = (height > fits && rect.top > fits ? Math.max(2, rect.top - height) : rect.bottom) + 'px';
    };

    const openPopup = () => {
        if (listMode || popup || state.disabled || !state.items.length)
            return;
        closeCombos();
        highlighted = state.value;
        popup = buildPopup();
        document.querySelector('#menus').append(popup);
        positionPopup();
        highlightRow();
        node.setAttribute('aria-expanded', 'true');
        openCombo.push({
            node,
            popup,
            close: () => closePopup()
        });
    };

    function closePopup() {
        if (!popup)
            return;
        popup.remove();
        popup = null;
        highlighted = null;
        node.setAttribute('aria-expanded', 'false');
        const index = openCombo.findIndex(e => e.node === node);
        if (index >= 0)
            openCombo.splice(index, 1);
    }

    const setOptions = (items, selected) => {
        state.items = (items || []).map(item => {
            const entry = toItem(item);
            entry.text = typeof item === 'string' ? item : String(item.label ?? item.value ?? '');
            return entry;
        });
        if (selected !== undefined && state.items.some(i => i.value === String(selected)))
            state.value = String(selected);
        if (!state.items.some(i => i.value === state.value))
            state.value = state.items[0]?.value ?? '';
        highlighted = state.value;
        if (listMode) {
            node.replaceChildren(...state.items.map(item => {
                const row = el('div', { class: 'win95-combo-option', role: 'option', 'data-value': item.value }, item.label);
                row.onclick = () => { highlighted = item.value; choose(item.value); };
                return row;
            }));
        }
        else if (popup) {
            closePopup();
            openPopup();
        }
        paint();
    };

    node.addEventListener('keydown', event => {
        if (state.disabled)
            return;
        const open = !!popup;
        if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            closePopup();
            return;
        }
        if (event.key === 'Tab') {
            closePopup();
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open && !listMode) {
                openPopup();
                return;
            }
            move(event.key === 'ArrowDown' ? 1 : -1);
            return;
        }
        if (event.key === 'Home' || event.key === 'End') {
            if (!open && !listMode)
                return;
            event.preventDefault();
            const target = event.key === 'Home' ? state.items[0] : state.items.at(-1);
            if (!target)
                return;
            highlighted = target.value;
            if (listMode)
                choose(target.value);
            else
                highlightRow();
            return;
        }
        if ((event.key === 'Enter' || event.key === ' ') && !listMode) {
            event.preventDefault();
            if (!open)
                openPopup();
            else {
                if (highlighted !== null)
                    choose(highlighted);
                closePopup();
            }
            return;
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey)
            playTypeAhead(event.key);
    });
    node.addEventListener('pointerdown', event => {
        if (state.disabled || listMode)
            return;
        event.preventDefault();
        node.focus();
        if (popup)
            closePopup();
        else
            openPopup();
    });
    node.addEventListener('blur', () => closePopup());

    Object.defineProperty(node, 'value', {
        get: () => state.value,
        set: value => { state.value = String(value ?? ''); paint(); }
    });
    Object.defineProperty(node, 'onchange', {
        get: () => state.change,
        set: fn => { state.change = typeof fn === 'function' ? fn : null; }
    });
    Object.defineProperty(node, 'disabled', {
        get: () => state.disabled,
        set: value => {
            state.disabled = !!value;
            node.tabIndex = state.disabled ? -1 : 0;
            node.classList.toggle('disabled', state.disabled);
            if (state.disabled)
                closePopup();
        }
    });
    node.setOptions = setOptions;
    node.closeMenu = closePopup;

    setOptions(options.options, options.value);
    return node;
}

window.addEventListener('pointerdown', event => {
    for (const entry of [...openCombo]) {
        if (!entry.node.contains(event.target) && !entry.popup.contains(event.target))
            entry.close();
    }
}, true);
window.addEventListener('resize', () => closeCombos());
window.addEventListener('scroll', () => closeCombos(), true);
