import { ICON_DATA } from './icon-data.js';
import { el } from './dom.js';
const paths = { computer: 'my-computer', network: 'network-neighborhood', recycle: 'recycle-bin-empty', recycleFull: 'recycle-bin-full', folder: 'folder', disk: 'hard-drive', floppy: 'floppy', cd: 'cd-drive', document: 'text-document', notepad: 'notepad', wordpad: 'wordpad', paint: 'paint', calculator: 'calculator', solitaire: 'solitaire', minesweeper: 'minesweeper', hearts: 'hearts', freecell: 'freecell', control: 'control-panel', display: 'display', dos: 'dos-prompt', help: 'help', run: 'run', find: 'find', shutdown: 'shut-down', printer: 'printer', sound: 'sound-recorder', media: 'media-player', clock: 'time-date', keyboard: 'keyboard', mouse: 'mouse', settings: 'settings', logoff: 'logoff', login: 'login', internet: 'internet', passwords: 'passwords', joystick: 'joystick', scandisk: 'scandisk', backup: 'backup', defrag: 'defrag', accessibility: 'accessibility', mail: 'mail', briefcase: 'briefcase', windows: 'windows-logo', about: 'windows-logo', font: 'fonts-control', task: 'programs', connection: 'network-neighborhood', modem: 'modem', suspend: 'suspend', text: 'text-document', image: 'paint', package: 'programs', volume: 'volume', programs: 'programs', documents: 'documents' };
const fallback = { computer: '▣', network: '▧', recycle: '♜', folder: '▰', disk: '▱', document: '▤', notepad: '▤', wordpad: '▤', paint: '▨', calculator: '▦', solitaire: '♠', minesweeper: '✹', control: '▦', dos: 'C:', help: '?', run: '▣', find: '⌕', shutdown: '▣', printer: '▣', sound: '♪', media: '♫', clock: '◷', keyboard: '▤', mouse: '▯', internet: 'e', mail: '✉', briefcase: '▣', windows: '▦' };
export function icon(name = 'document', size = 32) {
    const img = el('img', { class: 'icon', src: ICON_DATA[`${paths[name] || name}-${size}`] || ICON_DATA[`${paths[name] || name}-32`] || ICON_DATA['text-document-32'], width: size, height: size, alt: '', draggable: false });
    img.addEventListener('error', () => {
        if (!img.dataset.retried) {
            img.dataset.retried = '1';
            img.src = `./assets/icons/${paths[name] || name}-32.png`;
        }
        else {
            const f = el('span', { class: `icon-fallback icon-${name}`, text: fallback[name] || '▤', style: { width: size + 'px', height: size + 'px', fontSize: size * .85 + 'px' } });
            img.replaceWith(f);
        }
    });
    return img;
}
export function fileIcon(node) {
    if (node?.type === 'folder')
        return 'folder';
    const ext = node?.path?.split('.').pop().toLowerCase();
    return ({ txt: 'notepad', ini: 'notepad', sys: 'document', bat: 'dos', rtf: 'wordpad', doc: 'wordpad', htm: 'internet', html: 'internet', bmp: 'paint', png: 'paint', jpg: 'image', jpeg: 'image', wav: 'sound', mp3: 'media', webm: 'media', exe: 'task', lnk: 'task' })[ext] || 'document';
}
