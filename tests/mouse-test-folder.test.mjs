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
const { settingsApplet, doubleClickInterval } = await import('../src/packages/apps/control-panel.js');
const { ICON_DATA } = await import('../src/packages/ui/icon-data.js');

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

const openSheet = () => {
    const s = makeSystem();
    return { s, sheet: settingsApplet(s, 'mouse') };
};
const buttonsPage = sheet => sheet.body.children[1].children[0];
const folderOf = sheet => buttonsPage(sheet).querySelector('.mouse-test-folder');
const sliderOf = sheet => buttonsPage(sheet).querySelector('.win95-trackbar');

/* The double-click interval is measured on Date.now, so the test drives it. */
const withClock = () => {
    const real = Date.now;
    let now = 1_000_000;
    Date.now = () => now;
    return {
        click(node, at) { now = at; node.dispatchEvent({ type: 'click' }); },
        key(node, key) { node.dispatchEvent({ type: 'keydown', key, preventDefault() { } }); },
        restore() { Date.now = real; }
    };
};

test('the folder is the test area, and the old test button is gone', () => {
    const { sheet } = openSheet();
    const page = buttonsPage(sheet);
    const fieldset = page.querySelector('.mouse-test-area');
    assert.ok(fieldset, 'the test area is a group box');
    const buttons = fieldset.querySelectorAll('button');
    assert.equal(buttons.length, 1, 'only the folder is clickable');
    assert.equal(buttons[0], folderOf(sheet));
    assert.equal(buttons[0].getAttribute('aria-label'), 'Double-click to test');
    assert.equal(buttons[0].children.length, 1, 'the folder button holds its picture');
    assert.equal(page.querySelectorAll('button').length, 1, 'no separate test button remains');
});

test('the interval matches the slider position the rest of the desktop reads', () => {
    assert.equal(doubleClickInterval(0), 800);
    assert.equal(doubleClickInterval(50), 500);
    assert.equal(doubleClickInterval(100), 200);
    assert.equal(doubleClickInterval(undefined), 500);
});

test('a fast pair opens and closes the folder, a slow pair does neither', () => {
    const { sheet } = openSheet();
    const folder = folderOf(sheet);
    const clock = withClock();
    const picture = () => folder.children[0].getAttribute('src');
    const open = () => folder.getAttribute('aria-pressed');
    try {
        assert.equal(picture(), ICON_DATA['folder-32']);
        clock.click(folder, 0);
        clock.click(folder, 300);
        assert.equal(open(), 'true', 'two clicks inside 500 ms open the folder');
        assert.equal(picture(), ICON_DATA['folder-open-32'], 'the open picture takes over');
        clock.click(folder, 1000);
        clock.click(folder, 1600);
        assert.equal(open(), 'true', '600 ms apart is too slow to close it');
        clock.click(folder, 2000);
        clock.click(folder, 2300);
        assert.equal(open(), 'false', 'a fast pair closes it again');
        assert.equal(picture(), ICON_DATA['folder-32']);
    }
    finally {
        clock.restore();
    }
});

test('the slider changes what the folder accepts', () => {
    const { sheet } = openSheet();
    const folder = folderOf(sheet), slider = sliderOf(sheet);
    const clock = withClock();
    const open = () => folder.getAttribute('aria-pressed');
    try {
        clock.key(slider, 'End');
        assert.equal(slider.getAttribute('aria-valuenow'), '100', 'fastest position');
        clock.click(folder, 1000);
        clock.click(folder, 1300);
        assert.equal(open(), 'false', '300 ms is too slow for a 200 ms setting');
        clock.click(folder, 2000);
        clock.click(folder, 2100);
        assert.equal(open(), 'true', '100 ms is fast enough for a 200 ms setting');
        clock.key(slider, 'Home');
        assert.equal(slider.getAttribute('aria-valuenow'), '0', 'slowest position');
        clock.click(folder, 3000);
        clock.click(folder, 3600);
        assert.equal(open(), 'false', '600 ms is fast enough for an 800 ms setting');
    }
    finally {
        clock.restore();
    }
});

test('Apply stores the interval the slider shows', async () => {
    const { s, sheet } = openSheet();
    await sheet.apply();
    assert.equal(s.settings.get('doubleClickMs'), 500, 'the middle of the slider is the old default');
    sliderOf(sheet).dispatchEvent({ type: 'keydown', key: 'End', preventDefault() { } });
    await sheet.apply();
    assert.equal(s.settings.get('doubleClickMs'), 200);
    assert.equal(s.settings.get('applet-mouse').doubleClick, 100, 'the sheet reopens at the chosen speed');
});
