/**
 * Pure, reusable game engines. No DOM or browser dependencies.
 *
 * Minesweeper(rows = 9, cols = 9, mines = 10, rng = Math.random):
 *   reveal(index), flag(index), chord(index), reset() and neighbors(index).
 *   Mutating moves return true when they change the board; reset returns this.
 *   Mines are placed on the first reveal. The first square is always safe;
 *   its neighbors are also safe whenever the requested mine count allows it.
 *
 * Klondike(rng = Math.random):
 *   deal(), draw(), move(from, to), canMove(from, to), autoFoundation(from), undo().
 *   Cards are { id, rank: 1..13, suit, faceUp }; suits are the names in SUITS.
 *   Stock, waste and piles are ordered bottom-to-top (last item is the top).
 *   from = { zone: 'tableau'|'waste'|'foundation', pile?, index? }.
 *   Omitted source index means the top card. Only tableau supports sequences.
 *   to = { zone: 'tableau'|'foundation', pile }.
 *   Successful draw/move/undo return true; invalid actions return false.
 *   Standard scoring: +10 to foundation, +5 waste to tableau, +5 turn-up,
 *   -15 foundation to tableau, -100 stock recycle; score never becomes negative.
 *   Undo restores the entire action, including card turn-up and stock recycling.
 *
 * Both constructors also accept a numeric/string seed or { rng } / { seed }
 * in the RNG argument. seededRandom(seed) supplies deterministic Mulberry32.
 */
