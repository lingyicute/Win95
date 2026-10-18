/**
 * Mouse pointer schemes, the way the Mouse control panel's Pointers tab
 * implements them: a named scheme paints every cursor role (Normal Select,
 * Busy, Text Select, …) with one palette, the desktop reads the results from
 * CSS custom properties, and per-role file assignments override the scheme.
 *
 * The cursors are drawn as SVG on a classic 32×32 grid — the same white arrow
 * outline the pointer trails use — and rasterized to PNG before they reach the
 * `cursor` property, because SVG data URLs are not accepted as cursors by
 * every browser. Previews in the dialog show the SVG directly; a failed
 * rasterization falls back to it, and the CSS falls back to the equivalent
 * keyword if the URL itself is rejected.
 */
const ARROW_D = 'M1 1v15l3.4-3.2 2.4 5.6 2.7-1.2-2.4-5.5h4.8z';

/** Every cursor the Pointers tab can customize, in dialog order. */
export const POINTER_ROLES = [
    { id: 'normal', label: 'Normal Select', file: 'arrow.cur', fallback: 'default' },
    { id: 'help', label: 'Help Select', file: 'help.cur', fallback: 'help' },
    { id: 'working', label: 'Working In Background', file: 'appstarting.cur', fallback: 'progress' },
    { id: 'busy', label: 'Busy', file: 'wait.cur', fallback: 'wait' },
    { id: 'precision', label: 'Precision Select', file: 'cross.cur', fallback: 'crosshair' },
    { id: 'text', label: 'Text Select', file: 'ibeam.cur', fallback: 'text' },
    { id: 'handwriting', label: 'Handwriting', file: 'pen.cur', fallback: 'crosshair' },
    { id: 'vresize', label: 'Vertical Resize', file: 'size12.cur', fallback: 'ns-resize' },
    { id: 'hresize', label: 'Horizontal Resize', file: 'size11.cur', fallback: 'ew-resize' },
    { id: 'dresize1', label: 'Diagonal Resize 1', file: 'size14.cur', fallback: 'nwse-resize' },
    { id: 'dresize2', label: 'Diagonal Resize 2', file: 'size13.cur', fallback: 'nesw-resize' },
    { id: 'move', label: 'Move', file: 'move.cur', fallback: 'move' },
    { id: 'alternate', label: 'Alternate Select', file: 'alternate.cur', fallback: 'default' },
    { id: 'unavailable', label: 'Unavailable', file: 'unavail.cur', fallback: 'not-allowed' },
    { id: 'link', label: 'Link Select', file: 'hand.cur', fallback: 'pointer' }
];

/** The schemes that ship with the desktop, in Scheme-list order. */
export const SCHEMES = [
    { name: 'Windows Standard', fill: '#ffffff', outline: '#000000', accent: '#00a0a0' },
    { name: 'Windows Black', fill: '#000000', outline: '#ffffff', accent: '#ffff00' },
    { name: '3D-Bronzed', fill: '#d6b489', outline: '#2e1c0c', accent: '#8a5a28' },
    { name: '3D-White', fill: '#ffffff', outline: '#4a4a4a', accent: '#000080' },
    { name: 'Marine', fill: '#8ed2d2', outline: '#013b47', accent: '#e0f0f0' },
    { name: 'Rose', fill: '#f8bccd', outline: '#59102a', accent: '#ffe0ea' },
    { name: 'Slate', fill: '#99a6b8', outline: '#1a2230', accent: '#d7dee8' },
    { name: 'Sports', fill: '#e58348', outline: '#2e1508', accent: '#1d3f70' },
    { name: 'Sunset', fill: '#ff9a5e', outline: '#4a1604', accent: '#ffd020' },
    { name: 'The Blue', fill: '#7d9cf5', outline: '#0e1b4d', accent: '#c8d8ff' },
    { name: 'The Green', fill: '#85d87d', outline: '#0f3f1b', accent: '#d0f0c0' },
    { name: 'Multimedia', fill: '#ffdf68', outline: '#2f3f5c', accent: '#d13c5a' },
    { name: 'Magnified', fill: '#ffffff', outline: '#000000', accent: '#00a0a0', scale: 1.5 },
    { name: 'Hands1', fill: '#ffd9b8', outline: '#462a16', accent: '#462a16', variant: 'hand' },
    { name: 'Hands2', fill: '#f4f4f4', outline: '#101010', accent: '#101010', variant: 'hand' },
    { name: 'Crosshair', fill: '#ffffff', outline: '#000000', accent: '#00a0a0', variant: 'cross' }
];

