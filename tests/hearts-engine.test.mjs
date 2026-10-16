import test from 'node:test';
import assert from 'node:assert/strict';
import { Hearts, heartsPoints } from '../src/packages/games/hearts-engine.js';

const card = (suit, rank) => ({ id: `${suit}-${rank}`, suit, rank, faceUp: true });
const sum = values => values.reduce((total, value) => total + value, 0);
const snapshot = game => JSON.stringify(game);
const ids = cards => cards.map(c => c.id);

function ruleFixture(hand, trick = [], trickNumber = 1, broken = false) {
  const game = new Hearts(1);
  game.hands = [hand, [], [], []];
  game.trick = trick;
  game.trickNumber = trickNumber;
  game.heartsBroken = broken;
  game.turn = 0;
  game.leader = trick[0]?.player ?? 0;
  return game;
}

function checkConservation(game) {
  const cards = [...game.hands.flat(), ...game.trick.map(entry => entry.card), ...game.captured.flat()];
  assert.equal(cards.length, 52);
  assert.equal(new Set(ids(cards)).size, 52);
  assert.equal(sum(cards.map(heartsPoints)), 26);
  assert(cards.every(c => c.faceUp && c.rank >= 1 && c.rank <= 13));
  assert.deepEqual(game.rawRoundScores, game.captured.map(pile => sum(pile.map(heartsPoints))));
  if (game.state === 'playing') assert.deepEqual(game.roundScores, game.rawRoundScores);
}

function finalHand(scores = [0, 0, 0, 0], moon = false) {
  const game = new Hearts(1);
  const last = [card('clubs', 1), card('clubs', 2), card('diamonds', 3), card('hearts', 2)];
  const finalIds = new Set(ids(last));
  const earlier = game.hands.flat().filter(c => !finalIds.has(c.id));
  game.hands = last.map(c => [c]);
  game.captured = [[], [], [], []];
  if (moon) game.captured[0] = earlier;
  else {
    const hearts = earlier.filter(c => c.suit === 'hearts');
    game.captured[0] = hearts.slice(0, 6);
    game.captured[1] = earlier.filter(c => heartsPoints(c) === 13);
    game.captured[2] = earlier.filter(c => heartsPoints(c) === 0);
    game.captured[3] = hearts.slice(6);
  }
  game.roundScores = game.captured.map(pile => sum(pile.map(heartsPoints)));
  game.rawRoundScores = [...game.roundScores];
  game.scores = [...scores];
  game.trick = [];
  game.trickNumber = 12;
  game.heartsBroken = true;
  game.turn = 0;
  game.leader = 0;
  checkConservation(game);
  return game;
}

function finishLastTrick(game) {
  for (let player = 0; player < 4; player++) {
    assert.equal(game.turn, player);
    assert(game.play(game.hands[player][0].id));
  }
  checkConservation(game);
}

test('Hearts deals deterministically, starts with 2 clubs, and conserves all cards', () => {
  for (let seed = 0; seed < 64; seed++) {
    const game = new Hearts(seed);
    assert.deepEqual(game.hands.map(hand => hand.length), [13, 13, 13, 13]);
    assert.deepEqual(ids(game.legalCards()), ['clubs-2']);
    assert.equal(game.round, 1);
    assert.equal(game.trickNumber, 0);
    assert.equal(game.heartsBroken, false);
    checkConservation(game);
  }
  assert.equal(snapshot(new Hearts(9)), snapshot(new Hearts({ seed: 9 })));
  assert.notEqual(snapshot(new Hearts(8)), snapshot(new Hearts(9)));
  assert.throws(() => new Hearts(() => 1), RangeError);
  assert.throws(() => new Hearts('invalid'), TypeError);
  assert.equal(heartsPoints(card('spades', 12)), 13);
  assert.equal(heartsPoints(card('spades', 13)), 0);
  assert.equal(heartsPoints(card('hearts', 1)), 1);
});

test('Only the current player may play, and invalid cards leave state untouched', () => {
  const game = new Hearts(15);
  const initial = snapshot(game);
  const other = (game.turn + 1) % 4;
  assert.deepEqual(game.legalCards(other), []);
  assert.deepEqual(game.legalCards(-1), []);
  assert.deepEqual(game.legalCards(4), []);
  assert.deepEqual(game.legalCards('0'), []);
  assert.equal(game.play(game.hands[other][0].id), false);
  assert.equal(game.play('hearts-100'), false);
  assert.equal(game.play(undefined), false);
  assert.equal(game.nextRound(), false);
  assert.equal(snapshot(game), initial);
  const start = game.turn;
  assert(game.play('clubs-2'));
  assert.equal(game.turn, (start + 1) % 4);
  assert.equal(game.play('clubs-2'), false);
  checkConservation(game);
});

