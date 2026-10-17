import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './dom-shim.mjs';

installDom();
globalThis.requestAnimationFrame = () => 0;
const { trackbar } = await import('../src/packages/ui/trackbar.js');

test('a disabled trackbar ignores pointer and keys', () => {
    const bar = trackbar({ label: 'Trail length', value: 50 });
    bar.disabled = true;
    bar.dispatchEvent({ type: 'pointerdown', button: 0, clientX: 123, clientY: 0 });
    assert.equal(bar.value, 50, 'a click on the greyed-out slider changes nothing');
    bar.dispatchEvent({ type: 'keydown', key: 'ArrowRight' });
    assert.equal(bar.value, 50, 'arrow keys are equally inert');
    bar.disabled = false;
    bar.dispatchEvent({ type: 'keydown', key: 'End' });
    assert.equal(bar.value, 100, 'the slider works again once enabled');
});

test('a trackbar drag ends when the capture is lost', () => {
    const bar = trackbar({ label: 'Volume', value: 0 });
    bar.dispatchEvent({ type: 'pointerdown', button: 0, clientX: 200, clientY: 0 });
    assert.equal(bar.value, 100, 'the press jumps the thumb');
    bar.dispatchEvent({ type: 'pointermove', buttons: 1, clientX: 5 });
    assert.equal(bar.value, 0, 'a held drag follows the pointer');
    bar.dispatchEvent({ type: 'lostpointercapture' });
    bar.dispatchEvent({ type: 'pointermove', buttons: 0, clientX: 200 });
    assert.equal(bar.value, 0, 'a bare move after a lost capture does not slide');
});
