import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/packages/apps/utilities.js', import.meta.url), 'utf8');
const section = name => {
    const start = source.indexOf(`export function ${name}(`);
    assert.ok(start >= 0, `${name} was found`);
    const next = source.indexOf('\nexport function', start + 1);
    return source.slice(start, next < 0 ? undefined : next);
};

test('Find Now reports the matches it found, not a name from another function', () => {
    const find = section('findFiles');
    assert.doesNotMatch(find, /currentNodes/, 'currentNodes only exists in the disk utility');
    assert.match(find, /w\.status\(`\$\{nodes\.length\} file\(s\) found`\)/);
    assert.match(find, /if \(!nodes\.length\)/);
});
