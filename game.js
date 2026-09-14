'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

const THEME_STORAGE_KEY = 'tetris-theme';
const GRID_COLORS = { dark: '#22222e', light: '#dcdce6' };

// ---- Visual skins ----
// Each skin owns its own 7-color palette and its own block-drawing function.
// Skins only affect how canvas blocks are rendered; they are independent of
// the light/dark theme toggle (which controls page chrome via CSS vars).
const SKIN_STORAGE_KEY = 'tetris-skin';

const NEON_COLORS = [
  null,
  '#00e5ff', // I
  '#ffea00', // O
  '#e040fb', // T
  '#00e676', // S
  '#ff1744', // Z
  '#2979ff', // J
  '#ff9100', // L
];

const PASTEL_COLORS = [
  null,
  '#b8e8ec', // I
  '#fff3c4', // O
  '#e0c3e8', // T
  '#c8e6c9', // S
  '#f5c6c6', // Z
  '#c3d9f5', // J
  '#f8d9b0', // L
];

const PIXEL_COLORS = COLORS;

// Note: callers (drawBlock dispatcher below) already wrap each of these in
// ctx.save()/ctx.restore() with globalAlpha pre-set, so skin draw functions
// below focus purely on shape/color and never need to touch or reset
// globalAlpha/shadowBlur/shadowColor themselves.

function drawBlockRetro(context, x, y, colorIndex, size) {
  const color = SKINS.retro.palette[colorIndex];
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
}

function drawBlockNeon(context, x, y, colorIndex, size) {
  const color = SKINS.neon.palette[colorIndex];
  context.shadowBlur = 15;
  context.shadowColor = color;
  context.fillStyle = color;
  context.fillRect(x * size + 3, y * size + 3, size - 6, size - 6);
}

function drawBlockPastel(context, x, y, colorIndex, size) {
  const color = SKINS.pastel.palette[colorIndex];
  context.fillStyle = color;
  const px = x * size + 2;
  const py = y * size + 2;
  const s = size - 4;
  const r = Math.min(6, s / 2);
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(px, py, s, s, r);
  } else {
    // manual fallback for older browsers without roundRect support
    context.moveTo(px + r, py);
    context.arcTo(px + s, py, px + s, py + s, r);
    context.arcTo(px + s, py + s, px, py + s, r);
    context.arcTo(px, py + s, px, py, r);
    context.arcTo(px, py, px + s, py, r);
    context.closePath();
  }
  context.fill();
}

function drawBlockPixel(context, x, y, colorIndex, size) {
  const color = SKINS.pixel.palette[colorIndex];
  context.fillStyle = color;
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  context.fillRect(px, py, s, s);
  // dither texture: a 2x2 checkerboard of lighter/darker sub-rects to fake a pixelated look
  const cell = s / 2;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      context.fillStyle = (i + j) % 2 === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
      context.fillRect(px + i * cell, py + j * cell, cell, cell);
    }
  }
}

const SKINS = {
  retro: { palette: COLORS, background: null, drawBlock: drawBlockRetro },
  neon: { palette: NEON_COLORS, background: '#0a0a14', drawBlock: drawBlockNeon },
  pastel: { palette: PASTEL_COLORS, background: null, drawBlock: drawBlockPastel },
  pixel: { palette: PIXEL_COLORS, background: null, drawBlock: drawBlockPixel },
};

let currentSkin = 'retro';

function applySkin(skin) {
  currentSkin = SKINS[skin] ? skin : 'retro';
  if (skinSelect) skinSelect.value = currentSkin;
  localStorage.setItem(SKIN_STORAGE_KEY, currentSkin);
}

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function currentTheme() {
  return document.body.classList.contains('light-theme') ? 'light' : 'dark';
}

function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  themeToggle.checked = theme === 'light';
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  // save/restore isolates any per-skin context state (shadowBlur, shadowColor,
  // globalAlpha, ...) so it can never leak into grid lines or subsequent draws.
  context.save();
  context.globalAlpha = alpha ?? 1;
  SKINS[currentSkin].drawBlock(context, x, y, colorIndex, size);
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = GRID_COLORS[currentTheme()];
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const skinBg = SKINS[currentSkin].background;
  if (skinBg) {
    ctx.fillStyle = skinBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const skinBg = SKINS[currentSkin].background;
  if (skinBg) {
    nextCtx.fillStyle = skinBg;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  }
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // let focused form controls (e.g. the skin <select>) handle their own
  // arrow-key navigation instead of also moving/rotating the piece
  const activeTag = document.activeElement && document.activeElement.tagName;
  if (activeTag === 'SELECT' || activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked ? 'light' : 'dark');
  draw();
  drawNext();
});

if (skinSelect) {
  skinSelect.addEventListener('change', () => {
    applySkin(skinSelect.value);
    draw();
    drawNext();
    skinSelect.blur(); // return keyboard focus to the game immediately
  });
}

applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || 'dark');
applySkin(localStorage.getItem(SKIN_STORAGE_KEY) || 'retro');
init();
