import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translateText } from '../src/packages/core/i18n.js';
import { ICON_DATA } from '../src/packages/ui/icon-data.js';

/**
 * 3D Pinball for Windows - Space Cadet lives in `src/programs/pinball` with its
 * licence, and the desktop opens it in a window of its own. These checks hold
 * the pieces in place: the table's files and MIT licence are there and whole,
 * the window is exactly as large as the table plus its frame, the page keeps the
 * game's own bar hidden and offers the small handshake the desktop uses, and the
 * menus the desktop draws choose the same entries the game's own menus do.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');
const game = 'src/programs/pinball';

const [app, page, css, main, icons, readme, licence] = await Promise.all([
    read('src/packages/games/pinball.js'),
    read(`${game}/space-cadet.html`),
    read('src/styles.css'),
    read('src/main.js'),
    read('src/packages/ui/icons.js'),
    read(`${game}/README.md`),
    read(`${game}/LICENSE`)
]);

const rule = selector => {
    const found = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(match => match[1].trim() === selector);
    return found?.[2] ?? '';
};

test('the table and its licence are carried in a folder of their own', async () => {
    for (const file of ['SpaceCadetPinball.js', 'SpaceCadetPinball.wasm', 'SpaceCadetPinball.data', 'space-cadet.html', 'pinball-overlay.png', 'pinball-splash.png', 'LICENSE', 'README.md']) {
        const info = await stat(path.join(root, game, file));
        assert.ok(info.size > 0, `${file} is there and not empty`);
    }
    assert.match(licence, /^MIT License/, 'the licence is the MIT licence the game is published under');
    assert.match(licence, /Copyright \(c\) 2020-2021 Andrey Muzychenko/, 'and it names its holder');
    assert.match(licence, /The above copyright notice and this permission notice shall be included in all/, 'the notice is intact, as MIT requires');
    const wasm = await stat(path.join(root, game, 'SpaceCadetPinball.wasm'));
    assert.ok(wasm.size > 1000000, 'the table itself is the compiled game, not a placeholder');
    assert.match(readme, /MIT licence in \[LICENSE\]\(\.\/LICENSE\)/, 'the folder says where the licence is');
});

test('the game is in the Games menu and opens with the pinball icon', () => {
    assert.match(main, /import \{ pinball \} from '\.\/packages\/games\/pinball\.js';/);
    assert.match(main, /register\('pinball', '3D Pinball', 'pinball', pinball, 'game'\);/, 'it is registered as a game, so Start > Games lists it');
    assert.match(main, /pinball: 'pinball', '3dpinball': 'pinball', 'spacecadet': 'pinball'/, 'and the Run dialog knows the names it went by');
    assert.match(icons, /freecell: 'freecell', pinball: 'pinball'/);
    assert.ok(ICON_DATA['pinball-16'] && ICON_DATA['pinball-32'], 'the two icon sizes are inlined with the rest');
});

test('the window is the table plus its title bar, menu bar and frame', () => {
    const frame = rule('.window');
    const padding = /padding:(\d+(?:\.\d+)?)px (\d+(?:\.\d+)?)px (\d+(?:\.\d+)?)px (\d+(?:\.\d+)?)px/.exec(frame);
    assert.ok(padding, 'the frame spells out its padding');
    const [, top, right, bottom, left] = padding.map(Number);
    const title = Number(/\.title-bar\{[^}]*height:(\d+)px/.exec(css)?.[1] ?? 0);
    const menu = Number(/\.menu-bar\{[^}]*height:(\d+)px/.exec(css)?.[1] ?? 0);
    assert.equal(title, 19);
    assert.equal(menu, 22);
    assert.match(app, /width: TABLE_WIDTH \+ 6\.5,/, 'the width is the table plus the left and right padding');
    assert.equal(600 + left + right, 606.5);
    assert.match(app, /height: TABLE_HEIGHT \+ 47,/, 'the height is the table plus the bars and the padding');
    assert.equal(416 + title + menu + top + bottom, 463);
    assert.match(app, /resizable: false/, 'the table cannot be stretched away from its own size');
    assert.match(rule('.pinball-frame'), /width:600px;height:416px/, 'the page that draws the table fills the body exactly');
    assert.match(rule('.pinball-body'), /padding:0/, 'no grey band is left around the table');
});

test('the page hides the game\'s own menu bar behind a strip of its title picture', () => {
    assert.match(page, /<canvas id="canvas" width="600" height="440" tabindex="0"/, 'the game draws into its own canvas');
    assert.match(page, /top: -12px/, 'the picture sits 12 pixels up, under the bar the game draws for itself');
    assert.match(page, /#cover \{[^}]*width: 600px;[^}]*height: 9px;[^}]*background: url\(pinball-overlay\.png\) no-repeat 0 0/, 'the strip is the top of the title picture');
    assert.match(page, /#freeze \{[^}]*width: 600px;[^}]*height: 416px/, 'a still frame can cover the picture while a menu is open');
    assert.match(page, /aria-label="Space Cadet pinball table"/, 'the table has a name, as the desktop requires of its windows');
});

test('the page and the desktop share one small handshake', () => {
    for (const name of ['chooseMenu', 'press', 'freeze', 'thaw', 'setMuted', 'focus'])
        assert.match(page, new RegExp(name + ':'), `the page offers ${name}`);
    assert.match(page, /MENU_BAR_Y = 15, MENU_FIRST_ROW_Y = 35, MENU_ROW = 16, CLICK_GAP = 100/, 'the strip and the menus agree on where the game lays them out, and how fast it reads clicks');
    assert.match(page, /menuColumn = function \(index\) \{ return 30 \+ index \* 50; \}/);
    assert.match(app, /game\.chooseMenu\(top, item, sub\)/, 'the desktop asks the page to choose, rather than clicking blind');
    assert.match(app, /game\.freeze\(\) : game\.thaw\(\)/, 'a menu of the desktop freezes the picture until it closes');
    assert.match(page, /parent\.postMessage\(\{ type: 'pinball-shell-key', key: 'Control\+Escape' \}/, 'the page hands Ctrl+Esc back to the desktop');
    assert.match(app, /pinball-shell-key' && event\.data\.key === 'Control\+Escape'/, 'and the desktop answers it');
    assert.match(page, /contextmenu', function \(event\) \{ event\.preventDefault\(\); \}/, 'a right click on the glass opens nothing');
});

test('the desktop\'s menus name the entries the game\'s own menus have', () => {
    assert.match(app, /label: 'New Game', shortcut: 'F2', action: \(\) => press\('F2'\)/);
    assert.match(app, /label: 'Launch Ball', action: \(\) => choose\(0, 1\)/, 'the second entry of the game\'s Game menu');
    assert.match(app, /label: 'Pause\/Resume Game', shortcut: 'F3'/);
    assert.match(app, /label: 'High Scores…', disabled: true/, 'the browser build cannot show its high-score list');
    assert.match(app, /label: 'Demo', action: \(\) => choose\(0, 4\)/);
    assert.match(app, /choose\(1, 0, count - 1\)/, 'Select Players reaches the game\'s own submenu');
    assert.match(app, /label: 'Sound', shortcut: 'F5', checked: state\.sound, action: \(\) => \{ state\.sound = !state\.sound; press\('F5'\); \}/);
    assert.match(app, /label: 'Music', shortcut: 'F6', checked: state\.music, action: \(\) => \{ state\.music = !state\.music; press\('F6'\); \}/);
    assert.match(app, /label: 'Audio', checked: state\.audio, action: setAudio/, 'Audio is the desktop\'s own gain control');
    assert.match(app, /label: 'About Pinball', action: about/);
    assert.match(app, /Left flipper: Z\\nRight flipper: \/\\nPlunger: Space/, 'the About box tells the player the table\'s keys');
});

test('the new labels speak Chinese like the rest of the shell', () => {
    for (const [en, zh] of [
        ['3D Pinball', '三维弹球'],
        ['3D Pinball for Windows - Space Cadet', '三维弹球：太空军校生'],
        ['Launch Ball', '发射球'],
        ['Pause/Resume Game', '暂停/继续游戏'],
        ['High Scores…', '最高分数…'],
        ['Select Players', '选择玩家'],
        ['Sound', '声音'],
        ['About Pinball', '关于三维弹球'],
        ['The table could not be loaded.', '无法载入球台。']
    ])
        assert.equal(translateText(en, 'zh'), zh, en);
});
