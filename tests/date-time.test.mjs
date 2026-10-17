import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom, Element } from './dom-shim.mjs';

installDom();
globalThis.devicePixelRatio = 1;
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-US' }, configurable: true });
document.documentElement = document.createElement('html');
/* The shim has no input value plumbing; give elements the HTML value
   semantics the Date/Time sheet reads and writes. */
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

const makeSystem = () => ({
    settings: new Settings(),
    updateClock() { },
    ui: { message: async () => 'OK' },
    wm: {
        create() {
            return {
                body: document.createElement('div'),
                element: document.createElement('div'),
                onClosed: [],
                setMenu() { },
                close() { this.closed = true; }
            };
        }
    }
});

/* dateTime ticks an analog clock until the sheet closes; run the close
   handlers by hand so no interval outlives the test. */
const teardown = sheet => sheet.onClosed.forEach(fn => fn());
const timeInput = sheet => sheet.body.children[1].querySelectorAll('input').at(-1);

test('an untouched Date/Time sheet never rewrites the clock offset', async () => {
    const s = makeSystem();
    const sheet = settingsApplet(s, 'datetime');
    await sheet.apply();
    assert.equal(s.settings.get('clockOffset'), undefined, 'Apply without an edit leaves the offset alone');
    assert.equal(s.settings.get('timezone'), 'Local time');
    teardown(sheet);
});

test('editing the time pins the clock to that local time of day', async () => {
    const s = makeSystem();
    const sheet = settingsApplet(s, 'datetime');
    const input = timeInput(sheet);
    input.value = '01:23';
    input.dispatchEvent({ type: 'input' });
    await sheet.apply();
    const shown = new Date(Date.now() + s.settings.get('clockOffset'));
    assert.equal(shown.getHours(), 1);
    assert.equal(shown.getMinutes(), 23);
    teardown(sheet);
});

test('picking a day pins the clock to that local date', async () => {
    const s = makeSystem();
    const sheet = settingsApplet(s, 'datetime');
    const grid = sheet.body.children[1].querySelector('.calendar-grid');
    const day15 = [...grid.children].find(n => n.tagName === 'BUTTON' && n.textContent === '15');
    day15.dispatchEvent({ type: 'click' });
    await sheet.apply();
    const shown = new Date(Date.now() + s.settings.get('clockOffset'));
    assert.equal(shown.getDate(), 15, 'the offset targets the chosen day, not the UTC one');
    teardown(sheet);
});
