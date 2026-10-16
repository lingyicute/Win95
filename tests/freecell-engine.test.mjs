import test from 'node:test';
import assert from 'node:assert/strict';
import { FreeCell, microsoftRandom } from '../src/packages/games/freecell-engine.js';
import { seededRandom } from '../src/packages/games/engines.js';

const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
const card = (suit, rank) => ({ id: `${suit}-${rank}`, rank, suit, faceUp: true });
const cardsOnly = game => JSON.stringify({ cells: game.cells, foundations: game.foundations, tableau: game.tableau });
const snapshot = game => JSON.stringify({ cards: cardsOnly(game), seed: game.seed, moves: game.moves, state: game.state });
const notation = game => game.tableau.map(pile => pile.map(c => ' A23456789TJQK'[c.rank] + c.suit[0].toUpperCase()).join(' '));

function checkDeck(game) {
  const cards = [...game.cells.filter(Boolean), ...game.foundations.flat(), ...game.tableau.flat()];
  assert.equal(cards.length, 52);
  assert.equal(new Set(cards.map(c => c.id)).size, 52);
  for (const c of cards) {
    assert(c.faceUp);
    assert(SUITS.includes(c.suit));
    assert(Number.isInteger(c.rank) && c.rank >= 1 && c.rank <= 13);
  }
  for (const pile of game.foundations) {
    for (let index = 0; index < pile.length; index++) {
      assert.equal(pile[index].rank, index + 1);
      assert.equal(pile[index].suit, pile[0].suit);
    }
  }
}

function capacityFixture(freeCells, auxiliaries, destinationEmpty, sequenceLength) {
  const game = new FreeCell(1);
  const rank = destinationEmpty ? 13 : 12;
  const sequence = Array.from({ length: sequenceLength }, (_, offset) =>
    card(offset % 2 ? 'hearts' : 'spades', rank - offset));
  const destination = destinationEmpty ? [] : [card('hearts', 13)];
  const used = new Set([...sequence, ...destination].map(c => c.id));
  const remaining = game.tableau.flat().filter(c => !used.has(c.id));
  game.cells = Array.from({ length: 4 }, (_, index) => index < freeCells ? null : remaining.pop());
  game.tableau = Array.from({ length: 8 }, () => []);
  game.tableau[1] = destination;
  for (let index = auxiliaries + 2; index < 8; index++) game.tableau[index] = [remaining.pop()];
  const sourceIndex = remaining.length;
  game.tableau[0] = [...remaining, ...sequence];
  checkDeck(game);
  return {
    game, from: { zone: 'tableau', pile: 0, index: sourceIndex },
    to: { zone: 'tableau', pile: 1 },
    freeCells: Array.from({ length: freeCells }, (_, index) => index),
    auxiliaries: Array.from({ length: auxiliaries }, (_, index) => index + 2),
  };
}

// Constructive verification: every accepted supermove must be realizable using
// only individual legal card transfers and the advertised temporary storage.
function singleCardPlan(game, count, source, destination, auxiliaries, cells) {
  if (count <= cells.length + 1) {
    for (let index = 0; index < count - 1; index++) {
      assert(game.move({ zone: 'tableau', pile: source }, { zone: 'cell', pile: cells[index] }));
    }
    assert(game.move({ zone: 'tableau', pile: source }, { zone: 'tableau', pile: destination }));
    for (let index = count - 2; index >= 0; index--) {
      assert(game.move({ zone: 'cell', pile: cells[index] }, { zone: 'tableau', pile: destination }));
    }
    return;
  }
  assert(auxiliaries.length > 0);
  const [temporary, ...remaining] = auxiliaries;
  const halfCapacity = (cells.length + 1) * 2 ** remaining.length;
  if (count <= halfCapacity) return singleCardPlan(game, count, source, destination, remaining, cells);
  const parked = count - halfCapacity;
  singleCardPlan(game, parked, source, temporary, remaining, cells);
  singleCardPlan(game, halfCapacity, source, destination, remaining, cells);
  singleCardPlan(game, parked, temporary, destination, remaining, cells);
}

test('Microsoft RNG matches the MSVC reference sequence', () => {
  const next = microsoftRandom(1);
  assert.deepEqual(Array.from({ length: 6 }, () => next()), [41, 18467, 6334, 26500, 19169, 15724]);
});

