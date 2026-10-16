import assert from 'node:assert/strict';
import { DosEngine, normalizeDosPath } from '../src/packages/core/dos-engine.js';

const parent = path => path.lastIndexOf('\\') <= 2 ? path.slice(0, 3) : path.slice(0, path.lastIndexOf('\\'));
class MemoryFS {
  constructor() { this.nodes = new Map(); this.nodes.set('c:\\', { path: 'C:\\', type: 'folder' }); this.flushCount = 0; }
  norm(path) { return normalizeDosPath(path); }
  get(path) { return this.nodes.get(this.norm(path).toLowerCase()); }
  exists(path) { return !!this.get(path); }
  list(path) { const resolved = this.norm(path); return [...this.nodes.values()].filter(n => n.path !== resolved && parent(n.path).toLowerCase() === resolved.toLowerCase()); }
  read(path) { const n = this.get(path); if (!n || n.type !== 'file') throw Error('File not found'); return n.content; }
  write(path, content, mime = 'text/plain') { path = this.norm(path); const old = this.get(path); if (old?.readOnly) throw Error('Access denied'); if (!this.exists(parent(path))) throw Error('Path not found'); this.nodes.set(path.toLowerCase(), { ...old, path, type: 'file', content, mime, modified: new Date().toISOString() }); }
  mkdir(path) { path = this.norm(path); if (this.exists(path)) throw Error('Directory already exists'); if (!this.exists(parent(path))) throw Error('Path not found'); this.nodes.set(path.toLowerCase(), { path, type: 'folder' }); }
  copy(from, to) { from = this.norm(from); to = this.norm(to); const n = this.get(from); if (!n) throw Error('File not found'); if (this.exists(to)) throw Error('Destination exists'); this.nodes.set(to.toLowerCase(), { ...n, path: to }); }
  move(from, to) { from = this.norm(from); to = this.norm(to); const n = this.get(from); if (!n) throw Error('File not found'); if (this.exists(to)) throw Error('Destination exists'); const entries = [...this.nodes.values()].filter(n => n.path.toLowerCase() === from.toLowerCase() || n.path.toLowerCase().startsWith(from.toLowerCase() + '\\')); for (const e of entries) { this.nodes.delete(e.path.toLowerCase()); const path = to + e.path.slice(from.length); this.nodes.set(path.toLowerCase(), { ...e, path }); } }
  remove(path, recursive) { path = this.norm(path); const n = this.get(path); if (!n) throw Error('File not found'); if (n.readOnly) throw Error('Access denied'); const children = [...this.nodes.values()].filter(e => e.path.toLowerCase().startsWith(path.toLowerCase() + '\\')); if (children.length && !recursive) throw Error('Directory not empty'); for (const e of children) this.nodes.delete(e.path.toLowerCase()); this.nodes.delete(path.toLowerCase()); }
  size(path) { return new TextEncoder().encode(this.read(path)).length; }
  flush() { this.flushCount++; }
}

const fs = new MemoryFS();
for (const p of ['C:\\TEST', 'C:\\TEST\\SUB', 'C:\\WINDOWS', 'C:\\WINDOWS\\COMMAND']) fs.mkdir(p);
fs.write('C:\\TEST\\ONE.TXT', 'pear\r\napple\r\npear\r\n');
fs.write('C:\\TEST\\TWO.TXT', 'blue\norange');
fs.write('C:\\TEST\\SUB\\DEEP.TXT', 'nested');
fs.write('C:\\NOEXT', 'extensionless');
fs.write('C:\\WINDOWS\\NOTEPAD.EXE', 'desktop alias');
const launched = [], opened = [];
const dos = new DosEngine(fs, { launch: (app, args, cwd) => { if (app === 'missing-app') return false; launched.push({ app, args, cwd }); }, open: path => opened.push(path) });
const run = async line => (await dos.execute(line)).output;
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const contains = (actual, expected) => { assert.ok(actual.includes(expected), JSON.stringify(actual) + ' should include ' + JSON.stringify(expected)); checks++; };

