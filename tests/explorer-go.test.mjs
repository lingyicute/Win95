import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const explorerSrc = await readFile(path.join(root, 'src/packages/apps/explorer.js'), 'utf8');
const i18nSrc = await readFile(path.join(root, 'src/packages/core/i18n.js'), 'utf8');

test('the explorer menu bar carries a Go menu between View and Help', () => {
    const view = explorerSrc.indexOf("{ label: 'View'");
    const go = explorerSrc.indexOf("{ label: 'Go'");
    const help = explorerSrc.indexOf("{ label: 'Help'");
    assert.ok(view !== -1 && go !== -1 && help !== -1, 'all three menus exist');
    assert.ok(view < go && go < help, 'Go sits between View and Help');
    const goMenu = explorerSrc.slice(go, help);
    for (const item of ['Back', 'Forward', 'Up One Level'])
        assert.match(goMenu, new RegExp(`label: '${item}'`), `${item} lives in the Go menu`);
    assert.match(goMenu, /disabled: hIndex <= 0/, 'Back waits for history');
    assert.match(goMenu, /disabled: hIndex >= hist\.length - 1/, 'Forward waits for a rewritten future');
});

test('the explorer remembers where it has been', () => {
    assert.match(explorerSrc, /hist = \[path\], hIndex = 0/, 'history starts at the opening folder');
    assert.match(explorerSrc, /hist = hist\.slice\(0, hIndex \+ 1\)/, 'a new turn drops the rewritten future');
    assert.match(explorerSrc, /const go = delta =>/, 'Back and Forward share one walker');
    assert.match(explorerSrc, /const upOneLevel = \(\) => navigate\(/, 'the menu and the toolbar button climb the same way');
});

test('the Chinese wording follows the current choice', () => {
    assert.match(i18nSrc, /'Registered to:': '授权给：'/, 'the registration line reads 授权给');
    assert.doesNotMatch(i18nSrc, /注册给/, 'no 注册给 remains');
    assert.match(i18nSrc, /'Go': '转到'/, 'the Go menu is 转到');
    assert.match(i18nSrc, /'Up One Level': '向上一级'/, 'Up One Level keeps its wording');
});
