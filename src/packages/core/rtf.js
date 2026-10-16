/**
 * Small, dependency-free RTF/HTML interchange for a browser WordPad editor.
 *
 * Exports: htmlToRtf(html), rtfToHtml(rtf).
 * Reader works in Node and browsers; writer requires a global DOMParser.
 *
 * Supported: paragraphs; left/center/right/justified alignment; bold, italic,
 * underline; half-point font sizes; font families; foreground color tables;
 * tabs, soft line breaks, escaped punctuation, ANSI bytes, scoped Unicode
 * \uN/\ucN fallbacks (including UTF-16 surrogate pairs), and \upr/\ud text.
 * Common text symbols and visible field results are imported as text.
 * Inline HTML styles and legacy <font> formatting are exported. Stylesheets,
 * computed CSS, alpha colors, Symbol/Wingdings glyph mappings, page geometry,
 * lists/tables as structures, images, OLE, macros, and active fields are outside
 * this subset. Unsupported destinations are discarded, never executed.
 *
 * Output HTML contains only p, span and br, fixed CSS property names, sanitized
 * font names, numeric font sizes and hexadecimal colors. No input HTML is
 * copied into output. Both functions cap input at 8 MiB; RTF nesting at 512,
 * and HTML traversal at 256. Unbalanced/non-RTF input throws SyntaxError.
 * CP1252 is built in; other common code pages use TextDecoder where available.
 * For raw 8-bit RTF files, decode bytes as a one-byte-per-code-unit string
 * before calling rtfToHtml; UTF-8 file decoding can destroy legacy ANSI bytes.
 */
