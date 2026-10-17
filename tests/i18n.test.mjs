import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectLanguage, translateText } from '../src/packages/core/i18n.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The ZH table as an object, taken from the module source. It is a plain object
 * literal, so the literal is sliced out by brace matching and evaluated — the
 * alternative is a regex over 300 lines of quoted text, which reads more keys
 * than it should.
 */
async function dictionary() {
    const source = await readFile(path.join(root, 'src/packages/core/i18n.js'), 'utf8');
    const marker = 'const ZH = ';
    const start = source.indexOf(marker) + marker.length;
    let depth = 0, end = -1;
    for (let i = start; i < source.length; i++) {
        if (source[i] === '{')
            depth++;
        else if (source[i] === '}')
            if (!--depth) { end = i + 1; break; }
    }
    assert.ok(end > 0, 'the ZH dictionary literal was found');
    return new Function('return ' + source.slice(start, end))();
}

/** Every string the shell can render, quotes and escapes removed. */
async function renderedText() {
    const files = [];
    const walk = async directory => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const full = path.join(directory, entry.name);
            if (entry.isDirectory())
                await walk(full);
            else if (/\.(?:js|html)$/.test(entry.name) && entry.name !== 'i18n.js')
                files.push(full);
        }
    };
    await walk(path.join(root, 'src'));
    const text = [];
    for (const file of files)
        text.push(await readFile(file, 'utf8'));
    /* An apostrophe written \' in the source is the same text on screen. */
    return text.join('\n').replace(/\\(['"`\\])/g, '$1');
}

test('startup language follows the browser language', () => {
    assert.equal(detectLanguage('zh-CN'), 'zh');
    assert.equal(detectLanguage('zh-TW'), 'zh');
    assert.equal(detectLanguage('zh'), 'zh');
    assert.equal(detectLanguage('en-US'), 'en');
    assert.equal(detectLanguage('ja-JP'), 'en');
    assert.equal(detectLanguage(''), 'en');
    assert.equal(detectLanguage(undefined), 'en');
});

test('Chinese UI strings come from the dictionary, English is untouched', () => {
    assert.equal(translateText('Start', 'zh'), '开始');
    assert.equal(translateText('Accessories', 'zh'), '附件');
    assert.equal(translateText('Games', 'zh'), '游戏');
    assert.equal(translateText('Communications', 'zh'), '通讯');
    assert.equal(translateText('System Tools', 'zh'), '系统工具');
    assert.equal(translateText('Change Password', 'zh'), '更改密码');
    assert.equal(translateText('Click this button to change your Windows password.', 'zh'), '单击此按钮更改 Windows 密码。');
    assert.equal(translateText('Type a name to identify yourself to Windows. Enter a password if you want to.', 'zh'), '输入您的名称以标识 Windows 用户。如有密码，请输入密码。');
    assert.equal(translateText("Tip: If you don't enter a password, you won't get this prompt again at startup.", 'zh'), '提示：如果用户没有密码，下次启动时将不再显示此质询。');
    assert.equal(translateText('Old password:', 'zh'), '旧密码：');
    assert.equal(translateText('My Computer', 'zh'), '我的电脑');
    assert.equal(translateText('Show this next time', 'zh'), '下次显示此窗口');
    assert.equal(translateText('Start', 'en'), 'Start');
    assert.equal(translateText('  Files  ', 'zh'), '  文件  ');
    assert.equal(translateText('Some Untranslated String', 'zh'), 'Some Untranslated String');
});

test('dynamic UI strings are translated by pattern', () => {
    assert.equal(translateText('3 object(s)', 'zh'), '3 个对象');
    assert.equal(translateText('12.5 bytes', 'zh'), '12.5 字节');
    assert.equal(translateText("Cannot find 'solitaire'. Make sure the name is correct and try again.", 'zh'), '找不到“solitaire”。请确认名称正确后重试。');
    assert.equal(translateText('Are you sure you want to send to the Recycle Bin these 4 items?', 'zh'), '确实要将这 4 个项目发送到回收站吗？');
    assert.equal(translateText('About Notepad', 'zh'), '关于记事本');
    assert.equal(translateText('Beginner: 42 seconds\nExpert: — seconds', 'zh'), '初级：42 秒\n高级：— 秒');
    assert.equal(translateText('45 minutes (custom)', 'zh'), '45 分钟（自定义）');
    assert.equal(translateText('This is the same wait time as the Screen Saver tab in Display Properties; host sleep stays under your computer’s control.', 'zh'), '这与“显示属性”中的“屏幕保护程序”选项卡使用相同的等待时间；主机的睡眠仍由您的计算机控制。');
});

/**
 * Keys no source file spells out as one string, so the check below cannot find
 * them: 'Folder Options' and 'Folder-options' are a settings applet id with its
 * first letter capitalised (control-panel.js), the print dialog line is a single
 * table entry for text rendered as separate nodes, and the four media transport
 * words are entries for a pause control the player does not have yet.
 */
const UNRUNLIT_KEYS = [
    'Folder Options', 'Folder-options',
    'Paper: A4 Margins: 20 mm  Choose a printer and adjust paper options in the print dialog.',
    'Playing', 'Paused', 'Pause', 'Stopped'
];

test('every translation key matches text the shell actually renders', async () => {
    const zh = await dictionary();
    const keys = Object.keys(zh);
    assert.ok(keys.length > 500, `the dictionary is read in full, saw ${keys.length} keys`);
    const rendered = await renderedText();
    /* A key whose English text is nowhere in the source can never be looked up:
       translateText returns the DOM text unchanged when the table misses, which
       is how editing a key but not the string it names leaves the old copy on
       screen. Matching is a substring test and so forgiving by design — a key
       that only appears inside a longer concatenated line still counts. */
    const orphans = keys.filter(key => key && !rendered.includes(key) && !UNRUNLIT_KEYS.includes(key));
    assert.deepEqual(orphans, [], 'unreferenced ZH keys: ' + JSON.stringify(orphans));
});

test('System Properties names each hardware line in both languages', async () => {
    for (const [en, zh] of [['Hardware architecture:', '硬件架构：'], ['Browser', '浏览器'], ['Processors:', '处理器：'], ['8 logical cores', '8 个逻辑核心'], ['Display adapter:', '显示适配器：'], ['Disk:', '磁盘：']])
        assert.equal(translateText(en, 'zh'), zh, en);
    const source = await readFile(path.join(root, 'src/packages/apps/control-panel.js'), 'utf8');
    for (const label of ["'Hardware architecture:'", "'Processors:'", "'Display adapter:'", "'Disk:'"])
        assert.ok(source.includes(label), `${label} is the label the dictionary translates`);
    assert.doesNotMatch(source, /logical processors|'File storage:'|'System:'|'Computer:'|'Graphics:'/, 'the old labels are gone, so no dictionary entry is left behind');
});
