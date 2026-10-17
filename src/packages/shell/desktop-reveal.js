/**
 * The staged desktop reveal. Windows 95 did not paint a session all at once:
 * the wallpaper was simply there, and the rest of the shell arrived around it.
 * Here the desktop becomes the background first, then the desktop icons join
 * after 150 ms, the taskbar 100 ms after that and the window layer 200 ms
 * later again. Every wait is measured from the layer before it, so the reveal
 * takes 450 ms in total.
 *
 * A layer is hidden by a `reveal-<layer>` class on <body> (see styles.css) and
 * `revealing` marks a reveal in flight, so the same sequence can be styled and
 * observed without touching the layers themselves. The waits are never
 * overlapping timers of one shared length: each layer gets its own deadline, so
 * a stalled timer cannot hide a layer forever.
 */
export const REVEAL_LAYERS = [
    { layer: 'icons', ms: 150 },
    { layer: 'taskbar', ms: 100 },
    { layer: 'windows', ms: 200 }
];

/**
 * Reveals the desktop in stages and resolves once the last layer is visible.
 *
 * `onLayer` runs just before a layer becomes visible, which is how the shell
 * opens its start-up windows exactly when the window layer is ready instead of
 * showing them a few frames too early. `schedule` is the timer seam: pass
 * `(run) => run()` to reveal everything at once, or a queue to drive the
 * sequence from a test.
 */
export function revealDesktopLayers({ body = document.body, layers = REVEAL_LAYERS, onLayer = null, schedule = (run, ms) => setTimeout(run, ms) } = {}) {
    const hidden = new Set(layers.map(({ layer }) => layer));
    const paint = () => {
        for (const { layer } of layers)
            body.classList.toggle('reveal-' + layer, hidden.has(layer));
        body.classList.toggle('revealing', hidden.size > 0);
    };
    paint();
    if (!hidden.size)
        return Promise.resolve();
    let elapsed = 0;
    const deadlines = layers.map(({ layer, ms }) => {
        elapsed += Math.max(0, Number(ms) || 0);
        return { layer, at: elapsed };
    });
    return new Promise(resolve => {
        for (const { layer, at } of deadlines)
            schedule(() => {
                /* Another reveal may already have shown this layer. */
                if (!hidden.has(layer))
                    return;
                try {
                    onLayer?.(layer);
                }
                catch (error) {
                    console.error(`The desktop ${layer} layer could not be revealed:`, error);
                }
                hidden.delete(layer);
                paint();
                if (!hidden.size)
                    resolve();
            }, at);
    });
}
