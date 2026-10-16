import test from 'node:test';
import assert from 'node:assert/strict';
import { Klondike } from '../src/packages/games/engines.js';

// Standalone regression tests against the integrated engine.
// Run: node --test tests/klondike-draw-three.test.mjs

const ids = pile => pile.map(card => card.id);
const snapshot = game => structuredClone({
  stock: game.stock,
  waste: game.waste,
  tableau: game.tableau,
  foundations: game.foundations,
  score: game.score,
  moves: game.moves,
  passes: game.passes,
  state: game.state,
});

function assertConservation(game) {
  const cards = [...game.stock, ...game.waste, ...game.tableau.flat(), ...game.foundations.flat()];
  assert.equal(cards.length, 52, 'The transaction must retain all 52 cards.');
  assert.equal(new Set(ids(cards)).size, 52, 'The transaction must not duplicate any card.');
  assert(game.stock.every(card => card.faceUp === false), 'Every stock card must face down.');
  assert(game.waste.every(card => card.faceUp === true), 'Every waste card must face up.');
}

for (const remaining of [0, 1, 2, 3]) {
  test(`draw(3) with ${remaining} stock cards stops at the boundary and one undo restores the complete action`, () => {
    const game = new Klondike(123);
    while (game.stock.length > remaining) assert.equal(game.draw(), true);
    game.score = 250;
    const before = snapshot(game);
    const previousStock = ids(before.stock);
    const previousWaste = ids(before.waste);

    assert.equal(game.draw(3), true);
    assert.equal(game.moves, before.moves + 1, 'A three-card draw is one user action.');
    assert.equal(game.state, before.state);
    assert.deepEqual(game.tableau, before.tableau);
    assert.deepEqual(game.foundations, before.foundations);

    if (remaining === 0) {
      assert.deepEqual(ids(game.stock), previousWaste.toReversed(), 'Empty-stock clicks recycle in the original draw order.');
      assert.deepEqual(game.waste, [], 'Recycling must not also draw cards in the same action.');
      assert.equal(game.passes, before.passes + 1, 'Recycling advances the pass counter once.');
      assert.equal(game.score, before.score - 100, 'The existing recycle penalty is applied exactly once.');
    } else {
      const count = Math.min(3, remaining);
      const drawn = previousStock.slice(-count).toReversed();
      assert.deepEqual(ids(game.stock), previousStock.slice(0, remaining - count));
      assert.deepEqual(ids(game.waste), [...previousWaste, ...drawn], 'Draw only the cards that were in the stock at action start.');
      assert.equal(game.passes, before.passes, 'Exhausting the stock must not recycle it automatically.');
      assert.equal(game.score, before.score, 'A draw must not charge a recycle penalty.');
    }
    assertConservation(game);

    assert.equal(game.undo(), true);
    assert.deepEqual(snapshot(game), before, 'One undo restores order, orientation, score, moves, passes and state.');
    assertConservation(game);
  });
}

test('A three-card draw creates exactly one undo entry on a fresh deal', () => {
  const game = new Klondike(321);
  const before = snapshot(game);
  assert.equal(game.canUndo, false);
  assert.equal(game.draw(3), true);
  assert.equal(game.stock.length, 21);
  assert.deepEqual(ids(game.waste), ids(before.stock).slice(-3).toReversed());
  assert.equal(game.moves, 1);
  assertConservation(game);
  assert.equal(game.undo(), true);
  assert.deepEqual(snapshot(game), before);
  assert.equal(game.canUndo, false, 'No extra per-card or duplicate undo entry should remain.');
  assert.equal(game.undo(), false);
});
