import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDom, keydown } from './dom-shim.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function sourceFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory())
            files.push(...await sourceFiles(full));
        else if (entry.name.endsWith('.js'))
            files.push(full);
    }
    return files;
}

const css = await readFile(path.join(root, 'src/styles.css'), 'utf8');
const rule = selector => [...css.matchAll(new RegExp(`(?:^|})${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^}]*)\\}`, 'g'))]
    .map(match => match[1]).join(';');

test('no slider is left to the browser', async () => {
    for (const file of await sourceFiles(path.join(root, 'src'))) {
        const text = await readFile(file, 'utf8');
        assert.doesNotMatch(text, /type: 'range'|type="range"/, `${path.relative(root, file)} still builds a native slider`);
    }
    assert.doesNotMatch(css, /accent-color/, 'nothing is tinted any more, everything is drawn');
    assert.doesNotMatch(css, /input\[type=range\]/, 'the native slider rule is gone');
});

test('the drawn trackbar keeps its geometry', () => {
    assert.match(rule('.win95-trackbar'), /position:relative;flex:none;touch-action:none/);
    assert.match(rule('.win95-trackbar.horizontal'), /flex:1;height:34px/);
    assert.match(rule('.win95-trackbar.vertical'), /width:58px;height:112px/);
    assert.match(rule('.win95-trackbar.horizontal .win95-trackbar-track'), /height:2px;box-shadow:0 1px #fff/, 'groove with its highlight');
    assert.match(rule('.win95-trackbar.horizontal .win95-trackbar-thumb'), /clip-path:polygon/, 'the pointer-shaped thumb');
    assert.match(rule('.win95-trackbar.vertical .win95-trackbar-thumb'), /box-shadow:inset -1px -1px #000,inset 1px 1px #fff/, 'the bevelled bar thumb');
    assert.match(rule('.win95-trackbar:focus-visible'), /outline:1px dotted #000/);
});

test('both former native sliders now come from the shared component', async () => {
    for (const file of ['src/packages/apps/control-panel.js', 'src/packages/apps/multimedia.js']) {
        const text = await readFile(path.join(root, file), 'utf8');
        assert.match(text, /import \{ trackbar \} from '@win95\/ui\/trackbar\.js'/, file);
        assert.match(text, /trackbar\(\{/, file);
    }
    const component = await readFile(path.join(root, 'src/packages/ui/trackbar.js'), 'utf8');
    assert.match(component, /export function trackbar\(/);
    assert.match(component, /role: 'slider'/);
    assert.match(component, /tabindex: '0'/);
    assert.match(component, /'aria-orientation': orientation/);
    assert.match(component, /ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step, PageDown: -pageStep, PageUp: pageStep/);
    assert.match(component, /setValue\(min\)/, 'Home');
    assert.match(component, /setValue\(max\)/, 'End');
});

test('the component behaves like a slider', async () => {
    installDom();
    globalThis.requestAnimationFrame = () => 0;
    const { trackbar } = await import('../src/packages/ui/trackbar.js');
    const seen = [];
    const bar = trackbar({ label: 'Double-click speed', value: 40, onChange: next => seen.push(next) });

    assert.equal(bar.getAttribute('role'), 'slider');
    assert.equal(bar.getAttribute('aria-label'), 'Double-click speed');
    assert.equal(bar.getAttribute('aria-valuemin'), '0');
    assert.equal(bar.getAttribute('aria-valuemax'), '100');
    assert.equal(bar.getAttribute('aria-valuenow'), '40');

    bar.value = 55;
    assert.equal(bar.getAttribute('aria-valuenow'), '55', 'a programmatic move');
    assert.deepEqual(seen, [], 'does not report its own mirroring back to the caller');

    keydown(bar, 'ArrowRight');
    assert.equal(bar.value, 56);
    keydown(bar, 'PageUp');
    assert.equal(bar.value, 66);
    keydown(bar, 'End');
    assert.equal(bar.value, 100);
    keydown(bar, 'Home');
    assert.equal(bar.value, 0);
    assert.deepEqual(seen, [56, 66, 100, 0], 'keys report through onChange');

    bar.value = 500;
    assert.equal(bar.value, 100, 'clamped at the top');
    bar.max = 50;
    assert.equal(bar.getAttribute('aria-valuemax'), '50');
    assert.equal(bar.value, 50, 'a shrinking range pulls the thumb in');

    const stepped = trackbar({ label: 'Rate', min: 0, max: 100, step: 10, value: 0 });
    stepped.value = 34;
    assert.equal(stepped.value, 30, 'rounded onto the step');
});

test('the balance variant matches the volume control original', async () => {
    installDom();
    globalThis.requestAnimationFrame = () => 0;
    const { trackbar } = await import('../src/packages/ui/trackbar.js');
    const bar = trackbar({ label: 'Balance', min: -50, max: 50, value: 0, balance: true });
    assert.match(bar.getAttribute('class'), /balance/, 'the line-and-white-thumb look');
    assert.deepEqual([...bar.querySelectorAll('.win95-trackbar-tick')].map(t => t.style.left), ['25%', '50%', '75%'], 'ticks at the quarter points');
    assert.match(bar.querySelector('.win95-trackbar-thumb').innerHTML, /<svg/, 'the white point-down thumb');
});

test('the channel variant carries a ruled scale like the original seek bar', async () => {
    installDom();
    globalThis.requestAnimationFrame = () => 0;
    const { trackbar } = await import('../src/packages/ui/trackbar.js');
    const bar = trackbar({ label: 'Playback position', min: 0, max: 6, channel: true, ruler: at => at.toFixed(2) });
    assert.match(bar.getAttribute('class'), /channel/, 'the white channel look');
    const ruler = bar.querySelector('.win95-trackbar-ruler');
    assert.ok(ruler, 'the scale row exists');
    const labels = [...ruler.querySelectorAll('.win95-trackbar-ruler-label')].map(n => n.textContent);
    assert.deepEqual(labels, ['0.00', '1.00', '2.00', '3.00', '4.00', '5.00', '6.00'], 'a tick and its number across the span, the total at the end');
    assert.equal(ruler.querySelectorAll('.win95-trackbar-ruler-tick').length, labels.length);

    bar.max = 300;
    const wider = [...bar.querySelectorAll('.win95-trackbar-ruler-label')].map(n => n.textContent);
    assert.deepEqual(wider, ['0.00', '60.00', '120.00', '180.00', '240.00', '300.00'], 'the scale picks a step that fits');

    bar.max = 5.02;
    const odd = [...bar.querySelectorAll('.win95-trackbar-ruler-label')].map(n => n.textContent);
    assert.deepEqual(odd, ['0.00', '1.00', '2.00', '3.00', '4.00', '5.02'], 'a total between steps keeps its own end label');
    assert.equal(bar.querySelectorAll('.win95-trackbar-ruler-tick').length, 7, 'the unlabeled step tick before the total still shows');
    bar.ruler = at => `f${Math.round(at)}`;
    assert.equal(bar.querySelector('.win95-trackbar-ruler-label').textContent, 'f0', 'the scale can be re-labelled');

    const plain = trackbar({ label: 'Speed' });
    assert.equal(plain.querySelector('.win95-trackbar-ruler').childNodes.length, 0, 'applet sliders stay unrulled');
});
