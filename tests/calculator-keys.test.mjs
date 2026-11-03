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

const key = (sheet, label) => {
    const pads = [sheet.body.children[1], sheet.body.children[2], sheet.body.children[3]];
    const found = pads.flatMap(pad => [...pad.children]).find(n => n.textContent === label);
    assert.ok(found, `key ${label} exists`);
    return found;
};
const press = (sheet, ...keys) => {
    for (const k of keys)
        key(sheet, k).dispatchEvent({ type: 'click' });
    return sheet.body.children[0];
};

test('Backspace never leaves a bare minus sign behind', () => {
    const sheet = calculator(makeSystem());
    assert.equal(press(sheet, '5', '±').value, '-5');
    assert.equal(press(sheet, 'Backspace').value, '0', '-5 rubbed out is 0, not "-"');
    assert.equal(press(sheet, '7', '+', '1', '=').value, '8', 'the next sum starts from a real number');
});

test('the sign key keeps a decimal point that is still being typed', () => {
    const sheet = calculator(makeSystem());
    assert.equal(press(sheet, '5', '.', '±').value, '-5.');
    assert.equal(press(sheet, '2').value, '-5.2');
    assert.equal(press(sheet, '±').value, '5.2');
});

test('trigonometry in degrees returns exact zeros instead of rounding noise', () => {
    const sheet = calculator(makeSystem());
    assert.equal(press(sheet, '1', '8', '0', 'sin').value, '0', 'sin 180');
    assert.equal(press(sheet, 'C', '9', '0', 'cos').value, '0', 'cos 90');
    assert.equal(press(sheet, 'C', '3', '6', '0', '0', 'sin').value, '0', 'sin 3600');
    assert.equal(press(sheet, 'C', '3', '0', 'sin').value, '0.5', 'sin 30');
    assert.equal(press(sheet, 'C', '4', '5', 'tan').value, '1', 'tan 45');
});

test('tan of 90 degrees is an error, not a huge number', () => {
    const sheet = calculator(makeSystem());
    assert.equal(press(sheet, '9', '0', 'tan').value, 'Error');
    assert.equal(press(sheet, 'C', '2', '7', '0', 'tan').value, 'Error');
});

test('Backspace does not leave a negative zero behind', () => {
    const sheet = calculator(makeSystem());
    assert.equal(press(sheet, '0', '.', '±').value, '-0.');
    assert.equal(press(sheet, 'Backspace').value, '0', '-0. rubbed out is 0, not "-0"');
});

test('a division by zero mid-expression clears the pending operator and M+ ends the entry', () => {
    const sheet = calculator(makeSystem());
    assert.equal(press(sheet, '1', '÷', '0', '+').value, 'Error');
    assert.equal(press(sheet, '5', '=').value, '5', 'Error clears the pending sum instead of poisoning acc with NaN');
    assert.equal(press(sheet, '1', '÷', '0', '=').value, 'Error');
    assert.equal(press(sheet, '5', '=').value, '5', 'Error on equals clears lastOp and lastArg too');
    assert.equal(press(sheet, 'C', '4', 'M+', '7').value, '7', 'typing after M+ starts a new entry');
    assert.equal(press(sheet, 'MR').value, '4');
});