test('Microsoft numbered deals #1 and #617 match all 52 fixed card positions', () => {
  assert.deepEqual(notation(new FreeCell(1)), [
    'JD KD 2S 4C 3S 6D 6S', '2D KC KS 5C TD 8S 9C',
    '9H 9S 9D TS 4S 8D 2H', 'JC 5S QD QH TH QS 6H',
    '5D AD JS 4H 8H 6C', '7H QC AS AC 2C 3D',
    '7C KH AH 4D JH 8C', '5H 3H 3C 7S 7D TC',
  ]);
  assert.deepEqual(notation(new FreeCell(617)), [
    '7D TD TH KD 4C 4S JD', 'AD 7S QC 5H QS TS KS',
    '5C QD 3H 9S 9C 2H KC', '3S AC 9D 3C 9H 5D 4H',
    '5S 6D 6S 8S 7C JC', '8C 8H 8D 7H 6H 6C',
    '2D AS 3D 4D 2C JH', 'AH KH TC JS 2S QH',
  ]);
  for (const seed of [1, 617, 11982, 32000, 1000000]) {
    const game = new FreeCell(seed);
    checkDeck(game);
    assert.deepEqual(game.tableau.map(p => p.length), [7, 7, 7, 7, 6, 6, 6, 6]);
    assert.equal(snapshot(new FreeCell(seed)), snapshot(game));
  }
});

test('Invalid deals and descriptors are rejected without state changes', () => {
  const game = new FreeCell(2);
  const before = snapshot(game);
  for (const seed of [0, -1, 1000001, 2.5, NaN, '1']) assert.throws(() => game.deal(seed), RangeError);
  assert.equal(snapshot(game), before);
  for (const from of [null, {}, { zone: 'tableau', pile: -1 }, { zone: 'tableau', pile: 8 },
    { zone: 'tableau', pile: 0, index: 999 }, { zone: 'tableau', pile: 0, index: 1.5 },
    { zone: 'cell', pile: 0 }, { zone: 'stock', pile: 0 }, { zone: 'foundation', pile: 0 }]) {
    assert.equal(game.move(from, { zone: 'cell', pile: 0 }), false);
  }
  for (const to of [null, {}, { zone: 'tableau', pile: 8 }, { zone: 'cell', pile: 4 },
    { zone: 'foundation', pile: -1 }, { zone: 'waste', pile: 0 }]) {
    assert.equal(game.move({ zone: 'tableau', pile: 0 }, to), false);
  }
  assert.equal(snapshot(game), before);
  assert.equal(game.canUndo, false);
});

test('Cells hold one exposed card and moves are fully undoable', () => {
  const game = new FreeCell(1);
  const before = snapshot(game);
  const exposed = game.tableau[0].at(-1).id;
  assert(game.move({ zone: 'tableau', pile: 0 }, { zone: 'cell', pile: 0 }));
  assert.equal(game.cells[0].id, exposed);
  assert.equal(game.moves, 1);
  assert.equal(game.move({ zone: 'tableau', pile: 1 }, { zone: 'cell', pile: 0 }), false);
  assert.equal(game.move({ zone: 'cell', pile: 0 }, { zone: 'cell', pile: 0 }), false);
  assert(game.move({ zone: 'cell', pile: 0 }, { zone: 'cell', pile: 1 }));
  assert.equal(game.cells[0], null);
  checkDeck(game);
  assert(game.undo());
  assert(game.undo());
  assert.equal(snapshot(game), before);
  assert.equal(game.undo(), false);
  game.move({ zone: 'tableau', pile: 0 }, { zone: 'cell', pile: 0 });
  game.deal();
  assert.equal(snapshot(game), before);
  assert.equal(game.canUndo, false);
});

test('Supermove capacities match constructive single-card transfers for every storage configuration', () => {
  for (let freeCells = 0; freeCells <= 4; freeCells++) {
    for (let auxiliaryColumns = 0; auxiliaryColumns <= 6; auxiliaryColumns++) {
      for (const destinationEmpty of [false, true]) {
        const capacity = (freeCells + 1) * 2 ** auxiliaryColumns;
        const largestSequence = destinationEmpty ? 13 : 12;
        const count = Math.min(capacity, largestSequence);
        const setup = capacityFixture(freeCells, auxiliaryColumns, destinationEmpty, count);
        const { game, from, to } = setup;
        const original = snapshot(game);
        assert.equal(game.moveCapacity(to), capacity);
        const singles = capacityFixture(freeCells, auxiliaryColumns, destinationEmpty, count).game;
        assert(game.move(from, to));
        assert.equal(game.moves, 1);
        checkDeck(game);
        singleCardPlan(singles, count, 0, 1, setup.auxiliaries, setup.freeCells);
        checkDeck(singles);
        assert.equal(cardsOnly(game), cardsOnly(singles));
        assert(game.undo());
        assert.equal(snapshot(game), original);
        if (capacity < largestSequence) {
          const rejected = capacityFixture(freeCells, auxiliaryColumns, destinationEmpty, capacity + 1);
          const before = snapshot(rejected.game);
          assert.equal(rejected.game.canMove(rejected.from, rejected.to), false);
          assert.equal(rejected.game.move(rejected.from, rejected.to), false);
          assert.equal(snapshot(rejected.game), before);
          assert.equal(rejected.game.canUndo, false);
        }
      }
    }
  }
});