const MAX_INPUT = 8 * 1024 * 1024;
const DEFAULT_FONT = 'Arial';
const DEFAULT_SIZE = 24; // RTF half-points.
const ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);
const ALIGN_CONTROL = { left: 'ql', center: 'qc', right: 'qr', justify: 'qj' };
const CONTROL_ALIGN = { ql: 'left', qc: 'center', qr: 'right', qj: 'justify' };
const SKIP_DESTINATIONS = new Set([
    'annotation', 'atnauthor', 'atnid', 'atnref', 'atntime', 'author', 'background',
    'category', 'colorschememapping', 'comment', 'company', 'creatim', 'datafield',
    'datastore', 'doccomm', 'docvar', 'factoidname', 'falt', 'filetbl', 'fldinst',
    'fontemb', 'fontfile', 'footer', 'footerf', 'footerl', 'footerr', 'footnote',
    'generator', 'header', 'headerf', 'headerl', 'headerr', 'hl', 'hlfr', 'hlinkbase',
    'hlloc', 'htmltag', 'info', 'keywords', 'latentstyles', 'list', 'listlevel',
    'listname', 'listoverride', 'listoverridetable', 'listtable', 'listtext',
    'manager', 'mmathPr', 'nesttableprops', 'nonshppict', 'objalias', 'objclass',
    'objdata', 'object', 'objname', 'objsect', 'objtime', 'operator', 'panose',
    'password', 'pgp', 'pgptbl', 'picprop', 'pict', 'pn', 'pnseclvl', 'pntext',
    'printim', 'private', 'revtbl', 'revtim', 'rsidtbl', 'shp', 'shpinst',
    'shppict', 'shprslt', 'stylesheet', 'subject', 'template', 'themedata',
    'title', 'userprops', 'version', 'xe', 'xmlattrname', 'xmlattrvalue',
    'xmlclose', 'xmlname', 'xmlnstbl', 'xmlopen',
]);
const TEXT_CONTROLS = {
    bullet: '\u2022', emdash: '\u2014', endash: '\u2013', emspace: '\u2003',
    enspace: '\u2002', qmspace: '\u2005', lquote: '\u2018', rquote: '\u2019',
    ldblquote: '\u201c', rdblquote: '\u201d', tab: '\t', line: '\n',
};
const CP1252_SPECIAL = [
    0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021,
    0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f,
    0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
    0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178,
];
const CHARSET_CODE_PAGE = {
    77: 10000, 128: 932, 129: 949, 134: 936, 136: 950, 161: 1253,
    162: 1254, 163: 1258, 177: 1255, 178: 1256, 186: 1257, 204: 1251,
    222: 874, 238: 1250,
};
const CODE_PAGE_LABEL = {
    874: 'windows-874', 932: 'shift_jis', 936: 'gbk', 949: 'euc-kr',
    950: 'big5', 10000: 'macintosh', 65001: 'utf-8',
};
const NAMED_COLORS = {
    black: '#000000', silver: '#c0c0c0', gray: '#808080', grey: '#808080',
    white: '#ffffff', maroon: '#800000', red: '#ff0000', purple: '#800080',
    fuchsia: '#ff00ff', magenta: '#ff00ff', green: '#008000', lime: '#00ff00',
    olive: '#808000', yellow: '#ffff00', navy: '#000080', blue: '#0000ff',
    teal: '#008080', aqua: '#00ffff', cyan: '#00ffff', orange: '#ffa500',
    rebeccapurple: '#663399', darkred: '#8b0000', darkblue: '#00008b',
    darkgreen: '#006400', lightgray: '#d3d3d3', lightgrey: '#d3d3d3',
};
function checkInput(input, name) {
    if (typeof input !== 'string')
        throw new TypeError(`${name} expects a string.`);
    if (input.length > MAX_INPUT)
        throw new RangeError(`${name} input exceeds 8 MiB.`);
}
function escapeHtml(text) {
    return String(text).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '\ufffd')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function safeFont(value) {
    return String(value || '').replace(/[^\p{L}\p{N} ._-]/gu, '')
        .trim().slice(0, 128) || DEFAULT_FONT;
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
function channelHex(value) {
    return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
}
function parseColor(value) {
    const text = String(value || '').trim().toLowerCase();
    if (Object.hasOwn(NAMED_COLORS, text))
        return NAMED_COLORS[text];
    if (/^#[0-9a-f]{6}$/.test(text))
        return text;
    if (/^#[0-9a-f]{3}$/.test(text))
        return '#' + [...text.slice(1)].map(c => c + c).join('');
    const match = /^rgba?\(([^)]+)\)$/.exec(text);
    if (!match)
        return null;
    const values = match[1].replace(/\//g, ',').split(/[\s,]+/).filter(Boolean);
    if (values.length < 3 || values.length > 4)
        return null;
    if (values[3] !== undefined && !['1', '1.0', '100%'].includes(values[3]))
        return null;
    if (!values.slice(0, 3).every(v => /^[-+]?\d*\.?\d+%?$/.test(v)))
        return null;
    return '#' + values.slice(0, 3).map(v => channelHex(parseFloat(v) * (v.endsWith('%') ? 2.55 : 1))).join('');
}
function escapeRtf(text) {
    let result = '';
    // Iterate UTF-16 code units: supplementary characters require two signed \uN escapes.
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code === 92 || code === 123 || code === 125)
            result += '\\' + text[i];
        else if (code === 9)
            result += '\\tab ';
        else if (code === 10)
            result += '\\line ';
        else if (code === 13) {
            if (text.charCodeAt(i + 1) !== 10)
                result += '\\line ';
        }
        else if (code >= 32 && code <= 126)
            result += text[i];
        else
            result += `\\u${code > 32767 ? code - 65536 : code}?`;
    }
    return result;
}
function* tokens(source) {
    for (let i = 0; i < source.length;) {
        const char = source[i++];
        if (char === '{' || char === '}') {
            yield { type: char };
            continue;
        }
        if (char === '\r' || char === '\n')
            continue;
        if (char !== '\\') {
            const start = i - 1;
            while (i < source.length && !/[{}\\\r\n]/.test(source[i]))
                i++;
            yield { type: 'text', text: source.slice(start, i) };
            continue;
        }
        if (i === source.length)
            throw new SyntaxError('RTF ends with an incomplete escape.');
        const next = source[i++];
        if (next === "'") {
            const hex = source.slice(i, i + 2);
            if (!/^[0-9a-fA-F]{2}$/.test(hex))
                throw new SyntaxError('Invalid RTF hexadecimal byte.');
            i += 2;
            yield { type: 'byte', byte: parseInt(hex, 16) };
        }
        else if (/[a-zA-Z]/.test(next)) {
            const start = i - 1;
            while (i < source.length && /[a-zA-Z]/.test(source[i]))
                i++;
            const word = source.slice(start, i);
            let number;
            const numberStart = i;
            if (source[i] === '-' && /[0-9]/.test(source[i + 1] || ''))
                i++;
            while (i < source.length && /[0-9]/.test(source[i]))
                i++;
            if (i > numberStart)
                number = Number(source.slice(numberStart, i));
            if (number !== undefined && !Number.isSafeInteger(number))
                throw new SyntaxError('RTF integer is out of range.');
            if (source[i] === ' ')
                i++;
            if (word === 'bin') {
                if (number === undefined || number < 0 || i + number > source.length)
                    throw new SyntaxError('Invalid RTF binary payload length.');
                i += number;
                yield { type: 'binary' };
            }
            else
                yield { type: 'control', word, number };
        }
        else {
            if (next === '\r' && source[i] === '\n')
                i++;
            yield { type: 'symbol', symbol: next };
        }
    }
}
function decodeBytes(bytes, codePage) {
    if (codePage !== 1252 && typeof TextDecoder !== 'undefined') {
        const label = CODE_PAGE_LABEL[codePage] || (codePage >= 1250 && codePage <= 1258 ? `windows-${codePage}` : null);
        if (label) {
            try {
                return new TextDecoder(label).decode(new Uint8Array(bytes));
            }
            catch { /* CP1252 fallback. */ }
        }
    }
    let output = '';
    for (const byte of bytes)
        output += String.fromCharCode(byte >= 0x80 && byte <= 0x9f ? CP1252_SPECIAL[byte - 0x80] : byte);
    return output;
}
function initialState() {
    return {
        destination: 'body', b: false, i: false, u: false, hidden: false,
        f: 0, fs: DEFAULT_SIZE, cf: 0, align: 'left', uc: 1, codePage: 1252,
        fontId: -1, fontName: '', fontCharset: 0, fontCodePage: 0,
        red: 0, green: 0, blue: 0, hasColor: false,
        star: false, upr: false, uprChildren: 0,
    };
}
/** Import an RTF string as a safe HTML fragment. No DOM dependency. */
export function rtfToHtml(rtf) {
    checkInput(rtf, 'rtfToHtml');
    const source = rtf.replace(/^\uFEFF/, '').trim();
    if (!/^\{\s*\\rtf1(?:[^0-9]|$)/.test(source))
        throw new SyntaxError('Expected an RTF 1 document.');
    const fonts = new Map();
    const colors = [];
    const paragraphs = [];
    const stack = [];
    let state = initialState();
    let current = null;
    let defaultFont = 0;
    let fallback = 0;
    let bytes = [];
    let byteState = null;
    let finished = false;
    function styleKey(s) { return `${s.f}|${s.fs}|${s.cf}|${+s.b}|${+s.i}|${+s.u}`; }
    function paragraph(s) { return { alignment: s.align, runs: [] }; }
    function emit(text, s = state) {
        if (!text || s.destination === 'skip')
            return;
        if (s.destination === 'fonttbl') {
            for (const char of text) {
                if (char === ';') {
                    if (s.fontId >= 0)
                        fonts.set(s.fontId, { name: safeFont(s.fontName), charset: s.fontCharset, codePage: s.fontCodePage });
                    s.fontName = '';
                }
                else
                    s.fontName += char;
            }
            return;
        }
        if (s.destination === 'colortbl') {
            for (const char of text)
                if (char === ';') {
                    colors.push(s.hasColor ? '#' + channelHex(s.red) + channelHex(s.green) + channelHex(s.blue) : null);
                    s.red = s.green = s.blue = 0;
                    s.hasColor = false;
                }
            return;
        }
        if (s.hidden)
            return;
        current ||= paragraph(s);
        const key = styleKey(s);
        const previous = current.runs[current.runs.length - 1];
        if (previous?.key === key)
            previous.text += text;
        else
            current.runs.push({ key, text, f: s.f, fs: s.fs, cf: s.cf, b: s.b, i: s.i, u: s.u });
    }
    function flushBytes() {
        if (!bytes.length)
            return;
        const font = fonts.get(byteState.f);
        const codePage = byteState.destination === 'fonttbl'
            ? byteState.fontCodePage || CHARSET_CODE_PAGE[byteState.fontCharset] || byteState.codePage
            : font?.codePage || CHARSET_CODE_PAGE[font?.charset] || byteState.codePage;
        emit(decodeBytes(bytes, codePage), byteState);
        bytes = [];
        byteState = null;
    }
    function addByte(byte) {
        if (state.destination === 'skip')
            return;
        byteState ||= state;
        bytes.push(byte);
    }
    function finishParagraph() {
        if (state.destination !== 'body' || state.hidden)
            return;
        paragraphs.push(current || paragraph(state));
        current = null;
    }
    for (const token of tokens(source)) {
        if (finished) {
            if (token.type === 'text' && !token.text.trim())
                continue;
            throw new SyntaxError('Unexpected data after the RTF root group.');
        }
        if (token.type === '{' || token.type === '}') {
            flushBytes();
            fallback = 0; // A scope delimiter terminates the ANSI fallback region.
            if (token.type === '{') {
                if (stack.length >= 512)
                    throw new RangeError('RTF nesting exceeds 512 groups.');
                if (state.upr)
                    state.uprChildren++;
                const skipAnsiAlternative = state.upr && state.uprChildren === 1;
                stack.push(state);
                state = { ...state, star: false, upr: false, uprChildren: 0 };
                if (skipAnsiAlternative)
                    state.destination = 'skip';
            }
            else {
                if (!stack.length)
                    throw new SyntaxError('Unexpected RTF closing brace.');
                state = stack.pop();
                if (!stack.length)
                    finished = true;
            }
            continue;
        }
        if (fallback > 0) {
            if (token.type === 'text') {
                const skipped = Math.min(fallback, token.text.length);
                fallback -= skipped;
                token.text = token.text.slice(skipped);
                if (!token.text)
                    continue;
            }
            else {
                fallback--;
                continue;
            }
        }
        if (token.type === 'byte') {
            addByte(token.byte);
            continue;
        }
        if (token.type === 'text') {
            for (let i = 0; i < token.text.length; i++) {
                const code = token.text.charCodeAt(i);
                if (code <= 255)
                    addByte(code);
                else {
                    flushBytes();
                    emit(token.text[i]);
                }
            }
            continue;
        }
        flushBytes();
        if (token.type === 'binary')
            continue;
        if (token.type === 'symbol') {
            if (token.symbol === '*')
                state.star = true;
            else if ('\\{}'.includes(token.symbol))
                emit(token.symbol);
            else if (token.symbol === '~')
                emit('\u00a0');
            else if (token.symbol === '_')
                emit('\u2011');
            else if (token.symbol === '-')
                emit('\u00ad');
            else if (token.symbol === '\n' || token.symbol === '\r')
                finishParagraph();
            continue;
        }
        const { word, number } = token;
        if (state.destination === 'skip')
            continue;
        if (state.star) {
            state.star = false;
            if (word !== 'ud') {
                state.destination = 'skip';
                continue;
            }
        }
        if (SKIP_DESTINATIONS.has(word)) {
            state.destination = 'skip';
            continue;
        }
        if (word === 'fonttbl' || word === 'colortbl') {
            state.destination = word;
            continue;
        }
        if (word === 'upr') {
            state.upr = true;
            state.uprChildren = 0;
            continue;
        }
        if (word === 'uc') {
            if (number !== undefined)
                state.uc = clamp(number, 0, 65535);
            continue;
        }
        if (word === 'u') {
            if (number !== undefined) {
                emit(String.fromCharCode(number & 0xffff));
                fallback = state.uc;
            }
            continue;
        }
        if (word === 'ansicpg' && number !== undefined) {
            state.codePage = number;
            continue;
        }
        if (word === 'ansi') {
            state.codePage = 1252;
            continue;
        }
        if (word === 'mac') {
            state.codePage = 10000;
            continue;
        }
        if (state.destination === 'fonttbl') {
            if (word === 'f' && number !== undefined) {
                state.fontId = number;
                state.fontName = '';
                state.fontCharset = 0;
                state.fontCodePage = 0;
            }
            else if (word === 'fcharset')
                state.fontCharset = number || 0;
            else if (word === 'cpg')
                state.fontCodePage = number || 0;
            continue;
        }
        if (state.destination === 'colortbl') {
            if (['red', 'green', 'blue'].includes(word)) {
                state[word] = clamp(number || 0, 0, 255);
                state.hasColor = true;
            }
            continue;
        }
        if (word === 'deff' && number !== undefined) {
            defaultFont = number;
            state.f = number;
        }
        else if (word === 'plain')
            Object.assign(state, { b: false, i: false, u: false, hidden: false, f: defaultFont, fs: DEFAULT_SIZE, cf: 0 });
        else if (word === 'pard') {
            state.align = 'left';
            if (current)
                current.alignment = state.align;
        }
        else if (Object.hasOwn(CONTROL_ALIGN, word)) {
            state.align = CONTROL_ALIGN[word];
            if (current)
                current.alignment = state.align;
        }
        else if (word === 'b' || word === 'i')
            state[word] = number !== 0;
        else if (word === 'ul')
            state.u = number !== 0;
        else if (word === 'ulnone')
            state.u = false;
        else if (word === 'v')
            state.hidden = number !== 0;
        else if (word === 'f' && number !== undefined)
            state.f = number;
        else if (word === 'fs' && number !== undefined)
            state.fs = clamp(number, 2, 3276);
        else if (word === 'cf' && number !== undefined)
            state.cf = Math.max(0, number);
        else if (word === 'par' || word === 'page' || word === 'sect' || word === 'row')
            finishParagraph();
        else if (word === 'cell')
            emit('\t');
        else if (Object.hasOwn(TEXT_CONTROLS, word))
            emit(TEXT_CONTROLS[word]);
    }
    flushBytes();
    if (stack.length || !finished)
        throw new SyntaxError('Unclosed RTF group.');
    if (current)
        paragraphs.push(current);
    if (!paragraphs.length)
        paragraphs.push({ alignment: 'left', runs: [] });
    return paragraphs.map(p => {
        const content = p.runs.map(run => {
            const font = safeFont(fonts.get(run.f)?.name || fonts.get(defaultFont)?.name || DEFAULT_FONT);
            const style = [`font-family:"${font}"`, `font-size:${run.fs / 2}pt`];
            if (run.b)
                style.push('font-weight:700');
            if (run.i)
                style.push('font-style:italic');
            if (run.u)
                style.push('text-decoration:underline');
            if (colors[run.cf])
                style.push(`color:${colors[run.cf]}`);
            return `<span style="${escapeHtml(style.join(';'))}">${escapeHtml(run.text).replace(/\n/g, '<br>')}</span>`;
        }).join('');
        return `<p style="margin:0;white-space:pre-wrap;tab-size:8;text-align:${p.alignment}">${content || '<br>'}</p>`;
    }).join('\n');
}
function htmlStyle(element, inherited) {
    const next = { ...inherited };
    const tag = element.tagName.toLowerCase();
    const css = element.style;
    if (tag === 'b' || tag === 'strong')
        next.b = true;
    if (tag === 'i' || tag === 'em')
        next.i = true;
    if (tag === 'u')
        next.u = true;
    if (tag === 'pre') {
        next.preserve = true;
        next.font = 'Courier New';
    }
    if (/^h[1-6]$/.test(tag)) {
        next.b = true;
        next.fs = [48, 36, 28, 24, 20, 16][Number(tag[1]) - 1];
    }
    const weight = css?.fontWeight || '';
    if (weight === 'bold' || weight === 'bolder')
        next.b = true;
    else if (weight === 'normal' || weight === 'lighter')
        next.b = false;
    else if (/^\d+$/.test(weight))
        next.b = Number(weight) >= 600;
    if (css?.fontStyle === 'normal')
        next.i = false;
    else if (css?.fontStyle === 'italic' || css?.fontStyle === 'oblique')
        next.i = true;
    const decoration = css?.textDecorationLine || css?.textDecoration || '';
    if (decoration.includes('underline'))
        next.u = true;
    else if (decoration === 'none')
        next.u = false;
    const font = css?.fontFamily || (tag === 'font' ? element.getAttribute('face') : '');
    if (font)
        next.font = safeFont(font.split(',')[0].replace(/^["']|["']$/g, ''));
    const size = /^([\d.]+)(pt|px|em|rem|%)$/i.exec(css?.fontSize || '');
    if (size) {
        const value = Number(size[1]);
        const factors = { pt: 2, px: 1.5, em: inherited.fs, rem: DEFAULT_SIZE, '%': inherited.fs / 100 };
        next.fs = Math.round(clamp(value * factors[size[2].toLowerCase()], 2, 3276));
    }
    else if (tag === 'font') {
        const legacy = Number(element.getAttribute('size'));
        if (Number.isInteger(legacy) && legacy >= 1 && legacy <= 7)
            next.fs = [16, 20, 24, 28, 36, 48, 72][legacy - 1];
    }
    const color = parseColor(css?.color || (tag === 'font' ? element.getAttribute('color') : ''));
    if (color)
        next.color = color;
    const alignment = (css?.textAlign || element.getAttribute('align') || '').toLowerCase();
    if (ALIGNMENTS.has(alignment))
        next.align = alignment;
    if (['pre', 'pre-wrap', 'break-spaces'].includes(css?.whiteSpace))
        next.preserve = true;
    else if (css?.whiteSpace === 'normal' || css?.whiteSpace === 'nowrap')
        next.preserve = false;
    return next;
}
/** Export an HTML fragment using the documented text-formatting subset. */
export function htmlToRtf(html) {
    checkInput(html, 'htmlToRtf');
    if (typeof DOMParser === 'undefined')
        throw new Error('htmlToRtf requires DOMParser; provide a DOM implementation in Node.');
    const document = new DOMParser().parseFromString(html, 'text/html');
    const blocks = new Set(['p', 'div', 'pre', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'section', 'article', 'header', 'footer', 'main', 'aside', 'address', 'figcaption']);
    const discard = new Set(['script', 'style', 'template', 'iframe', 'object', 'embed', 'svg', 'math', 'link', 'meta', 'head', 'noscript']);
    const base = { b: false, i: false, u: false, font: DEFAULT_FONT, fs: DEFAULT_SIZE, color: null, align: 'left', preserve: false };
    const paragraphs = [];
    let current = null;
    function addText(text, style) {
        text = text.replace(/\r\n?/g, '\n');
        if (!style.preserve) {
            text = text.replace(/[\t\n\f ]+/g, ' ');
            const previous = current?.runs[current.runs.length - 1]?.text || '';
            if (!current || !current.runs.length || previous.endsWith(' '))
                text = text.replace(/^ +/, '');
        }
        if (!text)
            return;
        current ||= { alignment: style.align, runs: [] };
        const key = JSON.stringify(style);
        const previous = current.runs[current.runs.length - 1];
        if (previous?.key === key)
            previous.text += text;
        else
            current.runs.push({ ...style, key, text });
    }
    function finish() {
        if (!current)
            return;
        while (current.runs.length) {
            const last = current.runs[current.runs.length - 1];
            if (last.preserve)
                break;
            last.text = last.text.replace(/ +$/, '');
            if (last.text)
                break;
            current.runs.pop();
        }
        paragraphs.push(current);
        current = null;
    }
    function visit(node, inherited, depth) {
        if (depth > 256)
            throw new RangeError('HTML nesting exceeds 256 elements.');
        if (node.nodeType === 3) {
            addText(node.nodeValue || '', inherited);
            return;
        }
        if (node.nodeType !== 1)
            return;
        const tag = node.tagName.toLowerCase();
        if (discard.has(tag) || node.hasAttribute('hidden') || node.style?.display === 'none')
            return;
        const style = htmlStyle(node, inherited);
        if (tag === 'br') {
            // A line break remains significant even where ordinary HTML whitespace collapses.
            addText('\n', { ...style, preserve: true });
            return;
        }
        const isBlock = blocks.has(tag);
        if (isBlock)
            finish();
        const start = paragraphs.length;
        const children = Array.from(node.childNodes);
        const onlyPlaceholderBreak = isBlock && children.filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.nodeValue.trim())).length === 1
            && children.some(n => n.nodeType === 1 && n.tagName.toLowerCase() === 'br');
        if (!onlyPlaceholderBreak)
            for (const child of children)
                visit(child, style, depth + 1);
        if (isBlock) {
            finish();
            if (paragraphs.length === start)
                paragraphs.push({ alignment: style.align, runs: [] });
        }
    }
    for (const child of Array.from(document.body.childNodes))
        visit(child, base, 0);
    finish();
    if (!paragraphs.length)
        paragraphs.push({ alignment: 'left', runs: [] });
    const fonts = new Map([[DEFAULT_FONT, 0]]);
    const colors = new Map();
    for (const paragraph of paragraphs)
        for (const run of paragraph.runs) {
            if (!fonts.has(run.font))
                fonts.set(run.font, fonts.size);
            if (run.color && !colors.has(run.color))
                colors.set(run.color, colors.size + 1);
        }
    const fontTable = '{\\fonttbl' + [...fonts].map(([font, id]) => `{\\f${id}\\fnil\\fcharset0 ${escapeRtf(font)};}`).join('') + '}';
    const colorTable = '{\\colortbl ;' + [...colors.keys()].map(color => `\\red${parseInt(color.slice(1, 3), 16)}\\green${parseInt(color.slice(3, 5), 16)}\\blue${parseInt(color.slice(5, 7), 16)};`).join('') + '}';
    const body = paragraphs.map(paragraph => {
        const runs = paragraph.runs.map(run => `{\\f${fonts.get(run.font)}\\fs${run.fs}\\b${+run.b}\\i${+run.i}\\ul${+run.u}\\cf${colors.get(run.color) || 0} ${escapeRtf(run.text)}}`).join('');
        return `{\\pard\\${ALIGN_CONTROL[paragraph.alignment] || 'ql'} ${runs}\\par}`;
    }).join('\n');
    return `{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1\n${fontTable}\n${colorTable}\n${body}\n}`;
}
