import { el, button, download, fileInput, onDoubleActivate } from '@win95/ui/dom.js';
import { menuBar } from '@win95/ui/menu.js';
import { baseName } from '@win95/core/filesystem.js';
import { RasterPresenter } from '@win95/graphics/renderer.js';
export async function paint(s, args = {}) {
    const w = s.wm.create({ title: 'untitled - Paint', icon: 'paint', width: 720, height: 510, x: args.x, y: args.y });
    let path = args.path || null, dirty = false, generation = 0, tool = 'pencil', foreground = '#000000', background = '#ffffff', lineWidth = 1, fillShape = false, zoom = 1, selection = null, clip = null, undo = [], redo = [], drawing = false, start = null, snapshot = null, last = null, polygon = [], curveLine = null;
    const source = document.createElement('canvas');
    source.width = 640;
    source.height = 360;
    let ctx = source.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, source.width, source.height);
    const workspace = el('div', { class: 'paint-workspace' }), tools = el('div', { class: 'paint-tools' }), surface = el('div', { class: 'paint-surface' }), visible = el('canvas', { 'aria-label': 'Paint drawing canvas', role: 'img' });
    surface.append(visible);
    workspace.append(tools, surface);
    const palette = el('div', { class: 'paint-palette' });
    const current = el('div', { class: 'paint-current' }, el('span', { class: 'background', style: { background } }), el('span', { class: 'foreground', style: { background: foreground } }));
    palette.append(current);
    w.body.append(workspace, palette);
    w.status('For Help, click Help Topics on the Help Menu.');
    const presenter = new RasterPresenter(visible, { backend: new URLSearchParams(location.search).get('renderer') || s.settings.get('renderer', 'auto') });
    w.onClosed.push(() => presenter.destroy());
    await presenter.init();
    if (w.closed) {
        presenter.destroy();
        return w;
    }
    let canvas = presenter.canvas;
    canvas.style.width = source.width + 'px';
    canvas.style.height = source.height + 'px';
    const render = () => {
        if (w.closed)
            return;
        presenter.present(source);
        canvas = presenter.canvas;
        canvas.style.width = source.width * zoom + 'px';
        canvas.style.height = source.height * zoom + 'px';
        current.querySelector('.foreground').style.background = foreground;
        current.querySelector('.background').style.background = background;
        w.setTitle(`${path ? baseName(path) : 'untitled'} - Paint`);
    };
    const state = () => ({ width: source.width, height: source.height, data: ctx.getImageData(0, 0, source.width, source.height) });
    const checkpoint = () => {
        undo.push(state());
        if (undo.length > 24)
            undo.shift();
        redo = [];
    };
    const restore = x => { source.width = x.width; source.height = x.height; ctx = source.getContext('2d', { willReadFrequently: true }); ctx.putImageData(x.data, 0, 0); selection = null; render(); };
    const undoAction = () => {
        if (!undo.length)
            return;
        redo.push(state());
        restore(undo.pop());
        dirty = true;
    };
    const redoAction = () => {
        if (!redo.length)
            return;
        undo.push(state());
        restore(redo.pop());
        dirty = true;
    };
    const save = async (as = false) => {
        let next = path;
        if (as || !next)
            next = await s.ui.file({ save: true, name: path ? baseName(path) : 'untitled.png', extension: '.png', type: 'PNG Image (*.png)', owner: w });
        if (!next)
            return false;
        try {
            const savedGeneration = generation;
            const savedImage = source.toDataURL('image/png');
            s.fs.write(next, savedImage, 'image/png');
            await s.fs.flush();
            if (generation !== savedGeneration || w.closed)
                return false;
            path = next;
            dirty = source.toDataURL('image/png') !== savedImage;
            render();
            s.recent(path);
            return !dirty;
        }
        catch (e) {
            s.ui.error(e, w);
            return false;
        }
    };
    const confirm = async () => {
        if (!dirty)
            return true;
        const r = await s.ui.message('Save changes to ' + (path ? baseName(path) : 'untitled') + '?', 'Paint', ['Yes', 'No', 'Cancel'], { owner: w });
        return r === 'Yes' ? save() : r === 'No';
    };
    const loadImage = async (data, newPath = null) => {
        const img = new Image();
        img.src = data;
        await img.decode();
        if (img.width > 4096 || img.height > 4096)
            throw new Error('Images can be up to 4096 × 4096 pixels.');
        generation++;
        source.width = img.width;
        source.height = img.height;
        ctx = source.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, source.width, source.height);
        ctx.drawImage(img, 0, 0);
        path = newPath;
        undo = [];
        redo = [];
        dirty = !newPath;
        render();
    };
    const open = async () => {
        if (!await confirm())
            return;
        const p = await s.ui.file({ owner: w, type: 'Image Files (*.png, *.bmp, *.jpg)' });
        if (p)
            try {
                await loadImage(s.fs.read(p), p);
            }
            catch (e) {
                s.ui.error(new Error('Paint cannot read this image. Try a PNG, BMP, JPEG, or GIF file.'), w);
            }
    };
    const fresh = async () => {
        if (!await confirm())
            return;
        generation++;
        checkpoint();
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, source.width, source.height);
        path = null;
        dirty = false;
        selection = null;
        render();
    };
    const choose = t => {
        if (t !== tool) {
            /* Drafts belong to their tool: a stale curve snapshot would restore
               the whole canvas on the next curve click and erase everything
               drawn since, and a stale polygon would connect to its old last
               point. What is already drawn stays drawn. */
            curveLine = null;
            polygon = [];
        }
        tool = t;
        tools.querySelectorAll('[data-tool]').forEach(n => n.classList.toggle('selected', n.dataset.tool === t)); w.status(({ select: 'Select a rectangular area of the picture.', pencil: 'Draws a free-form line one pixel wide.', fill: 'Fills an area with the selected color.', text: 'Click the picture to insert text.', polygon: 'Click to add points. Double-click to complete the polygon.', curve: 'Drag a line, then click to set the curve.' })[t] || `Draw with the ${t} tool.`); };
    const definitions = [['select', '⬚', 'Select'], ['freeSelect', '♧', 'Free-form select'], ['eraser', '▱', 'Eraser'], ['fill', '◩', 'Fill with color'], ['picker', '⌁', 'Pick color'], ['magnifier', '⌕', 'Magnifier'], ['pencil', '╱', 'Pencil'], ['brush', '▰', 'Brush'], ['spray', '⁙', 'Airbrush'], ['text', 'A', 'Text'], ['line', '╲', 'Line'], ['curve', '∿', 'Curve'], ['rectangle', '□', 'Rectangle'], ['polygon', '⬠', 'Polygon'], ['ellipse', '○', 'Ellipse'], ['roundrect', '▢', 'Rounded rectangle']];
    for (const [t, label, title] of definitions)
        tools.append(button(label, () => choose(t), { title, 'aria-label': title, 'data-tool': t, class: t === tool ? 'selected' : '' }));
    const options = el('div', { class: 'paint-tool-options' }, ...['1', '3', '5', '8'].map(n => button('━', () => lineWidth = Number(n), { title: `Line width ${n}`, style: { fontSize: (+n + 7) + 'px' } })), button('▣', () => { fillShape = !fillShape; options.lastChild.classList.toggle('pressed', fillShape); }, { title: 'Filled shapes' }));
    tools.append(options);
    const colors = ['#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000', '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040'];
    const swatches = el('div', { class: 'paint-colors' });
    for (const color of colors) {
        const b = button('', () => { foreground = color; render(); }, { style: { background: color }, title: color, 'aria-label': 'Color ' + color });
        b.oncontextmenu = e => { e.preventDefault(); background = color; render(); };
        swatches.append(b);
    }
    palette.append(swatches, el('input', { type: 'color', value: foreground, title: 'Edit colors', 'aria-label': 'Custom color', oninput: e => { foreground = e.target.value; render(); } }));
    const pos = e => { canvas = presenter.canvas; const r = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(source.width - 1, Math.floor((e.clientX - r.left) / zoom))), y: Math.max(0, Math.min(source.height - 1, Math.floor((e.clientY - r.top) / zoom))) }; };
    const stroke = (a, b, color = foreground, width = lineWidth) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = tool === 'brush' ? 'round' : 'square'; ctx.beginPath(); ctx.moveTo(a.x + .5, a.y + .5); ctx.lineTo(b.x + .5, b.y + .5); ctx.stroke(); };
    const flood = (x, y, color) => {
        const im = ctx.getImageData(0, 0, source.width, source.height), d = im.data, W = im.width, H = im.height, i = (y * W + x) * 4, old = [d[i], d[i + 1], d[i + 2], d[i + 3]], rgb = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16), 255];
        if (old.every((v, j) => v === rgb[j]))
            return;
        const matches = n => d[n] === old[0] && d[n + 1] === old[1] && d[n + 2] === old[2] && d[n + 3] === old[3], stack = [y * W + x];
        while (stack.length) {
            const p = stack.pop(), ix = p * 4;
            if (!matches(ix))
                continue;
            d.set(rgb, ix);
            const xx = p % W, yy = Math.floor(p / W);
            if (xx > 0)
                stack.push(p - 1);
            if (xx < W - 1)
                stack.push(p + 1);
            if (yy > 0)
                stack.push(p - W);
            if (yy < H - 1)
                stack.push(p + W);
        }
        ctx.putImageData(im, 0, 0);
    };
    const shape = (a, b) => {
        ctx.strokeStyle = foreground;
        ctx.fillStyle = fillShape ? foreground : background;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([]);
        const x = Math.min(a.x, b.x) + .5, y = Math.min(a.y, b.y) + .5, width = Math.abs(a.x - b.x), height = Math.abs(a.y - b.y);
        ctx.beginPath();
        if (tool === 'line' || tool === 'curve') {
            ctx.moveTo(a.x + .5, a.y + .5);
            ctx.lineTo(b.x + .5, b.y + .5);
        }
        else if (tool === 'ellipse')
            ctx.ellipse(x + width / 2, y + height / 2, Math.max(.5, width / 2), Math.max(.5, height / 2), 0, 0, Math.PI * 2);
        else if (tool === 'roundrect')
            ctx.roundRect(x, y, width, height, Math.min(12, width / 2, height / 2));
        else if (tool === 'select' || tool === 'freeSelect') {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.rect(x, y, width, height);
        }
        else
            ctx.rect(x, y, width, height);
        if (fillShape && !['line', 'curve', 'select', 'freeSelect'].includes(tool))
            ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
    };
    surface.oncontextmenu = e => e.preventDefault();
    surface.addEventListener('pointerdown', async (e) => {
        if (e.target !== presenter.canvas)
            return;
        if (e.button !== 0 && e.button !== 2)
            return;
        e.preventDefault();
        const p = pos(e);
        start = p;
        last = p;
        if (tool === 'picker') {
            const d = ctx.getImageData(p.x, p.y, 1, 1).data;
            foreground = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
            render();
            choose('pencil');
            return;
        }
        if (tool === 'magnifier') {
            zoom = zoom === 1 ? 2 : zoom === 2 ? 4 : 1;
            render();
            return;
        }
        if (tool === 'text') {
            const text = await s.ui.prompt('Text:', '', 'Text', { owner: w });
            if (text) {
                checkpoint();
                ctx.font = `${Math.max(14, lineWidth * 5)}px Arial`;
                ctx.fillStyle = foreground;
                ctx.fillText(text, p.x, p.y + 16);
                dirty = true;
                render();
            }
            return;
        }
        if (tool === 'polygon') {
            if (!polygon.length)
                checkpoint();
            else
                stroke(polygon.at(-1), p);
            polygon.push(p);
            dirty = true;
            render();
            return;
        }
        if (tool === 'curve' && curveLine) {
            checkpoint();
            ctx.putImageData(curveLine.snapshot, 0, 0);
            ctx.strokeStyle = foreground;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.moveTo(curveLine.a.x, curveLine.a.y);
            ctx.quadraticCurveTo(p.x, p.y, curveLine.b.x, curveLine.b.y);
            ctx.stroke();
            curveLine = null;
            dirty = true;
            render();
            return;
        }
        checkpoint();
        snapshot = ctx.getImageData(0, 0, source.width, source.height);
        if (tool === 'fill') {
            flood(p.x, p.y, e.button === 2 ? background : foreground);
            dirty = true;
            render();
            return;
        }
        drawing = true;
        try {
            canvas.setPointerCapture(e.pointerId);
        }
        catch { }
        if (['pencil', 'brush', 'eraser'].includes(tool)) {
            const width = tool === 'eraser' ? Math.max(8, lineWidth * 3) : tool === 'brush' ? Math.max(3, lineWidth * 2) : lineWidth;
            ctx.fillStyle = tool === 'eraser' ? background : foreground;
            ctx.fillRect(p.x - Math.floor(width / 2), p.y - Math.floor(width / 2), width, width);
            render();
        }
    });
    surface.addEventListener('pointermove', e => {
        const p = pos(e);
        w.status(`${tool[0].toUpperCase() + tool.slice(1)}     ${p.x}, ${p.y} px     ${source.width} × ${source.height} px`);
        if (!drawing)
            return;
        if (!(e.buttons & 3)) {
            /* Heal a stroke whose pointer went up without an event (capture
               lost): finish instead of painting buttonless. */
            finish(e);
            return;
        }
        if (['pencil', 'brush', 'eraser'].includes(tool)) {
            stroke(last, p, tool === 'eraser' ? background : foreground, tool === 'eraser' ? Math.max(8, lineWidth * 3) : tool === 'brush' ? Math.max(3, lineWidth * 2) : lineWidth);
        }
        else if (tool === 'spray') {
            ctx.fillStyle = foreground;
            for (let i = 0; i < 30; i++) {
                const a = Math.random() * Math.PI * 2, r = Math.random() * (lineWidth * 3 + 7);
                ctx.fillRect(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 1, 1);
            }
        }
        else {
            ctx.putImageData(snapshot, 0, 0);
            shape(start, p);
        }
        last = p;
        dirty = true;
        render();
    });
    const finish = e => {
        if (!drawing)
            return;
        drawing = false;
        const p = pos(e);
        if (tool === 'select' || tool === 'freeSelect') {
            ctx.putImageData(snapshot, 0, 0);
            selection = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), width: Math.max(1, Math.abs(p.x - start.x)), height: Math.max(1, Math.abs(p.y - start.y)) };
            w.status(`Selected area: ${selection.width} × ${selection.height} pixels. Use Edit to copy or cut.`);
        }
        else if (tool === 'curve')
            curveLine = { a: start, b: p, snapshot };
        dirty = true;
        try {
            canvas.releasePointerCapture(e.pointerId);
        }
        catch { }
        render();
    };
    surface.addEventListener('pointerup', finish);
    surface.addEventListener('pointercancel', finish);
    surface.addEventListener('lostpointercapture', finish);
    onDoubleActivate(surface, () => {
        if (tool === 'polygon' && polygon.length > 1) {
            stroke(polygon.at(-1), polygon[0]);
            if (fillShape) {
                ctx.fillStyle = foreground;
                ctx.beginPath();
                polygon.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
                ctx.closePath();
                ctx.fill();
            }
            polygon = [];
            render();
        }
    });
    const copySelection = cut => {
        const r = selection || { x: 0, y: 0, width: source.width, height: source.height };
        clip = ctx.getImageData(r.x, r.y, r.width, r.height);
        s.imageClipboard = clip;
        if (cut) {
            checkpoint();
            ctx.fillStyle = background;
            ctx.fillRect(r.x, r.y, r.width, r.height);
            dirty = true;
            render();
        }
    };
    const pasteSelection = () => {
        clip = s.imageClipboard || clip;
        if (clip) {
            checkpoint();
            ctx.putImageData(clip, selection?.x || 0, selection?.y || 0);
            dirty = true;
            render();
        }
    };
    const transform = mode => {
        checkpoint();
        const tmp = document.createElement('canvas');
        tmp.width = source.width;
        tmp.height = source.height;
        tmp.getContext('2d').drawImage(source, 0, 0);
        if (mode === 'rotate') {
            source.width = tmp.height;
            source.height = tmp.width;
            ctx.translate(source.width, 0);
            ctx.rotate(Math.PI / 2);
        }
        else if (mode === 'horizontal') {
            ctx.translate(source.width, 0);
            ctx.scale(-1, 1);
        }
        else {
            ctx.translate(0, source.height);
            ctx.scale(1, -1);
        }
        ctx.drawImage(tmp, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        dirty = true;
        render();
    };
    const resize = async () => {
        const value = await s.ui.prompt('Width × height (pixels):', `${source.width} x ${source.height}`, 'Attributes', { owner: w });
        if (!value)
            return;
        const [width, height] = value.split(/\D+/).map(Number);
        if (!width || !height || width > 4096 || height > 4096) {
            s.ui.message('Enter a width and height between 1 and 4096.', 'Paint', ['OK'], { owner: w });
            return;
        }
        checkpoint();
        const old = state();
        source.width = width;
        source.height = height;
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
        ctx.putImageData(old.data, 0, 0);
        dirty = true;
        render();
    };
    const selectAll = () => { selection = { x: 0, y: 0, width: source.width, height: source.height }; choose('select'); w.status('The entire picture is selected.'); };
    w.setMenu(menuBar([{ label: 'File', items: [{ label: 'New', shortcut: 'Ctrl+N', action: fresh }, { label: 'Open…', shortcut: 'Ctrl+O', action: open }, { label: 'Save', shortcut: 'Ctrl+S', action: () => save() }, { label: 'Save As…', action: () => save(true) }, null, { label: 'From File…', action: () => fileInput('image/*', async (f) => {
                        if (await confirm()) {
                            const data = await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(f); });
                            try {
                                await loadImage(data);
                            }
                            catch (e) {
                                s.ui.error(e, w);
                            }
                        }
                    }) }, { label: 'Export PNG…', action: () => download(path ? baseName(path) : 'untitled.png', source.toDataURL()) }, { label: 'Set As Wallpaper', action: () => s.settings.set('wallpaper', source.toDataURL()) }, null, { label: 'Exit', action: () => w.close() }] }, { label: 'Edit', items: () => [{ label: 'Undo', shortcut: 'Ctrl+Z', disabled: !undo.length, action: undoAction }, { label: 'Repeat', shortcut: 'Ctrl+Y', disabled: !redo.length, action: redoAction }, null, { label: 'Cut', shortcut: 'Ctrl+X', action: () => copySelection(true) }, { label: 'Copy', shortcut: 'Ctrl+C', action: () => copySelection(false) }, { label: 'Paste', shortcut: 'Ctrl+V', disabled: !s.imageClipboard, action: pasteSelection }, { label: 'Clear Selection', shortcut: 'Del', action: () => {
                        if (selection) {
                            checkpoint();
                            ctx.fillStyle = background;
                            ctx.fillRect(selection.x, selection.y, selection.width, selection.height);
                            dirty = true;
                            render();
                        }
                    } }, { label: 'Select All', shortcut: 'Ctrl+A', action: selectAll }] }, { label: 'View', items: () => [{ label: 'Tool Box', checked: !tools.hidden, action: () => tools.hidden = !tools.hidden }, { label: 'Color Box', checked: !palette.hidden, action: () => palette.hidden = !palette.hidden }, null, { label: 'Zoom', items: [1, 2, 4, 8].map(n => ({ label: n * 100 + '%', checked: zoom === n, action: () => { zoom = n; render(); } })) }] }, { label: 'Image', items: [{ label: 'Flip Horizontal', action: () => transform('horizontal') }, { label: 'Flip Vertical', action: () => transform('vertical') }, { label: 'Rotate 90°', action: () => transform('rotate') }, { label: 'Invert Colors', shortcut: 'Ctrl+I', action: async () => {
                        checkpoint();
                        try {
                            const image = await presenter.invert(ctx.getImageData(0, 0, source.width, source.height));
                            ctx.putImageData(image, 0, 0);
                            dirty = true;
                            render();
                        }
                        catch (e) {
                            s.ui.error(e, w);
                        }
                    } }, { label: 'Attributes…', action: resize }, { label: 'Clear Image', action: () => { checkpoint(); ctx.fillStyle = background; ctx.fillRect(0, 0, source.width, source.height); dirty = true; render(); } }] }, { label: 'Colors', items: [{ label: 'Edit Colors…', action: () => palette.querySelector('input[type=color]').click() }] }, { label: 'Help', items: [{ label: 'Help Topics', action: () => s.launch('help', { topic: 'paint' }) }, { label: 'About Paint', action: () => s.about('Paint', 'paint') }] }]));
    w.element.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && ['s', 'o', 'n', 'z', 'y', 'c', 'x', 'v', 'a'].includes(e.key.toLowerCase())) {
            e.preventDefault();
            ({ s: () => save(e.shiftKey), o: open, n: fresh, z: undoAction, y: redoAction, c: () => copySelection(false), x: () => copySelection(true), v: pasteSelection, a: selectAll })[e.key.toLowerCase()]();
        }
    });
    w.onClose = confirm;
    presenter.onBackendChange = () => { canvas = presenter.canvas; drawing = false; render(); };
    if (path)
        try {
            await loadImage(s.fs.read(path), path);
        }
        catch (e) {
            s.ui.error(new Error('Paint could not open this image.'), w);
        }
    render();
    return w;
}
