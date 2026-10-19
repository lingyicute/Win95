import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { installDom } from './dom-shim.mjs';

/**
 * The Help viewer reads its topics out of a table in apps/utilities.js, in both languages.
 * A translation that loses a paragraph, a keyboard shortcut or a command example is exactly
 * what nobody notices, so the English topic is the specification here: the Chinese one has to
 * carry the same markup, in the same order, with the verbatim blocks untouched.
 */
installDom();
globalThis.devicePixelRatio = 1;
Object.defineProperty(globalThis, 'navigator', { value: { language: 'zh-CN', languages: ['zh-CN'] }, configurable: true });
document.documentElement = document.createElement('html');
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { }, key: () => null, length: 0 };
register('./win95-resolver.mjs', import.meta.url);
const { helpTopic, help } = await import('../src/packages/apps/utilities.js');

const TOPICS = ['welcome', 'files', 'windows', 'applications', 'notepad', 'wordpad', 'paint', 'calculator', 'pinball', 'settings', 'keyboard', 'dos', 'about'];
const tags = html => html.match(/<\/?[a-zA-Z]+[^>]*>/g) ?? [];

test('every help topic is written in Chinese too, with the same structure', () => {
    for (const key of TOPICS) {
        const en = helpTopic(key, 'en'), zh = helpTopic(key, 'zh');
        assert.notEqual(zh, en, `${key} has its own entry`);
        assert.match(zh.title, /[\u4e00-\u9fff]/, `${key} has a Chinese title`);
        assert.match(zh.body, /[\u4e00-\u9fff]/, `${key} has Chinese text`);
        assert.deepEqual(tags(zh.body), tags(en.body), `${key} keeps the same tags in the same order`);
        for (const block of ['<pre>', '<kbd>']) {
            const grab = t => (t.match(new RegExp(`${block}[\\s\\S]*?</${block.slice(1)}`, 'g')) ?? []).join('|');
            assert.equal(grab(zh.body), grab(en.body), `${key} leaves the ${block} content untranslated`);
        }
        for (const [tag] of [[/\bCtrl\+[A-Z]\b/g], [/\bAlt\+[A-Z]\b/g], [/\bF\d\b/g]])
            assert.deepEqual(zh.body.match(tag) ?? [], en.body.match(tag) ?? [], `${key} keeps every shortcut`);
        assert.equal(zh.body.replace(/<[^>]+>/g, '').trim().length > 40, true, `${key} is not a stub`);
    }
});

test('an unread language falls back to English instead of half a translation', () => {
    for (const key of TOPICS)
        assert.equal(helpTopic(key, 'de'), helpTopic(key, 'en'), `${key} falls back whole`);
});

test('the running desktop language picks the topic language', () => {
    assert.equal(helpTopic('welcome').title, '欢迎使用 Windows 95', 'a Chinese desktop gets Chinese help');
});

test('the help window lists, shows and searches topics in that language', async () => {
    const win = {
        title: '', body: document.createElement('div'), element: document.createElement('div'),
        closed: false, onClosed: [], setMenu() { }, setTitle() { }, close() { }, statusText: '',
        status(value) { this.statusText = value; }
    };
    const asked = [];
    const s = {
        wm: { create: () => win },
        ui: { prompt: async (...a) => { asked.push(a); return '回收站'; }, message: async (text) => { s.notFound = text; return 'OK'; } },
        settings: { get: () => undefined },
        about() { }
    };
    help(s, { topic: 'welcome' });
    const titles = win.body.querySelector('.help-topics').children.map(b => b.textContent);
    assert.deepEqual(titles.slice(0, 3), ['欢迎使用 Windows 95', '处理文件', '管理窗口'], 'the topic list is Chinese');
    assert.equal(win.body.querySelector('.help-page').innerHTML.startsWith('<h1>欢迎使用 Windows 95</h1>'), true, 'the opening topic is the Chinese body');
    assert.equal(win.statusText, '欢迎使用 Windows 95', 'the status bar shows the Chinese topic title');

    // '回收站' only ever appears in the Chinese text; the English page says Recycle Bin.
    const search = win.body.querySelectorAll('button').find(b => b.textContent === 'Search');
    search.dispatchEvent({ type: 'click' });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.ok(asked.some(a => a[0] === 'Search for:'), 'the Search button asks for a word');
    assert.equal(win.statusText, '处理文件', 'a Chinese word finds the Chinese topic that contains it');
    assert.equal(s.notFound, undefined, 'and the search is not silently empty');
});
