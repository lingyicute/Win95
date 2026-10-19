import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translateText } from '../src/packages/core/i18n.js';

/**
 * Paint's tools have a place to say how they should behave: one box under the
 * tool grid, blank until the chosen tool has something to offer. It used to be
 * a permanent column of five narrow buttons marked with dashes, which said
 * nothing about the thickness it picked and did not look like Paint at all.
 *
 * These checks hold the box to Paint's own arrangement: a single 66px well that
 * a tool fills with its own options, five line sizes drawn as lines of their
 * own thickness, and the three shape styles - outline, outline and fill, fill.
 * They also recompute the height from the stylesheet, so growing a line sample
 * without growing the box fails here rather than clipping the last size.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const [app, css] = await Promise.all([
    readFile(path.join(root, 'src/packages/apps/paint.js'), 'utf8'),
    readFile(path.join(root, 'src/styles.css'), 'utf8')
]);

const rule = selector => {
    const pattern = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}');
    return pattern.exec(css)?.[1] ?? '';
};
const px = (value, name) => {
    const found = new RegExp('(?:^|;|\\{)' + name + ':\\s*(\\d+(?:\\.\\d+)?)px').exec(';' + value)?.[1];
    assert.ok(found !== undefined, `${name} is spelled out in pixels in ${value.slice(0, 60)}…`);
    return Number(found);
};

test('the options sit in one box under the tools, and a tool with none leaves it blank', () => {
    assert.match(app, /const options = el\('div', \{ class: 'paint-tool-options'/);
    assert.match(app, /tools\.append\(toolGrid, options\)/, 'the box follows the grid, inside the same column');
    assert.match(app, /options\.replaceChildren\(\)/, 'the box is emptied before the chosen tool refills it');
    assert.match(app, /function refreshOptions\(\)/, 'one place decides what the box shows');
    assert.match(app, /refreshOptions\(\);/, 'choosing a tool asks for its options');
    assert.match(app, /const kind = tool === 'line' \|\| tool === 'curve' \? 'stroke'/, 'line tools get the line sizes');
    assert.match(app, /\['rectangle', 'polygon', 'ellipse', 'roundrect'\]\.includes\(tool\) \? 'shapes' : ''/, 'shape tools get the shape styles');
    assert.doesNotMatch(app, /━|▣/, 'the dash and the filled-square button are gone');
    assert.doesNotMatch(app, /'1', '3', '5', '8'/, 'the line sizes are no longer an arbitrary four');
});

test('the five line sizes are 1 to 5 pixels and are drawn at that thickness', () => {
    assert.match(app, /const STROKE_SIZES = \[1, 2, 3, 4, 5\];/);
    assert.match(app, /class: 'paint-stroke-sample', style: \{ height: size \+ 'px' \}/, 'each sample is its own height');
    assert.match(app, /lineWidth === size, `Line size \$\{size\}px`/, 'the chosen size is the pressed one');
    assert.match(app, /b\.onclick = \(\) => \{ lineWidth = size; refreshOptions\(\); \};/);
    assert.match(css, /\.paint-stroke-sample\{display:block;width:34px;background:#000\}/);
    assert.match(css, /\.paint-option\.selected \.paint-stroke-sample\{background:#fff\}/, 'the chosen line turns white on the blue band');
});

test('the box is exactly tall enough for five 12px samples and its padding', () => {
    const box = rule('.paint-tool-options');
    const height = px(box, 'height');
    const padding = px(box, 'padding');
    const option = px(rule('.paint-option'), 'height');
    assert.equal(height, 66, 'Paint\'s options well is 66px tall');
    assert.equal(padding, 3);
    assert.equal(option, 12, 'a sample row is 12px, like the original');
    assert.equal(padding * 2 + option * 5, height, 'five rows plus the well\'s padding are the whole height');
    assert.match(box, /box-sizing:border-box/, 'the height is the outer height');
    assert.match(box, /box-shadow:var\(--sunken\)/, 'the well is recessed like the textbook says');
});

test('the toolbar column is a flex stack so the well cannot spill over the palette', () => {
    assert.match(rule('.paint-tools'), /display:flex;flex-direction:column/, 'tools and their box are stacked, not grid rows');
    assert.match(rule('.paint-tools'), /width:58px;min-width:58px;padding:3px/, 'the column keeps its width');
    assert.match(rule('.paint-tool-grid'), /display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:25px/, 'the sixteen buttons keep their 2 × 8 grid');
    const column = px(rule('.paint-tools'), 'width') - px(rule('.paint-tools'), 'padding') * 2;
    const well = px(rule('.paint-tool-options'), 'height');
    assert.equal(column, 52, 'the well is as wide as the two tool columns together');
    assert.ok(well > 0);
});

test('shape tools offer outline, outline and fill, and fill - and drawing obeys them', () => {
    assert.match(app, /\{ id: 'outline', label: 'Outline', stroke: true, fill: false \}/);
    assert.match(app, /\{ id: 'both', label: 'Outline and fill', stroke: true, fill: true \}/);
    assert.match(app, /\{ id: 'fill', label: 'Fill', stroke: false, fill: true \}/);
    assert.match(app, /const style = shapeStyleChoice\(\), plain = \['line', 'curve', 'select', 'freeSelect'\]\.includes\(tool\);/, 'a line is always stroked even if the shape style says fill');
    assert.match(app, /if \(style\.fill && !plain\)\s*ctx\.fill\(\);/, 'filled styles fill the shape');
    assert.match(app, /if \(style\.stroke \|\| plain\)\s*ctx\.stroke\(\);/, 'outlined styles draw the border');
    assert.match(app, /ctx\.fillStyle = style\.id === 'both' \? background : foreground;/, 'outline and fill uses the background colour inside');
    assert.match(app, /const style = shapeStyleChoice\(\);\s*if \(style\.fill\) \{/, 'the polygon closes filled the same way');
});

test('the chosen option wears the dark blue band, as Paint marks tool options', () => {
    assert.match(css, /\.paint-option\{[^}]*border:0!important[^}]*background:transparent!important[^}]*box-shadow:none!important/, 'options are flat, not raised buttons');
    assert.match(css, /\.paint-option\.selected\{background:#000080!important\}/);
    assert.match(css, /\.paint-shape-sample\{display:block;width:29px;height:9px;border:1px solid;box-sizing:border-box\}/);
    assert.match(css, /\.paint-option\.selected \.paint-shape-sample\{filter:invert\(1\)\}/, 'the sample inverts on the blue band');
});

test('the status line names the tool in Chinese too', () => {
    assert.ok(app.includes('const title = definitions.find(([id]) => id === t)?.[2] ?? t;'), 'the tool\'s own name is used, not its lowercase id');
    assert.ok(app.includes('`Draw with the ${title} tool.`'), 'the fallback sentence quotes that name');
    assert.equal(translateText('Draw with the Line tool.', 'zh'), '使用直线工具绘图。');
    assert.equal(translateText('Draw with the Rounded rectangle tool.', 'zh'), '使用圆角矩形工具绘图。');
});

test('the new option labels speak Chinese, and the old filled-shapes key is gone', () => {
    assert.equal(translateText('Outline', 'zh'), '空心');
    assert.equal(translateText('Outline and fill', 'zh'), '空心并填充');
    assert.equal(translateText('Fill', 'zh'), '填充');
    assert.equal(translateText('Tool options', 'zh'), '工具选项');
    assert.equal(translateText('Line size 4px', 'zh'), '线宽 4 像素');
    assert.equal(translateText('Filled shapes', 'zh'), 'Filled shapes', 'nothing renders this key any more');
});
