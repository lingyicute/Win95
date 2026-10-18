/** A case-insensitive, transactional virtual DOS volume. All data stays in this browser. */
export const normalizePath = (path, cwd = 'C:\\') => {
    let s = String(path || cwd).replaceAll('/', '\\');
    if (!/^[A-Za-z]:/.test(s))
        s = s.startsWith('\\') ? cwd.slice(0, 2) + s : cwd.replace(/\\?$/, '\\') + s;
    const parts = s.slice(2).split('\\').filter(Boolean), stack = [];
    for (const p of parts) {
        if (p === '..')
            stack.pop();
        else if (p !== '.')
            stack.push(p);
    }
    return s[0].toUpperCase() + ':\\' + stack.join('\\');
};
export const parentPath = path => { const p = normalizePath(path); return p.length <= 3 ? p : p.lastIndexOf('\\') <= 2 ? p.slice(0, 3) : p.slice(0, p.lastIndexOf('\\')); };
export const baseName = path => normalizePath(path).split('\\').pop() || normalizePath(path);
/** The name a folder view shows: shortcuts drop their .lnk, and the Folder
    Options switch can drop one file extension (never a folder's). */
export const displayName = (node, hideExtensions = false) => {
    const name = baseName(node.path ?? String(node));
    const short = name.replace(/\.lnk$/i, '');
    if (!hideExtensions || node.type === 'folder' || node.type === 'directory' || short !== name)
        return short;
    return name.replace(/\.[^.]+$/, '');
};
/** The volume's own limit, in characters, on a single name. Nothing may grow past
    it by appending to a name that already sits at it - see unique(). */
export const NAME_LIMIT = 255;

