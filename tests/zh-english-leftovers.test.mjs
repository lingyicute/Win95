import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * English that survived a Chinese desktop. Every string pinned here was seen on
 * screen while the UI language was Chinese: the player's state in a window
 * title, the captions on the Display settings tab, the two Device Manager rows
 * that concatenate a caption with a browser-provided value, the sample message
 * in the Inbox, and dates printed through the host default locale instead of
 * the display language's.
 */
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { translateText } = await import('../src/packages/core/i18n.js');
const source = file => readFileSync(path.join(root, file), 'utf8');

test('the player names its state in the UI language', () => {
    assert.equal(translateText('Windows Chimes (paused)', 'zh'), 'Windows 钟声（已暂停）');
    assert.equal(translateText('Windows Chimes (playing)', 'zh'), 'Windows 钟声（正在播放）');
    /* The CD player prefixes the track number, and that pattern recurses into
       this one, so the state is translated inside the longer title too. */
    assert.equal(translateText('Track 01 — Windows Chimes (paused)', 'zh'), '曲目 01 — Windows 钟声（已暂停）');
});

test('a caption printed with a host value keeps the value and translates the caption', () => {
    assert.equal(translateText('Current renderer: WebGL2', 'zh'), '当前渲染器：WebGL2');
    assert.equal(translateText('1024 by 768 pixels', 'zh'), '1024 × 768 像素');
    assert.equal(translateText('Scale: 1× device pixels', 'zh'), '缩放：1× 设备像素');
    assert.equal(translateText('Display adapter — WebGL2', 'zh'), '显示适配器 — WebGL2');
    assert.equal(translateText('Virtual C: drive — IndexedDB', 'zh'), '虚拟 C: 盘 — IndexedDB');
    /* The value is whatever the browser reports; another one still comes back. */
    assert.equal(translateText('Current renderer: Canvas 2D', 'zh'), '当前渲染器：Canvas 2D');
    assert.equal(translateText('Display adapter — Software', 'zh'), '显示适配器 — Software');
});

test('dates are formatted for the display language, never the host default', () => {
    for (const file of ['src/packages/apps/explorer.js', 'src/packages/apps/documents.js', 'src/packages/apps/control-panel.js']) {
        const text = source(file);
        assert.doesNotMatch(text, /toLocale\w*\(\s*\)/, `${file} still lets the host pick the date format`);
        assert.match(text, /import \{[^}]*uiLocale[^}]*\} from '@win95\/core\/i18n\.js'/, `${file} reads the UI locale`);
    }
    /* The calendar month names and the weekday head are locale data as well:
       an English October over a Sunday-first grid reads as English chrome. */
    const panel = source('src/packages/apps/control-panel.js');
    assert.match(panel, /toLocaleString\(uiLocale, \{ month: 'long' \}\)/);
    assert.match(panel, /toLocaleDateString\(uiLocale, \{ weekday: 'narrow' \}\)/);
    assert.doesNotMatch(panel, /\['S', 'M', 'T', 'W', 'T', 'F', 'S'\]/);
});

test('the Volume Control window is tall enough for the four channel columns', () => {
    /* 278 clipped the Mute rows by 10 pixels: the columns measure 241 and the
       body was 231. The window is not resizable, so the browser never grows it. */
    assert.match(source('src/packages/apps/multimedia.js'), /title: 'Volume Control', icon: 'volume', width: 395, height: 292, resizable: false/);
});

test('the Inbox translates its preview labels and writes the sample in the UI language', () => {
    const mail = source('src/packages/apps/multimedia.js');
    assert.match(mail, /import \{[^}]*uiLang[^}]*\} from '@win95\/core\/i18n\.js'/);
    assert.match(mail, /const mailLabel = text => t\(text\) \+ \(uiLang === 'zh' \? '' : ' '\)/, 'the label is translated where it is built');
    assert.match(mail, /text: mailLabel\('From:'\)/, 'the preview is outside the walker, so it asks for the translation itself');
    assert.match(mail, /text: mailLabel\('Subject:'\)/);
    assert.match(mail, /欢迎使用收件箱/, 'the unread sample message is written in Chinese');
    /* Message bodies stay out of the walker: a body that happens to be one
       dictionary word must not be renamed in the reader's mailbox. */
    assert.match(source('src/packages/core/i18n.js'), /'\.mail-preview'/);
});
