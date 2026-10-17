import { el } from '@win95/ui/dom.js';
// Pointer trails, the way the original mouse driver drew them: copies of the
// pointer bitmap left along the recent path. The copies sit at where the
// pointer was a few moments ago, so a still pointer makes them collapse under
// the real one and disappear, exactly like the original.
const GHOST = '<svg viewBox="0 0 12 20" width="12" height="20" aria-hidden="true"><path d="M1 1v15l3.4-3.2 2.4 5.6 2.7-1.2-2.4-5.5h4.8z" fill="#fff" stroke="#000" stroke-width="1"/></svg>';
const AGE = 26;
export function pointerTrails(s) {
    const host = el('div', { class: 'pointer-trails', 'aria-hidden': 'true' });
    document.body.append(host);
    let ghosts = [], samples = [];
    const count = () => 2 + Math.round((s.settings.get('trailLength', 50) / 100) * 8);
    const sync = () => {
        const want = s.settings.get('pointerTrails', false) ? count() : 0;
        while (ghosts.length < want) {
            const g = el('span', { class: 'pointer-trail' });
            g.innerHTML = GHOST;
            host.append(g);
            ghosts.push(g);
        }
        while (ghosts.length > want)
            ghosts.pop().remove();
        host.hidden = want === 0;
    };
    sync();
    document.addEventListener('mousemove', e => {
        samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
        if (samples.length > 96)
            samples.shift();
    }, { passive: true });
    const place = (g, x, y) => {
        g.style.transform = `translate(${x}px, ${y}px)`;
    };
    const loop = () => {
        requestAnimationFrame(loop);
        if (!ghosts.length || !samples.length)
            return;
        const now = performance.now();
        const latest = samples[samples.length - 1];
        for (let i = 0; i < ghosts.length; i++) {
            const target = now - (i + 1) * AGE;
            let at = latest;
            for (let k = samples.length - 1; k >= 0; k--) {
                if (samples[k].t <= target) {
                    at = samples[k];
                    break;
                }
            }
            place(ghosts[i], at.x, at.y);
        }
    };
    requestAnimationFrame(loop);
    const change = () => sync();
    s.settings.addEventListener('change', change);
    return { stop: () => { s.settings.removeEventListener('change', change); host.remove(); ghosts = []; } };
}
