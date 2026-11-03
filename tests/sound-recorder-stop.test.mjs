/* Stop closes the recording's AudioContext, and so does the recorder's own stop
   event a moment later. Closing a closed context rejects with InvalidStateError,
   so each context must be closed exactly once. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom, Element } from './dom-shim.mjs';

installDom();
globalThis.devicePixelRatio = 1;
Object.defineProperty(globalThis, 'navigator', {
    value: { language: 'en-US', mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() { } }] }) } },
    configurable: true
});
document.documentElement = document.createElement('html');
Element.prototype.getContext = () => new Proxy({}, { get: (target, key) => key in target ? target[key] : () => { }, set: () => true });
Element.prototype.pause = () => { };
Object.defineProperty(Element.prototype, 'firstChild', { get() { return this.childNodes[0]; }, configurable: true });
Object.defineProperty(Element.prototype, 'lastChild', { get() { return this.childNodes.at(-1); }, configurable: true });
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => { };
const contexts = [];
globalThis.AudioContext = class {
    constructor() { this.state = 'running'; this.closes = 0; contexts.push(this); }
    createAnalyser() { return { fftSize: 0, getByteTimeDomainData() { } }; }
    createMediaStreamSource() { return { connect() { } }; }
    close() {
        this.closes++;
        if (this.state === 'closed')
            return Promise.reject(new Error('InvalidStateError'));
        this.state = 'closed';
        return Promise.resolve();
    }
};
const recorders = [];
globalThis.MediaRecorder = class {
    constructor() { this.state = 'inactive'; recorders.push(this); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; }
};
URL.createObjectURL = () => 'blob:test';
URL.revokeObjectURL = () => { };
register('./win95-resolver.mjs', import.meta.url);
const { soundRecorder } = await import('../src/packages/apps/multimedia.js');

const makeSystem = () => ({
    settings: { get: (k, d) => d, set() { }, addEventListener() { }, removeEventListener() { } },
    ui: { message() { }, error() { }, file: async () => null },
    wm: {
        create: () => ({ body: document.createElement('div'), element: document.createElement('div'), rect: {}, onClosed: [], setMenu() { }, setTitle() { }, status() { }, close() { } })
    }
});
const press = (w, label) => w.body.querySelectorAll('button').find(b => b.attributes['aria-label'] === label).dispatchEvent({ type: 'click' });
const settle = () => new Promise(r => setTimeout(r, 0));

test('stopping a recording closes its audio context exactly once', async () => {
    const rejections = [];
    const note = reason => rejections.push(reason);
    process.on('unhandledRejection', note);
    const w = soundRecorder(makeSystem());
    press(w, 'Record');
    await settle();
    const [first] = contexts;
    assert.equal(recorders.length, 1);
    press(w, 'Stop');
    recorders[0].onstop();
    await settle();
    process.off('unhandledRejection', note);
    assert.equal(first.closes, 1, 'the second close is skipped');
    assert.deepEqual(rejections, [], 'no InvalidStateError escapes');
});

test('a late stop event never closes the context of a newer recording', async () => {
    const w = soundRecorder(makeSystem());
    press(w, 'Record');
    await settle();
    const old = contexts.at(-1), oldRecorder = recorders.at(-1);
    press(w, 'Stop');
    press(w, 'Record');
    await settle();
    const fresh = contexts.at(-1);
    assert.notEqual(fresh, old);
    oldRecorder.onstop();
    await settle();
    assert.equal(fresh.state, 'running');
});
