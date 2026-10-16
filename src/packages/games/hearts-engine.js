/**
 * Four-player Hearts engine. No DOM, timers, network, or external dependencies.
 *
 * new Hearts(rng = Math.random): rng may also be an integer seed, { seed }, or
 * { rng }. newGame(optionalRng) resets the match; nextRound() advances only
 * from 'round-over'. Each round deals 13 cards to each player. Passing is
 * intentionally omitted: play begins immediately with the holder of 2 clubs.
 *
 * Cards: { id, rank: 1..13, suit, faceUp: true }; an ace (rank 1) wins over king.
 * hands[4], trick[{player,card}], captured[4], scores[4], roundScores[4], turn,
 * heartsBroken, state: 'playing'|'round-over'|'finished', winner, winners[].
 * turn is -1 after a hand. winner is the sole lowest scorer when finished;
 * tied winners are all listed in winners and winner remains null.
 *
 * play(cardId), aiPlay(), nextRound() return true on a successful action.
 * legalCards(player = turn) returns legal card references for the current
 * player only, or [] for an inactive player or completed hand.
 *
 * Rules: 2 clubs opens; follow suit; no first-trick points when a non-point
 * discard is available; hearts cannot lead before being broken unless only
 * hearts remain. Hearts score 1 each; queen of spades scores 13. Taking all
 * 26 points gives 26 to each opponent and zero to the moon shooter. A match
 * ends after a hand once any total reaches 100; the lowest total wins.
 *
 * roundScores are collected penalties during play and applied penalties after
 * the hand (including a moon adjustment). rawRoundScores preserves the actual
 * captured penalties. lastTrick and lastTrickWinner support UI animation after
 * trick is cleared. trickNumber counts completed tricks (0..13); round starts 1.
 */
const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
const strength = card => card.rank === 1 ? 14 : card.rank;
export const heartsPoints = card => card.suit === 'hearts' ? 1 :
    card.suit === 'spades' && card.rank === 12 ? 13 : 0;
