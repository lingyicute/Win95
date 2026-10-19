/**
 * A window's title bar flying to and from its taskbar button.
 *
 * A window that is minimized does not simply disappear: its title bar shrinks
 * down to the button it is going to live on, and grows back out of that button
 * when the window comes back. The bar that moves is a copy of the real one, so
 * the window itself stays where it is while the copy travels, and the window is
 * taken off the screen at the moment the copy lands - the two read as one
 * movement.
 *
 * A window that cannot show the movement - nothing has a layout to measure, the
 * browser has no animation engine, or the system was asked for less motion -
 * simply arrives. The callers get the same `animates` answer in both cases, so
 * they never have to guess which happened.
 */
const DURATION = 200;

/** A rect in the coordinates a fixed-position element is placed in. */
export const rectOf = node => {
    if (!node || typeof node.getBoundingClientRect !== 'function')
        return null;
    const { left, top, width, height } = node.getBoundingClientRect();
    return { left, top, width, height };
};

/** The part of a window that travels: its title bar. */
export const titleBarRect = windowElement => rectOf(windowElement?.querySelector?.('.title-bar'));

/** Both ends have to be somewhere on the screen for a flight to mean anything. */
export const canTravel = (from, to) => [from, to].every(rect => rect && rect.width > 1 && rect.height > 1);

const lessMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const place = (node, rect) => {
    node.style.left = rect.left + 'px';
    node.style.top = rect.top + 'px';
    node.style.width = rect.width + 'px';
    node.style.height = rect.height + 'px';
};

/**
 * The copy that flies: the window's own title bar without the buttons that
 * would tempt a click, painted in the colours it has right now (the live bar
 * may be the active one, and a bar appended to the page would not know).
 */
function flyingBar(windowElement) {
    const bar = windowElement?.querySelector?.('.title-bar');
    if (!bar || typeof document === 'undefined' || !document.body)
        return null;
    let ghost = null;
    if (typeof bar.cloneNode === 'function') {
        ghost = bar.cloneNode(true);
        for (const selector of ['button', '.title-controls'])
            ghost.querySelectorAll?.(selector).forEach(node => node.remove());
    }
    else {
        const text = bar.querySelector?.('.title-text')?.textContent;
        ghost = document.createElement('div');
        const label = document.createElement('span');
        label.className = 'title-text';
        label.textContent = text || '';
        ghost.append(label);
    }
    ghost.classList.add('flying-title-bar');
    ghost.setAttribute('aria-hidden', 'true');
    if (typeof getComputedStyle === 'function') {
        const paint = getComputedStyle(bar);
        ghost.style.background = paint.backgroundColor;
        ghost.style.color = paint.color;
    }
    return ghost;
}

/**
 * Flies the copy of `windowElement`'s title bar from `from` to `to`.
 *
 * Returns a handle: `animates` says whether anything is moving, and `cancel()`
 * stops a flight in progress without running `onDone` - for a window that is
 * closed, restored or minimized again before its bar lands. `onDone` runs only
 * when the bar actually lands; a caller that gets `animates: false` is already
 * where it wanted to be and should finish the move itself.
 */
export function flyTitleBar({ windowElement, from, to, onDone = () => { } }) {
    if (typeof document === 'undefined' || !canTravel(from, to) || lessMotion())
        return { animates: false, cancel() { } };
    const ghost = flyingBar(windowElement);
    if (!ghost || typeof ghost.animate !== 'function')
        return { animates: false, cancel() { } };
    place(ghost, from);
    document.body.append(ghost);
    let landed = false, timer = 0;
    const remove = () => {
        clearTimeout(timer);
        ghost.remove();
    };
    const land = () => {
        if (landed)
            return;
        landed = true;
        remove();
        onDone();
    };
    const frame = rect => ({ left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    const animation = ghost.animate([frame(from), frame(to)], { duration: DURATION, easing: 'linear', fill: 'forwards' });
    animation.onfinish = land;
    /* A throttled tab can hold the animation callback back; the flight still
       has to land, or the window would never arrive. */
    timer = setTimeout(land, DURATION + 80);
    return {
        animates: true,
        cancel() {
            if (landed)
                return;
            landed = true;
            try {
                animation.cancel();
            }
            catch { }
            remove();
        }
    };
}