/** The placeholder Pointers page stored these names in the applet draft. */
const LEGACY_NAMES = { 'Large': 'Magnified', 'Crosshair': 'Crosshair', 'Windows Standard': 'Windows Standard' };

const userSchemeMap = s => s.settings.get('cursorUserSchemes', {}) || {};

/** The scheme currently committed to the desktop, including legacy drafts. */
export function currentSchemeName(s) {
    const stored = s.settings.get('cursorScheme', '');
    if (stored)
        return stored;
    const legacy = LEGACY_NAMES[s.settings.get('applet-mouse', {})?.cursor];
    return legacy || 'Windows Standard';
}

/** Every scheme the Scheme combo lists: the built-ins, then saved ones. */
export function listSchemes(s) {
    return [...SCHEMES.map(x => x.name), ...Object.keys(userSchemeMap(s))];
}

/** Resolves a scheme name against the built-ins and the user's saved schemes. */
export function resolveScheme(s, name = currentSchemeName(s)) {
    return SCHEMES.find(x => x.name === name)
        || userSchemeMap(s)[name]
        || SCHEMES[0];
}

/* ------------------------------------------------------------------------- *
 * Cursor art. Everything is drawn on a 32×32 grid; two-tone pieces are built
 * from an outline pass followed by a fill pass so unions of overlapping
 * shapes keep one continuous border.
 * ------------------------------------------------------------------------- */

const r1 = n => Math.round(n * 10) / 10;

const solid = (d, p) => `<path d="${d}" fill="${p.fill}" stroke="${p.outline}" stroke-width="1" stroke-linejoin="round"/>`;

/** Several shapes as one silhouette: outline pass, then flat fill pass. */
const union = (shapes, p) => {
    const body = shapes.map(x => x.startsWith('<') ? x : `<path d="${x}"/>`).join('');
    return `<g fill="${p.outline}" stroke="${p.outline}" stroke-width="1" stroke-linejoin="round">${body}</g>`
        + `<g fill="${p.fill}" stroke="none">${body}</g>`;
};

/** One arrow arm: tip at (tx,ty), unit vector pointing into the shape. */
const arm = (tx, ty, ux, uy, { hl = 7, w = 5.5, sw = 2.2, len = 12.5 } = {}) => {
    const px = -uy, py = ux;
    const pt = (a, b) => `${r1(a)} ${r1(b)}`;
    const at = (u, n) => [tx + ux * u + px * n, ty + uy * u + py * n];
    return `M${pt(tx, ty)}`
        + `L${pt(...at(hl, w))}L${pt(...at(hl, sw))}L${pt(...at(len, sw))}`
        + `L${pt(...at(len, -sw))}L${pt(...at(hl, -sw))}L${pt(...at(hl, -w))}Z`;
};

const D = 0.70710678;

/** Hourglass on a 16×22 box; `at` places it, `s` scales it. */
const hourglass = (p, at = [0, 0], s = 1) => `<g transform="translate(${at[0]} ${at[1]}) scale(${s})">`
    + `<rect x="0" y="0" width="16" height="2.6" fill="${p.outline}"/>`
    + `<rect x="0" y="19.4" width="16" height="2.6" fill="${p.outline}"/>`
    + `<path d="M1.5 2.6H14.5L8 11Z" fill="${p.fill}" stroke="${p.outline}" stroke-width="1"/>`
    + `<path d="M1.5 19.4H14.5L8 12Z" fill="${p.fill}" stroke="${p.outline}" stroke-width="1"/>`
    + `<path d="M4 4.6H12L8 9.4Z" fill="${p.accent}"/>`
    + `<path d="M5.6 17.6H10.4L8 13.8Z" fill="${p.accent}"/>`
    + `</g>`;

const crossPaths = ['M0 14h32v3H0z', 'M14 0h3v32h-3z'];
const crossArt = p => `<g fill="${p.outline}">${crossPaths.map(d => `<path d="${d}"/>`).join('')}</g>`
    + `<g fill="${p.fill}"><path d="M0 15h32v1H0z"/><path d="M15 0h1v32h-1z"/></g>`;