function randomSource(value) {
    if (value && typeof value === 'object')
        value = value.rng ?? value.seed ?? Math.random;
    if (Number.isInteger(value)) {
        let state = value >>> 0;
        value = () => {
            state = (state + 0x6d2b79f5) >>> 0;
            let result = Math.imul(state ^ state >>> 15, state | 1);
            result ^= result + Math.imul(result ^ result >>> 7, result | 61);
            return ((result ^ result >>> 14) >>> 0) / 4294967296;
        };
    }
    if (typeof value !== 'function')
        throw new TypeError('RNG must be a function or integer seed.');
    return () => {
        const result = value();
        if (!Number.isFinite(result) || result < 0 || result >= 1) {
            throw new RangeError('RNG must return a finite number in [0, 1).');
        }
        return result;
    };
}
export class Hearts {
    constructor(rng = Math.random) {
        this._rng = randomSource(rng);
        this.newGame();
    }
    newGame(rng) {
        if (rng !== undefined)
            this._rng = randomSource(rng);
        this.scores = [0, 0, 0, 0];
        this.round = 0;
        this.targetScore = 100;
        this.winner = null;
        this.winners = [];
        this._deal();
        return this;
    }
    _deal() {
        const deck = [];
        for (const suit of SUITS) {
            for (let rank = 1; rank <= 13; rank++) {
                deck.push({ id: `${suit}-${rank}`, rank, suit, faceUp: true });
            }
        }
        for (let index = deck.length - 1; index > 0; index--) {
            const other = Math.floor(this._rng() * (index + 1));
            [deck[index], deck[other]] = [deck[other], deck[index]];
        }
        this.hands = Array.from({ length: 4 }, () => []);
        for (let index = 0; index < deck.length; index++)
            this.hands[index % 4].push(deck[index]);
        for (const hand of this.hands) {
            hand.sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || strength(a) - strength(b));
        }
        this.round++;
        this.roundScores = [0, 0, 0, 0];
        this.rawRoundScores = [0, 0, 0, 0];
        this.captured = Array.from({ length: 4 }, () => []);
        this.trick = [];
        this.lastTrick = [];
        this.lastTrickWinner = null;
        this.trickNumber = 0;
        this.heartsBroken = false;
        this.moonShooter = null;
        this.state = 'playing';
        this.turn = this.hands.findIndex(hand => hand.some(card => card.suit === 'clubs' && card.rank === 2));
        this.leader = this.turn;
    }
    nextRound() {
        if (this.state !== 'round-over')
            return false;
        this._deal();
        return true;
    }
    legalCards(player = this.turn) {
        if (this.state !== 'playing' || !Number.isInteger(player) || player !== this.turn || player < 0 || player >= 4)
            return [];
        const hand = this.hands[player];
        if (!this.trick.length) {
            if (this.trickNumber === 0)
                return hand.filter(card => card.suit === 'clubs' && card.rank === 2);
            if (!this.heartsBroken) {
                const others = hand.filter(card => card.suit !== 'hearts');
                if (others.length)
                    return others;
            }
            return [...hand];
        }
        const following = hand.filter(card => card.suit === this.trick[0].card.suit);
        if (following.length)
            return following;
        if (this.trickNumber === 0) {
            const nonPoints = hand.filter(card => heartsPoints(card) === 0);
            if (nonPoints.length)
                return nonPoints;
        }
        return [...hand];
    }
    play(cardId) {
        const card = this.legalCards().find(candidate => candidate.id === cardId);
        if (!card)
            return false;
        const player = this.turn;
        const index = this.hands[player].findIndex(candidate => candidate.id === cardId);
        this.hands[player].splice(index, 1);
        this.trick.push({ player, card });
        if (card.suit === 'hearts')
            this.heartsBroken = true;
        if (this.trick.length < 4)
            this.turn = (player + 1) % 4;
        else
            this._finishTrick();
        return true;
    }
    _finishTrick() {
        const leadSuit = this.trick[0].card.suit;
        let winning = this.trick[0];
        for (const entry of this.trick.slice(1)) {
            if (entry.card.suit === leadSuit && strength(entry.card) > strength(winning.card))
                winning = entry;
        }
        const points = this.trick.reduce((total, entry) => total + heartsPoints(entry.card), 0);
        this.roundScores[winning.player] += points;
        this.rawRoundScores[winning.player] += points;
        this.captured[winning.player].push(...this.trick.map(entry => entry.card));
        this.lastTrick = this.trick.map(entry => ({ player: entry.player, card: { ...entry.card } }));
        this.lastTrickWinner = winning.player;
        this.trickNumber++;
        this.trick = [];
        this.leader = winning.player;
        if (this.trickNumber === 13)
            this._finishRound();
        else
            this.turn = winning.player;
    }
    _finishRound() {
        const moonShooter = this.roundScores.findIndex(points => points === 26);
        if (moonShooter >= 0) {
            this.moonShooter = moonShooter;
            this.roundScores = this.roundScores.map((_, player) => player === moonShooter ? 0 : 26);
        }
        this.scores = this.scores.map((total, player) => total + this.roundScores[player]);
        this.turn = -1;
        this.state = this.scores.some(total => total >= this.targetScore) ? 'finished' : 'round-over';
        if (this.state === 'finished') {
            const minimum = Math.min(...this.scores);
            this.winners = this.scores.flatMap((total, player) => total === minimum ? [player] : []);
            this.winner = this.winners.length === 1 ? this.winners[0] : null;
        }
    }
    aiPlay() {
        const legal = this.legalCards();
        if (!legal.length)
            return false;
        let chosen;
        if (!this.trick.length) {
            // Low leads and short suits create future discard opportunities.
            const nonPoints = legal.filter(card => heartsPoints(card) === 0);
            const candidates = nonPoints.length ? nonPoints : legal;
            const hand = this.hands[this.turn];
            const suitSize = card => hand.filter(other => other.suit === card.suit).length;
            chosen = [...candidates].sort((a, b) => strength(a) - strength(b) || suitSize(a) - suitSize(b))[0];
        }
        else {
            const leadSuit = this.trick[0].card.suit;
            if (legal[0].suit !== leadSuit) {
                // Void: discard the queen, then high hearts, then dangerous high cards.
                const risk = card => heartsPoints(card) * 100 + strength(card) +
                    (card.suit === 'spades' && strength(card) > 12 ? 20 : 0);
                chosen = [...legal].sort((a, b) => risk(b) - risk(a))[0];
            }
            else {
                const winningRank = Math.max(...this.trick.filter(entry => entry.card.suit === leadSuit).map(entry => strength(entry.card)));
                const losing = legal.filter(card => strength(card) < winningRank);
                if (losing.length)
                    chosen = [...losing].sort((a, b) => strength(b) - strength(a))[0];
                else if (this.trick.length === 3) {
                    // A forced final-seat win sheds a high card while avoiding new points.
                    chosen = [...legal].sort((a, b) => heartsPoints(a) - heartsPoints(b) || strength(b) - strength(a))[0];
                }
                else
                    chosen = [...legal].sort((a, b) => strength(a) - strength(b))[0];
            }
        }
        return this.play(chosen.id);
    }
}