test('Players must follow suit, including the opening trick', () => {
  const game = ruleFixture([
    card('clubs', 7), card('clubs', 1), card('hearts', 3), card('spades', 12), card('diamonds', 2),
  ], [{ player: 3, card: card('clubs', 2) }], 0);
  assert.deepEqual(ids(game.legalCards()), ['clubs-7', 'clubs-1']);
  const before = snapshot(game);
  assert.equal(game.play('diamonds-2'), false);
  assert.equal(snapshot(game), before);
  assert(game.play('clubs-7'));
});

test('First-trick point discards are forbidden unless every available discard is a point card', () => {
  const game = ruleFixture([
    card('hearts', 3), card('spades', 12), card('diamonds', 2), card('spades', 2),
  ], [{ player: 3, card: card('clubs', 2) }], 0);
  assert.deepEqual(ids(game.legalCards()), ['diamonds-2', 'spades-2']);
  assert.equal(game.play('hearts-3'), false);
  assert.equal(game.play('spades-12'), false);
  const forced = ruleFixture([card('hearts', 3), card('spades', 12)], [{ player: 3, card: card('clubs', 2) }], 0);
  assert.deepEqual(ids(forced.legalCards()), ['hearts-3', 'spades-12']);
  assert(forced.play('hearts-3'));
  assert.equal(forced.heartsBroken, true);
});

test('Hearts may not lead before breaking unless only hearts remain; the queen does not break hearts', () => {
  const game = ruleFixture([card('hearts', 3), card('spades', 12), card('diamonds', 2)]);
  assert.deepEqual(ids(game.legalCards()), ['spades-12', 'diamonds-2']);
  assert.equal(game.play('hearts-3'), false);
  assert(game.play('spades-12'));
  assert.equal(game.heartsBroken, false);
  const onlyHearts = ruleFixture([card('hearts', 3), card('hearts', 12)]);
  assert.deepEqual(ids(onlyHearts.legalCards()), ['hearts-3', 'hearts-12']);
  assert(onlyHearts.play('hearts-3'));
  assert.equal(onlyHearts.heartsBroken, true);
  const broken = ruleFixture([card('hearts', 3), card('clubs', 4)], [], 3, true);
  assert.deepEqual(ids(broken.legalCards()), ['hearts-3', 'clubs-4']);
});

test('Tricks are won by the highest lead-suit card with aces high and points assigned once', () => {
  const game = new Hearts(1);
  game.hands = [[card('clubs', 13)], [card('clubs', 1)], [card('spades', 12)], [card('hearts', 13)]];
  game.turn = 0;
  game.leader = 0;
  game.trickNumber = 3;
  for (const id of ['clubs-13', 'clubs-1', 'spades-12', 'hearts-13']) assert(game.play(id));
  assert.equal(game.lastTrickWinner, 1);
  assert.equal(game.turn, 1);
  assert.equal(game.leader, 1);
  assert.deepEqual(game.roundScores, [0, 14, 0, 0]);
  assert.deepEqual(game.rawRoundScores, [0, 14, 0, 0]);
  assert.equal(game.heartsBroken, true);
  assert.equal(game.trickNumber, 4);
  assert.deepEqual(game.trick, []);
  assert.deepEqual(game.lastTrick.map(entry => entry.player), [0, 1, 2, 3]);
  assert.equal(game.captured[1].length, 4);
  assert.equal(game.play('hearts-13'), false);
});

test('AI discards dangerous cards when void and always honors first-trick restrictions', () => {
  const dump = ruleFixture([card('hearts', 1), card('spades', 12), card('diamonds', 2)], [{ player: 3, card: card('clubs', 3) }]);
  assert(dump.aiPlay());
  assert.equal(dump.trick.at(-1).card.id, 'spades-12');
  const first = ruleFixture([card('hearts', 1), card('spades', 12), card('diamonds', 7)], [{ player: 3, card: card('clubs', 2) }], 0);
  assert(first.aiPlay());
  assert.equal(first.trick.at(-1).card.id, 'diamonds-7');
  const duck = ruleFixture([card('spades', 2), card('spades', 11), card('spades', 12)], [{ player: 3, card: card('spades', 13) }]);
  assert(duck.aiPlay());
  assert.equal(duck.trick.at(-1).card.id, 'spades-12');
});

