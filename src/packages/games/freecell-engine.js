/**
 * FreeCell engine, independent of UI and browser APIs.
 *
 * new FreeCell(seed = 1): numbered Microsoft deals 1..1,000,000.
 * The original Windows 95 range is 1..32,000. This uses the same MSVC LCG,
 * rank-major C/D/H/S deck, tail-replacement selection and eight-column deal.
 * Algorithm reference: Jim Horne's published original shuffle description,
 * https://www.solitairelaboratory.com/mshuffle.txt
 *
 * State: cells[4] (null/card), foundations[4], tableau[8], seed, moves,
 * state ('playing'|'won'). Cards: { id, rank: 1..13, suit, faceUp: true }.
 * Tableau/foundation arrays are ordered bottom-to-top; last card is exposed.
 *
 * move(from, to), canMove(from, to), autoFoundation(from), undo(): booleans.
 * from = { zone: 'tableau'|'cell'|'foundation', pile, index? }.
 * to = { zone: 'tableau'|'cell'|'foundation', pile }.
 * Omitted source index selects the exposed card. Only tableau supports runs.
 * Foundations are terminal under the Windows FreeCell rules; undo can reverse
 * a foundation move. A source descriptor naming a foundation returns false.
 *
 * moveCapacity(to) = (empty cells + 1) * 2 ** auxiliary empty columns.
 * An empty destination column is excluded. Source columns are counted before
 * the move, so vacating the source never grants premature extra capacity.
 * Every sequence must descend by rank and alternate colors. Any rank can fill
 * an empty tableau column. A sequence transfer is one undoable action.
 */
const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
const red = card => card.suit === 'hearts' || card.suit === 'diamonds';
const cloneCard = card => card ? { ...card } : null;
const clonePile = pile => pile.map(cloneCard);
export function microsoftRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 214013) + 2531011) >>> 0;
        return (state >>> 16) & 0x7fff;
    };
}
export class FreeCell {
    constructor(seed = 1) { this.deal(seed); }
    deal(seed = this.seed) {
        if (!Number.isInteger(seed) || seed < 1 || seed > 1000000) {
            throw new RangeError('Deal number must be an integer from 1 to 1,000,000.');
        }
        this.seed = seed;
        this.cells = Array(4).fill(null);
        this.foundations = Array.from({ length: 4 }, () => []);
        this.tableau = Array.from({ length: 8 }, () => []);
        this.moves = 0;
        this.state = 'playing';
        this._history = [];
        const deck = [];
        for (let rank = 1; rank <= 13; rank++) {
            for (const suit of SUITS)
                deck.push({ id: `${suit}-${rank}`, rank, suit, faceUp: true });
        }
        const next = microsoftRandom(seed);
        for (let index = 0; index < 52; index++) {
            const chosen = next() % deck.length;
            this.tableau[index % 8].push(deck[chosen]);
            deck[chosen] = deck[deck.length - 1];
            deck.pop();
        }
        return this;
    }
    get canUndo() { return this._history.length !== 0; }
    _remember() {
        this._history.push({
            cells: this.cells.map(cloneCard),
            foundations: this.foundations.map(clonePile),
            tableau: this.tableau.map(clonePile),
            moves: this.moves,
            state: this.state,
        });
    }
    undo() {
        const previous = this._history.pop();
        if (!previous)
            return false;
        Object.assign(this, previous);
        return true;
    }
    _source(from) {
        if (!from || !Number.isInteger(from.pile) || from.pile < 0)
            return null;
        if (from.zone === 'cell') {
            if (from.pile >= 4 || (from.index !== undefined && from.index !== 0))
                return null;
            const card = this.cells[from.pile];
            return card?.faceUp ? { cards: [card], index: 0 } : null;
        }
        // Windows FreeCell home cells are terminal; reversal is provided by undo.
        if (from.zone !== 'tableau' || from.pile >= 8)
            return null;
        const pile = this.tableau[from.pile];
        const index = from.index === undefined ? pile.length - 1 : from.index;
        if (!Number.isInteger(index) || index < 0 || index >= pile.length)
            return null;
        const cards = pile.slice(index);
        for (let offset = 0; offset < cards.length; offset++) {
            if (!cards[offset].faceUp)
                return null;
            if (offset && (cards[offset - 1].rank !== cards[offset].rank + 1 ||
                red(cards[offset - 1]) === red(cards[offset])))
                return null;
        }
        return { cards, index };
    }
    _validDestination(to) {
        return to && Number.isInteger(to.pile) && to.pile >= 0 &&
            ((to.zone === 'tableau' && to.pile < 8) ||
                ((to.zone === 'cell' || to.zone === 'foundation') && to.pile < 4));
    }
    moveCapacity(to) {
        if (!this._validDestination(to) || to.zone !== 'tableau')
            return 0;
        const freeCells = this.cells.reduce((count, card) => count + (card === null ? 1 : 0), 0);
        const auxiliaryColumns = this.tableau.reduce((count, pile, index) => count + (index !== to.pile && pile.length === 0 ? 1 : 0), 0);
        return (freeCells + 1) * 2 ** auxiliaryColumns;
    }
    canMove(from, to) {
        if (this.state === 'won' || !this._validDestination(to))
            return false;
        const source = this._source(from);
        if (!source || (from.zone === to.zone && from.pile === to.pile))
            return false;
        const first = source.cards[0];
        if (to.zone === 'cell')
            return source.cards.length === 1 && this.cells[to.pile] === null;
        const pile = to.zone === 'foundation' ? this.foundations[to.pile] : this.tableau[to.pile];
        const top = pile.at(-1);
        if (to.zone === 'foundation') {
            return source.cards.length === 1 && (!top ? first.rank === 1 :
                top.suit === first.suit && first.rank === top.rank + 1);
        }
        if (source.cards.length > this.moveCapacity(to))
            return false;
        return !top || (top.faceUp && top.rank === first.rank + 1 && red(top) !== red(first));
    }
    move(from, to) {
        if (!this.canMove(from, to))
            return false;
        const source = this._source(from);
        this._remember();
        if (from.zone === 'cell')
            this.cells[from.pile] = null;
        else
            this.tableau[from.pile].splice(source.index);
        if (to.zone === 'cell')
            this.cells[to.pile] = source.cards[0];
        else if (to.zone === 'foundation')
            this.foundations[to.pile].push(source.cards[0]);
        else
            this.tableau[to.pile].push(...source.cards);
        this.moves++;
        if (this.foundations.reduce((count, pile) => count + pile.length, 0) === 52)
            this.state = 'won';
        return true;
    }
    autoFoundation(from) {
        const source = this._source(from);
        if (!source || source.cards.length !== 1)
            return false;
        const suit = source.cards[0].suit;
        const matching = this.foundations.findIndex(pile => pile.at(-1)?.suit === suit);
        const destination = matching >= 0 ? matching : this.foundations.findIndex(pile => pile.length === 0);
        return destination >= 0 && this.move(from, { zone: 'foundation', pile: destination });
    }
}
