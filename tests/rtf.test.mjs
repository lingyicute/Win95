/**
 * RTF reader conformance/security regression checks.
 *
 * Run beside rtf.js:
 *   node --test rtf.test.mjs
 *
 * Or test an integrated copy without moving this file:
 *   RTF_MODULE=/absolute/path/to/rtf.js node --test rtf.test.mjs
 *
 * No DOM or browser is required. These tests exercise rtfToHtml; the
 * DOMParser-dependent htmlToRtf writer needs separate browser round trips.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const moduleUrl = process.env.RTF_MODULE
  ? pathToFileURL(resolve(process.env.RTF_MODULE))
  : new URL('../src/packages/core/rtf.js', import.meta.url);
const { rtfToHtml } = await import(moduleUrl.href);

const cases = [
  {
    name: 'reads ordinary text',
    rtf: String.raw`{\rtf1 Hello}`,
    expected: 'Hello',
  },
  {
    name: 'imports nested bold and italic formatting',
    rtf: String.raw`{\rtf1 \b bold {\i nested} plain\b0 normal}`,
    expected: 'font-weight:700',
  },
  {
    name: 'combines signed UTF-16 surrogate escapes',
    rtf: String.raw`{\rtf1 \uc1\u-10179?\u-8704?}`,
    expected: '😀',
  },
  {
    name: 'supports uc0 without consuming following Unicode escapes',
    rtf: String.raw`{\rtf1 \uc0\u261\u281\u322}`,
    expected: 'ąęł',
  },
  {
    name: 'skips two literal fallback bytes for uc2',
    rtf: String.raw`{\rtf1 \uc2\u945??Z}`,
    expected: 'αZ',
  },
  {
    name: 'counts escaped symbols as individual fallback characters',
    rtf: String.raw`{\rtf1 \uc2\u945\~\~Z}`,
    expected: 'αZ',
  },
  {
    name: 'counts an entire binary payload as one fallback token',
    rtf: String.raw`{\rtf1 \uc1\u945\bin3 abcZ}`,
    expected: 'αZ',
  },
  {
    name: 'ends incomplete fallback skipping at a group boundary',
    rtf: String.raw`{\rtf1 \uc2\u945?{Z}}`,
    expected: 'αZ',
  },
  {
    name: 'reads the Unicode branch of an upr alternative',
    rtf: String.raw`{\rtf1 {\upr{ANSI}{\*\ud Unicode \u945?}}}`,
    expected: 'Unicode α',
  },
  {
    name: 'decodes CP1252 euro and typographic quotation bytes',
    rtf: String.raw`{\rtf1 \'80 \'93text\'94}`,
    expected: '€ “text”',
  },
  {
    name: 'decodes CP1251 Cyrillic bytes',
    rtf: String.raw`{\rtf1\ansicpg1251 \'cf\'f0\'e8\'e2\'e5\'f2}`,
    expected: 'Привет',
  },
  {
    name: 'combines adjacent Shift-JIS bytes before decoding',
    rtf: String.raw`{\rtf1\ansicpg932 \'82\'a0}`,
    expected: 'あ',
  },
  {
    name: 'preserves tabs and soft line breaks',
    rtf: String.raw`{\rtf1 a\tab b\line c\par d}`,
    expected: 'a\tb<br>c',
  },
  {
    name: 'resolves a foreground color table',
    rtf: String.raw`{\rtf1 {\fonttbl{\f0 Arial;}{\f1 Times New Roman;}}{\colortbl ;\red255\green0\blue128;}\f1\fs29\cf1\qc Text}`,
    expected: 'color:#ff0080',
  },
  {
    name: 'retains half-point font size precision',
    rtf: String.raw`{\rtf1 {\fonttbl{\f0 Arial;}{\f1 Times New Roman;}}\f1\fs29\qc Text}`,
    expected: 'font-size:14.5pt',
  },
  {
    name: 'retains visible field results without creating links',
    rtf: String.raw`{\rtf1 {\field{\*\fldinst HYPERLINK "javascript:alert(1)"}{\fldrslt Click me}}}`,
    expected: 'Click me',
  },
  {
    name: 'escapes raw HTML carried as document text',
    rtf: String.raw`{\rtf1 <img src=x onerror=alert(1)>}`,
    expected: '&lt;img',
  },
  {
    name: 'discards unknown ignorable destinations',
    rtf: String.raw`{\rtf1 Safe{\*\unknown DANGER}text}`,
    expected: 'Safetext',
  },
  {
    name: 'discards picture destinations',
    rtf: String.raw`{\rtf1 Safe{\pict DANGER}text}`,
    expected: 'Safetext',
  },
  {
    name: 'discards hidden text and resumes visible text',
    rtf: String.raw`{\rtf1 Safe\v DANGER\v0 text}`,
    expected: 'Safetext',
  },
  {
    name: 'ignores prototype-property names as unknown control words',
    rtf: String.raw`{\rtf1 \constructor\toString Safe}`,
    expected: 'Safe',
  },
  {
    name: 'unescapes braces and backslashes as text',
    rtf: String.raw`{\rtf1 \{a\} \\}`,
    expected: '{a} \\',
  },
];

for (const { name, rtf, expected } of cases) {
  test(name, () => {
    const html = rtfToHtml(rtf);
    assert.ok(html.includes(expected), JSON.stringify({ rtf, expected, html }));
    assert.ok(!html.includes('DANGER'), 'Discarded destination or hidden text leaked.');
    assert.ok(!/<(?:script|img|iframe|object|a)\b/i.test(html), 'Reader emitted an unsafe or unsupported HTML element.');
  });
}

const invalidCases = [
  ['rejects empty input', '', SyntaxError],
  ['rejects a group without an RTF header', '{}', SyntaxError],
  ['rejects an unclosed root group', '{\\rtf1', SyntaxError],
  ['rejects an extra closing brace', '{\\rtf1}}', SyntaxError],
  ['rejects trailing data outside the root', '{\\rtf1}x', SyntaxError],
  ['rejects an invalid hexadecimal byte', "{\\rtf1 \\'xx}", SyntaxError],
  ['rejects a truncated binary payload', '{\\rtf1\\bin20 abc}', SyntaxError],
  ['rejects excessive nesting', '{\\rtf1' + '{'.repeat(513), RangeError],
];

for (const [name, rtf, errorType] of invalidCases) {
  test(name, () => assert.throws(() => rtfToHtml(rtf), errorType));
}

test('keeps an empty paragraph without adding a phantom final paragraph', () => {
  const html = rtfToHtml(String.raw`{\rtf1 one\par \par three\par}`);
  assert.equal((html.match(/<p /g) || []).length, 3);
});

test('does not duplicate the ANSI branch when a Unicode alternative exists', () => {
  const html = rtfToHtml(String.raw`{\rtf1 {\upr{ANSI}{\*\ud Unicode}}}`);
  assert.ok(html.includes('Unicode'));
  assert.ok(!html.includes('ANSI'));
});

test('sanitizes malicious font-table names before embedding them in CSS', () => {
  const html = rtfToHtml(String.raw`{\rtf1 {\fonttbl{\f0 A" onmouseover="alert(1);}}\f0 Text}`);
  assert.ok(html.includes('font-family:&quot;A onmouseoveralert1&quot;'));
  assert.ok(!/\sonmouseover\s*=/.test(html));
});