test('Empty destination is excluded and the vacated source does not increase capacity', () => {
  const setup = capacityFixture(0, 0, true, 2);
  const { game, from, to } = setup;
  assert.equal(game.moveCapacity(to), 1);
  assert.equal(game.move(from, to), false);
  const prefix = game.tableau[0].splice(0, from.index);
  game.tableau[2].unshift(...prefix);
  checkDeck(game);
  assert.equal(game.tableau[0].length, 2);
  assert.equal(game.move({ zone: 'tableau', pile: 0, index: 0 }, to), false);
  assert(game.move({ zone: 'tableau', pile: 0 }, to));
  assert.equal(game.tableau[1][0].rank, 12); // Any card, not only a king, fills an empty column.
  checkDeck(game);
});

test('Invalid tableau order, color, and multi-card transfers into cells or foundations are rejected', () => {
  const { game, from } = capacityFixture(4, 0, false, 2);
  const initial = snapshot(game);
  assert.equal(game.move(from, { zone: 'cell', pile: 0 }), false);
  assert.equal(game.move(from, { zone: 'foundation', pile: 0 }), false);
  assert.equal(snapshot(game), initial);
  game.tableau[0].at(-1).suit = 'clubs';
  assert.equal(game.move(from, { zone: 'tableau', pile: 1 }), false);
  game.tableau[0].at(-1).suit = 'hearts';
  game.tableau[0].at(-1).rank = 10;
  assert.equal(game.move(from, { zone: 'tableau', pile: 1 }), false);
});

test('Foundations build ace-to-king by suit, remain terminal, and undo can reverse victory', () => {
  const game = new FreeCell(1);
  game.tableau = Array.from({ length: 8 }, () => []);
  game.foundations = SUITS.map(suit => Array.from({ length: suit === 'spades' ? 12 : 13 }, (_, index) => card(suit, index + 1)));
  game.cells = [card('spades', 13), null, null, null];
  checkDeck(game);
  const before = snapshot(game);
  assert.equal(game.move({ zone: 'cell', pile: 0 }, { zone: 'foundation', pile: 0 }), false);
  assert.equal(game.move({ zone: 'foundation', pile: 3 }, { zone: 'tableau', pile: 0 }), false);
  assert(game.autoFoundation({ zone: 'cell', pile: 0 }));
  assert.equal(game.state, 'won');
  assert.equal(game.moves, 1);
  checkDeck(game);
  assert(game.undo());
  assert.equal(snapshot(game), before);
  const fresh = new FreeCell(1);
  fresh.tableau = Array.from({ length: 8 }, () => []);
  fresh.cells = [card('clubs', 2), null, null, null];
  assert.equal(fresh.autoFoundation({ zone: 'cell', pile: 0 }), false);
  fresh.cells[0] = card('clubs', 1);
  assert(fresh.autoFoundation({ zone: 'cell', pile: 0 }));
  fresh.cells[0] = card('clubs', 2);
  assert(fresh.autoFoundation({ zone: 'cell', pile: 0 }));
  assert.equal(fresh.foundations[0].length, 2);
});

test('Random legal FreeCell play preserves all 52 cards and exact undo snapshots', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const game = new FreeCell(seed);
    const rng = seededRandom(seed);
    for (let step = 0; step < 150; step++) {
      const sources = [];
      for (let pile = 0; pile < 8; pile++) {
        for (let index = 0; index < game.tableau[pile].length; index++) sources.push({ zone: 'tableau', pile, index });
      }
      for (let pile = 0; pile < 4; pile++) sources.push({ zone: 'cell', pile });
      const possible = [];
      for (const from of sources) {
        for (const zone of ['cell', 'tableau', 'foundation']) {
          for (let pile = 0; pile < (zone === 'tableau' ? 8 : 4); pile++) {
            const to = { zone, pile };
            if (game.canMove(from, to)) possible.push([from, to]);
          }
        }
      }
      if (!possible.length) break;
      const before = snapshot(game);
      assert(game.move(...possible[Math.floor(rng() * possible.length)]));
      checkDeck(game);
      if (rng() < 0.15) {
        assert(game.undo());
        assert.equal(snapshot(game), before);
        checkDeck(game);
      }
    }
  }
});
