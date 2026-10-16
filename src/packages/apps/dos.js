import { el } from '@win95/ui/dom.js';
import { DosEngine } from '@win95/core/dos-engine.js';
import { normalizePath } from '@win95/core/filesystem.js';
export function dosPrompt(s, args = {}) {
    const w = s.wm.create({ title: 'MS-DOS Prompt', icon: 'dos', width: 665, height: 410 });
    w.body.classList.add('dos-body');
    const output = el('pre', { class: 'dos-output', text: 'Microsoft(R) Windows 95\n   (C)Copyright Microsoft Corp 1981-1995.\n\n' }), prompt = el('span'), input = el('input', { class: 'dos-input', spellcheck: false, autocomplete: 'off', 'aria-label': 'Command' }), line = el('form', { class: 'dos-line' }, prompt, input);
    w.body.append(output, line);
    const engine = new DosEngine(s.fs, { launch: (alias, params, cwd) => s.run(alias + (params?.length ? ' "' + (['notepad', 'wordpad', 'write', 'mspaint', 'pbrush', 'explorer'].includes(alias.toLowerCase()) ? normalizePath(params.join(' '), cwd) : params.join(' ')) + '"' : '')), open: path => s.open(path) });
    let history = [], historyIndex = 0, running = false;
    const update = () => { prompt.textContent = engine.prompt || engine.cwd + '>'; w.setTitle('MS-DOS Prompt'); w.body.scrollTop = w.body.scrollHeight; };
    line.onsubmit = async (e) => {
        e.preventDefault();
        if (running)
            return;
        const command = input.value;
        input.value = '';
        history.push(command);
        historyIndex = history.length;
        output.textContent += (engine.prompt || engine.cwd + '>') + command + '\n';
        running = true;
        input.disabled = true;
        try {
            const result = await engine.execute(command);
            if (result.clear)
                output.textContent = '';
            if (result.output)
                output.textContent += result.output + '\n';
            if (result.exit) {
                w.close();
                return;
            }
        }
        catch (err) {
            output.textContent += err.message + '\n';
        }
        finally {
            running = false;
            input.disabled = false;
            update();
            input.focus();
        }
    };
    input.onkeydown = e => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            historyIndex = Math.max(0, historyIndex - 1);
            input.value = history[historyIndex] || '';
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            historyIndex = Math.min(history.length, historyIndex + 1);
            input.value = history[historyIndex] || '';
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
            e.preventDefault();
            output.textContent += '^C\n';
            input.value = '';
            update();
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            const tokens = input.value.split(' '), prefix = tokens.at(-1);
            const matches = s.fs.list(engine.cwd).filter(n => n.path.split('\\').at(-1).toLowerCase().startsWith(prefix.toLowerCase()));
            if (matches.length === 1) {
                tokens[tokens.length - 1] = matches[0].path.split('\\').at(-1);
                input.value = tokens.join(' ');
            }
        }
    };
    w.body.addEventListener('click', () => {
        if (!window.getSelection()?.toString())
            input.focus();
    });
    w.onClosed.push(() => { running = false; });
    update();
    queueMicrotask(() => input.focus());
    if (args.fullscreen)
        w.maximize();
    return w;
}