const ibeamArt = p => union([
    'M7 3h16v3H7z', 'M7 26h16v3H7z', 'M14 3h4v26h-4z',
    'M8 4h14v1H8z', 'M8 27h14v1H8z', 'M15 4h1v24h-1z'
], p);

const penArt = p => `<path d="M9 19L22 6l4 4L13 23Z" fill="${p.fill}" stroke="${p.outline}" stroke-width="1" stroke-linejoin="round"/>`
    + `<path d="M9 19L4.6 27.4L13 23Z" fill="${p.outline}" stroke="${p.outline}" stroke-width="1" stroke-linejoin="round"/>`
    + `<path d="M6.6 25.4L10.4 22" stroke="${p.fill}" stroke-width="1" fill="none"/>`;

const handArt = p => union([
    '<rect x="7" y="3.5" width="4.6" height="12" rx="2.3"/>',
    '<rect x="11" y="9" width="4.6" height="9.5" rx="2.3"/>',
    '<rect x="15" y="11" width="4.6" height="8.5" rx="2.3"/>',
    '<rect x="19" y="13.5" width="4.2" height="7.5" rx="2.1"/>',
    '<rect x="5.5" y="14" width="18" height="13.5" rx="5"/>',
    '<rect x="3.2" y="17.5" width="4.4" height="7.5" rx="2.2"/>'
], p);

const unavailableArt = p => `<circle cx="16" cy="16" r="9.5" fill="${p.fill}" stroke="${p.outline}" stroke-width="1"/>`
    + `<path d="M8.6 23.4L23.4 8.6" stroke="${p.outline}" stroke-width="3" fill="none"/>`;

/** The Help Select badge: a stroked question mark with a halo. */
const qmarkArt = p => {
    const d = 'M15.6 12.6a4.1 4.1 0 1 1 4.6 4c-1.3.45-2 1.3-2 2.6v.7|M18.2 23.6h.01';
    const pass = (stroke, width) => d.split('|').map(x =>
        `<path d="${x}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
    return pass(p.fill, 4) + pass(p.outline, 2);
};

const arrowBase = (p, variant) => variant === 'cross'
    ? crossArt(p)
    : solid(ARROW_D, p);

/** Draws one cursor role for one scheme; returns { svg, w, h, x, y }. */
export function cursorArt(id, scheme = SCHEMES[0]) {
    const p = { fill: scheme.fill, outline: scheme.outline, accent: scheme.accent || scheme.fill };
    const variant = scheme.variant || 'arrow';
    let body, hx = 1, hy = 1;
    switch (id) {
        case 'help':
            body = solid(ARROW_D, p) + qmarkArt(p);
            break;
        case 'working':
            body = solid(ARROW_D, p) + hourglass(p, [15.5, 15], 0.68);
            break;
        case 'busy':
            body = hourglass(p, [8, 5]);
            hx = 16; hy = 16;
            break;
        case 'precision':
            body = crossArt(p);
            hx = 16; hy = 16;
            break;
        case 'text':
            body = ibeamArt(p);
            hx = 16; hy = 16;
            break;
        case 'handwriting':
            body = penArt(p);
            hx = 5; hy = 27;
            break;
        case 'vresize':
            body = union([arm(16, 3.5, 0, 1), arm(16, 28.5, 0, -1)], p);
            hx = 16; hy = 16;
            break;
        case 'hresize':
            body = union([arm(3.5, 16, 1, 0), arm(28.5, 16, -1, 0)], p);
            hx = 16; hy = 16;
            break;
        case 'dresize1':
            body = union([arm(3.5, 3.5, D, D, { len: 13 }), arm(28.5, 28.5, -D, -D, { len: 13 })], p);
            hx = 16; hy = 16;
            break;
        case 'dresize2':
            body = union([arm(28.5, 3.5, -D, D, { len: 13 }), arm(3.5, 28.5, D, -D, { len: 13 })], p);
            hx = 16; hy = 16;
            break;
        case 'move':
            body = union([arm(16, 3, 0, 1, { hl: 6, w: 5, sw: 2, len: 13 }),
                arm(16, 29, 0, -1, { hl: 6, w: 5, sw: 2, len: 13 }),
                arm(3, 16, 1, 0, { hl: 6, w: 5, sw: 2, len: 13 }),
                arm(29, 16, -1, 0, { hl: 6, w: 5, sw: 2, len: 13 })], p);
            hx = 16; hy = 16;
            break;
        case 'unavailable':
            body = unavailableArt(p);
            hx = 16; hy = 16;
            break;
        case 'link':
            body = handArt(p);
            hx = 9; hy = 4;
            break;
        case 'alternate':
        case 'normal':
            if (variant === 'hand') {
                body = handArt(p);
                hx = 9; hy = 4;
            }
            else
                body = arrowBase(p, variant);
            break;
        default:
            body = arrowBase(p, variant);
    }
    const scale = scheme.scale || 1;
    const size = Math.round(32 * scale);
    // The viewBox tracks the scaled canvas, or scaled art would clip at 32.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
        + (scale === 1 ? body : `<g transform="scale(${scale})">${body}</g>`) + '</svg>';
    return { svg, w: size, h: size, x: Math.round(hx * scale), y: Math.round(hy * scale) };
}

export const svgDataUrl = svg => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Builds one `cursor:` declaration: image, hotspot, then a keyword fallback. */
export const cssCursor = (url, x, y, fallback) => `url("${String(url).replace(/"/g, '%22')}") ${x | 0} ${y | 0}, ${fallback}`;

/* ------------------------------------------------------------------------- *
 * Rasterization: browsers agree on PNG cursors, not on SVG ones.
 * ------------------------------------------------------------------------- */

const rasterCache = new Map();

function rasterize(svg) {
    if (rasterCache.has(svg))
        return rasterCache.get(svg);
    const job = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || 32;
                canvas.height = img.naturalHeight || 32;
                canvas.getContext('2d').drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            }
            catch (error) {
                reject(error);
            }
        };
        img.onerror = () => reject(new Error('cursor image failed to load'));
        img.src = svgDataUrl(svg);
    }).catch(() => svg);
    if (rasterCache.size >= 32)
        rasterCache.delete(rasterCache.keys().next().value);
    rasterCache.set(svg, job);
    return job;
}

