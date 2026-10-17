import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    DIGIT_SEGMENTS, FACES, FLAG_MARKUP, MINE_MARKUP, SEGMENTS, WRONG_FLAG_MARKUP,
    cellClass, cellMarkup, counterChars, counterMarkup, faceFor, faceMarkup, litSegments
} from '../src/packages/games/mines-display.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digits = html => [...html.matchAll(/<span class="mines-digit">([\s\S]*?)<\/span>/g)].map(m => m[1]);
const litIn = digitHTML => [...digitHTML.matchAll(/mines-segment-([a-g])( is-lit)?/g)]
    .filter(m => m[2]).map(m => m[1]).join('');

test('a counter shows three characters, with a minus in front of negatives', () => {
    assert.equal(counterChars(10), '010');
    assert.equal(counterChars(0), '000');
    assert.equal(counterChars(7), '007');
    assert.equal(counterChars(999), '999');
    assert.equal(counterChars(1234), '999');
    assert.equal(counterChars(-1), '-01');
    assert.equal(counterChars(-12), '-12');
    assert.equal(counterChars(-99), '-99');
    assert.equal(counterChars(-250), '-99');
    assert.equal(counterChars(-0.4), '000', 'a fraction never turns into a sign');
    assert.equal(counterChars(Number.NaN), '000');
});

