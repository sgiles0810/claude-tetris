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

- `index.html` — DOM structure: an `#start-screen` (title, top-5 highscore table, best-combo/max-lines stats, "Resetear records" button, and the JUGAR button) shown on load, plus a `#game-wrapper` (hidden until JUGAR is clicked) containing the main `<canvas id="board">` (300×600, 10×20 grid of 30px blocks), a `<canvas id="next-canvas">` for the preview piece, the score/lines/level panel, and the pause/game-over overlay. The overlay has a `#name-entry` form (shown only when a game-over score qualifies for the top 5) and an `#overlay-highscores` table.
- `style.css` — dark/retro arcade visual theme; the start-screen/highscore/name-entry rules live in their own section at the end of the file.
- `game.js` — all game logic, structured around:
  - **Board model**: a `ROWS × COLS` matrix where each cell is `0` (empty) or a color index `1–7` identifying which piece type occupies it.
  - **Pieces**: the 7 tetrominoes defined as square matrices in `PIECES`. Rotation (`rotateCW`) transposes + reverses rows; `tryRotate` applies basic wall kicks (offsets `[0, -1, 1, -2, 2]`) so pieces can rotate against walls.
  - **Collision** (`collide`): checks board bounds and overlap with locked cells.
  - **Game loop** (`loop`): driven by `requestAnimationFrame`, accumulates elapsed time and drops the current piece one row once `dropInterval` is exceeded.
  - **Line clearing** (`clearLines`): scans bottom-up, splices out full rows and unshifts empty ones at the top; returns the number of lines cleared.
  - **Scoring**: classic table `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 pts/cell dropped, soft drop adds 1 pt/row.
  - **Leveling/speed**: level increases every 10 lines; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
  - **Ghost piece** (`ghostY`): projects where the current piece would land and renders it at `globalAlpha = 0.2`.
  - **Combo tracking**: `lockPiece()` increments a `combo` counter whenever `clearLines()` reports at least one cleared line, and resets it to 0 otherwise; `maxComboThisGame` tracks the best combo reached in the current game.
  - **Highscore module**: `localStorage`-backed, under `tetris-highscores` (top 5 `{name, score, lines, level, date}` entries) and `tetris-stats` (global `{bestCombo, maxLines}`). `qualifiesForHighscore`/`insertHighscore` manage the top-5 list; `renderHighscoreTable`/`renderStats` render it (via `textContent`, never `innerHTML`) into both `#start-highscore-table`/`#start-stats` on the start screen and `#overlay-highscores` on the game-over screen, highlighting the current run's entry when applicable. "Resetear records" clears both keys after an inline (non-blocking) confirmation.

Control flow: the start screen is shown on load; clicking JUGAR hides it, reveals `#game-wrapper`, and calls `init()` (which also resets combo/highscore overlay state) to build the board and start the loop. `loop()` advances gravity and calls `draw()` each frame → `keydown` handlers move/rotate/drop the piece → `lockPiece()` merges the piece into the board, clears lines, updates the combo counter, and spawns the next one. If a freshly spawned piece immediately collides, `endGame()` fires: it updates the global combo/max-lines stats, and shows the Game Over overlay — with a name-entry form if the score qualifies for the top 5, otherwise the top-5 table directly. Restarting (`restartBtn`) calls `init()` again without returning to the start screen.

## Tuning constants (in `game.js`)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval` are the main knobs. If you change `COLS`, `ROWS`, or `BLOCK`, update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS × BLOCK` and `ROWS × BLOCK`).
