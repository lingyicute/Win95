import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * Minesweeper, Hearts and FreeCell now have a page of their own in Help, the
 * same as Solitaire and Pinball: Help → How to Play and F1 open it, and it is
 * written in both languages.
 *
 * The words are held to the games themselves here - the field sizes and mine
 * counts Minesweeper actually offers, the scoring Hearts actually uses, the
 * move capacity FreeCell actually allows - so a later change to a rule fails
 * against the page that teaches it rather than quietly making the page wrong.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = await readFile(path.join(root, 'src/packages/games/apps.js'), 'utf8');

installDom();
register('./win95-resolver.mjs', import.meta.url);
const { helpTopic, helpTopicsOrder } = await import('../src/packages/apps/utilities.js');

const tags = html => html.match(/<\/?[a-zA-Z]+[^>]*>/g) ?? [];
const kbd = html => html.match(/<kbd>[\s\S]*?<\/kbd>/g) ?? [];

const guides = ['minesweeper', 'hearts', 'freecell'];

test('each game has a guide, and Help and F1 both open it', () => {
    for (const key of guides) {
        assert.match(app, new RegExp(`label: 'How to Play', shortcut: 'F1', action: \\(\\) => s\\.launch\\('help', \\{ topic: (?:'${key}'|isFree \\? 'freecell' : 'solitaire') \\}\\)`), `${key} has a How to Play`);
        assert.match(app, new RegExp(`e\\.key === 'F1'`), 'F1 is handled by the games');
    }
    assert.match(app, /s\.launch\('help', \{ topic: 'minesweeper' \}\)/, 'Minesweeper opens its own page');
    assert.match(app, /s\.launch\('help', \{ topic: 'hearts' \}\)/, 'Hearts opens its own page');
    assert.match(app, /s\.launch\('help', \{ topic: isFree \? 'freecell' : 'solitaire' \}\)/, 'FreeCell opens FreeCell, Solitaire opens Solitaire');
});

test('the table keeps its keys after a square or a card has been clicked', () => {
    const keeper = /function keepKeys\(s, w\) \{([\s\S]*?)\n\}/.exec(app)?.[1] ?? '';
    assert.match(keeper, /s\.wm\.active === w/, 'only the window that is active takes them');
    assert.match(keeper, /w\.element\.focus\(\{ preventScroll: true \}\)/, 'the window itself takes the keyboard');
    const uses = app.match(/keepKeys\(s, w\);/g) ?? [];
    assert.equal(uses.length, 3, 'Minesweeper, Solitaire/FreeCell and Hearts all call it after drawing');
});

test('every guide is written in both languages, with the same shape', () => {
    for (const key of guides) {
        const en = helpTopic(key, 'en'), zh = helpTopic(key, 'zh');
        assert.ok(en && zh, `${key} has a topic`);
        assert.notEqual(zh, en, `${key} has its own Chinese text`);
        assert.match(zh.title, /[\u4e00-\u9fff]/, `${key} has a Chinese title`);
        assert.match(zh.body, /[\u4e00-\u9fff]/, `${key} has Chinese text`);
        assert.deepEqual(tags(zh.body), tags(en.body), `${key} keeps the same tags in the same order`);
        assert.deepEqual(kbd(zh.body), kbd(en.body), `${key} keeps every key the same`);
        assert.match(en.body, /<h1>/, `${key} has a heading`);
        assert.match(en.body, /<h2>/, `${key} is laid out in sections`);
        assert.ok(en.body.replace(/<[^>]+>/g, '').length > 400, `${key} says more than a line`);
    }
});

test('the Minesweeper guide matches the fields the game deals', () => {
    const en = helpTopic('minesweeper', 'en'), zh = helpTopic('minesweeper', 'zh');
    for (const [lang, body] of [['en', en.body], ['zh', zh.body]]) {
        for (const fact of ['8 × 8', '16 × 16', '16 × 30', '10', '40', '99'])
            assert.ok(body.includes(fact), `${lang} names ${fact}`);
        assert.match(body, /F2/, `${lang} names the new-game key`);
    }
    /* The engine lays the mines after the first click, keeping that square and
       its neighbours clear - the page promises the same. */
    assert.match(en.body, /first click of a field is always safe/, 'the English page promises a safe first click');
    assert.match(zh.body, /第一下一定安全/, 'and so does the Chinese page');
    const engine = app.includes('new Minesweeper(r, c, m)') && app.includes('reset(8, 8, 10)') && app.includes('reset(16, 16, 40)') && app.includes('reset(16, 30, 99)');
    assert.ok(engine, 'and the game deals the fields the page describes');
});

test('the Hearts guide matches the rules the engine plays', () => {
    const en = helpTopic('hearts', 'en'), zh = helpTopic('hearts', 'zh');
    for (const [lang, body] of [['en', en.body], ['zh', zh.body]]) {
        assert.match(body, /2|two of clubs|梅花 2|梅花 2/, `${lang} says who leads`);
        assert.match(body, /100/, `${lang} names the match target`);
        assert.match(body, /13/, `${lang} gives the queen of spades' points`);
    }
    assert.match(en.body, /queen of spades/, 'the English page names the queen of spades');
    assert.match(zh.body, /黑桃 Q/, 'the Chinese page names it too');
    assert.match(en.body, /shoot the moon/i, 'and the moon shot');
    assert.match(zh.body, /全收/, 'both ways of saying it');
    assert.match(en.body, /no-passing Hearts/i, 'the page says this table passes no cards, as the status bar does');
});

test('the FreeCell guide matches the deal and the move capacity', () => {
    const en = helpTopic('freecell', 'en'), zh = helpTopic('freecell', 'zh');
    for (const [lang, body] of [['en', en.body], ['zh', zh.body]]) {
        assert.match(body, /52/, `${lang} starts from the whole deck`);
        assert.match(body, /1,000,000/, `${lang} gives the range of deal numbers`);
        assert.match(body, /Ace|A 排到 K|从 A/, `${lang} builds from the ace`);
    }
    assert.match(en.body, /one card, plus one for each empty free cell, doubled for every empty column/, 'the page states the capacity rule');
    assert.match(zh.body, /每个空当一张，再按.*每空出一列翻一倍/, 'and so does the Chinese page');
    assert.match(en.body, /F3/, 'Select Game is named with its key');
});

test('the games sit together in the list Help shows', () => {
    const order = helpTopicsOrder();
    const games = ['minesweeper', 'hearts', 'freecell', 'solitaire', 'pinball'].map(key => order.indexOf(key));
    assert.ok(games.every(index => index >= 0), 'all five games have a topic');
    assert.deepEqual([...games].sort((a, b) => a - b), games, 'and they are listed one after another');
});