/* ------------------------------------------------------------------------- *
 * Applying a scheme to the desktop through --cur-* custom properties.
 * ------------------------------------------------------------------------- */

let applyToken = 0;

export function applyCursorScheme(s, root) {
    const host = root || (typeof document !== 'undefined' ? document.documentElement : null);
    if (!host)
        return;
    const token = ++applyToken;
    const scheme = resolveScheme(s);
    const custom = s.settings.get('cursorCustom', null) || {};
    for (const role of POINTER_ROLES) {
        const property = `--cur-${role.id}`;
        const mine = custom[role.id];
        if (mine?.url) {
            host.style.setProperty(property, cssCursor(mine.url, mine.x, mine.y, role.fallback));
            continue;
        }
        const art = cursorArt(role.id, scheme);
        if (typeof Image === 'undefined') {
            // No browser image pipeline (tests): publish the SVG directly.
            host.style.setProperty(property, cssCursor(svgDataUrl(art.svg), art.x, art.y, role.fallback));
            continue;
        }
        rasterize(art.svg).then(png => {
            if (token === applyToken)
                host.style.setProperty(property, cssCursor(png, art.x, art.y, role.fallback));
        });
    }
}

/**
 * Starts the pointer scheme: applies the saved one and keeps it in step with
 * the settings. Apply/OK commits two keys back to back, so the reapply is
 * coalesced to one pass per turn of the event loop.
 */
export function installCursors(s) {
    applyCursorScheme(s);
    let queued = false;
    const change = event => {
        if (!['cursorScheme', 'cursorCustom'].includes(event.detail?.name) || queued)
            return;
        queued = true;
        queueMicrotask(() => {
            queued = false;
            applyCursorScheme(s);
        });
    };
    s.settings.addEventListener('change', change);
    return { apply: () => applyCursorScheme(s) };
}

/** The Busy cursor while the shell is busy (boot animation, shutdown). */
export function setPointerBusy(on) {
    document.body?.classList.toggle('busy-cursor', !!on);
}

