# 3D Pinball for Windows - Space Cadet

The Space Cadet table, built to run in a browser and carried here so the desktop
can open it in a window. The build is the one from
[SpaceCadetPinball](https://github.com/alula/SpaceCadetPinball) (the browser port
of the original 1995 table), included under the MIT licence in [LICENSE](./LICENSE).

| File | What it is |
| --- | --- |
| `space-cadet.html` | The page the window shows: the table, the strip that stands in for the game's own bar, and a still frame for the moment a menu is open |
| `SpaceCadetPinball.js`, `.wasm`, `.data` | The game itself |
| `pinball-overlay.png` | The top of the title picture, drawn as the bezel over the table |
| `pinball-splash.png` | The loading picture |

The page offers `window.pinball` to the desktop: `chooseMenu(top, item, sub)`
presses the same spot of the game's own menu bar a player would, `press(key)`
sends a key to the table, and `freeze()` / `thaw()` hold and release the
picture while the desktop's menus are open. It asks the desktop for
`Ctrl+Esc` back, since keys do not cross a frame boundary on their own.

The keys are the game's own: `Z` and `/` for the flippers, `Space` for the
plunger, `X`, `.` and the up arrow to bump the table, `F2` for a new game,
`F3` to pause, `F4` for full screen, `F5` and `F6` for sound and music.

How to play - the shots, the keys, the ranks from Cadet to Fleet Admiral - is
written for the desktop's Help window as the `pinball` topic in
`src/packages/apps/utilities.js`; the window's Help menu and `F1` open it.
