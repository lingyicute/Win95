/**
 * The mixer behind the Volume Control window.
 *
 * The sliders used to store their positions and nothing read them: the only
 * values that reached a speaker were the master volume, sampled once when a
 * player opened, and the master mute. Every sound the desktop makes now runs
 * through one Web Audio graph - the system sounds, both players, the recorder
 * playback and the shell's beeps - so dragging a fader changes the loudness of
 * whatever is already playing, the balance pans it, and "Mute all" silences the
 * machine.
 *
 * The channels and their settings keys are the ones the Volume Control window
 * names: 'volume' and 'muted' are the master fader, the other three are the
 * mixer strips below it. Gain is the master fader times the strip, which is
 * what a real mixer does; a strip muted on its own fader stays silent even
 * when the master is up, and the master silences everything.
 */

const CHANNELS = {
    master: { volume: 'volume', muted: 'muted', balance: 'balance' },
    wave: { volume: 'waveVolume', muted: 'waveVolumeMuted', balance: 'waveBalance' },
    midi: { volume: 'midiVolume', muted: 'midiVolumeMuted', balance: 'midiBalance' },
    cd: { volume: 'cdVolume', muted: 'cdVolumeMuted', balance: 'cdBalance' }
};

const MIX_KEYS = new Set(Object.values(CHANNELS).flatMap(keys => Object.values(keys)));
/** Every fader starts at 80, master and strips alike, until the settings say otherwise. */
export const DEFAULT_VOLUME = 80;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const mixChannels = () => Object.keys(CHANNELS);
/** The settings keys a channel drives; the Volume Control window writes the same ones. */
export const mixKeys = channel => CHANNELS[channel] || CHANNELS.wave;
const keysFor = mixKeys;

/** Linear gain for a channel: the master fader times its own, or zero muted. */
export function mixLevel(settings, channel = 'wave') {
    if (settings.get('muted', false))
        return 0;
    const keys = keysFor(channel);
    if (keys !== CHANNELS.master && settings.get(keys.muted, false))
        return 0;
    const master = clamp(settings.get('volume', DEFAULT_VOLUME) / 100, 0, 1);
    const own = channel === 'master' ? 1 : clamp(settings.get(keys.volume, DEFAULT_VOLUME) / 100, 0, 1);
    return master * own;
}

/** Stereo position from -1 (left) to 1 (right); master and strip balance add. */
export function mixPan(settings, channel = 'wave') {
    const keys = keysFor(channel);
    const master = clamp(settings.get('balance', 0), -50, 50);
    const own = channel === 'master' ? 0 : clamp(settings.get(keys.balance, 0), -50, 50);
    return clamp((master + own) / 50, -1, 1);
}

/**
 * One gain and one panner node per channel, plus the attachment bookkeeping for
 * media elements. A browser without Web Audio still gets the element's own
 * volume applied, which is everything except panning.
 */
export function createMixer(settings) {
    const nodes = new Map();
    const plain = new Set();
    const routed = new WeakSet();
    let audio = null;
    const resume = () => {
        if (audio?.state === 'suspended')
            audio.resume().catch(() => { });
    };
    const context = () => {
        if (!audio) {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            audio = new Ctor();
            // A browser may suspend the context while the page is in the
            // background; the first pointer anywhere brings the desktop back.
            if (typeof document !== 'undefined')
                document.addEventListener('pointerdown', resume, { passive: true });
        }
        resume();
        return audio;
    };
    const apply = (channel, node) => {
        node.gain.gain.value = mixLevel(settings, channel);
        if (node.panner)
            node.panner.pan.value = mixPan(settings, channel);
    };
    const chain = channel => {
        let node = nodes.get(channel);
        if (!node) {
            const ac = context();
            node = { gain: ac.createGain(), panner: ac.createStereoPanner ? ac.createStereoPanner() : null };
            if (node.panner) {
                node.gain.connect(node.panner);
                node.panner.connect(ac.destination);
            }
            else
                node.gain.connect(ac.destination);
            nodes.set(channel, node);
        }
        apply(channel, node);
        return node;
    };
    const refresh = () => {
        for (const [channel, node] of nodes)
            apply(channel, node);
        for (const entry of plain)
            entry.media.volume = mixLevel(settings, entry.channel);
    };
    settings.addEventListener('change', event => {
        if (MIX_KEYS.has(event.detail?.name))
            refresh();
    });
    return {
        /** Route a media element through the channel strip; safe to call twice. */
        attach(media, channel = 'wave') {
            if (!media || routed.has(media))
                return media;
            routed.add(media);
            try {
                context().createMediaElementSource(media).connect(chain(channel).gain);
                media.volume = 1;
            }
            catch {
                plain.add({ media, channel });
                media.volume = mixLevel(settings, channel);
            }
            return media;
        },
        /** A node a bare oscillator can feed, mixed like everything else. */
        input: channel => chain(channel).gain,
        /** The strip behind a channel, for the shell's own oscillators and tests. */
        node(channel) {
            const node = nodes.get(channel);
            return node ? { gain: node.gain.gain.value, pan: node.panner ? node.panner.pan.value : null } : null;
        },
        context,
        resume,
        refresh,
        level: channel => mixLevel(settings, channel),
        pan: channel => mixPan(settings, channel)
    };
}