test('Shooting the moon applies 26 points to opponents and retains the raw captured score', () => {
  const game = finalHand([0, 0, 0, 0], true);
  finishLastTrick(game);
  assert.equal(game.state, 'round-over');
  assert.equal(game.trickNumber, 13);
  assert.equal(game.turn, -1);
  assert.equal(game.moonShooter, 0);
  assert.deepEqual(game.rawRoundScores, [26, 0, 0, 0]);
  assert.deepEqual(game.roundScores, [0, 26, 26, 26]);
  assert.deepEqual(game.scores, [0, 26, 26, 26]);
  assert.deepEqual(game.legalCards(), []);
  assert.equal(game.aiPlay(), false);
  assert.equal(game.play('clubs-1'), false);
  assert(game.nextRound());
  assert.equal(game.round, 2);
  assert.equal(game.heartsBroken, false);
  assert.deepEqual(game.roundScores, [0, 0, 0, 0]);
  assert.deepEqual(game.rawRoundScores, [0, 0, 0, 0]);
  assert.deepEqual(game.scores, [0, 26, 26, 26]);
  assert.equal(game.moonShooter, null);
  checkConservation(game);
});

test('A match ends at 100, chooses the lowest scorer, and reports shared victories explicitly', () => {
  const game = finalHand([94, 80, 70, 78]);
  finishLastTrick(game);
  assert.deepEqual(game.roundScores, [7, 13, 0, 6]);
  assert.deepEqual(game.scores, [101, 93, 70, 84]);
  assert.equal(game.state, 'finished');
  assert.equal(game.winner, 2);
  assert.deepEqual(game.winners, [2]);
  const before = snapshot(game);
  assert.equal(game.nextRound(), false);
  assert.equal(game.aiPlay(), false);
  assert.equal(snapshot(game), before);
  const tied = finalHand([94, 80, 80, 74]);
  finishLastTrick(tied);
  assert.equal(tied.state, 'finished');
  assert.equal(tied.winner, null);
  assert.deepEqual(tied.winners, [2, 3]);
  const moon = finalHand([10, 80, 90, 95], true);
  finishLastTrick(moon);
  assert.deepEqual(moon.scores, [10, 106, 116, 121]);
  assert.equal(moon.winner, 0);
  game.newGame(321);
  assert.equal(snapshot(game), snapshot(new Hearts(321)));
});

test('Sixty-four complete AI hands finish exactly 13 tricks with legal plays and conserved points', () => {
  for (let seed = 0; seed < 64; seed++) {
    const game = new Hearts(seed);
    for (let move = 0; move < 52; move++) {
      assert.equal(game.state, 'playing');
      const player = game.turn;
      const legal = new Set(ids(game.legalCards()));
      const before = ids(game.hands[player]);
      assert(legal.size > 0);
      assert(game.aiPlay());
      const after = new Set(ids(game.hands[player]));
      const played = before.filter(id => !after.has(id));
      assert.equal(played.length, 1);
      assert(legal.has(played[0]));
      if (move === 0) assert.equal(played[0], 'clubs-2');
      assert.equal(game.trickNumber, Math.floor((move + 1) / 4));
      checkConservation(game);
    }
    assert.equal(game.state, 'round-over');
    assert.equal(game.captured.flat().length, 52);
    assert.equal(game.hands.flat().length, 0);
    assert.equal(sum(game.rawRoundScores), 26);
    assert.equal(sum(game.roundScores), game.moonShooter === null ? 26 : 78);
    assert.deepEqual(game.scores, game.roundScores);
    assert(game.nextRound());
    assert.equal(game.round, 2);
    checkConservation(game);
  }
});

test('Complete AI matches terminate by round 16 and preserve total scoring across rounds', () => {
  for (let seed = 0; seed < 8; seed++) {
    const game = new Hearts(seed);
    let previous = [0, 0, 0, 0];
    let plays = 0;
    while (game.state !== 'finished') {
      if (game.state === 'playing') {
        assert(game.aiPlay());
        plays++;
        assert(plays <= 16 * 52);
      } else {
        assert.deepEqual(game.scores, previous.map((score, player) => score + game.roundScores[player]));
        previous = [...game.scores];
        assert(game.nextRound());
      }
    }
    assert.deepEqual(game.scores, previous.map((score, player) => score + game.roundScores[player]));
    assert(game.scores.some(score => score >= 100));
    const minimum = Math.min(...game.scores);
    assert.deepEqual(game.winners, game.scores.flatMap((score, player) => score === minimum ? [player] : []));
    checkConservation(game);
  }
});
