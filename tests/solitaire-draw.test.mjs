import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';
import { Klondike } from '../src/packages/games/engines.js';

/**
 * Draw One and Draw Three were the same game to look at: the stock turned the
 * right number of cards, but the waste only ever drew the last one, so three
 * cards appeared exactly as one did. The waste is now a fan of what the stock
 * last turned over - one card, or three overlapping with the face on top - and
 * only that face can be taken, as on a real table.
 *
 * The choice is also remembered between deals and visits, as in Solitaire
 * itself, and Help → How to Play opens the guide to the game.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [app, css] = await Promise.all([
    readFile(path.join(root, 'src/packages/games/apps.js'), 'utf8'),
    readFile(path.join(root, 'src/styles.css'), 'utf8')
]);
const rule = selector => new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}').exec(css)?.[1] ?? '';
const cardWidth = Number(/width:(\d+)px/.exec(rule('.card'))?.[1] ?? 0);

test('the waste shows the cards the stock last turned over, not just the last one', () => {
    assert.equal(cardWidth, 66, 'a card is a fixed width, so a fan can be laid out in pixels');
    assert.match(app, /const shown = game\.waste\.slice\(-\(drawThree \? 3 : 1\)\);/, 'one card in Draw One, three in Draw Three');
    assert.match(app, /shown\.forEach\(\(card, i\) => \{/, 'each of them is drawn');
    assert.match(app, /node\.classList\.add\('waste-' \+ i\)/, 'and the ones behind the face are stepped across');
    assert.match(rule('.card.waste-1'), /left:\s*20px/, 'the second card shows its corner and leaves the rest covered');
    assert.match(rule('.card.waste-2'), /left:\s*40px/, 'the third shows just as much again');
    const waste = rule('.card-slot.waste');
    assert.match(waste, /width:106px/, 'the waste is wide enough for the whole fan');
    assert.ok(Number(/width:(\d+)px/.exec(waste)[1]) >= cardWidth + 40, 'which is the card plus the two steps');
});

test('only the face of the fan can be taken', () => {
    assert.match(app, /const isFace = i === shown\.length - 1;/, 'the face is the last card drawn');
    assert.match(app, /inert: !isFace/, 'the cards behind it are drawn but not played');
    assert.match(app, /draggable: !inert && !!card\.faceUp/, 'and cannot be dragged off the waste');
    assert.match(app, /if \(inert\)\s*\n\s*n\.tabIndex = -1;/, 'nor reached with the keyboard');
    assert.match(app, /onClick: isFace \? e => choose\(from, e\) : undefined/, 'a click on a buried card does nothing');
    assert.match(app, /if \(isFace\)\s*\n\s*wire\(node, from\);/, 'only the face is wired for dragging');
});

test('the choice outlives the deal, the window and the visit', () => {
    assert.match(app, /drawThree = !isFree && !!s\.settings\.get\('solitaireDrawThree', false\)/, 'a new window opens the way the last one was left');
    assert.match(app, /const setDraw = three => \{[\s\S]*?s\.settings\.set\('solitaireDrawThree', three\);[\s\S]*?render\(\);\s*\};/, 'choosing one saves it');
    assert.match(app, /label: 'Draw One', checked: !drawThree, action: \(\) => setDraw\(false\)/, 'Draw One is a tick that stays put');
    assert.match(app, /label: 'Draw Three', checked: drawThree, action: \(\) => setDraw\(true\)/);
    /* A new deal is a new Klondike but the same choice: nothing in newGame resets it. */
    const newGame = /const newGame = seed => \{([\s\S]*?)\};/.exec(app)?.[1] ?? '';
    assert.match(newGame, /new Klondike\(\)/, 'a new deal deals a new table');
    assert.doesNotMatch(newGame, /drawThree\s*=/, 'and leaves the draw choice alone');
});

test('the stock still turns over three at a time, and the waste reads back in order', () => {
    const game = new Klondike(7);
    const before = game.stock.length;
    game.draw(3);
    assert.equal(game.stock.length, before - 3, 'three cards leave the stock in one click');
    assert.equal(game.waste.length, 3, 'and land in the waste');
    assert.deepEqual(game.waste.map(card => card.faceUp), [true, true, true]);
    const shown = game.waste.slice(-3);
    assert.equal(shown.length, 3, 'the three shown are the three just drawn');
    assert.equal(shown.at(-1), game.waste.at(-1), 'the face of the fan is the top of the waste');
});

test('Help opens the guide to Solitaire, and F1 does too', () => {
    assert.match(app, /s\.launch\('help', \{ topic: isFree \? 'freecell' : 'solitaire' \}\)/, 'How to Play opens the Help page for the game at hand');
    assert.match(app, /label: 'How to Play', shortcut: 'F1'/, 'and says so on the menu, for both games');
    assert.match(app, /e\.key === 'F1'\)/, 'F1 opens it from the table');
    assert.match(app, /e\.stopPropagation\(\);\s*\n\s*s\.launch\('help', \{ topic: isFree \? 'freecell' : 'solitaire' \}\)/, 'and keeps the shell from opening a second Help window');
});

test('the keys keep working after a card has been clicked', () => {
    /* The table is drawn again after every move, which takes the card with the
       keyboard off the page; the window takes the keys back so F2, Ctrl+Z, H
       and F1 do not fall silent after the first click on a card. */
    assert.match(app, /function keepKeys\(s, w\) \{\s*\n\s*if \(s\.wm\.active === w && \(!document\.activeElement \|\| document\.activeElement === document\.body\)\)\s*\n\s*w\.element\.focus\(\{ preventScroll: true \}\);/, 'the window takes the keyboard back when the focus falls to the page');
});

test('the guide is written in both languages, with the same shape', () => {
    installDom();
    register('./win95-resolver.mjs', import.meta.url);
    return import('../src/packages/apps/utilities.js').then(({ helpTopic }) => {
        const en = helpTopic('solitaire', 'en'), zh = helpTopic('solitaire', 'zh');
        assert.ok(en && zh, 'the Help window has a topic for Solitaire');
        assert.equal(en.title, 'Solitaire');
        assert.match(zh.title, /[\u4e00-\u9fff]/);
        const tags = html => html.match(/<\/?[a-zA-Z]+[^>]*>/g) ?? [];
        assert.deepEqual(tags(zh.body), tags(en.body), 'the Chinese page has the same tags in the same order');
        assert.match(en.body, /Draw One/, 'the English guide names Draw One');
        assert.match(en.body, /Draw Three/, 'and Draw Three');
        assert.match(zh.body, /抽一张/, 'the Chinese guide names 抽一张');
        assert.match(zh.body, /抽三张/, 'and 抽三张');
        for (const [lang, body] of [['en', en.body], ['zh', zh.body]]) {
            assert.match(body, /Stock|牌堆/, `${lang} explains the stock`);
            assert.match(body, /100/, `${lang} gives the cost of turning the waste over`);
        }
        assert.match(zh.body, /抽一张与抽三张/, 'the Chinese guide has a section on the two ways to draw');
    });
});