/** HTML for one pointer-trail ghost: the current Normal Select cursor. */
export function trailGhost(s) {
    const custom = (s.settings.get('cursorCustom', null) || {}).normal;
    if (custom?.url)
        return `<img src="${String(custom.url).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" style="max-width:40px;max-height:40px" alt="">`;
    return cursorArt('normal', resolveScheme(s)).svg;
}

/* ------------------------------------------------------------------------- *
 * Cursor files. Browse… accepts real Windows .cur/.ico cursors (both PNG-
 * embedded and the classic BMP+AND-mask images), plain PNG/GIF/JPEG images
 * and SVG drawings. Everything comes back as one uniform entry:
 * { url, w, h, x, y, name } ready for cursorCustom and for the preview.
 * ------------------------------------------------------------------------- */

const readAscii = (view, offset, length) => String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + offset, length));
const isPng = bytes => bytes.byteLength >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
const isGif = bytes => bytes.byteLength >= 3 && readAscii({ buffer: bytes.buffer, byteOffset: bytes.byteOffset, byteLength: 3 }, 0, 3) === 'GIF';
const isJpeg = bytes => bytes.byteLength >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;

function imageSize(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (isPng(bytes) && bytes.byteLength >= 24)
        return { w: view.getUint32(16), h: view.getUint32(20) };
    if (isGif(bytes) && bytes.byteLength >= 10)
        return { w: view.getUint16(6, true), h: view.getUint16(8, true) };
    if (isJpeg(bytes)) {
        let at = 2;
        while (at + 9 < bytes.byteLength) {
            if (bytes[at] !== 0xff) { at++; continue; }
            const marker = bytes[at + 1];
            if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
                return { w: view.getUint16(at + 7), h: view.getUint16(at + 5) };
            at += 2 + view.getUint16(at + 2);
        }
    }
    return null;
}

/** Decodes a BMP cursor image (BITMAPINFOHEADER + XOR bitmap + AND mask). */
function decodeDib(image) {
    const view = new DataView(image.buffer, image.byteOffset, image.byteLength);
    const header = view.getUint32(0, true);
    if (header < 40)
        throw new Error('This cursor file uses an unsupported bitmap header.');
    const width = view.getInt32(4, true);
    const doubled = view.getInt32(8, true);
    const bpp = view.getUint16(12 + 2, true);
    const compression = view.getUint32(16, true);
    if (doubled === 0 || width <= 0)
        throw new Error('This cursor file has an invalid bitmap size.');
    const topDown = doubled < 0;
    const w = width;
    const h = Math.abs(doubled) / 2;
    const rgba = new Uint8ClampedArray(w * h * 4);
    const palette = [];
    let paletteBytes = 0;
    if (bpp <= 8) {
        // biClrUsed lies freely in the wild; never read past the image.
        const colors = Math.min(view.getUint32(32, true) || (1 << bpp), (image.byteLength - header) >> 2);
        paletteBytes = colors * 4;
        for (let i = 0; i < colors; i++)
            palette.push([view.getUint8(header + i * 4 + 2), view.getUint8(header + i * 4 + 1), view.getUint8(header + i * 4)]);
    }
    let masks = null;
    if (compression === 3)
        masks = [view.getUint32(header, true), view.getUint32(header + 4, true), view.getUint32(header + 8, true)];
    else if (compression !== 0)
        throw new Error('This cursor file uses a compressed bitmap.');
    // The XOR bitmap starts after the palette and the bitfield masks; the
    // AND mask follows it, both rows padded to four bytes.
    const xorAt = header + paletteBytes + (masks ? 12 : 0);
    const rowXor = ((w * bpp + 31) >> 5) * 4;
    const maskAt = xorAt + rowXor * h;
    const rowAnd = ((w + 31) >> 5) * 4;
    const channel = (value, mask) => {
        if (!mask)
            return 0;
        let shift = 0;
        while (!(mask >>> shift & 1)) shift++;
        const bitsCount = 32 - Math.clz32(mask >>> shift);
        return Math.round((value & mask) >>> shift) / ((1 << bitsCount) - 1) * 255 | 0;
    };
    const bits = (row, x) => {
        const at = xorAt + row * rowXor;
        if (bpp === 32) {
            const word = view.getUint32(at + x * 4, true);
            const a = view.getUint8(at + x * 4 + 3);
            if (masks)
                return [channel(word, masks[0]), channel(word, masks[1]), channel(word, masks[2]), a];
            return [word >> 16 & 255, word >> 8 & 255, word & 255, a];
        }
        if (bpp === 24) {
            const at24 = at + x * 3;
            return [view.getUint8(at24 + 2), view.getUint8(at24 + 1), view.getUint8(at24), 255];
        }
        if (bpp === 16) {
            const v = view.getUint16(at + x * 2, true);
            if (masks)
                return [channel(v, masks[0]), channel(v, masks[1]), channel(v, masks[2]), 255];
            return [(v & 31) * 255 / 31, (v >> 5 & 31) * 255 / 31, (v >> 10 & 31) * 255 / 31, 255];
        }
        const index = bpp === 8
            ? view.getUint8(at + x)
            : bpp === 4
                ? (view.getUint8(at + (x >> 1)) >> (x & 1 ? 0 : 4)) & 15
                : view.getUint8(at + (x >> 3)) >> (7 - (x & 7)) & 1;
        const rgb = palette[index] || [255, 255, 255];
        return [rgb[0], rgb[1], rgb[2], 255];
    };
    for (let y = 0; y < h; y++) {
        const srcRow = topDown ? y : h - 1 - y;
        for (let x = 0; x < w; x++) {
            const [r, g, b, a] = bits(srcRow, x);
            const out = (y * w + x) * 4;
            const andByte = view.getUint8(maskAt + srcRow * rowAnd + (x >> 3));
            const andBit = andByte >> (7 - (x & 7)) & 1;
            rgba[out] = r; rgba[out + 1] = g; rgba[out + 2] = b;
            rgba[out + 3] = a ? a : (andBit ? 0 : 255);
        }
    }
    return { w, h, rgba };
}

