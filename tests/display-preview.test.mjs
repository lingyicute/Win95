import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom, Element } from './dom-shim.mjs';

installDom();
globalThis.devicePixelRatio = 1;
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-US' }, configurable: true });
document.documentElement = document.createElement('html');
/* The shim has no input value plumbing; give elements the HTML value
   semantics the property pages read and write. */
Object.defineProperty(Element.prototype, 'value', {
    get() { return this.attributes.value ?? ''; },
    set(v) { this.attributes.value = String(v); },
    configurable: true
});
register('./win95-resolver.mjs', import.meta.url);
const { displayProperties } = await import('../src/packages/apps/control-panel.js');

class Settings extends EventTarget {
    constructor(values = {}) { super(); this.values = { ...values }; }
    get(key, fallback) { return this.values[key] ?? fallback; }
    set(key, value) { this.values[key] = value; }
}

const makeSystem = () => {
    let applied = 0;
    const s = {
        settings: new Settings(),
        applyAppearance() { applied++; },
        graphics: { presenter: { backend: 'test' } },
        ui: { message: async () => 'OK' },
        wm: {
            create() {
                return {
                    body: document.createElement('div'),
                    element: document.createElement('div'),
                    onClosed: [],
                    setMenu() { },
                    status() { },
                    close() { this.closed = true; }
                };
            }
        }
    };
    return { s, applied: () => applied };
};

const backgroundPanel = sheet => sheet.body.children[1].children[0];
const previewOf = panel => panel.querySelector('.display-preview');
const swatch = (panel, color) => [...panel.querySelector('.color-swatches').children]
    .find(b => b.getAttribute('aria-label') === 'Desktop color ' + color);

test('clicking a color swatch repaints the Background preview monitor', async () => {
    const { s } = makeSystem();
    const sheet = displayProperties(s);
    const panel = backgroundPanel(sheet);
    const preview = previewOf(panel);
    const red = swatch(panel, '#800000');
    assert.ok(red, 'the swatch row carries the standard palette');
    red.dispatchEvent({ type: 'click' });
    assert.equal(preview.style.backgroundColor, '#800000', 'the preview follows the pick');
    red.dispatchEvent({ type: 'click' });
    assert.equal(preview.style.backgroundColor, '#800000', 'a second pick keeps working (no throw)');
});

test('Apply commits the picked color and refreshes the desktop', async () => {
    const { s, applied } = makeSystem();
    const sheet = displayProperties(s);
    const panel = backgroundPanel(sheet);
    swatch(panel, '#000000').dispatchEvent({ type: 'click' });
    await sheet.apply();
    assert.equal(s.settings.get('desktopColor'), '#000000');
    assert.equal(applied(), 1, 'applyAppearance runs on Apply');
});