export const SUITS = Object.freeze(['clubs', 'diamonds', 'hearts', 'spades']);
export function seededRandom(seed = 0) {
    let state = typeof seed === 'number' ? seed >>> 0 : 2166136261;
    if (typeof seed !== 'number') {
        for (const character of String(seed)) {
            state = Math.imul(state ^ character.codePointAt(0), 16777619) >>> 0;
        }
    }
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}
function randomSource(source) {
    if (source && typeof source === 'object') {
        source = source.rng ?? (source.seed === undefined ? Math.random : seededRandom(source.seed));
    }
    if (typeof source === 'number' || typeof source === 'string')
        source = seededRandom(source);
    if (typeof source !== 'function')
        throw new TypeError('RNG must be a function or seed.');
    return () => {
        const value = source();
        if (!Number.isFinite(value) || value < 0 || value >= 1) {
            throw new RangeError('RNG must return a finite number in [0, 1).');
        }
        return value;
    };
}
function shuffle(items, rng) {
    for (let index = items.length - 1; index > 0; index--) {
        const other = Math.floor(rng() * (index + 1));
        [items[index], items[other]] = [items[other], items[index]];
    }
    return items;
}
export class Minesweeper {
    constructor(rows = 9, cols = 9, mines = 10, rng = Math.random) {
        if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
            throw new RangeError('Rows and columns must be positive integers.');
        }
        if (!Number.isSafeInteger(rows * cols) || rows * cols > 1000000) {
            throw new RangeError('The board must contain at most 1,000,000 cells.');
        }
        if (!Number.isInteger(mines) || mines < 0 || mines >= rows * cols) {
            throw new RangeError('Mine count must be between zero and board size minus one.');
        }
        this.rows = rows;
        this.cols = cols;
        this.mines = mines;
        this._rng = randomSource(rng);
        this.reset();
    }
    reset() {
        this.cells = Array.from({ length: this.rows * this.cols }, () => ({
            mine: false, revealed: false, flagged: false, adjacent: 0,
        }));
        this.state = 'ready';
        this.flags = 0;
        this.revealedCount = 0;
        this.exploded = -1;
        return this;
    }
    get remainingMines() { return this.mines - this.flags; }
    _valid(index) { return Number.isInteger(index) && index >= 0 && index < this.cells.length; }
    neighbors(index) {
        if (!this._valid(index))
            return [];
        const row = Math.floor(index / this.cols);
        const col = index % this.cols;
        const result = [];
        for (let y = Math.max(0, row - 1); y <= Math.min(this.rows - 1, row + 1); y++) {
            for (let x = Math.max(0, col - 1); x <= Math.min(this.cols - 1, col + 1); x++) {
                const neighbor = y * this.cols + x;
                if (neighbor !== index)
                    result.push(neighbor);
            }
        }
        return result;
    }
    _placeMines(first) {
        let excluded = new Set([first, ...this.neighbors(first)]);
        if (this.cells.length - excluded.size < this.mines)
            excluded = new Set([first]);
        const candidates = [];
        for (let index = 0; index < this.cells.length; index++) {
            if (!excluded.has(index))
                candidates.push(index);
        }
        shuffle(candidates, this._rng);
        for (let index = 0; index < this.mines; index++)
            this.cells[candidates[index]].mine = true;
        for (let index = 0; index < this.cells.length; index++) {
            if (this.cells[index].mine) {
                for (const neighbor of this.neighbors(index))
                    this.cells[neighbor].adjacent++;
            }
        }
        this.state = 'playing';
    }
    _open(index) {
        const initial = this.cells[index];
        if (initial.revealed || initial.flagged)
            return false;
        if (initial.mine) {
            this.exploded = index;
            this.state = 'lost';
            for (const cell of this.cells)
                if (cell.mine)
                    cell.revealed = true;
            return true;
        }
        const queue = [index];
        initial.revealed = true;
        this.revealedCount++;
        for (let cursor = 0; cursor < queue.length; cursor++) {
            const current = queue[cursor];
            if (this.cells[current].adjacent)
                continue;
            for (const neighbor of this.neighbors(current)) {
                const cell = this.cells[neighbor];
                if (!cell.mine && !cell.revealed && !cell.flagged) {
                    cell.revealed = true;
                    this.revealedCount++;
                    if (cell.adjacent === 0)
                        queue.push(neighbor);
                }
            }
        }
        return true;
    }
    _checkWin() {
        if (this.state === 'playing' && this.revealedCount === this.cells.length - this.mines) {
            this.state = 'won';
            for (const cell of this.cells)
                if (cell.mine)
                    cell.flagged = true;
            this.flags = this.mines;
        }
    }
    reveal(index) {
        if (!this._valid(index) || this.state === 'won' || this.state === 'lost')
            return false;
        if (this.cells[index].flagged || this.cells[index].revealed)
            return false;
        if (this.state === 'ready')
            this._placeMines(index);
        const changed = this._open(index);
        this._checkWin();
        return changed;
    }
    flag(index) {
        if (!this._valid(index) || this.state === 'won' || this.state === 'lost')
            return false;
        const cell = this.cells[index];
        if (cell.revealed)
            return false;
        cell.flagged = !cell.flagged;
        this.flags += cell.flagged ? 1 : -1;
        return true;
    }
    chord(index) {
        if (!this._valid(index) || this.state !== 'playing')
            return false;
        const cell = this.cells[index];
        if (!cell.revealed || cell.mine)
            return false;
        const neighbors = this.neighbors(index);
        if (neighbors.filter(neighbor => this.cells[neighbor].flagged).length !== cell.adjacent)
            return false;
        let changed = false;
        for (const neighbor of neighbors) {
            changed = this._open(neighbor) || changed;
            if (this.state === 'lost')
                break;
        }
        this._checkWin();
        return changed;
    }
}
export function cardColor(card) {
    return card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black';
}
const clonePile = pile => pile.map(card => ({ ...card }));
export class Klondike {
    constructor(rng = Math.random) {
        this._rng = randomSource(rng);
        this.deal();
    }
    deal() {
        const deck = [];
        for (const suit of SUITS) {
            for (let rank = 1; rank <= 13; rank++) {
                deck.push({ id: `${suit}-${rank}`, rank, suit, faceUp: false });
            }
        }
        shuffle(deck, this._rng);
        this.tableau = Array.from({ length: 7 }, () => []);
        for (let row = 0; row < 7; row++) {
            for (let pile = row; pile < 7; pile++) {
                const card = deck.pop();
                card.faceUp = pile === row;
                this.tableau[pile].push(card);
            }
        }
        this.stock = deck;
        this.waste = [];
        this.foundations = Array.from({ length: 4 }, () => []);
        this.score = 0;
        this.moves = 0;
        this.passes = 0;
        this.state = 'playing';
        this._history = [];
        return this;
    }
    get canUndo() { return this._history.length > 0; }
    _remember() {
        this._history.push({
            stock: clonePile(this.stock), waste: clonePile(this.waste),
            foundations: this.foundations.map(clonePile), tableau: this.tableau.map(clonePile),
            score: this.score, moves: this.moves, passes: this.passes, state: this.state,
        });
    }
    undo() {
        const previous = this._history.pop();
        if (!previous)
            return false;
        Object.assign(this, previous);
        return true;
    }
    draw(count = 1) {
        if (!Number.isInteger(count) || count < 1 || count > 24)
            return false;
        if (this.state === 'won' || (!this.stock.length && !this.waste.length))
            return false;
        this._remember();
        if (this.stock.length) {
            const available = Math.min(count, this.stock.length);
            for (let i = 0; i < available; i++) {
                const card = this.stock.pop();
                card.faceUp = true;
                this.waste.push(card);
            }
        }
        else {
            this.stock = this.waste.reverse();
            this.waste = [];
            for (const card of this.stock)
                card.faceUp = false;
            this.passes++;
            this.score = Math.max(0, this.score - 100);
        }
        this.moves++;
        return true;
    }
    _source(from) {
        if (!from || typeof from !== 'object')
            return null;
        let pile;
        if (from.zone === 'waste')
            pile = this.waste;
        else if (from.zone === 'tableau' && Number.isInteger(from.pile))
            pile = this.tableau[from.pile];
        else if (from.zone === 'foundation' && Number.isInteger(from.pile))
            pile = this.foundations[from.pile];
        if (!pile?.length)
            return null;
        const index = from.index === undefined ? pile.length - 1 : from.index;
        if (!Number.isInteger(index) || index < 0 || index >= pile.length)
            return null;
        if (from.zone !== 'tableau' && index !== pile.length - 1)
            return null;
        const cards = pile.slice(index);
        if (cards.some(card => !card.faceUp))
            return null;
        if (from.zone === 'tableau') {
            for (let offset = 1; offset < cards.length; offset++) {
                if (cards[offset - 1].rank !== cards[offset].rank + 1 ||
                    cardColor(cards[offset - 1]) === cardColor(cards[offset]))
                    return null;
            }
        }
        return { pile, index, cards };
    }
    _destination(to) {
        if (!to || !Number.isInteger(to.pile))
            return null;
        if (to.zone === 'tableau')
            return this.tableau[to.pile] ?? null;
        if (to.zone === 'foundation')
            return this.foundations[to.pile] ?? null;
        return null;
    }
    canMove(from, to) {
        if (this.state === 'won')
            return false;
        const source = this._source(from);
        const destination = this._destination(to);
        if (!source || !destination || source.pile === destination)
            return false;
        const card = source.cards[0];
        const top = destination.at(-1);
        if (to.zone === 'foundation') {
            return source.cards.length === 1 && (!top ? card.rank === 1 :
                top.faceUp && top.suit === card.suit && card.rank === top.rank + 1);
        }
        return !top ? card.rank === 13 :
            top.faceUp && top.rank === card.rank + 1 && cardColor(top) !== cardColor(card);
    }
    move(from, to) {
        if (!this.canMove(from, to))
            return false;
        const source = this._source(from);
        const destination = this._destination(to);
        this._remember();
        destination.push(...source.pile.splice(source.index));
        let points = 0;
        if (to.zone === 'foundation' && from.zone !== 'foundation')
            points += 10;
        if (to.zone === 'tableau' && from.zone === 'waste')
            points += 5;
        if (to.zone === 'tableau' && from.zone === 'foundation')
            points -= 15;
        if (from.zone === 'tableau') {
            const exposed = source.pile.at(-1);
            if (exposed && !exposed.faceUp) {
                exposed.faceUp = true;
                points += 5;
            }
        }
        this.score = Math.max(0, this.score + points);
        this.moves++;
        if (this.foundations.reduce((count, pile) => count + pile.length, 0) === 52)
            this.state = 'won';
        return true;
    }
    autoFoundation(from) {
        const source = this._source(from);
        if (!source || source.cards.length !== 1 || from.zone === 'foundation')
            return false;
        const matching = this.foundations.findIndex(pile => pile.at(-1)?.suit === source.cards[0].suit);
        if (matching >= 0)
            return this.move(from, { zone: 'foundation', pile: matching });
        const empty = this.foundations.findIndex(pile => pile.length === 0);
        return empty >= 0 && this.move(from, { zone: 'foundation', pile: empty });
    }
}
