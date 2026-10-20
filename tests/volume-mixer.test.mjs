import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_VOLUME, mixChannels, mixKeys, mixLevel, mixPan, createMixer } from '../src/packages/core/mixer.js';

/**
 * The Volume Control window used to write settings that nothing read. The
 * mixer is the reader: these tests pin the arithmetic it applies and the graph
 * it builds, so a fader that stops reaching a speaker fails here rather than
 * silently storing a number again.
 */

const settingsFor = (values = {}) => ({ get: (name, fallback) => values[name] ?? fallback });

class FakeParam {
    constructor() { this.value = 1; }
}

class FakeNode {
    constructor(name) { this.name = name; this.gain = new FakeParam(); this.pan = new FakeParam(); this.connections = []; }
    connect(node) { this.connections.push(node); return node; }
}

class FakeContext {
    constructor() { this.state = 'running'; this.destination = new FakeNode('destination'); this.currentTime = 0; this.resumed = 0; }
    createGain() { return new FakeNode('gain'); }
    createStereoPanner() { return new FakeNode('panner'); }
    createMediaElementSource(media) {
        const node = new FakeNode('source');
        node.connect = target => { media.routed = target; return target; };
        return node;
    }
    resume() { this.resumed++; this.state = 'running'; return Promise.resolve(); }
}

class FakeSettings extends EventTarget {
    constructor(values = {}) { super(); this.values = { ...values }; }
    get(name, fallback) { return this.values[name] ?? fallback; }
    set(name, value) { this.values[name] = value; this.dispatchEvent(new CustomEvent('change', { detail: { name, value } })); }
}

const withAudio = run => {
    const previousWindow = globalThis.window, previousDocument = globalThis.document;
    globalThis.window = { AudioContext: FakeContext };
    globalThis.document = { addEventListener() { }, removeEventListener() { } };
    try {
        return run();
    }
    finally {
        globalThis.window = previousWindow;
        globalThis.document = previousDocument;
    }
};

test('a channel is the master fader times its own strip', () => {
    assert.equal(mixChannels().join(','), 'master,wave,midi,cd');
    assert.equal(DEFAULT_VOLUME, 80, 'every fader starts at 80 percent');
    assert.equal(mixLevel(settingsFor(), 'master'), 0.8);
    assert.equal(mixLevel(settingsFor(), 'wave'), 0.8 * 0.8);
    assert.equal(mixLevel(settingsFor({ volume: 100, waveVolume: 100 }), 'wave'), 1);
    assert.equal(mixLevel(settingsFor({ volume: 50, cdVolume: 40 }), 'cd'), 0.2);
    assert.equal(mixLevel(settingsFor({ volume: 150, waveVolume: 150 }), 'wave'), 1, 'a fader past the top is clamped');
    assert.equal(mixLevel(settingsFor({ volume: -20 }), 'wave'), 0);
});

test('muting either the strip or the master silences that channel', () => {
    assert.equal(mixLevel(settingsFor({ muted: true, waveVolume: 100 }), 'wave'), 0);
    assert.equal(mixLevel(settingsFor({ muted: true }), 'master'), 0);
    assert.equal(mixLevel(settingsFor({ waveVolumeMuted: true, waveVolume: 100 }), 'wave'), 0);
    assert.equal(mixLevel(settingsFor({ waveVolumeMuted: true }), 'cd'), 0.8 * 0.8, 'one strip muted leaves the others alone');
});

test('balance pans, and the master balance adds to the strip balance', () => {
    assert.equal(mixPan(settingsFor(), 'wave'), 0);
    assert.equal(mixPan(settingsFor({ waveBalance: 50 }), 'wave'), 1);
    assert.equal(mixPan(settingsFor({ waveBalance: -25 }), 'wave'), -0.5);
    assert.equal(mixPan(settingsFor({ balance: 20, waveBalance: 10 }), 'wave'), 0.6);
    assert.equal(mixPan(settingsFor({ balance: 50, waveBalance: 50 }), 'wave'), 1, 'clamped to hard right');
    assert.equal(mixPan(settingsFor({ balance: -50, waveBalance: 50 }), 'wave'), 0);
    assert.equal(mixPan(settingsFor({ balance: -50 }), 'master'), -1, 'the master fader pans on its own');
});

