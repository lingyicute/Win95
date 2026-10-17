import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguage, translateText } from '../src/packages/core/i18n.js';

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
