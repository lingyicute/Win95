/**
 * The drawings on the Minesweeper board: the seven-segment counters and the
 * face of the reset button in the header, and the mine, flag and number marks
 * in the field itself.
 *
 * The original game never printed a number or a glyph. It lit segments of
 * three blocky seven-segment digits on black, with the dark segments still
 * faintly visible; the middle button carried a yellow face that changed with
 * the game; and the squares held 14-pixel mine and flag drawings. Everything
 * here is markup the caller drops in — the header displays and the board marks
 * alike, so replacing the old text and character glyphs stayed a small change
 * in the game itself.
 */

/** The seven segments: a top, b upper right, c lower right, d bottom, e lower left, f upper left, g middle. */
export const SEGMENTS = [...'abcdefg'];

/** Which of the seven segments each digit lights. */
export const DIGIT_SEGMENTS = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];

/**
 * Three characters for a counter. Flagging more squares than the field holds
 * mines puts a minus in front, and the clock stops at 999 seconds — the widest
 * the display can show.
 */
export function counterChars(value) {
    const count = Number.isFinite(value) ? Math.trunc(value) : 0;
    if (count < 0)
        return `-${String(Math.min(99, -count)).padStart(2, '0')}`;
    return String(Math.min(999, count)).padStart(3, '0');
}

/** The segments a single character lights; only the sign uses the middle bar alone. */
export const litSegments = char => char === '-' ? ['g'] : [...(DIGIT_SEGMENTS[Number(char)] ?? '')];

/** Markup for a whole counter: three digits, every segment present so the unlit ones stay visible. */
export const counterMarkup = value => [...counterChars(value)].map(char => {
    const lit = litSegments(char);
    return `<span class="mines-digit">${SEGMENTS.map(seg => `<i class="mines-segment mines-segment-${seg}${lit.includes(seg) ? ' is-lit' : ''}"></i>`).join('')}</span>`;
}).join('');

const EYES = {
    smile: '<path d="M7 5V7M13 5V7" stroke-width="2"/>',
    pressed: '<path d="M7 5V7M13 5V7" stroke-width="2"/>',
    lost: '<path d="M5 5L8 8M8 5L5 8M12 5L15 8M15 5L12 8"/>',
    won: '<path d="M3 5H17M4 6L5 9H8L9 6M11 6L12 9H15L16 6" fill="#000"/>'
};

const MOUTHS = {
    smile: '<path d="M5 11Q10 18 15 11"/>',
    pressed: '<ellipse cx="10" cy="13" rx="2" ry="3" fill="#000"/>',
    lost: '<path d="M5 15Q10 9 15 15"/>',
    won: '<path d="M5 11Q10 18 15 11"/>'
};

export const FACES = ['smile', 'pressed', 'lost', 'won'];

/** Which face belongs on the button: the game state wins over a held-down mouse. */
export const faceFor = (state, pressed) => state === 'lost' ? 'lost' : state === 'won' ? 'won' : pressed ? 'pressed' : 'smile';

export const faceMarkup = face => `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#ff0" stroke="#000"/><g fill="none" stroke="#000" stroke-width="1.2">${EYES[face] ?? EYES.smile}${MOUTHS[face] ?? MOUTHS.smile}</g></svg>`;

/** A spiked mine with the highlight pixel the original art has. */
export const MINE_MARKUP = '<svg class="mines-mark" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><g stroke="#000"><path d="M7 0V14M0 7H14M2 2L12 12M12 2L2 12"/><circle cx="7" cy="7" r="4" fill="#000"/></g><rect x="5" y="4" width="2" height="2" fill="#fff"/></svg>';

/** A red flag on a black pole, planted on a base. */
export const FLAG_MARKUP = '<svg class="mines-mark" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M7 2L2 5L7 7Z" fill="red"/><path d="M7 2V11H4V12H11V11H8V2Z" fill="#000"/></svg>';

/** A flag that turned out to be wrong: the mine it hid, struck through. */
export const WRONG_FLAG_MARKUP = MINE_MARKUP + '<span class="mines-wrong-mark" aria-hidden="true">\u00d7</span>';

/**
 * What a single square shows. A flag hides whatever is underneath it until the
 * game ends; when it does, a flag over a mine stays a flag and a flag over
 * empty ground turns into the mine it wrongly covered.
 */
export function cellMarkup({ flagged = false, revealed = false, mine = false, adjacent = 0, wrong = false } = {}) {
    if (flagged)
        return wrong ? WRONG_FLAG_MARKUP : FLAG_MARKUP;
    if (revealed && mine)
        return MINE_MARKUP;
    if (revealed && adjacent > 0)
        return String(adjacent);
    return '';
}

/**
 * Classes the square needs on top of its state: the flat look of an opened
 * square, the colour of its number, the red wash on the mine that went off,
 * and the mark of a flag that was wrong — a wrong flag opens the square it was
 * planted on, the way the original does when the game ends.
 */
export function cellClass({ revealed = false, adjacent = 0, exploded = false, wrong = false, flagged = false } = {}) {
    // The engine marks every mine as revealed when the game is lost, which must not
    // flatten a square the player covered with a flag.
    const open = wrong || (revealed && !flagged);
    return (open ? ' revealed' : '')
        + (open && !wrong && adjacent ? ' n' + adjacent : '')
        + (exploded ? ' exploded' : '')
        + (wrong ? ' wrong' : '');
}
