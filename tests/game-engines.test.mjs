import test from 'node:test';
import assert from 'node:assert/strict';
import { Minesweeper, Klondike, SUITS, cardColor, seededRandom } from '../src/packages/games/engines.js';

const snapshot = game => JSON.stringify({
  stock: game.stock, waste: game.waste, foundations: game.foundations,
  tableau: game.tableau, score: game.score, moves: game.moves,
  passes: game.passes, state: game.state,
});
const card = (suit, rank, faceUp = true) => ({ id: `${suit}-${rank}`, suit, rank, faceUp });
function emptyGame() {
  const game = new Klondike(0);
  game.stock = [];
  game.waste = [];
  game.tableau = Array.from({ length: 7 }, () => []);
  game.foundations = Array.from({ length: 4 }, () => []);
  return game;
}
function mineFixture() {
  const game = new Minesweeper(3, 3, 1, 0);
  game.cells[0].mine = true;
  for (const neighbor of game.neighbors(0)) game.cells[neighbor].adjacent++;
  game.state = 'playing';
  return game;
}
function checkDeck(game) {
  const cards = [...game.stock, ...game.waste, ...game.tableau.flat(), ...game.foundations.flat()];
  assert.equal(cards.length, 52);
  assert.equal(new Set(cards.map(item => item.id)).size, 52);
  assert(game.stock.every(item => !item.faceUp));
  assert(game.waste.every(item => item.faceUp));
  for (const pile of game.tableau) {
    let visible = false;
    for (let index = 0; index < pile.length; index++) {
      const current = pile[index];
      if (visible) {
        assert(current.faceUp);
        assert.equal(pile[index - 1].rank, current.rank + 1);
        assert.notEqual(cardColor(pile[index - 1]), cardColor(current));
      }
      visible ||= current.faceUp;
    }
    if (pile.length) assert(pile.at(-1).faceUp);
  }
  for (const pile of game.foundations) {
    for (let index = 0; index < pile.length; index++) {
      assert.equal(pile[index].rank, index + 1);
      assert.equal(pile[index].suit, pile[0].suit);
      assert(pile[index].faceUp);
    }
  }
}

test('Minesweeper validates dimensions and rejects invalid input without mutations', () => {
  for (const dimensions of [[0, 9, 1], [9, 0, 1], [2, 2, 4], [2, 2, -1], [2.5, 3, 1]]) {
    assert.throws(() => new Minesweeper(...dimensions), RangeError);
  }
  const game = new Minesweeper();
  for (const index of [-1, 81, NaN, 0.5, '1', undefined]) {
    assert.equal(game.reveal(index), false);
    assert.equal(game.flag(index), false);
    assert.equal(game.chord(index), false);
  }
  assert.equal(game.state, 'ready');
  assert.equal(game.flags, 0);
});

test('Minesweeper first reveal is safe across seeded normal and dense boards', () => {
  for (let seed = 0; seed < 100; seed++) {
    for (const [rows, cols, mines] of [[9, 9, 10], [16, 16, 40], [16, 30, 99], [2, 2, 3], [1, 1, 0]]) {
      const game = new Minesweeper(rows, cols, mines, seed);
      const first = seed % game.cells.length;
      assert.equal(game.reveal(first), true);
      assert.equal(game.cells[first].mine, false);
      assert.equal(game.cells[first].revealed, true);
      assert.equal(game.cells.filter(cell => cell.mine).length, mines);
      assert.notEqual(game.state, 'lost');
      if (game.cells.length - game.neighbors(first).length - 1 >= mines) {
        assert.equal(game.cells[first].adjacent, 0);
      }
      for (let index = 0; index < game.cells.length; index++) {
        assert.equal(game.cells[index].adjacent, game.neighbors(index).filter(n => game.cells[n].mine).length);
      }
    }
  }
});

