/**
 * The taskbar's own settings, in one place.
 *
 * The bar is 30px tall and the desktop leaves that strip alone. Auto hide takes
 * the bar out of the layout: the desktop uses the whole screen, and the bar
 * keeps a 3px edge at the bottom that brings it back under the pointer. Every
 * place that used to hard-code 30 asks `taskbarHeight()` instead, so maximized
 * and tiled windows follow the option the moment it is applied. "Always on top"
 * decides whether the bar paints over windows (z-index) or under them; with
 * auto hide off the desktop is inset and the choice has nothing to cover.
 */
export const TASKBAR_HEIGHT = 30;
const hasDocument = typeof document !== 'undefined';
export const taskbarHeight = () => hasDocument && document.body.classList.contains('auto-hide') ? 0 : TASKBAR_HEIGHT;
export function applyTaskbarSettings(settings) {
    if (!hasDocument)
        return;
    const classes = document.body.classList;
    classes.toggle('auto-hide', !!settings.get('taskbarAutoHide', false));
    classes.toggle('taskbar-on-top', settings.get('taskbarOnTop', true) !== false);
    const clock = document.querySelector('#clock');
    if (clock)
        clock.hidden = !settings.get('showClock', true);
}
