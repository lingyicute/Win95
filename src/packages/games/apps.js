import { el, button, uniqueId, onDoubleActivate } from '@win95/ui/dom.js';
import { menuBar } from '@win95/ui/menu.js';
import { Minesweeper, Klondike, cardColor } from './engines.js';
import { cellClass, cellMarkup, counterChars, counterMarkup, faceFor, faceMarkup } from './mines-display.js';
import { createTouchFlagHandler } from './mines-input.js';
import { FreeCell } from './freecell-engine.js';
const suitSymbols = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };
function cardNode(card, { selected = false, onClick, onDoubleClick, top = 0 } = {}) {
    const n = el('button', { class: 'card' + (card.faceUp ? ' ' + (cardColor(card) === 'red' ? 'red' : '') : ' face-down') + (selected ? ' selected' : ''), style: { top: top + 'px' }, 'aria-label': card.faceUp ? `${({ 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' })[card.rank] || card.rank} of ${card.suit}` : 'Face-down card', onclick: onClick, ondblclick: onDoubleClick, draggable: !!card.faceUp });
    if (card.faceUp) {
        const rank = ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[card.rank] || String(card.rank), sym = suitSymbols[card.suit];
        const corner = () => el('span', { class: 'card-corner' }, rank, el('span', { text: sym }));
        const end = corner();
        end.classList.add('bottom');
        n.append(corner(), el('span', { class: 'card-center', text: card.rank > 10 ? ({ 11: '♙', 12: '♕', 13: '♔' })[card.rank] : sym }), end);
        if (card.rank > 1 && card.rank <= 10) {
            const pips = el('div', { class: 'card-pips', 'aria-hidden': 'true' });
            const layouts = { 2: [[1, 0], [1, 4]], 3: [[1, 0], [1, 2], [1, 4]], 4: [[0, 0], [2, 0], [0, 4], [2, 4]], 5: [[0, 0], [2, 0], [1, 2], [0, 4], [2, 4]], 6: [[0, 0], [2, 0], [0, 2], [2, 2], [0, 4], [2, 4]], 7: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2], [0, 4], [2, 4]], 8: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2], [1, 3], [0, 4], [2, 4]], 9: [[0, 0], [2, 0], [0, 1.35], [2, 1.35], [1, 2], [0, 2.7], [2, 2.7], [0, 4], [2, 4]], 10: [[0, 0], [2, 0], [1, .7], [0, 1.35], [2, 1.35], [0, 2.7], [2, 2.7], [1, 3.3], [0, 4], [2, 4]] };
            for (const [x, y] of layouts[card.rank])
                pips.append(el('span', { text: sym, style: { left: (x * 25 + 25) + '%', top: (y * 17.5 + 15) + '%', transform: y > 2 ? 'translate(-50%,-50%) rotate(180deg)' : 'translate(-50%,-50%)' } }));
            n.querySelector('.card-center').replaceWith(pips);
        }
    }
    return n;
}
export function minesweeper(s) {
    let rows = 8, cols = 8, mines = 10, game = new Minesweeper(rows, cols, mines), startTime = 0, seconds = 0, best = s.settings.get('minesBest', {}), timer, pressed = false;
    // 20px a cell plus the 47px of chrome around it (window padding, .mines-body and .mines-frame padding and bevels,
    // and the board's border — summed from styles.css by tests/mines-window.test.mjs). A window any wider leaves a
    // grey strip beside the field, and only on the right: .mines-frame is an inline-block hugging the body's left edge.
    const w = s.wm.create({ title: 'Minesweeper', icon: 'minesweeper', width: cols * 20 + 46.5, height: rows * 20 + 138, resizable: false, allowOverflow: true });
    w.element.classList.add('mines-window');
    w.body.classList.add('mines-body');
    const frame = el('div', { class: 'mines-frame' }), count = el('div', { class: 'mines-counter', role: 'img' }), time = el('div', { class: 'mines-counter', role: 'img' }), face = button('', () => reset(), { class: 'mines-face', 'aria-label': 'New game' }), header = el('div', { class: 'mines-header' }, count, face, time), board = el('div', { class: 'mines-board', 'aria-label': 'Minesweeper board' });
    frame.append(header, board);
    w.body.append(frame);
    const paintCounter = (node, value) => {
        node.innerHTML = counterMarkup(value);
        node.setAttribute('aria-label', counterChars(value));
    };
    const paintFace = () => { face.innerHTML = faceMarkup(faceFor(game.state, pressed)); };
    const render = () => {
        paintCounter(count, mines - game.flags);
        paintCounter(time, seconds);
        paintFace();
        board.style.gridTemplateColumns = `repeat(${cols},20px)`;
        board.replaceChildren();
        const lost = game.state === 'lost';
        for (const [i, cell] of game.cells.entries()) {
            // When the game ends an unflagged mine is shown, and a flag over empty
            // ground turns into the mine it wrongly covered.
            const shown = lost && cell.mine && !cell.flagged ? { ...cell, revealed: true } : cell;
            const wrong = lost && cell.flagged && !cell.mine;
            const b = button('', e => {
                if ((e.detail > 0 || e.pointerType === 'touch') && touchFlags.consumeClick(i)) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                reveal(i);
            }, { class: 'mine-cell' + cellClass({ ...shown, exploded: game.exploded === i, wrong }), 'aria-label': `Row ${Math.floor(i / cols) + 1} column ${i % cols + 1}, ${cell.flagged ? 'flagged' : cell.revealed ? cell.mine ? 'mine' : `${cell.adjacent} adjacent mines` : 'covered'}` });
            b.innerHTML = cellMarkup({ ...shown, wrong });
            b.oncontextmenu = e => {
                e.preventDefault();
                if (!touchFlags.contextMenu()) {
                    game.flag(i);
                    render();
                }
            };
            b.onauxclick = e => {
                if (e.button === 1) {
                    e.preventDefault();
                    game.chord(i);
                    finish();
                    render();
                }
            };
            onDoubleActivate(b, () => { game.chord(i); finish(); render(); });
            b.onpointerdown = e => {
                if (e.button === 0) {
                    pressed = true;
                    paintFace();
                }
                touchFlags.pointerDown(i, e);
            };
            board.append(b);
        }
    };
    const touchFlags = createTouchFlagHandler(i => {
        game.flag(i);
        render();
    });
    let ended = false;
    const finish = () => {
        if (game.state === 'won' || game.state === 'lost') {
            clearInterval(timer);
            if (!ended) {
                ended = true;
                if (game.state === 'won') {
                    const key = `${rows}x${cols}:${mines}`;
                    if (best[key] === undefined || seconds < best[key]) {
                        best[key] = seconds;
                        s.settings.set('minesBest', best);
                    }
                }
                s.beep(game.state === 'won' ? 'win' : 'error');
            }
        }
    };
    const reveal = i => {
        const wasReady = game.state === 'ready';
        const changed = game.reveal(i);
        if (changed && wasReady && game.state === 'playing') {
            startTime = Date.now();
            timer = setInterval(() => { seconds = Math.floor((Date.now() - startTime) / 1000); paintCounter(time, seconds); }, 500);
        }
        finish();
        render();
    };
    const reset = (r = rows, c = cols, m = mines) => { touchFlags.cancel(); clearInterval(timer); rows = r; cols = c; mines = m; game = new Minesweeper(r, c, m); seconds = 0; startTime = 0; pressed = false; ended = false; w.rect.width = c * 20 + 46.5; w.rect.height = r * 20 + 138; s.wm.layout(w); render(); };
    w.setMenu(menuBar([{ label: 'Game', items: () => [{ label: 'New', shortcut: 'F2', action: () => reset() }, null, { label: 'Beginner', checked: rows === 8, action: () => reset(8, 8, 10) }, { label: 'Intermediate', checked: rows === 16 && cols === 16, action: () => reset(16, 16, 40) }, { label: 'Expert', checked: cols === 30, action: () => reset(16, 30, 99) }, { label: 'Custom…', action: async () => {
                        const r = await s.ui.prompt('Rows, columns, mines:', `${rows}, ${cols}, ${mines}`, 'Custom Field', { owner: w });
                        if (r) {
                            const [a, b, c] = r.split(/\D+/).map(Number);
                            if (a >= 8 && a <= 24 && b >= 8 && b <= 30 && c >= 1 && c < a * b)
                                reset(a, b, c);
                            else
                                s.ui.message('Use 8–24 rows, 8–30 columns, and fewer mines than squares.', 'Minesweeper', ['OK'], { owner: w });
                        }
                    } }, null, { label: 'Best Times…', action: () => s.ui.message(`Beginner: ${best['8x8:10'] ?? '—'} seconds\nIntermediate: ${best['16x16:40'] ?? '—'} seconds\nExpert: ${best['16x30:99'] ?? '—'} seconds`, 'Fastest Mine Sweepers', ['OK'], { owner: w, height: 210 }) }, null, { label: 'Exit', action: () => w.close() }] }, { label: 'Help', items: [{ label: 'How to Play', action: () => s.ui.message('Uncover every empty square without hitting a mine.\n\nLeft-click reveals a square. Right-click places a flag. Numbers count nearby mines. Double-click a number after flagging all adjacent mines to reveal its neighbors.', 'Minesweeper', ['OK'], { owner: w, height: 240 }) }, { label: 'About Minesweeper', action: () => s.about('Minesweeper', 'minesweeper') }] }]));
    w.element.addEventListener('keydown', e => {
        if (e.key === 'F2') {
            e.preventDefault();
            reset();
        }
    });
    const releaseFace = e => {
        touchFlags.pointerEnd(e.pointerId);
        if (!pressed)
            return;
        pressed = false;
        paintFace();
    };
    const movePointer = e => touchFlags.pointerMove(e);
    window.addEventListener('pointerup', releaseFace);
    window.addEventListener('pointercancel', releaseFace);
    window.addEventListener('pointermove', movePointer);
    w.onClosed.push(() => {
        touchFlags.cancel();
        clearInterval(timer);
        window.removeEventListener('pointerup', releaseFace);
        window.removeEventListener('pointercancel', releaseFace);
        window.removeEventListener('pointermove', movePointer);
    });
    reset();
    return w;
}
export function solitaire(s, args = {}) {
    const isFree = args.freecell === true;
    let game = isFree ? new FreeCell(args.seed || Math.floor(Math.random() * 32000) + 1) : new Klondike(), selected = null, drawThree = false, elapsed = 0, winRecorded = false, dealToken = uniqueId();
    const w = s.wm.create({ title: isFree ? `FreeCell Game #${game.seed}` : 'Solitaire', icon: isFree ? 'freecell' : 'solitaire', width: isFree ? 641 : 600, height: 470 });
    const board = el('div', { class: 'solitaire-board' + (isFree ? ' freecell-board' : '') });
    w.body.append(board);
    w.status('');
    const same = (a, b) => a && b && a.zone === b.zone && a.pile === b.pile && a.index === b.index;
    const move = to => {
        if (!selected)
            return false;
        if (game.move(selected, to)) {
            selected = null;
            render();
            return true;
        }
        return false;
    };
    const choose = (from, e) => {
        e?.stopPropagation();
        if (selected && from.zone === 'tableau' && !same(selected, from) && move({ zone: 'tableau', pile: from.pile }))
            return;
        if (selected && from.zone === 'cell' && move({ zone: 'cell', pile: from.pile }))
            return;
        selected = same(selected, from) ? null : from;
        render();
    };
    const auto = from => {
        if (game.autoFoundation(from)) {
            selected = null;
            render();
        }
    };
    const cardAt = from => from.zone === 'tableau' ? game.tableau[from.pile]?.[from.index] : from.zone === 'cell' ? game.cells[from.pile] : from.zone === 'waste' ? game.waste.at(-1) : game.foundations[from.pile]?.at(-1);
    const wire = (node, from) => { node.ondragstart = e => { selected = from; e.dataTransfer.setData('application/x-win95-card', JSON.stringify({ from, dealToken, cardId: cardAt(from)?.id })); e.dataTransfer.effectAllowed = 'move'; }; };
    const target = (node, to) => {
        node.ondragover = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
        node.ondrop = e => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const payload = JSON.parse(e.dataTransfer.getData('application/x-win95-card'));
                if (payload.dealToken !== dealToken || payload.cardId === undefined || cardAt(payload.from)?.id !== payload.cardId)
                    return;
                selected = payload.from;
                move(to);
            }
            catch { }
        };
        node.addEventListener('click', e => {
            if (e.target === node)
                move(to);
        });
    };
    const render = () => {
        board.replaceChildren();
        const top = el('div', { class: isFree ? 'freecell-header' : 'card-row' }), left = isFree ? el('div', { class: 'card-row' }) : top, right = isFree ? el('div', { class: 'card-row' }) : top;
        if (isFree) {
            for (let i = 0; i < 4; i++) {
                const slot = el('div', { class: 'card-slot', 'aria-label': 'Free cell ' + (i + 1) });
                target(slot, { zone: 'cell', pile: i });
                if (game.cells[i]) {
                    const from = { zone: 'cell', pile: i }, node = cardNode(game.cells[i], { selected: same(selected, from), onClick: e => choose(from, e), onDoubleClick: () => auto(from) });
                    wire(node, from);
                    slot.append(node);
                }
                left.append(slot);
            }
            top.append(left, right);
        }
        else {
            const stock = el('div', { class: 'card-slot stock', 'aria-label': 'Stock', text: game.stock.length ? '' : '↻', onclick: () => { game.draw(drawThree ? 3 : 1); selected = null; render(); } });
            if (game.stock.length)
                stock.append(cardNode({ faceUp: false }));
            const waste = el('div', { class: 'card-slot', 'aria-label': 'Waste' });
            if (game.waste.length) {
                const from = { zone: 'waste' }, node = cardNode(game.waste.at(-1), { selected: same(selected, from), onClick: e => choose(from, e), onDoubleClick: () => auto(from) });
                wire(node, from);
                waste.append(node);
            }
            top.append(stock, waste, el('div', { style: { width: '66px', flexShrink: 0 } }));
        }
        for (let i = 0; i < 4; i++) {
            const slot = el('div', { class: 'card-slot foundation', 'aria-label': 'Foundation ' + (i + 1), text: isFree ? 'A' : '' });
            target(slot, { zone: 'foundation', pile: i });
            if (game.foundations[i].length) {
                const from = { zone: 'foundation', pile: i }, card = cardNode(game.foundations[i].at(-1), { selected: same(selected, from), onClick: e => {
                        e.stopPropagation();
                        if (!move({ zone: 'foundation', pile: i }) && !isFree)
                            choose(from, e);
                    } });
                if (!isFree)
                    wire(card, from);
                slot.append(card);
            }
            right.append(slot);
        }
        board.append(top);
        const tableau = el('div', { class: 'solitaire-tableau' });
        game.tableau.forEach((pile, i) => {
            const column = el('div', { class: 'solitaire-column', 'aria-label': 'Tableau column ' + (i + 1), style: { height: Math.max(110, pile.length * 22 + 75) + 'px' } });
            target(column, { zone: 'tableau', pile: i });
            let y = 0;
            pile.forEach((card, j) => {
                const from = { zone: 'tableau', pile: i, index: j }, node = cardNode(card, { selected: same(selected, from), top: y, onClick: e => {
                        if (card.faceUp)
                            choose(from, e);
                        else
                            e.stopPropagation();
                    }, onDoubleClick: () => auto(from) });
                if (card.faceUp)
                    wire(node, from);
                column.append(node);
                y += card.faceUp ? 22 : 13;
            });
            tableau.append(column);
        });
        board.append(tableau);
        w.status(isFree ? `Game #${game.seed}       Moves: ${game.moves}       Free cells: ${game.cells.filter(c => !c).length}` : `Score: ${game.score}       Time: ${elapsed}       Moves: ${game.moves}`);
        if (game.state === 'won') {
            const wins = s.settings.get(isFree ? 'freecellWins' : 'solitaireWins', 0) + 1;
            if (!winRecorded) {
                s.settings.set(isFree ? 'freecellWins' : 'solitaireWins', wins);
                winRecorded = true;
            }
            board.append(el('div', { class: 'game-victory' }, el('h2', { text: 'Congratulations!' }), el('p', { text: 'You won the game.' }), button('Deal Again', () => newGame())));
        }
    };
    const newGame = seed => { game = isFree ? new FreeCell(seed || Math.floor(Math.random() * 32000) + 1) : new Klondike(); selected = null; elapsed = 0; winRecorded = false; dealToken = uniqueId(); w.setTitle(isFree ? `FreeCell Game #${game.seed}` : 'Solitaire'); render(); board.scrollTop = 0; };
    const hint = () => {
        const sources = [];
        game.tableau.forEach((pile, i) => pile.forEach((c, j) => {
            if (c.faceUp)
                sources.push({ zone: 'tableau', pile: i, index: j });
        }));
        if (isFree)
            game.cells.forEach((c, i) => c && sources.push({ zone: 'cell', pile: i }));
        else if (game.waste.length)
            sources.push({ zone: 'waste' });
        for (const from of sources)
            for (let i = 0; i < 4; i++)
                if (game.canMove(from, { zone: 'foundation', pile: i })) {
                    selected = from;
                    render();
                    w.status(`Hint: move the selected card to a foundation.`);
                    return;
                }
        for (const from of sources)
            for (let i = 0; i < game.tableau.length; i++)
                if (game.canMove(from, { zone: 'tableau', pile: i })) {
                    selected = from;
                    render();
                    w.status(`Hint: move the selected card to column ${i + 1}.`);
                    return;
                }
        w.status(isFree ? 'No tableau or foundation move found. Try a free cell.' : 'Click the stock to draw another card.');
    };
    const selectGame = async () => { const r = await s.ui.prompt('Game number (1–32000):', String(game.seed), 'Select Game', { owner: w }); const n = Number(r); if (r && Number.isInteger(n) && n >= 1 && n <= 32000)
        newGame(n); };
    w.setMenu(menuBar([{ label: 'Game', items: () => [{ label: isFree ? 'New Game' : 'Deal', shortcut: 'F2', action: () => newGame() }, ...(isFree ? [{ label: 'Select Game…', shortcut: 'F3', action: selectGame }, { label: 'Restart Game', action: () => newGame(game.seed) }] : []), { label: 'Undo', shortcut: 'Ctrl+Z', disabled: !game.canUndo, action: () => { game.undo(); selected = null; render(); } }, { label: 'Hint', shortcut: 'H', action: hint }, null, ...(!isFree ? [{ label: 'Draw One', checked: !drawThree, action: () => drawThree = false }, { label: 'Draw Three', checked: drawThree, action: () => drawThree = true }] : [{ label: 'Statistics…', action: () => s.ui.message(`Games won: ${s.settings.get('freecellWins', 0)}`, 'FreeCell Statistics', ['OK'], { owner: w }) }]), null, { label: 'Exit', action: () => w.close() }] }, { label: 'Help', items: [{ label: 'How to Play', action: () => s.ui.message(isFree ? 'Move all cards to the four foundations, building from Ace to King in each suit.\n\nBuild tableau columns in descending order with alternating colors. Any card may occupy a free cell. Empty cells and columns determine how many cards can be moved together.\n\nClick a card, then its destination, or drag it. Double-click to move it to a foundation.' : 'Build four foundations from Ace to King in each suit. Tableau columns descend with alternating colors. An empty column accepts a King.\n\nClick a card, then its destination, or drag it. Double-click to move to a foundation. Click the stock to draw.', isFree ? 'FreeCell' : 'Solitaire', ['OK'], { owner: w, width: 440, height: 290 }) }, { label: 'About ' + (isFree ? 'FreeCell' : 'Solitaire'), action: () => s.about(isFree ? 'FreeCell' : 'Solitaire', isFree ? 'freecell' : 'solitaire') }] }]));
    w.element.addEventListener('keydown', e => {
        if (e.key === 'F2') {
            e.preventDefault();
            newGame();
        }
        else if (e.key === 'F3' && isFree) {
            e.preventDefault();
            selectGame();
        }
        else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            game.undo();
            selected = null;
            render();
        }
        else if (e.key.toLowerCase() === 'h')
            hint();
        else if (e.key === 'Escape') {
            selected = null;
            render();
        }
    });
    const timer = setInterval(() => {
        if (game.state !== 'won') {
            elapsed++;
            if (!isFree)
                w.status(`Score: ${game.score}       Time: ${elapsed}       Moves: ${game.moves}`);
        }
    }, 1000);
    w.onClosed.push(() => clearInterval(timer));
    render();
    w.game = () => game;
    return w;
}
export async function hearts(s) {
    const { Hearts } = await import('./hearts-engine.js');
    let game = new Hearts(), timer = 0;
    const names = [s.settings.get('owner', 'Windows User'), 'West', 'North', 'East'];
    const w = s.wm.create({ title: 'Hearts', icon: 'hearts', width: 640, height: 460 });
    const board = el('div', { class: 'hearts-table' });
    w.body.append(board);
    const render = () => {
        board.replaceChildren();
        for (const [i, p] of [[1, { left: '20px', top: '42%' }], [2, { left: '46%', top: '15px' }], [3, { right: '20px', top: '42%' }]])
            board.append(el('div', { class: 'hearts-player', style: p }, names[i], el('p', { text: game.hands[i].length + ' cards' })));
        const scores = el('div', { class: 'hearts-score' });
        for (let i = 0; i < 4; i++)
            scores.append(el('div', { text: `${names[i]}: ${game.scores[i]} (+${game.roundScores[i]})` }));
        board.append(scores);
        const trick = el('div', { class: 'hearts-trick' });
        const visible = game.trick.length ? game.trick : game.lastTrick;
        for (const item of visible || [])
            trick.append(el('div', { style: { position: 'relative', width: '66px', height: '115px' } }, el('span', { text: names[item.player], style: { position: 'absolute', top: '-20px' } }), cardNode(item.card)));
        board.append(trick);
        const instructions = el('div', { class: 'hearts-instruction', text: game.state === 'playing' ? (game.turn === 0 ? 'Your turn. Choose a card to play.' : names[game.turn] + ' is thinking…') : game.state === 'finished' ? 'Game over.' : 'Hand complete.' });
        board.append(instructions);
        const hand = el('div', { class: 'hearts-hand' });
        const legal = game.turn === 0 ? game.legalCards(0) : [];
        for (const card of [...game.hands[0]].sort((a, b) => a.suit.localeCompare(b.suit) || (a.rank === 1 ? 14 : a.rank) - (b.rank === 1 ? 14 : b.rank))) {
            const node = cardNode(card, { onClick: () => {
                    if (game.turn !== 0 || game.state !== 'playing')
                        return;
                    if (game.play(card.id)) {
                        render();
                        advance();
                    }
                    else
                        s.beep('error');
                } });
            if (game.turn === 0 && !legal.some(c => c.id === card.id))
                node.style.filter = 'brightness(.7)';
            hand.append(node);
        }
        board.append(hand);
        if (game.state !== 'playing') {
            board.append(el('div', { class: 'game-victory' }, el('h2', { text: game.state === 'finished' ? 'Game Over' : 'Hand Complete' }), el('p', { text: game.state === 'finished' ? `${game.winners.map(i => names[i]).join(' & ')} won.` : 'Scores have been added to the total.' }), button(game.state === 'finished' ? 'New Game' : 'Next Hand', () => { game.state === 'finished' ? game.newGame() : game.nextRound(); render(); advance(); })));
        }
        w.status(`Hand ${game.round}       Hearts ${game.heartsBroken ? 'broken' : 'not broken'}       No-passing game`);
    };
    const advance = () => {
        clearTimeout(timer);
        if (game.state === 'playing' && game.turn !== 0)
            timer = setTimeout(() => {
                if (w.closed)
                    return;
                game.aiPlay();
                render();
                advance();
            }, 550);
    };
    const newGame = () => { game = new Hearts(); render(); advance(); };
    w.setMenu(menuBar([{ label: 'Game', items: [{ label: 'New Game', shortcut: 'F2', action: newGame }, { label: 'Exit', action: () => w.close() }] }, { label: 'Help', items: [{ label: 'How to Play', action: () => s.ui.message('Avoid winning hearts (1 point each) and the queen of spades (13 points). Follow the suit led whenever possible. The two of clubs leads the first trick.\n\nTaking all 26 points gives each opponent 26 points. The match ends at 100; the lowest score wins.\n\nThis version plays no-passing hands.', 'Hearts', ['OK'], { owner: w, height: 300, width: 440 }) }, { label: 'About Hearts', action: () => s.about('Hearts', 'hearts') }] }]));
    w.element.addEventListener('keydown', e => { if (e.key === 'F2') {
        e.preventDefault();
        newGame();
    } });
    w.onClosed.push(() => clearTimeout(timer));
    render();
    advance();
    return w;
}