check(normalizeDosPath('..\\..\\..', 'C:\\TEST'), 'C:\\');
check(normalizeDosPath('c:/TEST/./SUB/../one.txt'), 'C:\\TEST\\one.txt');
check(await run('CD "C:\\TEST"'), ''); check(dos.cwd, 'C:\\TEST');
check(await run('CD'), 'C:\\TEST');
check((await run('DIR /B *.TXT')).split('\n'), ['ONE.TXT', 'TWO.TXT']);
contains(await run('DIR /B /S *.TXT'), 'C:\\TEST\\SUB\\DEEP.TXT');
contains(await run('DIR /W'), '[SUB]');
check(await run('TYPE one.txt'), 'pear\r\napple\r\npear\r\n');
contains(await run('FIND /C "pear" one.txt'), ': 2');
contains(await run('FIND /I /N "ORANGE" TWO.TXT'), '[2]orange');
check(await run('SORT < ONE.TXT'), 'apple\npear\npear');
check(await run('SORT /R ONE.TXT'), 'pear\npear\napple');
check(await run('ECHO first > "out file.txt"'), '');
check(await run('ECHO second >> "out file.txt"'), '');
check(fs.read('C:\\TEST\\out file.txt'), 'first\r\nsecond\r\n');
check(await run('ECHO "a > b"'), '"a > b"');
check(await run('ECHO escaped ^> sign'), 'escaped > sign');
check(await run('SET greeting=Hello World'), '');
check(await run('ECHO %GREETING%'), 'Hello World');
check(await run('SET "GREETING=changed value"'), '');
check(await run('ECHO %greeting%'), 'changed value');
check(await run('PROMPT [$P]$G$S'), ''); check(dos.prompt, '[C:\\TEST]> ');
check(await run('MD "New Folder"'), '');
contains(await run('COPY ONE.TXT "New Folder"'), '1 file(s) copied');
check(fs.read('C:\\TEST\\New Folder\\ONE.TXT'), fs.read('C:\\TEST\\ONE.TXT'));
contains(await run('COPY ONE.TXT TWO.TXT'), 'already exists');
contains(await run('COPY /Y ONE.TXT TWO.TXT'), '1 file(s) copied');
check(fs.read('C:\\TEST\\TWO.TXT'), fs.read('C:\\TEST\\ONE.TXT'));
check(await run('REN "New Folder\\ONE.TXT" FIRST.TXT'), '');
check(fs.exists('C:\\TEST\\New Folder\\FIRST.TXT'), true);
contains(await run('MOVE "New Folder\\FIRST.TXT" "C:\\TEST\\MOVED.TXT"'), '1 file(s) moved');
check(await run('RD "New Folder"'), '');
contains(await run('RD SUB'), 'not empty');
contains(await run('RD C:\\'), 'drive root');
check(await run('ATTRIB +R +H MOVED.TXT'), '');
check(fs.get('C:\\TEST\\MOVED.TXT').readOnly, true);
check((await run('DIR /B')).includes('MOVED.TXT'), false);
contains(await run('DIR /B /A'), 'MOVED.TXT');
contains(await run('DEL MOVED.TXT'), 'read-only');
contains(await run('ECHO overwrite > MOVED.TXT'), 'read-only');
contains(await run('ATTRIB MOVED.TXT'), 'R');
check(await run('ATTRIB -R -H MOVED.TXT'), '');
contains(await run('DEL MOVED.TXT'), '1 file(s) deleted');
check(fs.exists('C:\\TEST\\MOVED.TXT'), false);
check(fs.flushCount, 2);
contains(await run('TREE /F'), 'DEEP.TXT');
contains(await run('CHKDSK'), 'No filesystem errors found');
const expectedStorage = [...fs.nodes.values()].filter(n => n.type === 'file').reduce((sum, n) => sum + new TextEncoder().encode(n.content).length, 0);
contains(await run('CHKDSK'), expectedStorage.toLocaleString('en-US') + ' bytes');
contains(await run('MEM'), 'virtual file(s)');
contains(await run('VER'), 'not emulated');
contains(await run('missing.exe'), 'cannot run');
check(dos.errorlevel, 1);
contains(await run('START missing.exe'), 'not emulated');
contains(await run('unknown-command'), 'Bad command or file name');
check(await run('START notepad "ONE.TXT"'), ''); check(launched.at(-1).app, 'notepad'); check(launched.at(-1).args, ['ONE.TXT']);
check(await run('C:\\WINDOWS\\NOTEPAD.EXE'), ''); check(launched.at(-1).app, 'notepad');
check(await run('START ONE.TXT'), ''); check(opened.at(-1), 'C:\\TEST\\ONE.TXT');
check(await run('START "" "ONE.TXT"'), ''); check(opened.at(-1), 'C:\\TEST\\ONE.TXT');
contains(await run('START missing-app'), 'not found');
check((await dos.execute('CLS')).clear, true);
check((await dos.execute('EXIT')).exit, true);
contains(await run('DATE 02-29-2024'), '2/29/2024');
contains(await run('DATE 02-30-2024'), 'Invalid date');
contains(await run('TIME 1:23 PM'), '13:23');

fs.write('C:\\TEST\\ARGS.BAT', '@echo off\r\necho %1 %2\r\necho %*\r\nset SAVED=%1\r\necho %SAVED%\r\n');
check(await run('ARGS "hello world" again'), 'hello world again\n"hello world" again\nhello world');
fs.write('C:\\TEST\\CHILD.BAT', '@echo child\r\nexit /b\r\necho skipped');
fs.write('C:\\TEST\\PARENT.BAT', '@echo off\r\ncall CHILD.BAT\r\necho parent');
check(await run('PARENT'), 'child\nparent');
fs.write('C:\\WINDOWS\\COMMAND\\PATHAPP.BAT', '@echo path-found');
check(await run('PATHAPP'), 'path-found');
fs.write('C:\\TEST\\LOOP.BAT', '@echo off\n:loop\ngoto loop');
dos.maxBatchLines = 12;
contains(await run('LOOP'), 'command limit exceeded');
fs.write('C:\\TEST\\RECURSE.BAT', '@call RECURSE.BAT');
dos.maxBatchLines = 1000;
contains(await run('RECURSE'), 'nesting limit exceeded');
const originalRead = fs.read;
fs.read = function(path) { if (this.norm(path).toLowerCase() === 'c:\\test\\one.txt') throw Error('Unreadable file'); return originalRead.call(this, path); };
contains(await run('CHKDSK'), 'issue(s) found');
fs.read = originalRead;
check(await run('REN *.TXT *.BAK'), '');
check(fs.exists('C:\\TEST\\ONE.BAK'), true);
contains(await run('DEL /S *.BAK'), 'file(s) deleted');
check(await run('RD /S SUB'), '');
check(fs.exists('C:\\TEST\\SUB'), false);
await run('CD \\'); contains(await run('DIR /B *.*'), 'NOEXT');
console.log(`${checks} integration assertions passed.`);
