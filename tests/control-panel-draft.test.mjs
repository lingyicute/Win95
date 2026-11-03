/* A control panel applet saves its draft as applet-<id>. When the box mirrors a
   shared setting that was changed elsewhere since, the shared setting wins:
   opening the sheet and pressing OK must not write the stale draft back. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom, Element } from './dom-shim.mjs';

installDom();
globalThis.devicePixelRatio = 1;
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-US' }, configurable: true });
document.documentElement = document.createElement('html');
Object.defineProperty(Element.prototype, 'value', {
    get() { return this.attributes.value ?? ''; },
    set(v) { this.attributes.value = String(v); },
    configurable: true
});
register('./win95-resolver.mjs', import.meta.url);
const { settingsApplet } = await import('../src/packages/apps/control-panel.js');

class Settings extends EventTarget {
    constructor(values = {}) { super(); this.values = { ...values }; }
    get(key, fallback) { return this.values[key] ?? fallback; }
    set(key, value) { this.values[key] = value; }
}
const makeSystem = values => ({
    settings: new Settings(values),
    applyAppearance() { },
    updateClock() { },
    ui: { message: async () => 'OK' },
    wm: {
        create() {
            return { body: document.createElement('div'), element: document.createElement('div'), onClosed: [], setMenu() { }, close() { this.closed = true; } };
        }
    }
});

test('a stale High Contrast draft does not override a scheme changed since', async () => {
    const s = makeSystem({ scheme: 'Desert', 'applet-accessibility': { highContrast: true, contrast: 'High Contrast Black' } });
    await settingsApplet(s, 'accessibility').apply();
    assert.equal(s.settings.get('scheme'), 'Desert', 'the scheme chosen in Display is kept');
    assert.equal(s.settings.get('applet-accessibility').highContrast, false);
});

test('a High Contrast scheme set elsewhere shows up in Accessibility', async () => {
    const s = makeSystem({ scheme: 'High Contrast White', 'applet-accessibility': { highContrast: false } });
    await settingsApplet(s, 'accessibility').apply();
    assert.equal(s.settings.get('scheme'), 'High Contrast White');
});

test('a setting that is only this sheet’s own keeps its saved draft', async () => {
    const s = makeSystem({ 'applet-folder-options': { extensions: false } });
    await settingsApplet(s, 'folder-options').apply();
    assert.equal(s.settings.get('applet-folder-options').extensions, false);
});

test('the locale sheet starts from the current locale, not the saved draft', async () => {
    const s = makeSystem({ locale: 'de-DE', 'applet-regional': { locale: 'fr-FR' } });
    await settingsApplet(s, 'regional').apply();
    assert.equal(s.settings.get('applet-regional').locale, 'de-DE');
});