const key = p => normalizePath(p).toLowerCase();
export function nameError(name) {
    const n = String(name ?? '');
    if (!n.trim())
        return 'Please type a name.';
    if (n.length > NAME_LIMIT)
        return 'A name can be at most 255 characters.';      // 字面量：词典按整句匹配，别用模板拼
    if (/^\.+$/.test(n.trim()))
        return 'The file name is not valid.';
    if (/[<>:"/\\|?*\x00-\x1f]/.test(n))
        return 'A name cannot contain any of the following characters:\n  \\ / : * ? " < > |';
    /* Reserved device names stay reserved even with an extension: Windows 95
       would open CON as the console whatever the caller meant. */
    if (/^(CON|PRN|AUX|CLOCK\$|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i.test(n.trim()))
        return 'The file name is not valid.';
    if (/[. ]$/.test(n))
        return 'The file name is not valid.';
    return null;
}
const validName = name => {
    const problem = nameError(name);
    if (problem)
        throw new Error(problem);
    return name;
};
export class VirtualFileSystem extends EventTarget {
    constructor() { super(); this.nodes = new Map(); this.db = null; this.revision = 0; this.lastSaved = 0; this.persistence = 'memory'; }
    async init() {
        try {
            this.db = await new Promise((resolve, reject) => { const r = indexedDB.open('win95-desktop', 1); r.onupgradeneeded = () => r.result.createObjectStore('volume'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
            const data = await new Promise((resolve, reject) => { const r = this.db.transaction('volume').objectStore('volume').get('C'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
            if (data?.nodes) {
                this.nodes = new Map(data.nodes);
                this.revision = data.revision || 0;
            }
            this.persistence = 'IndexedDB';
        }
        catch {
            try {
                this.db?.close();
            }
            catch { }
            this.db = null;
            try {
                const d = JSON.parse(localStorage.getItem('win95-volume') || 'null');
                if (d?.nodes) {
                    this.nodes = new Map(d.nodes);
                    this.revision = d.revision || 0;
                }
                this.persistence = 'localStorage';
            }
            catch { }
        }
        try {
            const journal = JSON.parse(localStorage.getItem('win95-journal') || 'null');
            if (journal?.nodes && journal.revision > this.revision) {
                this.nodes = new Map(journal.nodes);
                this.revision = journal.revision;
            }
        }
        catch { }
        if (!this.nodes.size)
            this.seed();
        else
            await this.flush().catch(() => { });
        return this;
    }
    seed() {
        const folders = ['C:\\', 'C:\\Windows', 'C:\\Windows\\Desktop', 'C:\\Windows\\Start Menu', 'C:\\Windows\\System', 'C:\\My Documents', 'C:\\My Documents\\Pictures', 'C:\\Program Files', 'C:\\Recycled', 'A:\\', 'D:\\'];
        for (const path of folders)
            this.nodes.set(key(path), { path, type: 'folder', created: Date.now(), modified: Date.now() });
        const files = {
            'C:\\My Documents\\Read Me.txt': 'Welcome to Microsoft Windows 95\r\n================================\r\n\r\nA whole new world of possibilities.\r\n\r\nDouble-click an icon to open it. Click Start to find your programs, change settings, or shut down your computer.\r\n\r\nA few things to try\r\n------------------\r\n\r\n- Write a letter in WordPad.\r\n- Make a picture in Paint and save it to your computer.\r\n- Take a break with Solitaire or Minesweeper.\r\n- Explore the C: drive in My Computer.\r\n- Customize your desktop in Control Panel.\r\n\r\nYour documents and settings are saved in this browser.\r\n',
            'C:\\My Documents\\Shopping List.txt': 'Shopping List\r\n\r\nMilk\r\nBread\r\nCoffee\r\nFloppy disks\r\n',
            'C:\\My Documents\\Welcome.htm': '<h1>Welcome to the World Wide Web</h1><p>Your personal starting point for exploring the Internet.</p>',
            'C:\\Windows\\win.ini': '[windows]\r\nload=\r\nrun=\r\n[desktop]\r\nWallpaper=(None)\r\nTileWallpaper=0\r\n',
            'C:\\Windows\\system.ini': '[boot]\r\nshell=Explorer.exe\r\n[386Enh]\r\n',
            'C:\\AUTOEXEC.BAT': '@ECHO OFF\r\nSET PATH=C:\\Windows;C:\\Windows\\Command\r\nECHO Welcome to Windows 95.\r\n',
            'C:\\CONFIG.SYS': 'DOS=HIGH,UMB\r\nFILES=40\r\nBUFFERS=30\r\n',
            'C:\\My Documents\\Letter.rtf': '<p style="text-align:right">October 4, 1995</p><p>Dear friend,</p><p>I finally got Windows 95! Everything is right here on my desktop. I can write letters, draw pictures, and even play a game of Solitaire.</p><p>See you soon!</p>'
        };
        for (const [path, content] of Object.entries(files))
            this.nodes.set(key(path), { path, type: 'file', content, mime: path.endsWith('.htm') ? 'text/html' : 'text/plain', created: Date.now(), modified: Date.now() });
        this.changed();
    }
    get(path) { return this.nodes.get(key(path)); }
    exists(path) { return this.nodes.has(key(path)); }
    list(path = 'C:\\') {
        const p = normalizePath(path);
        if (this.get(p)?.type !== 'folder')
            throw new Error('The folder does not exist.');
        return [...this.nodes.values()].filter(n => key(n.path) !== key(p) && key(parentPath(n.path)) === key(p)).sort((a, b) => (a.type === b.type ? 0 : a.type === 'folder' ? -1 : 1) || baseName(a.path).localeCompare(baseName(b.path)));
    }
    read(path) {
        const n = this.get(path);
        if (!n || n.type !== 'file')
            throw new Error('File not found: ' + path);
        return n.content ?? '';
    }
    write(path, content, mime = 'text/plain') {
        path = normalizePath(path);
        validName(baseName(path));
        if (this.get(parentPath(path))?.type !== 'folder')
            throw new Error('The destination folder does not exist.');
        if (this.get(path)?.type === 'folder')
            throw new Error('A folder has that name.');
        const old = this.get(path);
        if (old?.readOnly || old?.attributes?.includes?.('R'))
            throw new Error('Access denied: the file is read-only.');
        this.nodes.set(key(path), { ...old, path, type: 'file', content: String(content), mime, created: old?.created || Date.now(), modified: Date.now() });
        this.changed();
        return path;
    }
    mkdir(path) {
        path = normalizePath(path);
        validName(baseName(path));
        if (this.exists(path))
            throw new Error('A file or folder with that name already exists.');
        if (this.get(parentPath(path))?.type !== 'folder')
            throw new Error('The destination folder does not exist.');
        this.nodes.set(key(path), { path, type: 'folder', created: Date.now(), modified: Date.now() });
        this.changed();
        return path;
    }
    /** An unused sibling of `path`: 'Report.txt', 'Report (2).txt', … Callers use this
     *  to dodge a name already in the folder - pasting again, importing again, sending a
     *  second file of the same name to the Recycle Bin - so the answer has to be legal,
     *  not merely new: at the cap the counter is carved out of the stem rather than
     *  bolted on, since 'Report (2).txt' longer than the limit is refused on the spot. */
    unique(path, folder = this.get(path)?.type === 'folder') {
        path = normalizePath(path);
        if (!this.exists(path))
            return path;
        const dot = path.lastIndexOf('.'), cut = path.lastIndexOf('\\') + 1, hasExt = !folder && dot > cut;
        const dir = path.slice(0, cut), stem = hasExt ? path.slice(cut, dot) : path.slice(cut), ext = hasExt ? path.slice(dot) : '';
        for (let n = 2; ; n++) {
            const counter = ` (${n})`, room = NAME_LIMIT - counter.length - ext.length;
            let stemPart = stem, extPart = ext;
            if (stem.length + ext.length + counter.length > NAME_LIMIT)
                if (room > 0)
                    stemPart = stem.slice(0, room);
                else
                    stemPart = stem.slice(0, NAME_LIMIT - counter.length), extPart = '';
            const candidate = dir + stemPart + counter + extPart;
            if (!this.exists(candidate))
                return candidate;
        }
    }
    transfer(from, to, copy = false) {
        from = normalizePath(from);
        to = normalizePath(to);
        if (from.length <= 3 || key(from) === 'c:\\recycled')
            throw new Error('This system folder cannot be moved.');
        if (!this.exists(from))
            throw new Error('The source no longer exists.');
        if (key(to) === key(from)) {
            if (from !== to) {
                const list = [...this.nodes.values()].filter(n => key(n.path) === key(from) || key(n.path).startsWith(key(from) + '\\'));
                for (const n of list) {
                    this.nodes.delete(key(n.path));
                    const path = to + n.path.slice(from.length);
                    this.nodes.set(key(path), { ...n, path });
                }
                this.changed();
            }
            return to;
        }
        validName(baseName(to));
        if (key(to).startsWith(key(from) + '\\'))
            throw new Error('A folder cannot be placed inside itself.');
        if (this.exists(to))
            throw new Error('A file or folder with that name already exists.');
        if (this.get(parentPath(to))?.type !== 'folder')
            throw new Error('The destination folder does not exist.');
        const changes = [...this.nodes.values()].filter(n => key(n.path) === key(from) || key(n.path).startsWith(key(from) + '\\')).map(n => [n, to + n.path.slice(from.length)]);
        for (const [n, path] of changes) {
            if (!copy)
                this.nodes.delete(key(n.path));
            this.nodes.set(key(path), { ...structuredClone(n), path, modified: Date.now(), ...(copy ? { originalPath: undefined } : {}) });
        }
        this.changed();
        return to;
    }
    rename(path, name) { return this.transfer(path, normalizePath(parentPath(path) + '\\' + validName(name))); }
    copy(from, to) { return this.transfer(from, to, true); }
    move(from, to) { return this.transfer(from, to, false); }
    remove(path, permanent = false) {
        const node = this.get(path);
        if (!node)
            throw new Error('File not found.');
        path = node.path;
        if (path.length <= 3 || ['c:\\recycled', 'c:\\windows'].includes(key(path)))
            throw new Error('This system folder cannot be deleted.');
        if (!permanent && !key(path).startsWith('c:\\recycled\\')) {
            const dest = this.unique('C:\\Recycled\\' + baseName(path), node.type === 'folder');
            this.move(path, dest);
            this.get(dest).originalPath = path;
            this.changed();
            return;
        }
        for (const k of [...this.nodes.keys()])
            if (k === key(path) || k.startsWith(key(path) + '\\'))
                this.nodes.delete(k);
        this.changed();
    }
    /** Folders on `path` that the volume does not have yet, created from the top down.
     *  Stops at a name held by a file: that road is closed, and the caller's own check
     *  reports it instead of quietly replacing what the user put there. */
    ensureFolders(path) {
        const missing = [];
        for (let p = normalizePath(path); p.length > 3 && this.get(p)?.type !== 'folder'; p = parentPath(p)) {
            if (this.exists(p))
                break;
            missing.push(p);
        }
        for (const p of missing.reverse())
            this.mkdir(p);
        return this.get(normalizePath(path))?.type === 'folder';
    }
    restore(path) {
        const n = this.get(path);
        if (!n?.originalPath)
            throw new Error('This file is not in the Recycle Bin.');
        const to = this.unique(n.originalPath, n.type === 'folder');
        this.ensureFolders(parentPath(to));
        this.move(path, to);
        delete this.get(to).originalPath;
        this.changed();
        return to;
    }
    search(pattern, folder = 'C:\\') {
        const p = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*').replaceAll('?', '.');
        const re = new RegExp(p || '.*', 'i');
        const root = key(folder);
        const recycleBin = 'c:\\recycled';
        return [...this.nodes.values()].filter(node => {
            const path = key(node.path);
            const inFolder = path === root || path.startsWith(root.endsWith('\\') ? root : root + '\\');
            const inRecycleBin = path === recycleBin || path.startsWith(recycleBin + '\\');
            return inFolder && !inRecycleBin && re.test(baseName(node.path));
        });
    }
    size(path) { const n = this.get(path); return n?.type === 'file' ? new TextEncoder().encode(n.content || '').length : [...this.nodes.values()].filter(n => key(n.path).startsWith(key(path).replace(/\\$/, '') + '\\') && n.type === 'file').reduce((s, n) => s + new TextEncoder().encode(n.content || '').length, 0); }
    changed() {
        this.revision++;
        try {
            localStorage.setItem('win95-journal', JSON.stringify({ revision: this.revision, nodes: [...this.nodes] }));
        }
        catch { }
        this.dispatchEvent(new Event('change'));
        void this.flush().catch(() => { });
    }
    async flush() {
        const revision = this.revision, data = { revision, nodes: [...this.nodes] };
        try {
            if (this.db)
                await new Promise((resolve, reject) => { const tx = this.db.transaction('volume', 'readwrite'); tx.objectStore('volume').put(data, 'C'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('The storage transaction was aborted.')); });
            else if (this.persistence === 'localStorage')
                localStorage.setItem('win95-volume', JSON.stringify(data));
            else
                throw new Error('Persistent storage is unavailable. Export a backup to keep your files.');
            this.lastSaved = Math.max(this.lastSaved, revision);
            try {
                const journal = JSON.parse(localStorage.getItem('win95-journal') || 'null');
                if (journal && journal.revision <= this.lastSaved)
                    localStorage.removeItem('win95-journal');
            }
            catch { }
        }
        catch (error) {
            this.dispatchEvent(new CustomEvent('storageerror', { detail: error }));
            throw error;
        }
    }
    export() { return JSON.stringify({ format: 'win95-volume', version: 1, nodes: [...this.nodes] }, null, 2); }
}
export const readSettingsValues = () => {
    try {
        return JSON.parse(localStorage.getItem('win95-settings') || '{}') || {};
    }
    catch {
        return {};
    }
};
export class Settings extends EventTarget {
    constructor() {
        super();
        this.values = readSettingsValues();
    }
    get(name, fallback) { return this.values[name] ?? fallback; }
    set(name, value) {
        this.values[name] = value;
        try {
            localStorage.setItem('win95-settings', JSON.stringify(this.values));
        }
        catch { }
        this.dispatchEvent(new CustomEvent('change', { detail: { name, value } }));
    }
}
