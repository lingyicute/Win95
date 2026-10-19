import { el } from '@win95/ui/dom.js';

/**
 * Suspend: the desktop is put to sleep and the screen goes black.
 *
 * Nothing is closed and nothing is lost - the windows stay where they were -
 * and the first thing the user touches brings it all back: a click anywhere,
 * or any key. That first click or key belongs to the black screen, not to
 * whatever happens to be under it, so it is swallowed rather than passed on
 * to a window the user could not see.
 */
export function installSuspend(s) {
    const screen = el('div', { class: 'suspend-screen', hidden: true, 'aria-hidden': 'true' });
    document.body.append(screen);
    let asleep = false;
    const stop = event => {
        event.preventDefault?.();
        /* The key that wakes the desktop must not also reach the Program
           Manager shortcuts or a text field that was left focused. */
        if (event.stopImmediatePropagation)
            event.stopImmediatePropagation();
        else
            event.stopPropagation?.();
    };
    /* A click is a press and a release. The press wakes the screen; the click
       the browser builds from that same press would land on whatever the
       screen was covering, so the first click after a waking press is let go
       unheeded - and only the first, so the very next click is the user's. */
    let swallowClick = null;
    const releaseClick = () => {
        if (!swallowClick)
            return;
        document.removeEventListener('click', swallowClick, true);
        swallowClick = null;
    };
    const guardClick = () => {
        let timer = 0;
        swallowClick = event => {
            stop(event);
            clearTimeout(timer);
            releaseClick();
        };
        document.addEventListener('click', swallowClick, true);
        timer = setTimeout(releaseClick, 1000);
    };
    const wake = () => {
        if (!asleep)
            return;
        asleep = false;
        s.suspended = false;
        s.lastActivity = Date.now();
        screen.hidden = true;
    };
    document.addEventListener('pointerdown', event => {
        if (!asleep)
            return;
        stop(event);
        wake();
        guardClick();
    }, true);
    document.addEventListener('keydown', event => {
        if (!asleep)
            return;
        stop(event);
        wake();
    }, true);
    const suspend = () => {
        if (asleep)
            return;
        asleep = true;
        s.suspended = true;
        s.lastActivity = Date.now();
        screen.hidden = false;
    };
    s.suspend = suspend;
    return suspend;
}
