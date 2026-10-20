import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relative => readFile(path.join(root, relative), 'utf8');

/** The registration block for one app, from its register() call to the next. */
async function appBlock(id) {
    const main = await source('src/main.js');
    const start = main.indexOf(`register('${id}'`);
    assert.ok(start > 0, `${id} is registered`);
    const next = main.indexOf('\nregister(', start + 1);
    return main.slice(start, next > 0 ? next : main.length);
}

/** Width and height from a JPEG's start-of-frame marker. */
function jpegSize(buffer) {
    assert.equal(buffer[0], 0xff, 'JPEG magic');
    assert.equal(buffer[1], 0xd8, 'JPEG start');
    let i = 2;
    while (i < buffer.length - 9) {
        if (buffer[i] !== 0xff) { i++; continue; }
        const marker = buffer[i + 1];
        if (marker >= 0xc0 && marker <= 0xc3)
            return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
        i += 2 + buffer.readUInt16BE(i + 2);
    }
    assert.fail('no start-of-frame marker');
}

test('Taskbar Properties is a two-page property sheet', async () => {
    const app = await appBlock('taskbar-properties');
    assert.match(app, /propertySheet\(s, 'Taskbar Properties', 'windows', \[/, 'built with the shared property sheet');
    assert.match(app, /\['Taskbar Options', p => \{/, 'first tab is Taskbar Options');
    assert.match(app, /\['Start Menu Programs', p => \{/, 'second tab is Start Menu Programs');
    for (const label of ['Always on top', 'Auto hide', 'Show small icons in Start menu', 'Show clock'])
        assert.ok(app.includes(`check('${label}'`), `${label} is a checkbox on the first tab`);
    assert.match(app, /dirtyApply: true/, 'Apply starts greyed until a setting changes');
});

test('the Taskbar Options tab shows the illustration as it was supplied', async () => {
    const app = await appBlock('taskbar-properties');
    assert.match(app, /src: '\.\/assets\/taskbar-preview\.jpg'/, 'the sheet uses the shipped image');
    assert.match(app, /width: 271, height: 129/, 'the image keeps its natural size');
    const size = jpegSize(await readFile(path.join(root, 'src/assets/taskbar-preview.jpg')));
    assert.deepEqual(size, { width: 271, height: 129 }, 'the asset is the 271x129 original');
});

test('Start Menu Programs holds the Documents menu and its Clear button', async () => {
    const app = await appBlock('taskbar-properties');
    assert.match(app, /el\('legend', \{ text: 'Documents menu' \}\)/, 'the group box is titled Documents menu');
    assert.match(app, /icon\('recycle', 32\)/, 'the Recycle Bin is drawn beside the text');
    assert.match(app, /Click the Clear button to remove the contents of the Documents menu and other personal history lists\./);
    assert.match(app, /button\('Clear', \(\) => s\.settings\.set\('recentDocuments', \[\]\)\)/, 'Clear empties the recent documents list');
    assert.match(app, /class: 'documents-actions'/, 'the button sits at the lower right of the group');
});

test('OK and Apply write the four taskbar settings; Cancel writes nothing', async () => {
    const app = await appBlock('taskbar-properties');
    for (const key of ['taskbarOnTop', 'taskbarAutoHide', 'showSmallIcons', 'showClock'])
        assert.match(app, new RegExp(`s\\.settings\\.set\\('${key}'`), `${key} is committed`);
    assert.match(app, /applyTaskbarSettings\(s\.settings\)/, 'the shell is told about the new settings');
    assert.match(app, /w\.apply = \(\) => \{/, 'the sheet exposes apply() for OK and Apply');
    assert.doesNotMatch(app, /onchange: e => \{ s\.settings\.set/, 'a checkbox alone must not write a setting');
});

test('Apply is only enabled for the sheets that ask for a dirty state', async () => {
    const [panel, main] = await Promise.all([source('src/packages/apps/control-panel.js'), source('src/main.js')]);
    assert.match(panel, /export function propertySheet\(s, title, ic, tabs, width = 420, height = 420, options = \{\}\)/);
    assert.match(panel, /if \(options\.dirtyApply\) \{\s*apply\.disabled = true;\s*w\.markDirty = \(\) => \{ apply\.disabled = false; \};/, 'markDirty lights the button');
    assert.match(panel, /const apply = button\('Apply', async \(\) => \{ await w\.apply\?\.\(\); clean\(\); \}\)/, 'Apply clears the highlight after it runs');
    assert.equal((main.match(/dirtyApply: true/g) || []).length, 1, 'only Taskbar Properties opts in');
});

test('Show small icons produces the small 16px start menu', async () => {
    const [main, css] = await Promise.all([source('src/main.js'), source('src/styles.css')]);
    assert.match(main, /const small = s\.settings\.get\('showSmallIcons', false\);/, 'the menu reads the setting');
    assert.match(main, /large: !small/, 'small mode drops the 32px icons');
    assert.match(main, /brand: !small/, 'small mode drops the Windows 95 banner');
    assert.match(main, /class: 'start-menu' \+ \(small \? ' small-icons' : ''\)/, 'small mode is a modifier class');
    assert.match(css, /\.start-menu\.small-icons\{width:auto;min-width:0;padding:2px\}/, 'the popup shrinks to its content');
    assert.match(css, /\.start-menu\.small-icons \.menu-item\{min-height:22px;padding:2px 8px 2px 2px!important;gap:6px\}/, 'rows are one icon tall');
    assert.match(css, /\.start-menu\{width:206px\}/, 'the large menu keeps its width');
    assert.match(css, /\.start-menu \.menu-item\{min-height:37px/, 'the large menu keeps its rows');
});

test('Auto hide takes the bar out of the layout and Always on top keeps it above windows', async () => {
    const [settings, manager, menu, css] = await Promise.all([
        source('src/packages/shell/taskbar-settings.js'),
        source('src/packages/shell/window-manager.js'),
        source('src/packages/ui/menu.js'),
        source('src/styles.css'),
    ]);
    assert.match(settings, /export const taskbarHeight = \(\) => hasDocument && document\.body\.classList\.contains\('auto-hide'\) \? 0 : TASKBAR_HEIGHT;/);
    assert.match(settings, /classes\.toggle\('auto-hide'/, 'the body carries the auto hide state');
    assert.match(settings, /classes\.toggle\('taskbar-on-top'/, 'the body carries the always on top state');
    assert.doesNotMatch(manager, /innerHeight - 30\b/, 'the window manager no longer hard-codes the bar height');
    assert.ok((manager.match(/taskbarHeight\(\)/g) || []).length >= 8, 'every desktop edge follows the setting');
    assert.match(menu, /innerHeight - taskbarHeight\(\) - rect\.height/, 'menus stay above the bar');
    assert.match(css, /body\.auto-hide #desktop\{inset:0\}/, 'the desktop grows while the bar is hidden');
    assert.match(css, /body\.auto-hide #taskbar\{transform:translateY\(calc\(100% - 3px\)\)\}/, 'a 3px edge remains on screen');
    assert.match(css, /body\.auto-hide #taskbar:hover,body\.auto-hide #taskbar:focus-within,body\.auto-hide #taskbar:has\(#start-button\[aria-expanded=true\]\)\{transform:none\}/, 'hover, focus and the open Start menu bring it back');
    assert.match(css, /body:not\(\.taskbar-on-top\) #taskbar\{z-index:5\}/, 'Always on top is what keeps the bar over windows');
});

test('the new taskbar strings are translated', async () => {
    const i18n = await source('src/packages/core/i18n.js');
    for (const [key, value] of [
        ['Taskbar Options', '任务栏选项'],
        ['Start Menu Programs', '开始菜单程序'],
        ['Auto hide', '自动隐藏'],
        ['Show small icons in Start menu', '在“开始菜单”中显示小图标'],
        ['Documents menu', '文档菜单'],
        ['Clear', '清除'],
    ])
        assert.ok(i18n.includes(`'${key}': '${value}'`), `${key} is in the dictionary`);
    assert.ok(i18n.includes("单击“清除”按钮可以删除“文档”菜单中的内容和其他个人历史记录列表。"), 'the paragraph is translated');
});