test('Minesweeper flags, flood fill and automatic victory flags behave consistently', () => {
  const game = new Minesweeper(64, 64, 0, 2);
  assert(game.flag(0));
  assert.equal(game.flags, 1);
  assert.equal(game.reveal(0), false);
  assert.equal(game.state, 'ready');
  assert(game.reveal(1));
  assert.equal(game.state, 'playing');
  assert.equal(game.revealedCount, 4095);
  assert(game.flag(0));
  assert(game.reveal(0));
  assert.equal(game.state, 'won');
  assert.equal(game.revealedCount, 4096);
  assert.equal(game.flag(0), false);
  game.reset();
  assert.equal(game.revealedCount, 0);
  assert.equal(game.state, 'ready');
  const dense = new Minesweeper(2, 2, 3, 0);
  dense.reveal(0);
  assert.equal(dense.state, 'won');
  assert.equal(dense.flags, 3);
  assert.equal(dense.remainingMines, 0);
});

test('Minesweeper chord wins with correct flags and loses with an incorrect flag', () => {
  const game = mineFixture();
  game.reveal(4);
  assert.equal(game.chord(4), false);
  game.flag(0);
  assert(game.chord(4));
  assert.equal(game.state, 'won');
  assert.equal(game.revealedCount, 8);
  const wrong = mineFixture();
  wrong.reveal(4);
  wrong.flag(2);
  assert(wrong.chord(4));
  assert.equal(wrong.state, 'lost');
  assert.equal(wrong.exploded, 0);
  assert(wrong.cells[0].revealed);
  assert.equal(wrong.flag(2), false);
  assert.equal(wrong.reveal(8), false);
});