function parseCursorBuffer(buffer, name) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    if (bytes.byteLength > 6 && readAscii(view, 0, 4) === 'RIFF')
        throw new Error('Animated cursors (.ani) are not supported here. Save the cursor as a .cur or .png file and try again.');
    if (bytes.byteLength >= 6 && (view.getUint16(2, true) === 1 || view.getUint16(2, true) === 2) && view.getUint16(0, true) === 0) {
        const type = view.getUint16(2, true);
        const count = view.getUint16(4, true);
        if (count < 1 || bytes.byteLength < 6 + count * 16)
            throw new Error('This cursor file has no images.');
        let best = null;
        for (let i = 0; i < count; i++) {
            const at = 6 + i * 16;
            const w = view.getUint8(at) || 256, h = view.getUint8(at + 1) || 256;
            // Type 2 (.cur) stores the hotspot in the planes/bitcount pair;
            // type 1 (.ico) stores real plane counts, so icons get a centre.
            const x = type === 2 ? view.getUint16(at + 4, true) : w >> 1;
            const y = type === 2 ? view.getUint16(at + 6, true) : h >> 1;
            const size = view.getUint32(at + 8, true), offset = view.getUint32(at + 12, true);
            if (!best || w * h > best.w * best.h)
                best = { w, h, x, y, size, offset };
        }
        if (!best || best.offset + best.size > bytes.byteLength)
            throw new Error('This cursor file is truncated.');
        const image = bytes.subarray(best.offset, best.offset + best.size);
        if (isPng(image)) {
            const size = imageSize(image) || { w: best.w, h: best.h };
            return { url: `data:image/png;base64,${toBase64(image)}`, w: size.w, h: size.h, x: Math.min(best.x, size.w - 1), y: Math.min(best.y, size.h - 1), name };
        }
        let decoded;
        try {
            decoded = decodeDib(image);
        }
        catch (error) {
            if (error instanceof RangeError)
                throw new Error('This cursor file is truncated.');
            throw error;
        }
        return { decoded, x: best.x, y: best.y, name };
    }
    if (isPng(bytes) || isGif(bytes) || isJpeg(bytes)) {
        const size = imageSize(bytes);
        if (!size)
            throw new Error('This image file could not be read.');
        const mime = isPng(bytes) ? 'image/png' : isGif(bytes) ? 'image/gif' : 'image/jpeg';
        return { url: `data:${mime};base64,${toBase64(bytes)}`, w: size.w, h: size.h, x: Math.min(size.w >> 1, 127), y: Math.min(size.h >> 1, 127), name };
    }
    if (readAscii(view, 0, Math.min(5, bytes.byteLength)) === '<?xml' || readAscii(view, 0, Math.min(4, bytes.byteLength)) === '<sv' || /<svg[\s>]/i.test(String.fromCharCode(...bytes.subarray(0, 512))))
        return { svgText: new TextDecoder().decode(bytes), name };
    throw new Error('That file is not a cursor. Choose a .cur, .png, .gif, .jpg or .svg file.');
}

function toBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
}

/** Puts raw RGBA pixels through a canvas so every custom cursor is a PNG. */
function rgbaToPng(decoded) {
    if (typeof document === 'undefined')
        return null;
    const canvas = document.createElement('canvas');
    canvas.width = decoded.w;
    canvas.height = decoded.h;
    canvas.getContext('2d').putImageData(new ImageData(decoded.rgba, decoded.w, decoded.h), 0, 0);
    return canvas.toDataURL('image/png');
}

/** Measures or rasterizes plain images; caps the result at 128px. */
function normalizeImage(url, w, h) {
    if (typeof Image === 'undefined')
        return Promise.resolve(null);
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            try {
                if (!img.naturalWidth || !img.naturalHeight)
                    return resolve(null);
                let { width: iw, height: ih } = img;
                const canvas = document.createElement('canvas');
                const max = Math.max(iw, ih);
                if (max > 128) {
                    const k = 128 / max;
                    iw = Math.max(1, Math.round(iw * k));
                    ih = Math.max(1, Math.round(ih * k));
                }
                canvas.width = iw;
                canvas.height = ih;
                canvas.getContext('2d').drawImage(img, 0, 0, iw, ih);
                resolve({ url: canvas.toDataURL('image/png'), w: iw, h: ih });
            }
            catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

/**
 * Reads a picked cursor file into an entry for cursorCustom. Rejects with a
 * message ready for a message box.
 */
export async function parseCursorFile(file) {
    if (file.size > 300 * 1024)
        throw new Error('That file is larger than 300 KB. Cursor files are usually only a few kilobytes.');
    const buffer = await file.arrayBuffer();
    const parsed = parseCursorBuffer(buffer, file.name);
    if (parsed.svgText) {
        // A cursor image needs an intrinsic pixel size; derive one from the
        // viewBox when the drawing only carries percentages or nothing.
        let text = parsed.svgText;
        if (!/\bwidth="\d/.test(text)) {
            const box = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(text);
            const w = Math.min(128, Math.round(Number(box?.[1]) || 32));
            const h = Math.min(128, Math.round(Number(box?.[2]) || 32));
            text = text.replace(/<svg(\s+)/, `<svg width="${w}" height="${h}"$1`);
        }
        const dataUrl = svgDataUrl(text);
        const measured = await normalizeImage(dataUrl, 0, 0).catch(() => null);
        if (measured)
            return { ...measured, x: Math.min(measured.w >> 1, 127), y: Math.min(measured.h >> 1, 127), name: file.name };
        const size = /width="(\d+(?:\.\d+)?)/.exec(text);
        const w = Math.min(128, Math.round(Number(size?.[1]) || 32));
        return { url: dataUrl, w, h: w, x: w >> 1, y: w >> 1, name: file.name };
    }
    if (parsed.decoded) {
        const png = rgbaToPng(parsed.decoded);
        if (png)
            return { url: png, w: parsed.decoded.w, h: parsed.decoded.h, x: Math.min(parsed.x, parsed.decoded.w - 1, 127), y: Math.min(parsed.y, parsed.decoded.h - 1, 127), name: file.name };
        // No canvas (tests): hand back the raw pixels for the caller to keep.
        return { decoded: parsed.decoded, x: parsed.x, y: parsed.y, name: file.name };
    }
    const normalized = await normalizeImage(parsed.url, parsed.w, parsed.h);
    const image = normalized || parsed;
    // normalizeImage may have shrunk the bitmap, so the hotspot scales with it.
    const kx = image.w / parsed.w, ky = image.h / parsed.h;
    return {
        url: image.url,
        w: image.w,
        h: image.h,
        x: Math.min(Math.round(parsed.x * kx), image.w - 1, 127),
        y: Math.min(Math.round(parsed.y * ky), image.h - 1, 127),
        name: file.name
    };
}
