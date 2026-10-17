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
Element.prototype.focus = Element.prototype.focus || function () { };
register('./win95-resolver.mjs', import.meta.url);
const { calculator } = await import('../src/packages/apps/documents.js');

const makeSystem = () => ({
    copyText() { },
    pasteText: async () => null,
    wm: {
        create() {
            return {
                body: document.createElement('div'),
                element: document.createElement('div'),
                rect: {},
                onClosed: [],
                setMenu() { },
                status() { },
                close() { this.closed = true; }
            };
        }
    }
});

const press = (sheet, ...keys) => {
    const pad = sheet.body.children[3];
    for (const k of keys) {
        const b = [...pad.children].find(n => n.textContent === k);
        assert.ok(b, `key ${k} exists`);
        b.dispatchEvent({ type: 'click' });
    }
    return sheet.body.children[0];
};

test('percent ends the entry so typing starts a new number', () => {
    const sheet = calculator(makeSystem());
    const display = press(sheet, '5', '0', '+', '1', '0', '%');
    assert.equal(display.value, '5', '10% of 50 is 5');
    assert.equal(press(sheet, '2').value, '2', 'a digit after % starts fresh instead of appending');
});

test('equals after a percent still finishes the pending sum', () => {
    const sheet = calculator(makeSystem());
    const display = press(sheet, '5', '0', '+', '1', '0', '%', '=');
    assert.equal(display.value, '55', '50 plus 10% of 50');
});
