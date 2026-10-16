import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildSite, defaultVersion, versionCss, versionHtml, versionJavaScript } from '../tools/build-site.mjs';

const VERSION = 'abc1234';

test('deployment environments provide the default asset version', () => {
    assert.equal(defaultVersion({}), 'dev');
    assert.equal(defaultVersion({ GITHUB_SHA: 'github-sha' }), 'github-sha');
    assert.equal(defaultVersion({ CF_PAGES_COMMIT_SHA: 'cloudflare-sha', GITHUB_SHA: 'github-sha' }), 'cloudflare-sha');
    assert.equal(defaultVersion({ APP_VERSION: 'manual', CF_PAGES_COMMIT_SHA: 'cloudflare-sha' }), 'manual');
});

test('JavaScript module specifiers gain the release version', () => {
    const source = [
        "import { el } from '@win95/ui/dom.js';",
        "import { local } from './local.js';",
        "import { up } from '../core/filesystem.js';",
        "import './side-effect.js';",
        "export { thing } from './thing.js';",
        "const lazy = () => import('./lazy.js');",
        "import external from 'some-package';",
        "const sound = new Audio('./assets/win95-startup.mp3');"
    ].join('\n');
    const output = versionJavaScript(source, VERSION);
    assert.match(output, /@win95\/ui\/dom\.js\?v=abc1234/);
    assert.match(output, /\.\/local\.js\?v=abc1234/);
    assert.match(output, /\.\.\/core\/filesystem\.js\?v=abc1234/);
    assert.match(output, /import '\.\/side-effect\.js\?v=abc1234'/);
    assert.match(output, /from '\.\/thing\.js\?v=abc1234'/);
    assert.match(output, /import\('\.\/lazy\.js\?v=abc1234'\)/);
    assert.match(output, /from 'some-package'/);
    assert.doesNotMatch(output, /some-package\?v=/);
    assert.match(output, /win95-startup\.mp3\?v=abc1234/);
    assert.equal(versionJavaScript(output, VERSION), output, 'versioning is idempotent');
});

test('HTML entry points and CSS fonts gain the release version', () => {
    const html = '<link rel="stylesheet" href="./styles.css"><script type="module" src="./main.js"></script><img src="./assets/logo.svg"><a href="https://example.com/x.css">x</a>';
    const output = versionHtml(html, VERSION);
    assert.match(output, /styles\.css\?v=abc1234/);
    assert.match(output, /main\.js\?v=abc1234/);
    assert.match(output, /logo\.svg\?v=abc1234/);
    assert.doesNotMatch(output, /example\.com\/x\.css\?v=/);

    const css = "@font-face{src:url('./assets/font.woff2')} .a{background:url(\"data:image/svg+xml,%3Csvg/%3E\")}";
    const styled = versionCss(css, VERSION);
    assert.match(styled, /font\.woff2\?v=abc1234/);
    assert.doesNotMatch(styled, /data:image\/svg\+xml,[^)]*\?v=/);
});

test('buildSite copies binaries unchanged and versions text in the output only', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'win95-build-'));
    const source = path.join(root, 'src');
    const output = path.join(root, '_site');
    await mkdir(path.join(source, 'packages'), { recursive: true });
    await writeFile(path.join(source, 'index.html'), '<script type="module" src="./main.js"></script>');
    await writeFile(path.join(source, 'main.js'), "import './packages/app.js';\n");
    await writeFile(path.join(source, 'packages', 'app.js'), 'export const value = 1;\n');
    const binary = Buffer.from([0, 1, 2, 250, 255]);
    await writeFile(path.join(source, 'asset.bin'), binary);

    const result = await buildSite({ source, output, version: VERSION });
    assert.equal(result.files, 4);
    assert.match(await readFile(path.join(output, 'index.html'), 'utf8'), /main\.js\?v=abc1234/);
    assert.match(await readFile(path.join(output, 'main.js'), 'utf8'), /app\.js\?v=abc1234/);
    assert.deepEqual(await readFile(path.join(output, 'asset.bin')), binary);
    assert.doesNotMatch(await readFile(path.join(source, 'main.js'), 'utf8'), /\?v=/, 'source tree is left untouched');
});
