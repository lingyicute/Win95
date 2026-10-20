import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

installDom();
globalThis.devicePixelRatio = 1;
globalThis.requestAnimationFrame = () => 0;
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-US' }, configurable: true });
document.documentElement = document.createElement('html');
register('./win95-resolver.mjs', import.meta.url);
const { settingsApplet } = await import('../src/packages/apps/control-panel.js');
const { volumeControl } = await import('../src/packages/apps/multimedia.js');

/**
 * Multimedia Properties and Volume Control are two views of one mixer. They
 * write the same settings keys, but each used to paint its controls once and
 * never look again: the sheet kept a copy of the volume it was opened with, so
 * pressing OK after moving a fader in Volume Control silently restored the old
 * level, and the faders stayed put when the sheet's slider moved. These tests
 * pin the shared-key behaviour: whichever window writes, the other moves.
 */

/** Settings with the real desktop's change event on every write. */
class Settings extends EventTarget {
    constructor(values = {}) { super(); this.values = { ...values }; }
    get(name, fallback) { return this.values[name] ?? fallback; }
    set(name, value) {
        this.values[name] = value;
        this.dispatchEvent(new CustomEvent('change', { detail: { name, value } }));
    }
}

const windowDouble = () => {
    const win = {
        body: document.createElement('div'),
        element: document.createElement('div'),
        onClosed: [],
        setMenu() { },
        close() { this.closed = true; for (const fn of this.onClosed) fn(); }
    };
    return win;
};

const systemWith = (values = {}) => {
    const s = {
        settings: new Settings(values),
        wm: { create: () => windowDouble() },
        ui: { message: async () => 'OK' },
        beep() { },
        launch() { },
        updateClock() { },
        about() { }
    };
    return s;
};

const bars = root => [...root.querySelectorAll('.win95-trackbar')];
/* The test DOM matches class and tag selectors only, so the checkbox is found
   by its tag and then filtered by type, the way a browser would. */
const boxes = root => [...root.querySelectorAll('input')].filter(node => node.getAttribute('type') === 'checkbox');
const audioPage = sheet => sheet.body.children[1].children[0];
const sheetVolume = sheet => audioPage(sheet).querySelector('.win95-trackbar');
const sheetMute = sheet => boxes(audioPage(sheet))[0];
const valuenow = node => Number(node.getAttribute('aria-valuenow'));
const keydown = (node, key) => node.dispatchEvent({ type: 'keydown', key, preventDefault() { } });

const openVolumeControl = (s) => {
    const w = volumeControl(s);
    const faders = bars(w.body).filter(b => b.classList.contains('vertical'));
    const balances = bars(w.body).filter(b => b.classList.contains('balance'));
    const mutes = boxes(w.body);
    const [master, wave, midi, cd] = faders;
    return { w, master, wave, midi, cd, masterBalance: balances[0], mutes };
};

test('the Volume Control faders follow a setting written anywhere else', () => {
    const s = systemWith();
    const { master, wave, masterBalance, mutes } = openVolumeControl(s);
    assert.equal(valuenow(master), 80, 'the master fader starts at the shared default');

    s.settings.set('volume', 35);
    assert.equal(valuenow(master), 35, 'the master fader moved with the key');
    s.settings.set('waveVolume', 12);
    assert.equal(valuenow(wave), 12, 'and so did the strip below it');
    s.settings.set('balance', -25);
    assert.equal(valuenow(masterBalance), -25, 'balance is a key like any other');
    s.settings.set('muted', true);
    assert.equal(mutes[0].checked, true, 'Mute all checks itself');
    s.settings.set('muted', false);
    assert.equal(mutes[0].checked, false, 'and clears itself');
});

test('a fader dragged in Volume Control still writes its key', () => {
    const s = systemWith();
    const { master } = openVolumeControl(s);
    keydown(master, 'ArrowLeft');
    assert.equal(s.settings.get('volume'), 79, 'the drag reaches the settings the mixer reads');
    assert.equal(valuenow(master), 79, 'and the thumb stays where it was put');
});

test('the Multimedia sheet writes the volume while the slider moves', () => {
    const s = systemWith();
    const sheet = settingsApplet(s, 'multimedia');
    const slider = sheetVolume(sheet);
    assert.equal(valuenow(slider), 80, 'the sheet opens on the current volume');

    keydown(slider, 'ArrowRight');
    assert.equal(s.settings.get('volume'), 81, 'no OK has been pressed and the mixer already knows');
    assert.equal(valuenow(slider), 81);

    sheetMute(sheet).checked = true;
    sheetMute(sheet).dispatchEvent({ type: 'change', target: sheetMute(sheet) });
    assert.equal(s.settings.get('muted'), true, 'Mute all sounds is just as immediate');
});

test('the sheet follows changes made in Volume Control, and OK keeps them', async () => {
    const s = systemWith();
    const sheet = settingsApplet(s, 'multimedia');
    const slider = sheetVolume(sheet);

    s.settings.set('volume', 42);
    assert.equal(valuenow(slider), 42, 'the slider moves without being touched');

    /* The bug this pins: OK used to write the volume the sheet opened with,
       undoing whatever Volume Control had done in the meantime. */
    await sheet.apply();
    assert.equal(s.settings.get('volume'), 42, 'OK commits the value on screen, not the stale one');

    s.settings.set('muted', true);
    assert.equal(sheetMute(sheet).checked, true, 'Mute all in Volume Control checks this box too');
});

test('the two windows really are one mixer, in both directions at once', () => {
    const s = systemWith();
    const sheet = settingsApplet(s, 'multimedia');
    const { master } = openVolumeControl(s);

    keydown(sheetVolume(sheet), 'ArrowLeft');
    keydown(sheetVolume(sheet), 'ArrowLeft');
    assert.equal(valuenow(master), 78, 'Volume Control shows the sheet');

    keydown(master, 'ArrowUp');
    assert.equal(valuenow(sheetVolume(sheet)), 79, 'the sheet shows Volume Control');

    s.settings.set('waveVolume', 30);
    assert.equal(s.settings.get('waveVolume'), 30, 'the strips nobody else shows are unaffected');
});

test('the sheet opens on the live volume, not on the draft it stored last time', async () => {
    /* Closing the sheet writes its fields to 'applet-multimedia'. Volume
       Control can move the master afterwards, so a sheet that trusts that
       stored draft would come back one step behind the mixer - and commit it
       again on OK. */
    const s = systemWith({ volume: 70, muted: false, 'applet-multimedia': { volume: 60 } });
    const sheet = settingsApplet(s, 'multimedia');
    assert.equal(valuenow(sheetVolume(sheet)), 70, 'the slider shows the mixer, not the stored draft');
    await sheet.apply();
    assert.equal(s.settings.get('volume'), 70, 'and OK does not put the stale level back');
});

test('closing a window stops it listening to the shared keys', () => {
    const s = systemWith();
    const { w, master } = openVolumeControl(s);
    const sheet = settingsApplet(s, 'multimedia');

    w.close();
    s.settings.set('volume', 10);
    assert.equal(valuenow(master), 80, 'a closed Volume Control no longer redraws');
    assert.equal(valuenow(sheetVolume(sheet)), 10, 'but the sheet that is still open does');

    sheet.close();
    s.settings.set('volume', 55);
    assert.equal(valuenow(sheetVolume(sheet)), 10, 'and a closed sheet is quiet too');
});