test('every digit lights the segments of a seven-segment display', () => {
    assert.deepEqual(SEGMENTS, [...'abcdefg']);
    assert.deepEqual(DIGIT_SEGMENTS, ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg']);
    assert.equal(litSegments('8').length, 7, 'eight lights everything');
    assert.equal(litSegments('1').length, 2, 'one is the right-hand pair');
    assert.equal(litSegments('0').join(''), 'abcdef', 'zero keeps the middle bar dark');
    assert.equal(litSegments('7').join(''), 'abc');
    assert.deepEqual(litSegments('-'), ['g'], 'the sign is the middle bar alone');
});

test('the counter markup draws all seven segments per digit and lights the right ones', () => {
    const html = counterMarkup(10);
    const found = digits(html);
    assert.equal(found.length, 3);
    for (const digit of found)
        assert.equal([...digit.matchAll(/mines-segment-[a-g]/g)].length, 7, 'unlit segments stay visible');
    assert.equal(litIn(found[0]), 'abcdef', '0 (tens)');
    assert.equal(litIn(found[1]), 'bc', '1 (ones)');
    assert.equal(litIn(found[2]), 'abcdef', '0 (hundreds)');
});

test('a negative counter marks the sign with the middle bar', () => {
    const found = digits(counterMarkup(-2));
    assert.equal(litIn(found[0]), 'g');
    assert.equal(litIn(found[1]), 'abcdef', '0 (tens)');
    assert.equal(litIn(found[2]), 'abdeg', '2 (ones)');
});

test('the four faces differ exactly where they should', () => {
    assert.deepEqual(FACES, ['smile', 'pressed', 'lost', 'won']);
    const smile = faceMarkup('smile');
    const pressed = faceMarkup('pressed');
    const lost = faceMarkup('lost');
    const won = faceMarkup('won');
    for (const face of [smile, pressed, lost, won]) {
        assert.match(face, /viewBox="0 0 20 20"/);
        assert.match(face, /<circle cx="10" cy="10" r="9" fill="#ff0" stroke="#000"\/>/, 'yellow face with a black outline');
    }
    const withoutMouth = (html, mouth) => html.replace(mouth, '');
    assert.equal(withoutMouth(smile, '<path d="M5 11Q10 18 15 11"/>'), withoutMouth(pressed, '<ellipse cx="10" cy="13" rx="2" ry="3" fill="#000"/>'), 'only the mouth changes while the mouse is held');
    assert.match(pressed, /<ellipse cx="10" cy="13" rx="2" ry="3"/, 'open mouth');
    assert.match(smile, /M5 11Q10 18 15 11/, 'smile');
    assert.match(lost, /M5 5L8 8M8 5L5 8M12 5L15 8M15 5L12 8/, 'crossed eyes');
    assert.match(lost, /M5 15Q10 9 15 15/, 'frown');
    assert.doesNotMatch(lost, /Q10 18/);
    assert.match(won, /M3 5H17M4 6L5 9H8L9 6M11 6L12 9H15L16 6/, 'sunglasses');
    assert.match(won, /M5 11Q10 18 15 11/, 'still smiling');
});

test('the face follows the game, and a held-down mouse only matters while playing', () => {
    assert.equal(faceFor('ready', false), 'smile');
    assert.equal(faceFor('playing', false), 'smile');
    assert.equal(faceFor('playing', true), 'pressed');
    assert.equal(faceFor('ready', true), 'pressed');
    assert.equal(faceFor('lost', true), 'lost', 'a lost game keeps the dead face');
    assert.equal(faceFor('lost', false), 'lost');
    assert.equal(faceFor('won', true), 'won');
    assert.equal(faceFor('won', false), 'won');
});

test('the board marks are drawings, not characters', () => {
    assert.match(MINE_MARKUP, /<svg class="mines-mark" viewBox="0 0 14 14"/);
    assert.match(MINE_MARKUP, /<path d="M7 0V14M0 7H14M2 2L12 12M12 2L2 12"\/>/, 'eight spikes');
    assert.match(MINE_MARKUP, /<circle cx="7" cy="7" r="4" fill="#000"\/>/, 'black body');
    assert.match(MINE_MARKUP, /<rect x="5" y="4" width="2" height="2" fill="#fff"\/>/, 'highlight pixel');

    assert.match(FLAG_MARKUP, /<svg class="mines-mark" viewBox="0 0 14 14"/);
    assert.match(FLAG_MARKUP, /<path d="M7 2L2 5L7 7Z" fill="red"\/>/, 'red pennant');
    assert.match(FLAG_MARKUP, /<path d="M7 2V11H4V12H11V11H8V2Z" fill="#000"\/>/, 'pole and base');

    assert.equal(WRONG_FLAG_MARKUP, MINE_MARKUP + '<span class="mines-wrong-mark" aria-hidden="true">\u00d7</span>', 'a wrong flag is the mine it hid, struck through');
});

test('a square shows one mark: flag, mine, number or nothing', () => {
    assert.equal(cellMarkup(), '');
    assert.equal(cellMarkup({ revealed: true }), '', 'emptied ground stays blank');
    assert.equal(cellMarkup({ revealed: true, adjacent: 3 }), '3');
    assert.equal(cellMarkup({ revealed: true, adjacent: 0 }), '');
    assert.equal(cellMarkup({ revealed: true, mine: true }), MINE_MARKUP);
    assert.equal(cellMarkup({ flagged: true }), FLAG_MARKUP);
    assert.equal(cellMarkup({ flagged: true, revealed: true, mine: true }), FLAG_MARKUP, 'a flag over a mine stays a flag');
    assert.equal(cellMarkup({ flagged: true, wrong: true }), WRONG_FLAG_MARKUP);
    assert.equal(cellMarkup({ flagged: true, wrong: true, mine: true }), WRONG_FLAG_MARKUP, 'the wrong flag wins');
});

test('a square carries the classes its state asks for', () => {
    assert.equal(cellClass(), '');
    assert.equal(cellClass({ revealed: true }), ' revealed');
    assert.equal(cellClass({ revealed: true, adjacent: 2 }), ' revealed n2');
    assert.equal(cellClass({ revealed: true, exploded: true }), ' revealed exploded');
    assert.equal(cellClass({ flagged: true }), '', 'a covered square keeps its raised look');
    assert.equal(cellClass({ flagged: true, revealed: true, adjacent: 1 }), '', 'a flag hides the mine under it even after the loss marks every mine revealed');
    assert.equal(cellClass({ wrong: true }), ' revealed wrong', 'a wrong flag opens the square');
    assert.equal(cellClass({ wrong: true, adjacent: 4 }), ' revealed wrong', 'no number colour under a wrong flag');
    assert.equal(cellClass({ revealed: true, adjacent: 1, exploded: true, wrong: true }), ' revealed exploded wrong', 'still no number under a wrong flag');
});

test('the styles carry the segment geometry the markup expects', async () => {
    const css = await readFile(path.join(root, 'src/styles.css'), 'utf8');
    const rule = selector => css.match(new RegExp(`\\${selector}\\{([^}]*)\\}`))?.[1] ?? '';
    assert.match(rule('.mines-counter'), /background:#000/);
    assert.match(rule('.mines-digit'), /width:12px;height:22px/);
    assert.match(rule('.mines-segment'), /background:#310000/, 'unlit segments stay visible');
    const lit = css.match(/\.mines-segment\.is-lit\{([^}]*)\}/)?.[1] ?? '';
    assert.match(lit, /background:#f00/);
    for (const seg of 'abcdefg')
        assert.ok(css.includes(`.mines-segment-${seg}`), `segment ${seg} is positioned`);
    assert.ok(css.includes('clip-path:polygon'), 'the segments are chamfered');
    assert.doesNotMatch(css, /\.digital-counter/, 'the text counter is gone');
    assert.match(rule('.mines-mark'), /width:16px;height:16px/, 'the board marks fill the 20px squares the way the 14px art fills the original 16px ones');
    assert.match(rule('.mine-cell'), /position:relative/, 'the wrong-flag mark is positioned against its square');
    assert.match(rule('.mines-wrong-mark'), /color:#f00/);
});

test('the game paints the counters and the face instead of writing text', async () => {
    const source = await readFile(path.join(root, 'src/packages/games/apps.js'), 'utf8');
    assert.match(source, /import \{ cellClass, cellMarkup, counterChars, counterMarkup, faceFor, faceMarkup \} from '\.\/mines-display\.js'/);
    assert.match(source, /paintCounter\(count, mines - game\.flags\)/);
    assert.match(source, /paintCounter\(time, seconds\)/);
    assert.match(source, /face\.innerHTML = faceMarkup\(faceFor\(game\.state, pressed\)\)/);
    assert.doesNotMatch(source, /count\.textContent|time\.textContent|face\.textContent/, 'no text is written into the displays');
    assert.doesNotMatch(source, /[\u2739\u2691\u2690\u263a\u2639\u263b]/, 'no character stands in for a drawing');
    assert.match(source, /b\.innerHTML = cellMarkup\(\{ \.\.\.shown, wrong \}\)/, 'the squares are painted as markup, not as text');
    assert.doesNotMatch(source, /button\(cellMarkup/, 'markup must not be passed to the button text argument, which escapes it');
    assert.match(source, /lost && cell\.mine && !cell\.flagged/, 'a flagged mine stays covered when the game ends');
    assert.match(source, /window\.addEventListener\('pointerup', releaseFace\)/);
    assert.match(source, /window\.removeEventListener\('pointerup', releaseFace\)/, 'the window listener is dropped with the window');
});