test('Klondike deals 52 unique cards with correct pile shapes and reproducible seeds', () => {
  for (let seed = 0; seed < 100; seed++) {
    const game = new Klondike(seed);
    checkDeck(game);
    assert.deepEqual(game.tableau.map(pile => pile.length), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(game.stock.length, 24);
    assert.equal(game.canUndo, false);
  }
  assert.equal(snapshot(new Klondike('classic')), snapshot(new Klondike({ seed: 'classic' })));
  assert.notEqual(snapshot(new Klondike(1)), snapshot(new Klondike(2)));
});

test('Klondike draw and recycle preserve card order and undo the complete operation', () => {
  const game = new Klondike(45);
  const initial = snapshot(game);
  const firstId = game.stock.at(-1).id;
  assert(game.draw());
  assert.equal(game.waste.at(-1).id, firstId);
  assert(game.undo());
  assert.equal(snapshot(game), initial);
  for (let index = 0; index < 24; index++) assert(game.draw());
  game.score = 150;
  const beforeRecycle = snapshot(game);
  assert(game.draw());
  assert.equal(game.stock.length, 24);
  assert.equal(game.waste.length, 0);
  assert.equal(game.score, 50);
  assert.equal(game.passes, 1);
  assert(game.undo());
  assert.equal(snapshot(game), beforeRecycle);
  game.draw();
  game.draw();
  assert.equal(game.waste.at(-1).id, firstId);
  checkDeck(game);
  game.deal();
  assert.equal(game.canUndo, false);
  assert.equal(game.moves, 0);
  assert.equal(game.score, 0);
});

test('Klondike moves legal sequences and undo includes the exposed card and scoring', () => {
  const game = emptyGame();
  game.tableau[0] = [card('clubs', 4, false), card('spades', 12), card('hearts', 11)];
  game.tableau[1] = [card('diamonds', 13)];
  const initial = snapshot(game);
  const from = { zone: 'tableau', pile: 0, index: 1 };
  const to = { zone: 'tableau', pile: 1 };
  assert(game.canMove(from, to));
  assert(game.move(from, to));
  assert.equal(game.tableau[0][0].faceUp, true);
  assert.equal(game.tableau[1].length, 3);
  assert.equal(game.score, 5);
  assert.equal(game.moves, 1);
  assert(game.undo());
  assert.equal(snapshot(game), initial);
  assert.equal(game.undo(), false);
});

test('Klondike rejects hidden cards, invalid sequences, same-color moves and non-kings in empty piles', () => {
  const game = emptyGame();
  game.tableau[0] = [card('spades', 12), card('clubs', 11)];
  game.tableau[1] = [card('diamonds', 13)];
  game.tableau[2] = [card('hearts', 10, false)];
  game.waste = [card('spades', 13), card('clubs', 12)];
  const initial = snapshot(game);
  const attempts = [
    [{ zone: 'tableau', pile: 0, index: 0 }, { zone: 'tableau', pile: 1 }],
    [{ zone: 'tableau', pile: 0 }, { zone: 'tableau', pile: 3 }],
    [{ zone: 'tableau', pile: 2 }, { zone: 'tableau', pile: 0 }],
    [{ zone: 'tableau', pile: 0 }, { zone: 'tableau', pile: 0 }],
    [{ zone: 'waste', index: 0 }, { zone: 'tableau', pile: 3 }],
    [{ zone: 'tableau', pile: -1 }, { zone: 'tableau', pile: 1 }],
    [{ zone: 'stock' }, { zone: 'tableau', pile: 1 }],
    [{ zone: 'waste' }, { zone: 'tableau', pile: 99 }],
    [null, { zone: 'tableau', pile: 1 }],
    [{ zone: 'waste' }, null],
  ];
  for (const [from, to] of attempts) {
    assert.equal(game.canMove(from, to), false);
    assert.equal(game.move(from, to), false);
  }
  assert.equal(snapshot(game), initial);
  assert.equal(game.canUndo, false);
  game.waste = [card('hearts', 13)];
  assert(game.move({ zone: 'waste' }, { zone: 'tableau', pile: 3 }));
  assert.equal(game.score, 5);
});

test('Klondike foundations enforce ace-first, rank and suit, and allow top-card return', () => {
  const game = emptyGame();
  game.waste = [card('clubs', 2)];
  assert.equal(game.autoFoundation({ zone: 'waste' }), false);
  game.waste = [card('clubs', 1)];
  assert(game.autoFoundation({ zone: 'waste' }));
  assert.equal(game.score, 10);
  game.waste = [card('hearts', 2)];
  assert.equal(game.move({ zone: 'waste' }, { zone: 'foundation', pile: 0 }), false);
  game.waste = [card('clubs', 2)];
  assert(game.autoFoundation({ zone: 'waste' }));
  assert.equal(game.foundations[0].length, 2);
  assert.equal(game.score, 20);
  game.tableau[0] = [card('diamonds', 3)];
  assert(game.move({ zone: 'foundation', pile: 0 }, { zone: 'tableau', pile: 0 }));
  assert.equal(game.score, 5);
  assert.equal(game.foundations[0].length, 1);
  assert(game.undo());
  assert.equal(game.score, 20);
  assert.equal(game.foundations[0].length, 2);
});

test('Klondike winning move is detected and fully undoable', () => {
  const game = emptyGame();
  game.foundations = SUITS.map(suit => Array.from({ length: suit === 'spades' ? 12 : 13 }, (_, rank) => card(suit, rank + 1)));
  game.waste = [card('spades', 13)];
  const initial = snapshot(game);
  assert(game.autoFoundation({ zone: 'waste' }));
  assert.equal(game.state, 'won');
  assert.equal(game.draw(), false);
  assert(game.undo());
  assert.equal(snapshot(game), initial);
  checkDeck(game);
});

test('Klondike random legal play preserves all deck and pile invariants', () => {
  for (let seed = 0; seed < 30; seed++) {
    const rng = seededRandom(seed + 500);
    const game = new Klondike(seed);
    for (let step = 0; step < 120; step++) {
      const before = snapshot(game);
      let changed;
      if (rng() < 0.45) changed = game.draw();
      else {
        const sources = [{ zone: 'waste' }];
        for (let pile = 0; pile < 7; pile++) {
          for (let index = 0; index < game.tableau[pile].length; index++) {
            if (game.tableau[pile][index].faceUp) sources.push({ zone: 'tableau', pile, index });
          }
        }
        for (let pile = 0; pile < 4; pile++) sources.push({ zone: 'foundation', pile });
        const moves = [];
        for (const from of sources) {
          for (const zone of ['tableau', 'foundation']) {
            for (let pile = 0; pile < (zone === 'tableau' ? 7 : 4); pile++) {
              const to = { zone, pile };
              if (game.canMove(from, to)) moves.push([from, to]);
            }
          }
        }
        changed = moves.length ? game.move(...moves[Math.floor(rng() * moves.length)]) : game.draw();
      }
      checkDeck(game);
      if (changed && rng() < 0.12) {
        assert(game.undo());
        assert.equal(snapshot(game), before);
        checkDeck(game);
      }
    }
  }
});
