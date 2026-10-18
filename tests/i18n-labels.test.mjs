import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The Chinese UI translates rendered text through a dictionary and a list of
 * dynamic patterns. Two things went wrong here and are pinned now: a pattern
 * whose literal brackets were written as a capture group could never match, and
 * the File Properties labels were never in the dictionary at all, so a Chinese
 * desktop showed them in English.
 */
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { translateText } = await import('../src/packages/core/i18n.js');

const source = () => readFileSync(path.join(root, 'src/packages/core/i18n.js'), 'utf8');

test('the File Properties labels are translated', () => {
    const pairs = [['Type:', '类型：'], ['Location:', '位置：'], ['Size:', '大小：'], ['Contains:', '包含：'], ['Created:', '创建时间：'], ['Modified:', '修改时间：']];
    for (const [english, chinese] of pairs)
        assert.equal(translateText(english, 'zh'), chinese, `${english} is a label the Properties sheet prints`);
});

test('a colour name keeps its brackets and translates', () => {
    assert.equal(translateText('Color (#ff0000)', 'zh'), '颜色 #ff0000');
});

test('the language pages translate', () => {
    assert.equal(translateText('Language:', 'zh'), '语言：');
    assert.equal(translateText('Display language:', 'zh'), '显示语言：');
});

test('a mine cell counts its neighbours in Chinese, singular and plural', () => {
    assert.equal(translateText('Row 3 column 5, 2 adjacent mines', 'zh'), '第 3 行第 5 列，邻近 2 颗雷');
    assert.equal(translateText('Row 1 column 2, 1 adjacent mine', 'zh'), '第 1 行第 2 列，邻近 1 颗雷');
    assert.equal(translateText('Row 1 column 1, covered', 'zh'), '第 1 行第 1 列，未翻开');
    assert.equal(translateText('Row 2 column 2, flagged', 'zh'), '第 2 行第 2 列，已插旗');
});

test('the colour pattern still matches what Paint prints', () => {
    // The regression this guards: the swatch label is built as 'Color ' + hex.
    const css = readFileSync(path.join(root, 'src/packages/apps/paint.js'), 'utf8');
    assert.match(css, /'aria-label': 'Color ' \+ color/, 'Paint still prints the colour this way');
    assert.equal(translateText('Color (#000080)', 'zh'), '颜色 #000080', 'and the pattern still answers it');
});
