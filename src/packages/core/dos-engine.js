/* Browser-backed DOS command interpreter. This is not x86 / native binary emulation. */
const HELP = {
    DIR: 'DIR [drive:][path][pattern] [/W] [/B] [/S] [/A]  Lists real files.',
    CD: 'CD [path]  Changes or displays the current directory. CHDIR is an alias.',
    CLS: 'CLS  Clears the command window.',
    ECHO: 'ECHO [ON|OFF|message]  Displays text or changes batch command echo.',
    TYPE: 'TYPE filename [...]  Displays text files.',
    COPY: 'COPY [/Y] source destination  Copies files; /Y permits replacement.',
    MOVE: 'MOVE [/Y] source destination  Moves files or directories.',
    REN: 'REN source new-name  Renames files or directories. RENAME is an alias.',
    DEL: 'DEL [/F] [/S] [/Q] filename [...]  Deletes files. ERASE is an alias.',
    MD: 'MD path [...]  Creates directories. MKDIR is an alias.',
    RD: 'RD [/S] [/Q] path [...]  Removes directories; /S includes contents.',
    SET: 'SET [name=[value]]  Displays, sets or removes environment variables.',
    PATH: 'PATH [directory[;directory...]]  Displays or sets the program search path.',
    PROMPT: 'PROMPT [text]  Sets the prompt; $P=path, $G=>, $T=time, $D=date.',
    VER: 'VER  Shows the interpreter version and its emulation boundary.',
    VOL: 'VOL [drive:]  Displays the virtual volume label.',
    DATE: 'DATE [/T] [MM-DD-YYYY]  Displays or sets the session date.',
    TIME: 'TIME [/T] [HH:MM[:SS] [AM|PM]]  Displays or sets the session time.',
    TREE: 'TREE [path] [/F] [/A]  Shows directories; /F includes files.',
    HELP: 'HELP [command]  Displays command help.',
    MEM: 'MEM  Reports actual virtual file storage and available browser heap data.',
    ATTRIB: 'ATTRIB [+R|-R] [+A|-A] [+S|-S] [+H|-H] [pattern] [/S] [/D]',
    CHKDSK: 'CHKDSK [path]  Scans the real virtual filesystem for errors.',
    FIND: 'FIND [/I] [/V] [/C] [/N] "text" file [...]  Searches text files.',
    SORT: 'SORT [/R] [/+column] [file]  Sorts lines; < file is also supported.',
    START: 'START application-or-path [arguments]  Opens a desktop app or file.',
    CALL: 'CALL batch-file [arguments]  Runs a .BAT file (%1..%9 and %* supported).',
    GOTO: 'GOTO label  Jumps to a label in the current batch file. GOTO :EOF returns.',
    REM: 'REM comment  Adds a batch-file comment.',
    EXIT: 'EXIT [/B]  Closes the command window; /B returns from a batch file.',
};
const COMMAND_ALIASES = { CHDIR: 'CD', MKDIR: 'MD', RMDIR: 'RD', ERASE: 'DEL', RENAME: 'REN' };
const APP_ALIASES = {
    notepad: 'notepad', wordpad: 'wordpad', write: 'wordpad', mspaint: 'paint',
    pbrush: 'paint', paint: 'paint', calc: 'calculator', calculator: 'calculator',
    sol: 'solitaire', solitaire: 'solitaire', winmine: 'minesweeper', minesweeper: 'minesweeper',
    freecell: 'freecell', mshearts: 'hearts', hearts: 'hearts', explorer: 'explorer',
    control: 'control-panel', sndrec32: 'sound-recorder', sndvol32: 'volume',
    mplayer: 'media-player', command: 'dos',
};
const key = value => String(value).toUpperCase();
const rootOf = path => `${String(path).slice(0, 2).toUpperCase()}\\`;
const baseName = path => String(path).replace(/\\$/, '').split('\\').pop() || String(path);
const parentOf = path => {
    const index = path.lastIndexOf('\\');
    return index <= 2 ? rootOf(path) : path.slice(0, index);
};
const join = (path, name) => path.replace(/\\$/, '') + '\\' + name;
const isFolder = node => !!node && (['folder', 'directory', 'dir'].includes(node.type) || node.isDirectory === true);
const bytes = value => new TextEncoder().encode(String(value ?? '')).length;
const pad = (value, length) => String(value).padEnd(length, ' ');
const error = message => Object.assign(new Error(message), { dosError: true });
/** Normalize a DOS path, retaining C:\\ and clamping .. at the drive root. */
export function normalizeDosPath(value, cwd = 'C:\\') {
    let input = String(value ?? '').trim().replace(/^"(.*)"$/, '$1').replace(/\//g, '\\');
    if (!input)
        return cwd;
    if (input.startsWith('\\\\'))
        throw error('Network paths are not available in this session.');
    let drive = rootOf(cwd), relative;
    if (/^[A-Za-z]:/.test(input)) {
        drive = input.slice(0, 2).toUpperCase() + '\\';
        relative = input.slice(2);
        if (!relative.startsWith('\\') && key(drive) === key(rootOf(cwd)))
            relative = cwd.slice(3) + '\\' + relative;
    }
    else
        relative = input.startsWith('\\') ? input : cwd.slice(3) + '\\' + input;
    const segments = [];
    for (const part of relative.split('\\')) {
        if (!part || part === '.')
            continue;
        if (part === '..')
            segments.pop();
        else
            segments.push(part);
    }
    return drive + segments.join('\\');
}
function wildcard(pattern) {
    if (pattern === '*.*')
        pattern = '*';
    return new RegExp('^' + [...pattern].map(c => c === '*' ? '.*' : c === '?' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('') + '$', 'i');
}
function lex(source) {
    const tokens = [];
    let text = '', start = -1, quoted = false, quotedToken = false;
    const flush = end => {
        if (start >= 0)
            tokens.push({ value: text, start, end, quoted: quotedToken, kind: 'word' });
        text = '';
        start = -1;
        quotedToken = false;
    };
    for (let i = 0; i < source.length; i++) {
        const c = source[i];
        if (c === '^' && i + 1 < source.length) {
            if (start < 0)
                start = i;
            text += source[++i];
        }
        else if (c === '"') {
            if (start < 0)
                start = i;
            quoted = !quoted;
            quotedToken = true;
        }
        else if (!quoted && /\s/.test(c))
            flush(i);
        else if (!quoted && (c === '>' || c === '<')) {
            flush(i);
            const opStart = i, value = c === '>' && source[i + 1] === '>' ? source.slice(i, ++i + 1) : c;
            tokens.push({ value, kind: 'redirect', start: opStart, end: i + 1 });
        }
        else {
            if (start < 0)
                start = i;
            text += c;
        }
    }
    if (quoted)
        throw error('Unmatched quotation mark.');
    flush(source.length);
    return tokens;
}
function parseLine(source) {
    const tokens = lex(source), ranges = [], words = [];
    let redirect = null, input = null;
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.kind !== 'redirect') {
            words.push(token.value);
            continue;
        }
        const file = tokens[++i];
        if (!file || file.kind !== 'word' || !file.value)
            throw error('The syntax of the command is incorrect.');
        if (token.value === '<') {
            if (input)
                throw error('Only one input redirection is supported.');
            input = file.value;
        }
        else {
            if (redirect)
                throw error('Only one output redirection is supported.');
            redirect = { path: file.value, append: token.value === '>>' };
        }
        ranges.push([token.start, file.end]);
    }
    let clean = source;
    for (const [start, end] of ranges.reverse())
        clean = clean.slice(0, start) + clean.slice(end);
    const first = lex(clean)[0];
    return { words, redirect, input, tail: first ? clean.slice(first.end).replace(/^\s+/, '').replace(/\s+$/, '') : '' };
}
/** All mutations are confined to fs. launch(alias,args,cwd) / open(path) are optional desktop hooks. */
export class DosEngine {
    constructor(fs, { launch, open } = {}) {
        if (!fs)
            throw new TypeError('DosEngine requires a filesystem.');
        this.fs = fs;
        this.launch = launch;
        this.open = open;
        this.cwd = 'C:\\';
        this.env = { COMSPEC: 'C:\\WINDOWS\\COMMAND.COM', PATH: 'C:\\WINDOWS;C:\\WINDOWS\\COMMAND', TEMP: 'C:\\WINDOWS\\TEMP', PROMPT: '$P$G' };
        this.echo = true;
        this.errorlevel = 0;
        this.maxBatchLines = 1000;
        this.maxBatchDepth = 12;
        this.clockOffset = 0;
        this.attributes = new Map();
        this.driveDirectories = new Map([['C:', this.cwd]]);
    }
    normalize(path) { return normalizeDosPath(path, this.cwd); }
    now() { return new Date(Date.now() + this.clockOffset); }
    get prompt() { return this.formatPrompt(); }
    formatPrompt() {
        const date = this.now();
        const codes = { P: this.cwd, N: this.cwd.slice(0, 1), G: '>', L: '<', B: '|', Q: '=', C: '(', F: ')', S: ' ', _: '\n', $: '$', D: date.toLocaleDateString('en-US'), T: date.toLocaleTimeString('en-US', { hour12: false }), V: 'Windows 95' };
        return String(this.env.PROMPT ?? '$P$G').replace(/\$(.)/g, (_, c) => codes[key(c)] ?? '');
    }
    _expandEnv(line, context) {
        const special = { CD: this.cwd, ERRORLEVEL: String(this.errorlevel), DATE: this.now().toLocaleDateString('en-US'), TIME: this.now().toLocaleTimeString('en-US') };
        let expanded = String(line).replace(/%([A-Za-z_][A-Za-z0-9_ ()-]*)%/g, (_, name) => this.env[key(name)] ?? special[key(name)] ?? '');
        if (context.batchArgs) {
            expanded = expanded.replace(/%~([0-9])/g, (_, n) => context.batchArgs[Number(n)] ?? '')
                .replace(/%([0-9])/g, (_, n) => context.batchArgs[Number(n)] ?? '')
                .replace(/%\*/g, () => context.batchArgs.slice(1).map(a => /\s/.test(a) ? '"' + a + '"' : a).join(' '));
        }
        return expanded;
    }
    async _get(path) {
        const resolved = this.normalize(path);
        const node = await this.fs.get(resolved);
        if (!node)
            return null;
        return { ...node, path: node.path || resolved, name: node.name || baseName(node.path || resolved), _raw: node };
    }
    async _exists(path) {
        if (typeof this.fs.exists === 'function')
            return !!(await this.fs.exists(this.normalize(path)));
        return !!(await this._get(path));
    }
    async _require(path, kind) {
        const node = await this._get(path);
        if (!node)
            throw error(kind === 'folder' ? 'The system cannot find the path specified.' : 'File not found - ' + path);
        if (kind === 'folder' && !isFolder(node))
            throw error('Not a directory - ' + path);
        if (kind === 'file' && isFolder(node))
            throw error('Access denied - ' + path + ' is a directory.');
        return node;
    }
    async _list(path) {
        const directory = await this._require(path, 'folder');
        const entries = await this.fs.list(directory.path);
        const result = [];
        for (const item of entries || []) {
            const node = typeof item === 'string' ? await this._get(join(directory.path, item)) : { ...item, path: item.path || join(directory.path, item.name), name: item.name || baseName(item.path), _raw: item };
            if (node)
                result.push(node);
        }
        return result.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }
    async _read(path) {
        await this._require(path, 'file');
        const data = await this.fs.read(this.normalize(path));
        return typeof data === 'string' ? data : data?.content != null ? String(data.content) : data == null ? '' : String(data);
    }
    async _size(node) {
        if (isFolder(node))
            return 0;
        if (typeof this.fs.size === 'function') {
            const value = await this.fs.size(node.path);
            if (typeof value === 'number' && Number.isFinite(value))
                return value;
        }
        return bytes(node.content ?? await this._read(node.path));
    }
    _flags(node) {
        const existing = this.attributes.get(key(node.path));
        if (existing)
            return new Set(existing);
        let flags = new Set(isFolder(node) ? [] : ['A']);
        const raw = node.attributes;
        if (typeof raw === 'string')
            flags = new Set(raw.toUpperCase().replace(/[^ARSH]/g, ''));
        if (node.readOnly || raw?.readOnly)
            flags.add('R');
        if (node.hidden || raw?.hidden)
            flags.add('H');
        if (node.system || raw?.system)
            flags.add('S');
        return flags;
    }
    async _writable(path) {
        const node = await this._get(path);
        if (node && this._flags(node).has('R'))
            throw error('Access denied - file is read-only: ' + node.path);
    }
    async _write(path, content) {
        const resolved = this.normalize(path);
        await this._require(parentOf(resolved), 'folder');
        const node = await this._get(resolved);
        if (node && isFolder(node))
            throw error('Access denied - destination is a directory.');
        await this._writable(resolved);
        await this.fs.write(resolved, content, node?.mime || 'text/plain');
    }
    async _walk(path, includeFiles = true, seen = new Set()) {
        const resolved = this.normalize(path);
        if (seen.has(key(resolved)))
            throw error('Directory cycle detected at ' + resolved);
        seen.add(key(resolved));
        const all = [];
        for (const node of await this._list(resolved)) {
            if (isFolder(node)) {
                all.push(node);
                all.push(...await this._walk(node.path, includeFiles, seen));
            }
            else if (includeFiles)
                all.push(node);
        }
        return all;
    }
    async _matches(pattern, { recursive = false, filesOnly = false, directoriesOnly = false } = {}) {
        const resolved = this.normalize(pattern || '*');
        let found;
        if (!/[?*]/.test(resolved)) {
            const node = await this._get(resolved);
            found = node ? [node] : [];
        }
        else {
            const directory = parentOf(resolved), mask = wildcard(baseName(resolved));
            const entries = recursive ? await this._walk(directory) : await this._list(directory);
            found = entries.filter(node => mask.test(node.name));
        }
        return found.filter(node => (!filesOnly || !isFolder(node)) && (!directoriesOnly || isFolder(node)));
    }
    async execute(line) {
        const context = { budget: { remaining: this.maxBatchLines }, depth: 0 };
        const result = await this._executeLine(String(line ?? ''), context);
        return { output: String(result.output ?? ''), ...(result.clear ? { clear: true } : {}), ...(result.exit ? { exit: true } : {}) };
    }
    async _executeLine(line, context) {
        if (--context.budget.remaining < 0)
            return { output: 'Batch execution stopped: command limit exceeded.', _stop: true };
        if (!line.trim() || /^\s*::/.test(line))
            return { output: '' };
        try {
            const expanded = this._expandEnv(line.replace(/^\s*@/, ''), context);
            const parsed = parseLine(expanded);
            if (!parsed.words.length)
                return { output: '' };
            if (parsed.input)
                parsed.stdin = await this._read(parsed.input);
            const result = await this._dispatch(parsed, context);
            this.errorlevel = result.errorlevel ?? 0;
            if (parsed.redirect) {
                const path = this.normalize(parsed.redirect.path);
                const old = parsed.redirect.append && await this._exists(path) ? await this._read(path) : '';
                const output = String(result.output ?? '');
                await this._write(path, old + output + (output && !/\r?\n$/.test(output) ? '\r\n' : ''));
                result.output = '';
            }
            return result;
        }
        catch (e) {
            this.errorlevel = 1;
            return { output: e?.message || String(e), errorlevel: 1 };
        }
    }
    async _dispatch(parsed, context) {
        const [typed, ...args] = parsed.words;
        let command = key(typed);
        command = COMMAND_ALIASES[command] || command;
        if (args.includes('/?'))
            return { output: HELP[command] || 'No help is available for ' + typed + '.' };
        const switches = new Set(args.filter(a => /^\/[A-Za-z?]/.test(a)).map(key));
        const paths = args.filter(a => !/^\/[A-Za-z?]/.test(a));
        const out = output => ({ output });
        if (/^ECHO[.:/]/i.test(typed) && typed.length > 5)
            return out(typed.slice(5) + (parsed.tail ? ' ' + parsed.tail.replace(/\^(.)/g, '$1') : ''));
        if (/^[A-Z]:$/.test(command)) {
            const destination = this.driveDirectories.get(command) || command + '\\';
            const node = await this._require(destination, 'folder');
            this.cwd = node.path;
            return out('');
        }
        switch (command) {
            case 'REM': return out('');
            case 'CLS': return { output: '', clear: true };
            case 'VER': return out('Microsoft Windows 95 [Version 4.00.950]\nBrowser command interpreter; native DOS/Windows binaries are not emulated.');
            case 'HELP': {
                const subject = key(args[0] || '');
                return out(subject ? HELP[COMMAND_ALIASES[subject] || subject] || 'No help is available for ' + args[0] + '.' : Object.entries(HELP).map(([name, help]) => pad(name, 8) + help.slice(help.indexOf('  ') + 2)).join('\n'));
            }
            case 'CD': {
                if (!args.length)
                    return out(this.cwd);
                const path = args.filter(a => key(a) !== '/D').join(' ');
                const node = await this._require(path, 'folder');
                this.cwd = node.path;
                this.driveDirectories.set(key(this.cwd.slice(0, 2)), this.cwd);
                return out('');
            }
            case 'ECHO':
                if (!args.length)
                    return out('ECHO is ' + (this.echo ? 'on.' : 'off.'));
                if (args.length === 1 && /^(on|off)$/i.test(args[0])) {
                    this.echo = key(args[0]) === 'ON';
                    return out('');
                }
                return out(parsed.tail.replace(/\^(.)/g, '$1'));
            case 'ECHO.':
            case 'ECHO:':
            case 'ECHO/': return out('\n');
            case 'SET': {
                let text = parsed.tail;
                if (text.startsWith('"') && text.endsWith('"'))
                    text = text.slice(1, -1);
                if (!text)
                    return out(Object.keys(this.env).sort().map(name => name + '=' + this.env[name]).join('\n'));
                const equals = text.indexOf('=');
                if (equals < 0)
                    return out(Object.keys(this.env).sort().filter(name => name.startsWith(key(text))).map(name => name + '=' + this.env[name]).join('\n'));
                const name = key(text.slice(0, equals).trim());
                if (!name)
                    throw error('Environment variable name is required.');
                const value = text.slice(equals + 1);
                if (value)
                    this.env[name] = value;
                else
                    delete this.env[name];
                return out('');
            }
            case 'PATH':
                if (!args.length)
                    return out('PATH=' + (this.env.PATH || ''));
                this.env.PATH = parsed.tail === ';' ? '' : parsed.tail;
                return out('');
            case 'PROMPT':
                this.env.PROMPT = parsed.tail || '$P$G';
                return out('');
            case 'VOL': {
                const drive = paths[0] ? this.normalize(paths[0]).slice(0, 3) : rootOf(this.cwd);
                const node = await this._require(drive, 'folder');
                return out('Volume in drive ' + drive[0] + ' is ' + (node.label || this.fs.label || 'WINDOWS95') + '\nThis is the desktop\'s virtual file volume.');
            }
            case 'DIR': return out(await this._dir(paths[0] || '*', switches));
            case 'TYPE': {
                if (!paths.length) {
                    if (parsed.stdin != null)
                        return out(parsed.stdin);
                    throw error(HELP.TYPE);
                }
                const blocks = [];
                for (const pattern of paths) {
                    const matches = await this._matches(pattern, { filesOnly: true });
                    if (!matches.length)
                        throw error('File not found - ' + pattern);
                    for (const node of matches)
                        blocks.push(await this._read(node.path));
                }
                return out(blocks.join('\n'));
            }
            case 'MD': {
                if (!paths.length)
                    throw error(HELP.MD);
                for (const path of paths) {
                    const resolved = this.normalize(path);
                    await this._require(parentOf(resolved), 'folder');
                    await this.fs.mkdir(resolved);
                }
                return out('');
            }
            case 'RD': {
                if (!paths.length)
                    throw error(HELP.RD);
                for (const path of paths) {
                    const node = await this._require(path, 'folder');
                    if (node.path === rootOf(node.path))
                        throw error('Cannot remove a drive root.');
                    if (key(this.cwd) === key(node.path) || key(this.cwd).startsWith(key(node.path) + '\\'))
                        throw error('Cannot remove the current directory or one of its parents.');
                    if (!switches.has('/S') && (await this._list(node.path)).length)
                        throw error('The directory is not empty. Use RD /S to remove its contents.');
                    await this.fs.remove(node.path, true);
                }
                return out('');
            }
            case 'DEL': {
                if (!paths.length)
                    throw error(HELP.DEL);
                let count = 0;
                for (const pattern of paths) {
                    const direct = !/[?*]/.test(pattern) ? await this._get(pattern) : null;
                    const mask = isFolder(direct) ? join(direct.path, '*') : pattern;
                    const matches = await this._matches(mask, { recursive: switches.has('/S'), filesOnly: true });
                    if (!matches.length)
                        throw error('File not found - ' + pattern);
                    for (const node of matches) {
                        if (!switches.has('/F'))
                            await this._writable(node.path);
                        else if (node.readOnly)
                            node._raw.readOnly = false;
                        await this.fs.remove(node.path, true);
                        this.attributes.delete(key(node.path));
                        count++;
                    }
                }
                return out(count + ' file(s) deleted.');
            }
            case 'COPY':
            case 'MOVE': return out(await this._copyMove(command, paths, switches));
            case 'REN': return out(await this._rename(paths));
            case 'DATE':
            case 'TIME': return out(this._dateTime(command, args));
            case 'TREE': return out(await this._tree(paths[0] || this.cwd, switches));
            case 'ATTRIB': return out(await this._attrib(args));
            case 'MEM':
            case 'CHKDSK': return out(await this._storage(command, paths[0] || rootOf(this.cwd)));
            case 'FIND': return this._find(args, parsed.stdin);
            case 'SORT': return out(await this._sort(args, parsed.stdin));
            case 'START': {
                if (!args.length)
                    return out(await this._start(this.cwd, []));
                const startArgs = args[0] === '' && args.length > 1 ? args.slice(1) : args;
                return out(await this._start(startArgs[0], startArgs.slice(1)));
            }
            case 'EXIT': return switches.has('/B') && context.depth > 0 ? { output: '', _return: true } : { output: '', exit: true };
            case 'GOTO':
                if (!context.depth)
                    throw error('GOTO is only available inside a batch file.');
                if (!args[0])
                    throw error(HELP.GOTO);
                return key(args[0]) === ':EOF' ? { output: '', _return: true } : { output: '', _goto: args[0].replace(/^:/, '') };
            case 'CALL': {
                if (!args.length)
                    throw error(HELP.CALL);
                const bat = await this._findBatch(args[0]);
                if (!bat)
                    throw error('Batch file not found - ' + args[0]);
                return this._runBatch(bat, args.slice(1), context);
            }
            default: {
                if (command.startsWith(':') && context.depth)
                    return out('');
                const bat = await this._findBatch(typed);
                if (bat)
                    return this._runBatch(bat, args, context);
                const app = APP_ALIASES[baseName(typed).toLowerCase().replace(/\.(exe|com)$/i, '')];
                if (app && /[\\/:]/.test(typed) && !await this._exists(typed))
                    throw error('File not found - ' + typed);
                if (app && this.launch) {
                    await this.launch(app, args, this.cwd);
                    return out('');
                }
                if (/\.(exe|com)$/i.test(typed))
                    throw error('Native .EXE/.COM binaries cannot run in this browser command interpreter. Use START with a supported desktop application.');
                throw error('Bad command or file name: ' + typed);
            }
        }
    }
    async _dir(pattern, switches) {
        const resolved = this.normalize(pattern), direct = !/[?*]/.test(resolved) ? await this._get(resolved) : null;
        const directory = isFolder(direct) ? direct.path : parentOf(resolved);
        const mask = wildcard(isFolder(direct) ? '*' : baseName(resolved));
        await this._require(directory, 'folder');
        const directories = [directory];
        if (switches.has('/S'))
            directories.push(...(await this._walk(directory, false)).map(n => n.path));
        const output = [];
        let files = 0, folders = 0, total = 0;
        for (const path of directories) {
            const nodes = (await this._list(path)).filter(node => mask.test(node.name) && (switches.has('/A') || !this._flags(node).has('H')));
            if (!nodes.length && directories.length > 1)
                continue;
            if (switches.has('/B')) {
                output.push(...nodes.map(node => switches.has('/S') ? node.path : node.name));
                continue;
            }
            output.push(' Directory of ' + path, '');
            if (switches.has('/W')) {
                const values = nodes.map(node => isFolder(node) ? '[' + node.name + ']' : node.name);
                for (let i = 0; i < values.length; i += 4)
                    output.push(values.slice(i, i + 4).map(name => pad(name, Math.max(18, name.length + 2))).join('').trimEnd());
            }
            else
                for (const node of nodes) {
                    const date = new Date(node.modified || node.created || Date.now());
                    const stamp = Number.isNaN(date.getTime()) ? '          ' : date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
                    const time = Number.isNaN(date.getTime()) ? '        ' : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                    output.push(stamp + '  ' + time + '  ' + (isFolder(node) ? pad('<DIR>', 12) : String(await this._size(node)).padStart(12, ' ')) + '  ' + node.name);
                }
            for (const node of nodes) {
                if (isFolder(node))
                    folders++;
                else {
                    files++;
                    total += await this._size(node);
                }
            }
            if (!nodes.length)
                output.push('File not found.');
            output.push('');
        }
        if (!switches.has('/B'))
            output.push(' ' + files + ' File(s)  ' + total.toLocaleString('en-US') + ' bytes', ' ' + folders + ' Dir(s)');
        return output.join('\n');
    }
    async _copyMove(command, paths, switches) {
        if (!paths.length || paths.length > 2)
            throw error(HELP[command]);
        const sources = await this._matches(paths[0], { filesOnly: command === 'COPY' });
        if (!sources.length)
            throw error('File not found - ' + paths[0]);
        const destination = this.normalize(paths[1] || this.cwd), destNode = await this._get(destination);
        if (sources.length > 1 && !isFolder(destNode))
            throw error('The destination must be an existing directory when multiple files are selected.');
        let count = 0;
        for (const source of sources) {
            if (source.path === rootOf(source.path))
                throw error('Cannot copy or move a drive root.');
            if (command === 'COPY' && isFolder(source))
                throw error('COPY copies files. Directory copies are not supported.');
            const target = isFolder(destNode) ? join(destNode.path, source.name) : destination;
            if (key(source.path) === key(target))
                throw error('The source and destination are the same.');
            if (isFolder(source) && key(target).startsWith(key(source.path) + '\\'))
                throw error('Cannot move a directory into itself.');
            await this._require(parentOf(target), 'folder');
            if (await this._exists(target)) {
                if (!switches.has('/Y'))
                    throw error('Destination already exists. Use ' + command + ' /Y to replace a file.');
                const old = await this._require(target, 'file');
                await this._writable(old.path);
                await this.fs.remove(old.path, true);
            }
            await this.fs[command === 'COPY' ? 'copy' : 'move'](source.path, target);
            const attributes = this.attributes.get(key(source.path));
            if (attributes) {
                this.attributes.set(key(target), new Set(attributes));
                if (command === 'MOVE')
                    this.attributes.delete(key(source.path));
            }
            if (command === 'MOVE' && (key(this.cwd) === key(source.path) || key(this.cwd).startsWith(key(source.path) + '\\'))) {
                this.cwd = target + this.cwd.slice(source.path.length);
                this.driveDirectories.set(key(this.cwd.slice(0, 2)), this.cwd);
            }
            count++;
        }
        return count + ' file(s) ' + (command === 'COPY' ? 'copied.' : 'moved.');
    }
    async _rename(paths) {
        if (paths.length !== 2)
            throw error(HELP.REN);
        if (/[\\/:]/.test(paths[1]))
            throw error('REN accepts a new name, not a different directory. Use MOVE to move files.');
        const sources = await this._matches(paths[0]);
        if (!sources.length)
            throw error('File not found - ' + paths[0]);
        if (sources.length > 1 && !/[?*]/.test(paths[1]))
            throw error('Multiple files require a wildcard in the new name.');
        for (const node of sources) {
            if (node.path === rootOf(node.path))
                throw error('Cannot rename a drive root.');
            let targetName = paths[1];
            if (targetName.includes('*')) {
                const split = node.name.lastIndexOf('.');
                const stem = split > 0 ? node.name.slice(0, split) : node.name;
                const extension = split > 0 ? node.name.slice(split + 1) : '';
                let index = 0;
                targetName = targetName.replace(/\*/g, () => index++ === 0 ? stem : extension);
            }
            let position = 0;
            targetName = [...targetName].map(c => c === '?' ? node.name[position++] || '' : (position++, c)).join('');
            if (!targetName || targetName === '.' || targetName === '..')
                throw error('Invalid file name.');
            const target = join(parentOf(node.path), targetName);
            if (key(target) !== key(node.path) && await this._exists(target))
                throw error('Destination already exists - ' + targetName);
            if (key(target) !== key(node.path))
                await this.fs.move(node.path, target);
            const attributes = this.attributes.get(key(node.path));
            if (attributes) {
                this.attributes.delete(key(node.path));
                this.attributes.set(key(target), attributes);
            }
            if (key(this.cwd) === key(node.path) || key(this.cwd).startsWith(key(node.path) + '\\'))
                this.cwd = target + this.cwd.slice(node.path.length);
        }
        return '';
    }
    _dateTime(command, args) {
        const setting = args.filter(a => key(a) !== '/T').join(' ');
        const now = this.now(), next = new Date(now);
        if (setting && command === 'DATE') {
            const match = setting.match(/^(\d{1,4})[-/](\d{1,2})[-/](\d{1,4})$/);
            if (!match)
                throw error('Invalid date. Use MM-DD-YYYY or YYYY-MM-DD.');
            let year, month, day;
            if (match[1].length === 4)
                [, year, month, day] = match.map(Number);
            else {
                month = Number(match[1]);
                day = Number(match[2]);
                year = Number(match[3]);
                if (year < 100)
                    year += year >= 80 ? 1900 : 2000;
            }
            next.setFullYear(year, month - 1, day);
            if (next.getFullYear() !== year || next.getMonth() !== month - 1 || next.getDate() !== day)
                throw error('Invalid date.');
            this.clockOffset += next.getTime() - now.getTime();
        }
        else if (setting) {
            const match = setting.match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(AM|PM)?$/i);
            if (!match)
                throw error('Invalid time. Use HH:MM[:SS] [AM|PM].');
            let hour = Number(match[1]);
            const minute = Number(match[2]), second = Number(match[3] || 0), period = key(match[4] || '');
            if (minute > 59 || second > 59 || hour > (period ? 12 : 23) || (period && hour < 1))
                throw error('Invalid time.');
            if (period)
                hour = hour % 12 + (period === 'PM' ? 12 : 0);
            next.setHours(hour, minute, second, 0);
            this.clockOffset += next.getTime() - now.getTime();
        }
        const current = this.now();
        return command === 'DATE' ? 'Current date is ' + current.toLocaleDateString('en-US') : 'Current time is ' + current.toLocaleTimeString('en-US', { hour12: false });
    }
    async _tree(path, switches) {
        const root = await this._require(path, 'folder'), lines = [root.path], seen = new Set();
        const visit = async (directory, prefix) => {
            if (seen.has(key(directory)))
                throw error('Directory cycle detected at ' + directory);
            seen.add(key(directory));
            const nodes = (await this._list(directory)).filter(n => isFolder(n) || switches.has('/F'));
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i], last = i === nodes.length - 1;
                lines.push(prefix + (switches.has('/A') ? (last ? '\\---' : '+---') : (last ? '└───' : '├───')) + node.name);
                if (isFolder(node))
                    await visit(node.path, prefix + (last ? '    ' : switches.has('/A') ? '|   ' : '│   '));
            }
        };
        await visit(root.path, '');
        return lines.join('\n');
    }
    async _attrib(args) {
        const changes = args.filter(a => /^[+-][ARSH]$/i.test(a));
        const unsupported = args.find(a => /^[+-]/.test(a) && !/^[+-][ARSH]$/i.test(a));
        if (unsupported)
            throw error('Invalid attribute - ' + unsupported);
        const pattern = args.find(a => !/^[+\-/]/.test(a)) || '*';
        const switches = new Set(args.filter(a => a.startsWith('/')).map(key));
        const matches = await this._matches(pattern, { recursive: switches.has('/S'), filesOnly: !switches.has('/D') });
        if (!matches.length)
            throw error('File not found - ' + pattern);
        const lines = [];
        for (const node of matches) {
            const flags = this._flags(node);
            for (const change of changes) {
                const letter = key(change[1]);
                if (change[0] === '+')
                    flags.add(letter);
                else
                    flags.delete(letter);
            }
            if (changes.length) {
                this.attributes.set(key(node.path), flags);
                if (node._raw) {
                    node._raw.readOnly = flags.has('R');
                    node._raw.hidden = flags.has('H');
                    node._raw.system = flags.has('S');
                    node._raw.attributes = [...flags].join('');
                }
            }
            else
                lines.push(['A', 'S', 'H', 'R'].map(flag => flags.has(flag) ? flag : ' ').join(' ') + '     ' + node.path);
        }
        if (changes.length && typeof this.fs.flush === 'function')
            await this.fs.flush();
        return lines.join('\n');
    }
    async _storage(command, path) {
        const root = await this._require(path, 'folder');
        const visited = new Set(), entries = [], issues = [];
        const scan = async (directory) => {
            if (visited.has(key(directory))) {
                issues.push('Duplicate or cyclic directory: ' + directory);
                return;
            }
            visited.add(key(directory));
            let children;
            try {
                children = await this._list(directory);
            }
            catch (e) {
                issues.push(directory + ': ' + e.message);
                return;
            }
            for (const node of children) {
                entries.push(node);
                if (key(parentOf(node.path)) !== key(directory))
                    issues.push('Incorrect parent: ' + node.path);
                if (isFolder(node))
                    await scan(node.path);
                else {
                    try {
                        await this._read(node.path);
                    }
                    catch (e) {
                        issues.push(node.path + ': ' + e.message);
                    }
                }
            }
        };
        await scan(root.path);
        let storage = 0, files = 0, directories = 0;
        for (const node of entries) {
            if (isFolder(node))
                directories++;
            else {
                files++;
                try {
                    storage += await this._size(node);
                }
                catch (e) {
                    issues.push(node.path + ': ' + e.message);
                }
            }
        }
        if (command === 'MEM') {
            const lines = [storage.toLocaleString('en-US') + ' bytes in ' + files + ' virtual file(s)', directories + ' directorie(s)', 'DOS conventional and extended memory segments are not emulated.'];
            const memory = globalThis.performance?.memory;
            if (memory?.usedJSHeapSize)
                lines.push(memory.usedJSHeapSize.toLocaleString('en-US') + ' bytes of JavaScript heap currently used.');
            return lines.join('\n');
        }
        return ['Checking ' + root.path, storage.toLocaleString('en-US') + ' bytes in ' + files + ' file(s)', directories + ' directorie(s) checked', ...(issues.length ? [issues.length + ' issue(s) found:', ...issues] : ['No filesystem errors found.']), 'Host disk capacity and allocation sectors are not exposed by this virtual filesystem.'].join('\n');
    }
    async _find(args, stdin) {
        const switches = new Set(args.filter(a => /^\/[IVCN]$/i.test(a)).map(key));
        const values = args.filter(a => !/^\/[IVCN]$/i.test(a));
        if (!values.length || (values.length < 2 && stdin == null))
            throw error(HELP.FIND);
        const needle = switches.has('/I') ? values[0].toLowerCase() : values[0];
        const sources = [];
        if (values.length === 1)
            sources.push({ path: '', text: stdin });
        else
            for (const pattern of values.slice(1)) {
                const matches = await this._matches(pattern, { filesOnly: true });
                if (!matches.length)
                    throw error('File not found - ' + pattern);
                for (const node of matches)
                    sources.push({ path: node.path, text: await this._read(node.path) });
            }
        let matched = 0;
        const output = [];
        for (const source of sources) {
            const lines = String(source.text).split(/\r?\n/);
            if (lines.at(-1) === '')
                lines.pop();
            const found = [];
            lines.forEach((line, index) => {
                const contains = (switches.has('/I') ? line.toLowerCase() : line).includes(needle);
                if (switches.has('/V') ? !contains : contains)
                    found.push((switches.has('/N') ? '[' + (index + 1) + ']' : '') + line);
            });
            matched += found.length;
            if (switches.has('/C'))
                output.push((source.path ? '---------- ' + source.path + ': ' : '') + found.length);
            else {
                if (source.path)
                    output.push('---------- ' + source.path);
                output.push(...found);
            }
        }
        return { output: output.join('\n'), errorlevel: matched ? 0 : 1 };
    }
    async _sort(args, stdin) {
        const reverse = args.some(a => key(a) === '/R'), columnOption = args.find(a => /^\/\+\d+$/.test(a));
        const column = columnOption ? Number(columnOption.slice(2)) - 1 : 0;
        if (column < 0)
            throw error('The sort column must be 1 or greater.');
        const paths = args.filter(a => key(a) !== '/R' && !/^\/\+\d+$/.test(a));
        if (paths.length > 1 || (!paths.length && stdin == null))
            throw error(HELP.SORT);
        const text = paths.length ? await this._read(paths[0]) : stdin;
        const lines = String(text).split(/\r?\n/);
        if (lines.at(-1) === '')
            lines.pop();
        lines.sort((a, b) => a.slice(column).localeCompare(b.slice(column), undefined, { sensitivity: 'base' }));
        if (reverse)
            lines.reverse();
        return lines.join('\n');
    }
    async _start(target, args) {
        const alias = APP_ALIASES[baseName(target).toLowerCase().replace(/\.(exe|com)$/i, '')];
        if (alias && /[\\/:]/.test(target) && !await this._exists(target))
            throw error('File not found - ' + target);
        if (alias && this.launch) {
            await this.launch(alias, args, this.cwd);
            return '';
        }
        const node = await this._get(target);
        if (node) {
            if (/\.(exe|com)$/i.test(node.path))
                throw error('Native .EXE/.COM binaries are not emulated. START can open supported desktop applications or documents.');
            if (!this.open)
                throw error('No desktop file opener is connected.');
            await this.open(node.path);
            return '';
        }
        if (/\.(exe|com)$/i.test(target))
            throw error('Native .EXE/.COM binaries are not emulated. START can open supported desktop applications or documents.');
        if (this.launch) {
            const result = await this.launch(target, args, this.cwd);
            if (result !== false)
                return '';
        }
        throw error('Application or file not found - ' + target);
    }
    async _findBatch(command) {
        if (/\.(exe|com)$/i.test(command))
            return null;
        const candidates = /[\\/:]/.test(command) ? [this.normalize(command)] : [join(this.cwd, command), ...(this.env.PATH || '').split(';').filter(Boolean).map(path => join(path.replace(/^"|"$/g, ''), command))];
        for (const candidate of candidates) {
            for (const path of /\.bat$/i.test(candidate) ? [candidate] : baseName(candidate).includes('.') ? [] : [candidate + '.BAT']) {
                const node = await this._get(path);
                if (node && !isFolder(node))
                    return node.path;
            }
        }
        return null;
    }
    async _runBatch(path, args, parentContext) {
        if (parentContext.depth >= this.maxBatchDepth)
            throw error('Batch execution stopped: nesting limit exceeded.');
        const source = await this._read(path), lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
        const context = { ...parentContext, depth: parentContext.depth + 1, batchArgs: [path, ...args] };
        const labels = new Map();
        lines.forEach((line, index) => {
            const match = line.match(/^\s*:([^:\s][^\s]*)/);
            if (match)
                labels.set(key(match[1]), index);
        });
        const output = [];
        let clear = false;
        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            if (!line.trim() || /^\s*:/.test(line))
                continue;
            if (this.echo && !/^\s*@/.test(line))
                output.push(this.formatPrompt() + this._expandEnv(line, context));
            const result = await this._executeLine(line, context);
            if (result.clear) {
                output.length = 0;
                clear = true;
            }
            if (result.output)
                output.push(result.output);
            if (result.exit)
                return { output: output.join('\n'), clear, exit: true };
            if (result._return || result._stop)
                break;
            if (result._goto) {
                const target = labels.get(key(result._goto));
                if (target == null) {
                    output.push('Label not found - ' + result._goto);
                    this.errorlevel = 1;
                    break;
                }
                index = target;
            }
        }
        return { output: output.join('\n'), clear, errorlevel: this.errorlevel };
    }
}
export default DosEngine;
