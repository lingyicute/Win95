import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';
import { saverWaitMinutes, saverWaitOptions } from '../src/packages/apps/saver-wait.js';

installDom();
globalThis.devicePixelRatio = 1;
document.documentElement = document.createElement('html');
register('./win95-resolver.mjs', import.meta.url);
const { displayProperties, settingsApplet } = await import('../src/packages/apps/control-panel.js');

class TestSettings extends EventTarget {
    constructor(values = {}) { super(); this.values = { ...values }; }

    get(name, fallback) { return this.values[name] ?? fallback; }

    set(name, value) {
        this.values[name] = value;
        this.dispatchEvent(new CustomEvent('change', { detail: { name, value } }));
    }
}

const makeSystem = (values = {}) => ({
    settings: new TestSettings(values),
    applyAppearance() { },
    graphics: { screensaver() { }, presenter: { backend: 'canvas2d' } },
    ui: { prompt: async () => null },
    wm: {
        create() {
            const w = {
                body: document.createElement('div'),
                element: document.createElement('div'),
                onClosed: [],
                setMenu() { },
                status() { },
                close() { this.onClosed.forEach(fn => fn()); }
            };
            return w;
        }
    }
});

const panel = (w, index) => {
    w.body.children[0].children[index].dispatchEvent({ type: 'click' });
    return w.body.children[1];
};
const displayWait = w => panel(w, 1).querySelector('input');
const setDisplayWait = (w, minutes) => {
    const input = displayWait(w);
    input.value = String(minutes);
    input.dispatchEvent({ type: 'input' });
};
const powerCombo = w => w.body.children[1].querySelector('.win95-combo');
const powerLabel = w => powerCombo(w).querySelector('.win95-combo-value').textContent;
const choosePower = (w, label) => {
    powerCombo(w).dispatchEvent({ type: 'pointerdown', preventDefault() { } });
    const popup = document.querySelector('#menus').querySelector('.win95-combo-popup');
    const row = popup.children.find(child => child.textContent === label);
    assert.ok(row, `Power should offer "${label}"`);
    row.dispatchEvent({ type: 'click' });
};

test('the shared model normalizes stored values and keeps custom presets', () => {
    assert.equal(saverWaitMinutes('10 minutes'), 10);
    assert.equal(saverWaitMinutes(-1), 0);
    assert.equal(saverWaitMinutes('not a number'), 0);
    assert.equal(saverWaitMinutes(undefined), 0);
    assert.deepEqual(saverWaitOptions(5).map(option => option.label),
        ['Never', '1 minute', '5 minutes', '10 minutes', '30 minutes']);
    assert.deepEqual(saverWaitOptions(45)[0], { value: '45', label: '45 minutes (custom)' });
    assert.equal(saverWaitOptions(0).some(option => option.label.includes('custom')), false);
});

test('a wait set in Display survives opening and confirming Power', async () => {
    const s = makeSystem();
    const display = displayProperties(s);
    setDisplayWait(display, 45);
    await display.apply();
    assert.equal(s.settings.get('saverMinutes'), 45);

    const power = settingsApplet(s, 'power');
    assert.equal(powerLabel(power), '45 minutes (custom)', 'Power must show the value Display owns');
    await power.apply();
    assert.equal(s.settings.get('saverMinutes'), 45, 'OK without touching the list must not reset the wait');
    assert.equal(s.settings.get('applet-power'), undefined, 'no shadow copy may be written');
});

test('a Power preset writes minutes and Display reads them back', async () => {
    const s = makeSystem();
    const power = settingsApplet(s, 'power');
    assert.equal(powerLabel(power), 'Never');

    choosePower(power, '10 minutes');
    await power.apply();
    assert.equal(s.settings.get('saverMinutes'), 10);
    assert.equal(s.settings.get('applet-power'), undefined);

    const display = displayProperties(s);
    assert.equal(displayWait(display).getAttribute('value'), '10');
});

test('Power keeps a value that is not one of its presets', async () => {
    const s = makeSystem({ saverMinutes: 13 });
    const power = settingsApplet(s, 'power');
    assert.equal(powerLabel(power), '13 minutes (custom)');
    await power.apply();
    assert.equal(s.settings.get('saverMinutes'), 13);
});

test('both dialogs follow the shared setting while they are open', () => {
    const s = makeSystem({ saverMinutes: 5 });
    const display = displayProperties(s);
    const power = settingsApplet(s, 'power');

    s.settings.set('saverMinutes', 30);
    assert.equal(displayWait(display).value, '30');
    assert.equal(powerLabel(power), '30 minutes');

    s.settings.set('saverMinutes', 45);
    assert.equal(displayWait(display).value, '45');
    assert.equal(powerLabel(power), '45 minutes (custom)');
});

test('closing a property sheet releases its settings listener', () => {
    const s = makeSystem();
    const power = settingsApplet(s, 'power');
    let listening = true;
    const remove = s.settings.removeEventListener.bind(s.settings);
    s.settings.removeEventListener = (...args) => { listening = false; remove(...args); };
    power.close();
    assert.equal(listening, false);
    s.settings.set('saverMinutes', 1);
    assert.equal(powerLabel(power), 'Never', 'a closed dialog must not keep painting');
});
