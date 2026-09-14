# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A classic Tetris implementation in vanilla JavaScript with HTML5 Canvas — no build step, no dependencies, no `package.json`. Just `index.html`, `style.css`, and `game.js`.

## Running the game

Open `index.html` directly in a browser, or serve it statically:

```bash
python3 -m http.server 8000
# or
npx serve .
```

There is no build, lint, or test tooling in this repo — there is nothing to compile or run beyond opening the page.

## Architecture

Everything lives in three files with a direct 1:1 mapping:

- `index.html` — DOM structure: the main `<canvas id="board">` (300×600, 10×20 grid of 30px blocks), a `<canvas id="next-canvas">` for the preview piece, the score/lines/level panel, the game-over overlay (`#overlay`), and the separate pause menu (`#pause-menu`).
- `style.css` — dark/retro arcade visual theme.
- `game.js` — all game logic, structured around:
  - **Board model**: a `ROWS × COLS` matrix where each cell is `0` (empty) or a color index `1–7` identifying which piece type occupies it.
  - **Pieces**: the 7 tetrominoes defined as square matrices in `PIECES`. Rotation (`rotateCW`) transposes + reverses rows; `tryRotate` applies basic wall kicks (offsets `[0, -1, 1, -2, 2]`) so pieces can rotate against walls.
  - **Collision** (`collide`): checks board bounds and overlap with locked cells.
  - **Game loop** (`loop`): driven by `requestAnimationFrame`, accumulates elapsed time and drops the current piece one row once `dropInterval` is exceeded.
  - **Line clearing** (`clearLines`): scans bottom-up, splices out full rows and unshifts empty ones at the top.
  - **Scoring**: classic table `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 pts/cell dropped, soft drop adds 1 pt/row.
  - **Leveling/speed**: `level = startingLevel + Math.floor(lines / 10)`; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms. `startingLevel` comes from the pause menu's "Nivel inicial" selector, persisted in `localStorage` (`STARTING_LEVEL_STORAGE_KEY`) and applied by `init()`.
  - **Ghost piece** (`ghostY`): projects where the current piece would land and renders it at `globalAlpha = 0.2`.
  - **Pause menu** (`#pause-menu`, separate from the game-over `#overlay`): `togglePause()`/`showPauseMenu()` toggle it on `P` or `Escape`. It has two sub-sections toggled via `.hidden` — `#pause-main` (Reanudar / Reiniciar / Ver controles / Nivel inicial select) and `#pause-controls` (the key list, with a "Volver" button back to `#pause-main`). While `paused` is true, the `keydown` handler's early return blocks all game-affecting keys (arrows, `KeyX`, `Space`).

Control flow: `init()` builds the board and starts the loop → `loop()` advances gravity and calls `draw()` each frame → `keydown` handlers move/rotate/drop the piece → `lockPiece()` merges the piece into the board, clears lines, and spawns the next one. If a freshly spawned piece immediately collides, `endGame()` fires and shows the Game Over overlay.

## Tuning constants (in `game.js`)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval` are the main knobs. If you change `COLS`, `ROWS`, or `BLOCK`, update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS × BLOCK` and `ROWS × BLOCK`).
