/** Event-driven raster presentation. WebGPU -> WebGL2 -> Canvas2D. No idle render loop. */
export class RasterPresenter {
    constructor(canvas, { backend = 'auto' } = {}) { this.canvas = canvas; this.preferred = backend; this.backend = 'initializing'; this.device = null; this.destroyed = false; this.pending = null; this.errors = []; }
    async init() {
        if (this.preferred === 'auto' || this.preferred === 'webgpu') {
            try {
                if (!navigator.gpu)
                    throw new Error('WebGPU is unavailable');
                const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
                if (!adapter)
                    throw new Error('No WebGPU adapter');
                this.device = await adapter.requestDevice();
                this.context = this.canvas.getContext('webgpu');
                if (!this.context)
                    throw new Error('WebGPU canvas context is unavailable');
                this.format = navigator.gpu.getPreferredCanvasFormat();
                this.context.configure({ device: this.device, format: this.format, alphaMode: 'opaque' });
                const shader = this.device.createShaderModule({ code: `@group(0) @binding(0) var smp: sampler; @group(0) @binding(1) var tex: texture_2d<f32>; struct Out { @builtin(position) pos:vec4f, @location(0) uv:vec2f }; @vertex fn vs(@builtin(vertex_index) i:u32)->Out {var p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));var o:Out;o.pos=vec4f(p[i],0,1);o.uv=vec2f((p[i].x+1)*0.5,1-(p[i].y+1)*0.5);return o;} @fragment fn fs(in:Out)->@location(0) vec4f{return textureSample(tex,smp,in.uv);}` });
                this.pipeline = this.device.createRenderPipeline({ layout: 'auto', vertex: { module: shader, entryPoint: 'vs' }, fragment: { module: shader, entryPoint: 'fs', targets: [{ format: this.format }] }, primitive: { topology: 'triangle-list' } });
                this.sampler = this.device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });
                this.backend = 'WebGPU';
                this.device.lost.then(info => {
                    if (this.destroyed)
                        return;
                    this.errors.push(info.message);
                    this.recover();
                });
                return this;
            }
            catch (e) {
                this.errors.push(e.message);
                this.device?.destroy();
                this.device = null;
            }
        }
        return this.initFallback();
    }
    freshCanvas() { const old = this.canvas, newCanvas = old.cloneNode(false); newCanvas.width = old.width; newCanvas.height = old.height; old.replaceWith(newCanvas); this.canvas = newCanvas; return newCanvas; }
    initFallback() {
        if (this.context) {
            this.context.unconfigure?.();
            this.context = null;
            this.freshCanvas();
        }
        if (this.preferred !== 'canvas2d') {
            try {
                const gl = this.canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true });
                if (gl) {
                    const shader = (type, source) => {
                        const s = gl.createShader(type);
                        gl.shaderSource(s, source);
                        gl.compileShader(s);
                        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
                            throw new Error(gl.getShaderInfoLog(s));
                        return s;
                    };
                    const program = gl.createProgram();
                    gl.attachShader(program, shader(gl.VERTEX_SHADER, '#version 300 es\nprecision highp float;out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=vec2(p.x,1.0-p.y);gl_Position=vec4(p*2.0-1.0,0,1);}'));
                    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;in vec2 uv;uniform sampler2D image;out vec4 color;void main(){color=texture(image,uv);}'));
                    gl.linkProgram(program);
                    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
                        throw new Error(gl.getProgramInfoLog(program));
                    gl.useProgram(program);
                    this.gl = gl;
                    this.program = program;
                    this.glTexture = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    this.backend = 'WebGL2';
                    this.canvas.addEventListener('webglcontextlost', e => {
                        e.preventDefault();
                        if (!this.destroyed) {
                            this.gl = null;
                            this.freshCanvas();
                            this.ctx = this.canvas.getContext('2d', { alpha: false });
                            this.backend = 'Canvas 2D';
                            if (this.source)
                                this.present(this.source);
                            this.onBackendChange?.();
                        }
                    });
                    return this;
                }
            }
            catch (e) {
                this.errors.push(e.message);
                this.freshCanvas();
            }
        }
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.backend = 'Canvas 2D';
        return this;
    }
    recover() {
        this.texture?.destroy();
        this.texture = null;
        this.textureSize = null;
        this.context?.unconfigure();
        this.context = null;
        this.device = null;
        this.freshCanvas();
        this.initFallback();
        if (this.source)
            this.present(this.source);
        this.onBackendChange?.();
    }
    present(source) {
        if (this.destroyed)
            return;
        this.source = source;
        if (this.canvas.width !== source.width)
            this.canvas.width = source.width;
        if (this.canvas.height !== source.height)
            this.canvas.height = source.height;
        if (this.backend === 'WebGPU') {
            try {
                const device = this.device;
                const size = `${source.width}x${source.height}`;
                if (size !== this.textureSize) {
                    this.texture?.destroy();
                    this.texture = device.createTexture({ size: [source.width, source.height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
                    this.textureSize = size;
                    this.bindGroup = device.createBindGroup({ layout: this.pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: this.sampler }, { binding: 1, resource: this.texture.createView() }] });
                }
                device.queue.copyExternalImageToTexture({ source }, { texture: this.texture }, [source.width, source.height]);
                const encoder = device.createCommandEncoder();
                const pass = encoder.beginRenderPass({ colorAttachments: [{ view: this.context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
                pass.setPipeline(this.pipeline);
                pass.setBindGroup(0, this.bindGroup);
                pass.draw(3);
                pass.end();
                device.queue.submit([encoder.finish()]);
            }
            catch (e) {
                this.errors.push(e.message);
                this.recover();
            }
        }
        else if (this.gl) {
            const gl = this.gl;
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        else
            this.ctx?.drawImage(source, 0, 0);
    }
    async invert(imageData) {
        if (this.backend !== 'WebGPU') {
            const data = new Uint8ClampedArray(imageData.data);
            for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i];
                data[i + 1] = 255 - data[i + 1];
                data[i + 2] = 255 - data[i + 2];
            }
            return new ImageData(data, imageData.width, imageData.height);
        }
        const device = this.device, bytes = imageData.data.byteLength;
        const input = device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
        const read = device.createBuffer({ size: bytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        try {
            device.queue.writeBuffer(input, 0, imageData.data);
            const shader = device.createShaderModule({ code: '@group(0) @binding(0) var<storage,read_write> pixels:array<u32>; @compute @workgroup_size(256) fn main(@builtin(global_invocation_id) id:vec3u){if(id.x<arrayLength(&pixels)){pixels[id.x]=pixels[id.x]^0x00ffffffu;}}' });
            const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module: shader, entryPoint: 'main' } });
            const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: input } }] });
            const encoder = device.createCommandEncoder();
            const pass = encoder.beginComputePass();
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bind);
            pass.dispatchWorkgroups(Math.ceil(bytes / 4 / 256));
            pass.end();
            encoder.copyBufferToBuffer(input, 0, read, 0, bytes);
            device.queue.submit([encoder.finish()]);
            await read.mapAsync(GPUMapMode.READ);
            const result = new Uint8ClampedArray(read.getMappedRange().slice(0));
            read.unmap();
            return new ImageData(result, imageData.width, imageData.height);
        }
        finally {
            input.destroy();
            read.destroy();
        }
    }
    destroy() { this.destroyed = true; this.texture?.destroy(); this.device?.destroy(); this.gl?.deleteTexture(this.glTexture); this.gl?.deleteProgram(this.program); this.gl?.getExtension('WEBGL_lose_context')?.loseContext(); }
}
export class DesktopGraphics {
    constructor(s) { this.system = s; this.source = document.createElement('canvas'); this.presenter = new RasterPresenter(document.querySelector('#desktop-graphics'), { backend: new URLSearchParams(location.search).get('renderer') || s.settings.get('renderer', 'auto') }); this.frame = 0; }
    async init() {
        await this.presenter.init();
        this.render();
        this.resize = () => {
            if (!this.frame)
                this.frame = requestAnimationFrame(() => { this.frame = 0; this.render(); });
        };
        window.addEventListener('resize', this.resize);
        this.system.settings.addEventListener('change', () => this.render());
        return this;
    }
    render() {
        const s = this.system;
        this.source.width = Math.max(1, innerWidth);
        this.source.height = Math.max(1, innerHeight - 30);
        const ctx = this.source.getContext('2d');
        const bg = s.settings.get('desktopColor', '#008080'), pattern = s.settings.get('wallpaper', 'None');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, this.source.width, this.source.height);
        if (pattern === 'Clouds') {
            for (let y = 0; y < this.source.height; y += 8)
                for (let x = 0; x < this.source.width; x += 8) {
                    const v = Math.sin(x * .018) + Math.cos(y * .02) + Math.sin((x + y) * .011);
                    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, (v + .1) * .13)})`;
                    ctx.fillRect(x, y, 8, 8);
                }
        }
        else if (pattern === 'Bricks') {
            ctx.strokeStyle = '#004040';
            ctx.lineWidth = 1;
            for (let y = 0; y < this.source.height; y += 16) {
                ctx.beginPath();
                ctx.moveTo(0, y + .5);
                ctx.lineTo(this.source.width, y + .5);
                ctx.stroke();
                for (let x = (y % 32 ? 16 : 0); x < this.source.width; x += 32) {
                    ctx.beginPath();
                    ctx.moveTo(x + .5, y);
                    ctx.lineTo(x + .5, y + 16);
                    ctx.stroke();
                }
            }
        }
        else if (pattern === 'Weave') {
            ctx.fillStyle = '#004040';
            for (let y = 0; y < this.source.height; y += 4)
                for (let x = (y % 8 ? 2 : 0); x < this.source.width; x += 4)
                    ctx.fillRect(x, y, 2, 2);
        }
        else if (pattern === 'Tiles') {
            for (let y = 0; y < this.source.height; y += 32)
                for (let x = 0; x < this.source.width; x += 32) {
                    ctx.fillStyle = (x + y) % 64 ? '#008080' : '#006060';
                    ctx.fillRect(x, y, 32, 32);
                    ctx.strokeStyle = '#409090';
                    ctx.strokeRect(x + .5, y + .5, 31, 31);
                }
        }
        else if (pattern.startsWith('data:')) {
            const img = new Image();
            img.onload = () => { ctx.drawImage(img, Math.max(0, (this.source.width - img.width) / 2), Math.max(0, (this.source.height - img.height) / 2)); this.presenter.present(this.source); };
            img.src = pattern;
        }
        this.presenter.present(this.source);
        document.documentElement.style.setProperty('--desktop', bg);
    }
    async screensaver(kind = 'Mystify') {
        const canvas = document.createElement('canvas');
        canvas.className = 'screensaver';
        document.body.append(canvas);
        const source = document.createElement('canvas');
        source.width = innerWidth;
        source.height = innerHeight;
        const ctx = source.getContext('2d');
        const render = new RasterPresenter(canvas);
        await render.init();
        let frame = 0, time = 0, last = 0, stopped = false;
        const points = Array.from({ length: 8 }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, vx: (Math.random() > .5 ? 1 : -1) * (1.4 + Math.random() * 2), vy: (Math.random() > .5 ? 1 : -1) * (1.4 + Math.random() * 2) }));
        const stars = Array.from({ length: 200 }, () => ({ x: (Math.random() - .5) * innerWidth, y: (Math.random() - .5) * innerHeight, z: Math.random() * innerWidth }));
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, source.width, source.height);
        const tick = now => {
            if (stopped)
                return;
            if (now - last < 30) {
                frame = requestAnimationFrame(tick);
                return;
            }
            last = now;
            time++;
            ctx.fillStyle = kind === 'Mystify' ? 'rgba(0,0,0,.11)' : '#000';
            ctx.fillRect(0, 0, source.width, source.height);
            if (kind === 'Starfield') {
                ctx.fillStyle = '#fff';
                for (const star of stars) {
                    star.z -= 8;
                    if (star.z < 1)
                        star.z = innerWidth;
                    const x = star.x / star.z * innerWidth + innerWidth / 2, y = star.y / star.z * innerWidth + innerHeight / 2, k = Math.max(1, 3 - star.z / innerWidth * 3);
                    ctx.fillRect(x, y, k, k);
                }
            }
            else if (kind === 'Marquee') {
                ctx.fillStyle = '#c0c0c0';
                ctx.font = 'bold 50px Tahoma, "WenQuanYi Bitmap Song 12px", Arial';
                ctx.fillText(safeSaverText(this.system.settings.get('saverText', 'Windows 95')), innerWidth - (time * 3) % (innerWidth + 500), innerHeight / 2);
            }
            else {
                for (const p of points) {
                    p.x += p.vx;
                    p.y += p.vy;
                    if (p.x < 0 || p.x > innerWidth)
                        p.vx *= -1;
                    if (p.y < 0 || p.y > innerHeight)
                        p.vy *= -1;
                }
                for (let i = 0; i < 2; i++) {
                    ctx.strokeStyle = i ? '#00ffff' : '#ff00ff';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    points.slice(i * 4, i * 4 + 4).forEach((p, j) => j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
                    ctx.closePath();
                    ctx.stroke();
                }
            }
            render.present(source);
            frame = requestAnimationFrame(tick);
        };
        const stop = () => { stopped = true; cancelAnimationFrame(frame); render.destroy(); render.canvas.remove(); document.removeEventListener('keydown', stop); document.removeEventListener('pointerdown', stop); document.removeEventListener('pointermove', stop); };
        document.addEventListener('keydown', stop);
        document.addEventListener('pointerdown', stop);
        setTimeout(() => {
            if (!stopped)
                document.addEventListener('pointermove', stop);
        }, 500);
        frame = requestAnimationFrame(tick);
        return stop;
    }
}
const safeSaverText = t => String(t).slice(0, 100);
