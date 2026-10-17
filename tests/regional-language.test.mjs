import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

installDom();
globalThis.devicePixelRatio = 1;
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-US' }, configurable: true });
document.documentElement = document.createElement('html');
register('./win95-resolver.mjs', import.meta.url);
const { settingsApplet } = await import('../src/packages/apps/control-panel.js');

class Settings extends EventTarget {
    constructor(values) { super(); this.values = { ...values }; }
    get(key, fallback) { return this.values[key] ?? fallback; }
    set(key, value) { this.values[key] = value; }
}

const makeSystem = (messageChoice, restartResult = true) => {
    const messages = [], restarts = [];
    return {
        messages,
        restarts,
        settings: new Settings({ 'ui-language': 'en' }),
        updateClock() { },
        ui: { message: async (...args) => { messages.push(args); return messageChoice; } },
        restart: async window => { restarts.push(window); return restartResult; },
        wm: {
            create() {
                return {
                    body: document.createElement('div'),
                    element: document.createElement('div'),
                    onClosed: [],
                    setMenu() { },
                    close() { this.closed = true; },
                };
            }
        }
    };
};

function selectChineseLanguage(sheet) {
    sheet.body.children[0].children[1].dispatchEvent({ type: 'click' });
    const language = sheet.body.children[1].querySelector('.win95-combo');
    language.dispatchEvent({ type: 'keydown', key: 'ArrowDown' });
    language.dispatchEvent({ type: 'keydown', key: 'ArrowDown' });
    language.dispatchEvent({ type: 'keydown', key: 'Enter' });
    assert.equal(language.value, 'zh');
}

test('Apply without changing the UI language does not prompt or restart', async () => {
    const s = makeSystem('OK');
    const sheet = settingsApplet(s, 'regional');
    sheet.body.children[2].children[2].dispatchEvent({ type: 'click' });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(s.messages, []);
    assert.deepEqual(s.restarts, []);
    assert.equal(s.settings.get('ui-language'), 'en');
});

test('Apply prompts and restarts when the UI language changes', async () => {
    const s = makeSystem('OK');
    const sheet = settingsApplet(s, 'regional');
    selectChineseLanguage(sheet);
    sheet.body.children[2].children[2].dispatchEvent({ type: 'click' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(s.messages[0][1], 'Language Change');
    assert.equal(s.settings.get('ui-language'), 'zh');
    assert.deepEqual(s.restarts, [sheet]);
});

test('OK uses the same confirmation and restart path as Apply', async () => {
    const s = makeSystem('OK');
    const sheet = settingsApplet(s, 'regional');
    selectChineseLanguage(sheet);
    sheet.body.children[2].children[0].dispatchEvent({ type: 'click' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(s.messages[0][1], 'Language Change');
    assert.deepEqual(s.restarts, [sheet]);
    assert.equal(sheet.closed, true);
});

test('Canceling the restart prompt keeps the previous language and does not restart', async () => {
    const s = makeSystem('Cancel');
    const sheet = settingsApplet(s, 'regional');
    selectChineseLanguage(sheet);
    await sheet.apply('apply');
    assert.equal(s.settings.get('ui-language'), 'en');
    assert.deepEqual(s.restarts, []);
});

test('a blocked restart is reported and the unapplied language choice is rolled back', async () => {
    const s = makeSystem('OK', false);
    const sheet = settingsApplet(s, 'regional');
    selectChineseLanguage(sheet);
    await sheet.apply('apply');
    assert.equal(s.settings.get('ui-language'), 'en');
    assert.equal(s.messages[1][1], 'Restart Windows');
});
