/**
 * The sliding control the desktop uses for volumes, speeds and positions.
 *
 * Drawn the way the original trackbar looks: a two-pixel groove with its
 * highlight, ticks under a horizontal bar and beside a vertical one, and the
 * shaped thumb — a wide bevelled bar vertically, a downward pointer
 * horizontally. Pointer, keyboard and screen-reader behaviour come with it:
 * drag anywhere on the bar, arrow and page keys step, Home and End jump, and
 * the element carries the slider role with its value spoken.
 */
import { el, uniqueId } from './dom.js';

export function trackbar({ label, orientation = 'horizontal', min = 0, max = 100, step = 1, pageStep = 10, value = 0, valueText, onChange, channel = false, balance = false, ruler = null, ticks: tickCount = 0 }) {
    const vertical = orientation === 'vertical';
    const clamp = next => Math.min(max, Math.max(min, Number(next) || 0));
    let current = clamp(value);
    const thumb = el('div', { class: 'win95-trackbar-thumb', 'aria-hidden': 'true' });
    const ticks = el('div', { class: 'win95-trackbar-ticks', 'aria-hidden': 'true' });
    const tickRatios = tickCount > 1 ? Array.from({ length: tickCount }, (_, i) => i / (tickCount - 1)) : vertical ? [0, .2, .4, .6, .8, 1] : balance ? [.25, .5, .75] : [0, .5, 1];
    for (const tickRatio of tickRatios) {
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
    const rulerRow = el('div', { class: 'win95-trackbar-ruler', 'aria-hidden': 'true' });
    const root = el('div', {
        class: `win95-trackbar ${orientation}${channel ? ' channel' : ''}${balance ? ' balance' : ''}`,
        role: 'slider',
        tabindex: '0',
        'aria-label': label,
        'aria-orientation': orientation,
        'aria-valuemin': String(min),
        'aria-valuemax': String(max)
    }, ticks, el('div', { class: 'win95-trackbar-track', 'aria-hidden': 'true' }), thumb, rulerRow);
    if (balance) {
        // The original balance slider: a white point-down thumb outlined in grey
        // riding a plain dark line.
        thumb.innerHTML = '<svg viewBox="0 0 10 22" width="10" height="22" shape-rendering="crispEdges" aria-hidden="true"><polygon points="0.5,0.5 9.5,0.5 9.5,15 5,21.5 0.5,15" fill="#fff" stroke="#808080"/></svg>';
    }
    if (channel) {
        // The original seek bar's thumb: a slim raised marker whose bottom comes
        // to a point over the scale.
        const cid = uniqueId('thumbclip');
        thumb.innerHTML = `<svg viewBox="0 0 10 20" width="10" height="20" shape-rendering="crispEdges" aria-hidden="true"><defs><clipPath id="${cid}"><polygon points="0,0 10,0 10,14 5,20 0,14"/></clipPath></defs><polygon points="0,0 10,0 10,14 5,20 0,14" fill="#808080"/><g clip-path="url(#${cid})"><polygon points="-1,-1 9,-1 9,13 4,19 -1,13" fill="#fff"/><polygon points="1,1 9,1 9,13.4 5,18.6 1,13.4" fill="#c0c0c0"/></g></svg>`;
    }
    // How far the thumb centre stays in from each end: half the thumb, so the
    // thumb never hangs off the bar.
    const EDGE = channel ? 5 : balance ? 8 : 11;
    const ratio = () => (current - min) / (max - min);
    // The original media player puts a ruled scale under its seek bar: a tick and
    // its number at every step of a scale it chooses to fit, plus the total at
    // the far end.
    const RULER_STEPS = [.1, .25, .5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 3600, 7200, 18000, 36000, 108000];
    const MIN_LABEL_PX = 30;
    const paintRuler = () => {
        // Measured before the row is emptied: an empty ruler is display:none,
        // which would report a width of zero.
        const width = rulerRow.clientWidth;
        rulerRow.replaceChildren();
        if (!ruler || !(max > min))
            return;
        const span = max - min;
        // The original picks the scale from the pixels available: a label needs
        // about thirty pixels of room. Without a layout width (tests) fall back
        // to at most seven divisions.
        const every = width
            ? RULER_STEPS.find(candidate => candidate * (width / span) >= MIN_LABEL_PX) ?? RULER_STEPS[RULER_STEPS.length - 1]
            : RULER_STEPS.find(candidate => span / candidate <= 7) ?? RULER_STEPS[RULER_STEPS.length - 1];
        const label = typeof ruler === 'function' ? ruler : ruler.label;
        const steps = [min];
        for (let at = min + every; at < max; at += every)
            steps.push(at);
        const hasEnd = steps[steps.length - 1] < max;
        steps.forEach((at, i) => {
            const tick = el('span', { class: 'win95-trackbar-ruler-tick' });
            tick.style.left = `${(at - min) / span * 100}%`;
            rulerRow.append(tick);
            if (hasEnd && i === steps.length - 1)
                return;
            const text = el('span', { class: 'win95-trackbar-ruler-label' + (i ? '' : ' first'), text: label(at) });
            text.style.left = `${(at - min) / span * 100}%`;
            rulerRow.append(text);
        });
        if (!hasEnd)
            return;
        const endTick = el('span', { class: 'win95-trackbar-ruler-tick' });
        endTick.style.left = '100%';
        const endLabel = el('span', { class: 'win95-trackbar-ruler-label last', text: label(max) });
        endLabel.style.left = '100%';
        rulerRow.append(endTick, endLabel);
    };
    const render = () => {
        const r = ratio();
        if (vertical) {
            thumb.style.left = '50%';
            thumb.style.top = root.clientHeight ? `${8 + (1 - r) * (root.clientHeight - 16)}px` : `${(1 - r) * 100}%`;
        }
        else {
            thumb.style.top = channel ? '12px' : balance ? '13px' : '50%';
            thumb.style.left = root.clientWidth ? `${EDGE + r * (root.clientWidth - EDGE * 2)}px` : `${r * 100}%`;
        }
        root.setAttribute('aria-valuenow', String(current));
        root.setAttribute('aria-valuetext', valueText ? valueText(current) : String(current));
    };
    const setValue = (next, notify = true) => {
        const stepped = clamp(Math.round((clamp(next) - min) / step) * step + min);
        const normalized = Object.is(stepped, -0) ? 0 : stepped;
        if (normalized !== current) {
            current = normalized;
            if (notify)
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
        const travel = Math.max(1, rect.width - EDGE * 2);
        return min + (event.clientX - rect.left - EDGE) / travel * (max - min);
    };
    let dragging = false;
    root.addEventListener('pointerdown', event => {
        if (root.disabled || (event.button !== undefined && event.button !== 0))
            return;
        dragging = true;
        try {
            root.setPointerCapture?.(event.pointerId);
        }
        catch { }
        root.focus({ preventScroll: true });
        setValue(valueFromPointer(event));
        event.preventDefault();
    });
    root.addEventListener('pointermove', event => {
        if (!dragging)
            return;
        if (!(event.buttons & 3)) {
            /* Heal a drag whose pointer went up without an event (capture
               lost): stop instead of sliding buttonless. */
            stopDrag();
            return;
        }
        setValue(valueFromPointer(event));
    });
    const stopDrag = () => { dragging = false; };
    root.addEventListener('pointerup', stopDrag);
    root.addEventListener('pointercancel', stopDrag);
    root.addEventListener('lostpointercapture', stopDrag);
    root.addEventListener('keydown', event => {
        if (root.disabled)
            return;
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
    // Callers that mirror another source of truth (a playing file, a stored
    // setting) move the thumb without telling themselves about it.
    Object.defineProperties(root, {
        value: { get: () => current, set: next => setValue(next, false), enumerable: true },
        min: { get: () => min, set: next => { min = Number(next) || 0; root.setAttribute('aria-valuemin', String(min)); paintRuler(); setValue(current, false); }, enumerable: true },
        max: { get: () => max, set: next => { max = Number(next) || 0; root.setAttribute('aria-valuemax', String(max)); paintRuler(); setValue(current, false); }, enumerable: true },
        step: { get: () => step, set: next => { step = Number(next) || 1; setValue(current, false); }, enumerable: true }
    });
    paintRuler();
    render();
    requestAnimationFrame(render);
    if (typeof ResizeObserver !== 'undefined')
        new ResizeObserver(() => {
            render();
            paintRuler();
        }).observe(root);
    Object.defineProperty(root, 'disabled', {
        get: () => root.classList.contains('win95-trackbar-disabled'),
        set: on => {
            root.classList.toggle('win95-trackbar-disabled', !!on);
            root.tabIndex = on ? -1 : 0;
            root.setAttribute('aria-disabled', on ? 'true' : 'false');
        },
        enumerable: true
    });
    Object.defineProperty(root, 'ruler', {
        get: () => ruler,
        set: next => {
            ruler = next;
            paintRuler();
        }
    });
    return root;
}
