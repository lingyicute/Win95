const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 10;
const SUPPRESSION_MS = 1000;

/**
 * Coalesces a touch long-press timer and the contextmenu some mobile browsers
 * synthesize for the same gesture. Otherwise both paths toggle the flag,
 * briefly changing the counter and then undoing one another.
 */
export function createTouchFlagHandler(onFlag, {
    delay = LONG_PRESS_MS,
    now = Date.now,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
} = {}) {
    if (typeof onFlag !== 'function')
        throw new TypeError('A flag callback is required.');

    let activePress = null;
    let ignoreContextMenuUntil = 0;
    let suppressedClick = null;

    const clearPressTimer = press => {
        if (press && press.timer !== null) {
            clearTimeoutFn(press.timer);
            press.timer = null;
        }
    };
    const cancelPress = () => {
        clearPressTimer(activePress);
        activePress = null;
    };
    const flagPress = press => {
        if (activePress !== press || press.handled || press.cancelled)
            return false;
        press.handled = true;
        clearPressTimer(press);
        const timestamp = now();
        ignoreContextMenuUntil = timestamp + SUPPRESSION_MS;
        suppressedClick = { index: press.index, until: timestamp + SUPPRESSION_MS };
        onFlag(press.index);
        return true;
    };

    return {
        pointerDown(index, event) {
            if (event.isPrimary === false)
                return;
            cancelPress();
            ignoreContextMenuUntil = 0;
            suppressedClick = null;
            if (event.pointerType !== 'touch' || event.button !== 0)
                return;

            const press = {
                index,
                pointerId: event.pointerId,
                x: Number.isFinite(event.clientX) ? event.clientX : null,
                y: Number.isFinite(event.clientY) ? event.clientY : null,
                handled: false,
                cancelled: false,
                timer: null,
            };
            activePress = press;
            press.timer = setTimeoutFn(() => {
                press.timer = null;
                if (activePress === press && !press.cancelled)
                    flagPress(press);
            }, delay);
        },

        pointerMove(event) {
            const press = activePress;
            if (!press || press.handled || press.cancelled)
                return;
            if (event.pointerId !== undefined && press.pointerId !== undefined && event.pointerId !== press.pointerId)
                return;
            if (press.x === null || press.y === null || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY))
                return;
            if (Math.abs(event.clientX - press.x) > MOVE_TOLERANCE || Math.abs(event.clientY - press.y) > MOVE_TOLERANCE) {
                press.cancelled = true;
                clearPressTimer(press);
            }
        },

        pointerEnd(pointerId) {
            if (!activePress)
                return;
            if (pointerId !== undefined && activePress.pointerId !== undefined && pointerId !== activePress.pointerId)
                return;
            cancelPress();
        },

        /** Returns true when this contextmenu belongs to, or trails, a touch. */
        contextMenu() {
            const timestamp = now();
            if (activePress) {
                if (!activePress.cancelled)
                    flagPress(activePress);
                ignoreContextMenuUntil = Math.max(ignoreContextMenuUntil, timestamp + SUPPRESSION_MS);
                return true;
            }
            if (timestamp < ignoreContextMenuUntil) {
                ignoreContextMenuUntil = 0;
                return true;
            }
            return false;
        },

        /** Swallows the synthetic click that may follow a touch long-press. */
        consumeClick(index) {
            if (!suppressedClick)
                return false;
            if (now() >= suppressedClick.until) {
                suppressedClick = null;
                return false;
            }
            if (suppressedClick.index !== index)
                return false;
            suppressedClick = null;
            return true;
        },

        /** Cancels a pending gesture, e.g. when the board resets or closes. */
        cancel() {
            cancelPress();
            ignoreContextMenuUntil = 0;
            suppressedClick = null;
        },
    };
}