test('the strip keys are the ones the Volume Control window writes', () => {
    assert.deepEqual(mixKeys('master'), { volume: 'volume', muted: 'muted', balance: 'balance' });
    assert.deepEqual(mixKeys('wave'), { volume: 'waveVolume', muted: 'waveVolumeMuted', balance: 'waveBalance' });
    assert.deepEqual(mixKeys('midi'), { volume: 'midiVolume', muted: 'midiVolumeMuted', balance: 'midiBalance' });
    assert.deepEqual(mixKeys('cd'), { volume: 'cdVolume', muted: 'cdVolumeMuted', balance: 'cdBalance' });
});

test('a media element follows its strip while it plays', () => withAudio(() => {
    const settings = new FakeSettings({ volume: 100, waveVolume: 100 });
    const mixer = createMixer(settings);
    const media = { volume: 1 };
    mixer.attach(media, 'wave');
    assert.equal(media.routed.gain.value, 1, 'the element is routed through the strip');
    assert.equal(media.volume, 1, 'the element volume is left alone once it is in the graph');
    settings.set('waveVolume', 25);
    assert.equal(media.routed.gain.value, 0.25, 'moving the fader is heard without reopening the player');
    settings.set('waveBalance', -50);
    const panner = media.routed.connections[0];
    assert.equal(panner.name, 'panner', 'the strip gain feeds the panner');
    assert.equal(panner.connections[0].name, 'destination', 'and the panner feeds the speakers');
    assert.equal(mixer.node('wave').gain, 0.25);
    assert.equal(mixer.node('wave').pan, -1);
    settings.set('muted', true);
    assert.equal(mixer.node('wave').gain, 0, 'Mute all silences the strip');
    settings.set('muted', false);
    assert.equal(mixer.node('wave').gain, 0.25);
}));

test('attaching the same element twice does not build a second graph node', () => withAudio(() => {
    const mixer = createMixer(new FakeSettings());
    const media = { volume: 1 };
    mixer.attach(media, 'wave');
    const first = media.routed;
    mixer.attach(media, 'wave');
    assert.equal(media.routed, first);
    assert.equal(mixer.node('wave').gain, 0.8 * 0.8);
}));

test('without Web Audio the element volume still follows its strip', () => {
    const settings = new FakeSettings({ volume: 100, waveVolume: 100 });
    const mixer = createMixer(settings);
    const media = { volume: 1 };
    mixer.attach(media, 'wave');
    assert.equal(media.routed, undefined, 'nothing was routed');
    assert.equal(media.volume, 1);
    settings.set('waveVolume', 10);
    assert.equal(media.volume, 0.1, 'the fallback keeps the fader real');
});

test('the shell and the players all go through the mixer', async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const read = file => readFile(path.join(root, file), 'utf8');
    const main = await read('src/main.js');
    const media = await read('src/packages/apps/multimedia.js');
    assert.match(main, /s\.mixer = createMixer\(s\.settings\)/, 'the desktop owns one mixer');
    assert.match(main, /s\.mixer\.attach\(audio, 'wave'\)/, 'the system sounds are on the Wave strip');
    assert.match(main, /const output = s\.mixer\.input\('wave'\)/, 'the shell beeps feed the Wave strip');
    assert.doesNotMatch(main, /gain\.connect\(s\.audio\.destination\)/, 'no beep bypasses the mixer');
    assert.match(media, /value: s\.settings\.get\(key, DEFAULT_VOLUME\)/, 'the faders start at the shared default');
    assert.match(media, /s\.mixer\?\.attach\(media, cd \? 'cd' : 'wave'\)/, 'the players attach their element');
    assert.match(media, /s\.mixer\?\.attach\(audio, 'wave'\)/, 'the recorder playback attaches too');
    assert.doesNotMatch(media, /applyVolume/, 'the once-at-open volume is gone');
});
