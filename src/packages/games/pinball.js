import { el } from '@win95/ui/dom.js';
import { menuBar } from '@win95/ui/menu.js';

/**
 * 3D Pinball for Windows - Space Cadet.
 *
 * The table itself is the original Space Cadet built for the browser, carried
 * whole in `src/programs/pinball` beside its licence. It runs in a page of its
 * own inside the window - `space-cadet.html` - so that every launch is a fresh
 * table, and closing the window stops its picture, its sound and its keys
 * instead of leaving them running behind a gone window.
 *
 * That page draws the game's 600 × 416 picture under a strip cut from the game's
 * title art, which stands in for the menu bar the game draws for itself. The
 * desktop draws the menus; choosing an entry asks the page to press the same
 * spot of the game's own bar, so the two agree without either being redrawn.
 */
const TABLE_WIDTH = 600;
const TABLE_HEIGHT = 416;
const PICTURE_PAGE = './programs/pinball/space-cadet.html';

export function pinball(s) {
    const w = s.wm.create({
        title: '3D Pinball for Windows - Space Cadet',
        icon: 'pinball',
        /* 600 × 416 of table, plus the menu bar and the frame around it. */
        width: TABLE_WIDTH + 6.5,
        height: TABLE_HEIGHT + 47,
        resizable: false
    });
    w.body.classList.add('pinball-body');
    w.element.classList.add('pinball-window');

    const frame = el('iframe', {
        class: 'pinball-frame',
        title: '3D Pinball for Windows - Space Cadet',
        src: PICTURE_PAGE
    });
    w.body.append(frame);

    /** The page inside the window, once it has loaded. */
    const table = () => {
        try {
            return frame.contentWindow?.pinball ?? null;
        }
        catch {
            return null;
        }
    };
    const ready = () => !!table()?.ready;

    /* Frozen while a menu of the desktop's is open over it: the game plays on
       underneath, but the picture stands still, so the game's own bar cannot
       show between the menu and the strip. */
    let watching = 0, held = false;
    const watchMenus = () => {
        watching = requestAnimationFrame(() => {
            if (w.closed)
                return;
            const open = w.element.classList.contains('active') && !!document.querySelector('#menus .popup-menu');
            if (open !== held) {
                held = open;
                const game = table();
                if (game)
                    open ? game.freeze() : game.thaw();
            }
            watchMenus();
        });
    };
    watchMenus();
    w.onClosed.push(() => cancelAnimationFrame(watching));

    /* The page hands back the keys the desktop answers itself; keys never cross
       a frame boundary on their own, so this is what makes Ctrl+Esc - Start,
       from anywhere, as it always was - still work with the table focused. */
    const shellKeys = event => {
        if (event.source !== frame.contentWindow)
            return;
        if (event.data?.type !== 'pinball-shell-key')
            return;
        if (event.data.key === 'Control+Escape')
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', ctrlKey: true, bubbles: true, cancelable: true }));
        /* F1 is the shell's Help key, as it is in every other program. */
        else if (event.data.key === 'F1')
            openHelp();
    };
    window.addEventListener('message', shellKeys);
    w.onClosed.push(() => window.removeEventListener('message', shellKeys));
    /* Clicking the window puts the keyboard back in the table. */
    w.element.addEventListener('pointerdown', () => setTimeout(() => table()?.focus(), 0));

    const state = { players: 1, sound: true, music: true, audio: true };
    const choose = (top, item, sub) => {
        const game = table();
        if (game)
            game.chooseMenu(top, item, sub);
    };
    const press = key => table()?.press(key);
    const openHelp = () => s.launch('help', { topic: 'pinball' });
    const setAudio = () => {
        state.audio = !state.audio;
        table()?.setMuted(!state.audio);
    };

    w.setMenu(menuBar([
        {
            label: 'Game',
            items: () => [
                { label: 'New Game', shortcut: 'F2', action: () => press('F2') },
                { label: 'Launch Ball', action: () => choose(0, 1) },
                { label: 'Pause/Resume Game', shortcut: 'F3', action: () => press('F3') },
                null,
                { label: 'High Scores…', disabled: true },
                { label: 'Demo', action: () => choose(0, 4) },
                null,
                { label: 'Exit', action: () => w.close() }
            ]
        },
        {
            label: 'Options',
            items: () => [
                {
                    label: 'Select Players',
                    items: [1, 2, 3, 4].map(count => ({
                        label: `${count} Player${count > 1 ? 's' : ''}`,
                        checked: state.players === count,
                        action: () => {
                            state.players = count;
                            choose(1, 0, count - 1);
                        }
                    }))
                },
                null,
                { label: 'Sound', shortcut: 'F5', checked: state.sound, action: () => { state.sound = !state.sound; press('F5'); } },
                { label: 'Music', shortcut: 'F6', checked: state.music, action: () => { state.music = !state.music; press('F6'); } },
                null,
                { label: 'Audio', checked: state.audio, action: setAudio },
                null,
                { label: 'Player Controls…', shortcut: 'F8', action: () => press('F8') }
            ]
        },
        {
            label: 'Help',
            items: () => [
                { label: 'Help Topics', shortcut: 'F1', action: openHelp },
                null,
                { label: 'About Pinball', action: about }
            ]
        }
    ]));

    const about = () => s.ui.message(
        '3D Pinball for Windows - Space Cadet\n\nLeft flipper: Z\nRight flipper: /\nPlunger: Space\nTable bump: X, . and the up arrow\n\nNew game: F2\nPause: F3\n\nHelp Topics has the full guide to the table.',
        'About Pinball', ['OK'], { owner: w, height: 290, icon: 'pinball' });

    frame.addEventListener('load', () => {
        /* The page loads the game itself; this is only the polite wait. */
        const poll = () => {
            if (w.closed)
                return;
            if (ready())
                table()?.focus();
            else
                setTimeout(poll, 100);
        };
        poll();
    });

    return w;
}
