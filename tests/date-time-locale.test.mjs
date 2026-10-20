import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom, Element } from './dom-shim.mjs';

/**
 * The Date/Time sheet inside a Chinese desktop. Its calendar used to be English
 * in both places a language shows: the month combo read "October" and the
 * weekday head was the fixed row S M T W T F S. Both are now locale data taken
 * from the display language, which the English run in date-time.test.mjs does
 * not exercise.
 */
installDom();
globalThis.devicePixelRatio = 1;
Object.defineProperty(globalThis, 'navigator', { value: { language: 'zh-CN', languages: ['zh-CN'] }, configurable: true });
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

test('the calendar heads its columns in Chinese and names the month in Chinese', () => {
    const sheet = settingsApplet(makeSystem(), 'datetime');
    const page = sheet.body.children[1], grid = page.querySelector('.calendar-grid');
    const head = [...grid.querySelectorAll('.weekday')].map(node => node.textContent);
    assert.deepEqual(head, ['日', '一', '二', '三', '四', '五', '六'], 'Sunday first, as the column order requires');
    const month = page.querySelector('.win95-combo-value').textContent;
    assert.match(month, /月$/, `the combo shows a Chinese month, saw ${month}`);
    assert.doesNotMatch(month, /^[A-Z][a-z]+$/, 'no English month name survives');
    sheet.onClosed.forEach(fn => fn());
});
