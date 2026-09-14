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

const THEME_STORAGE_KEY = 'tetris-theme';
const GRID_COLORS = { dark: '#22222e', light: '#dcdce6' };

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, maxComboThisGame;

// ==================== Highscore module ====================
// Stores the top 5 scores and global aggregate stats in localStorage.

const HIGHSCORES_STORAGE_KEY = 'tetris-highscores';
const STATS_STORAGE_KEY = 'tetris-stats';
const MAX_HIGHSCORES = 5;

const startScreen = document.getElementById('start-screen');
const gameWrapper = document.getElementById('game-wrapper');
const playBtn = document.getElementById('play-btn');
const startHighscoreTableEl = document.getElementById('start-highscore-table');
const startStatsEl = document.getElementById('start-stats');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const resetConfirmEl = document.getElementById('reset-confirm');
const resetConfirmYesBtn = document.getElementById('reset-confirm-yes');
const resetConfirmNoBtn = document.getElementById('reset-confirm-no');
const nameEntryEl = document.getElementById('name-entry');
const nameInputEl = document.getElementById('name-input');
const nameSubmitBtn = document.getElementById('name-submit-btn');
const overlayHighscoresEl = document.getElementById('overlay-highscores');

function loadHighscores() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HIGHSCORES_STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveHighscores(list) {
  try {
    localStorage.setItem(HIGHSCORES_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    // storage unavailable/full — fail silently, in-memory state still works
  }
}

function loadStats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATS_STORAGE_KEY));
    if (parsed && typeof parsed === 'object') {
      return {
        bestCombo: Number(parsed.bestCombo) || 0,
        maxLines: Number(parsed.maxLines) || 0,
      };
    }
  } catch (e) {
    // ignore malformed data
  }
  return { bestCombo: 0, maxLines: 0 };
}

function saveStats(stats) {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    // storage unavailable/full — fail silently, in-memory state still works
  }
}

function qualifiesForHighscore(candidateScore) {
  const list = loadHighscores();
  if (list.length < MAX_HIGHSCORES) return true;
  return candidateScore > list[list.length - 1].score;
}

function insertHighscore(name, candidateScore, candidateLines, candidateLevel) {
  const list = loadHighscores();
  const entry = {
    name,
    score: candidateScore,
    lines: candidateLines,
    level: candidateLevel,
    date: new Date().toISOString(),
  };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, MAX_HIGHSCORES);
  saveHighscores(list);
  return entry;
}

function resetHighscores() {
  try {
    localStorage.removeItem(HIGHSCORES_STORAGE_KEY);
    localStorage.removeItem(STATS_STORAGE_KEY);
  } catch (e) {
    // storage unavailable — nothing to clean up
  }
}

function renderHighscoreTable(container, highlightEntry) {
  const list = loadHighscores();
  container.textContent = '';
  if (list.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'highscore-empty';
    empty.textContent = 'Sin puntuaciones todavía';
    container.appendChild(empty);
    return;
  }
  const table = document.createElement('table');
  table.className = 'highscore-table';
  const tbody = document.createElement('tbody');
  list.forEach((entry, idx) => {
    const row = document.createElement('tr');
    // Entries are re-read from localStorage via JSON.parse, so they are
    // never the same object reference as highlightEntry — compare by the
    // (unique enough) date timestamp instead of using `===`.
    if (highlightEntry && entry.date === highlightEntry.date) {
      row.classList.add('highscore-highlight');
    }
    const rankCell = document.createElement('td');
    rankCell.textContent = `${idx + 1}.`;
    const nameCell = document.createElement('td');
    nameCell.textContent = entry.name;
    const scoreCell = document.createElement('td');
    scoreCell.textContent = entry.score.toLocaleString();
    const linesCell = document.createElement('td');
    linesCell.textContent = `${entry.lines}L`;
    row.appendChild(rankCell);
    row.appendChild(nameCell);
    row.appendChild(scoreCell);
    row.appendChild(linesCell);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderStats(container) {
  const stats = loadStats();
  container.textContent = '';
  const comboEl = document.createElement('span');
  comboEl.textContent = `Mejor combo: ${stats.bestCombo}`;
  const maxLinesEl = document.createElement('span');
  maxLinesEl.textContent = `Máx. líneas: ${stats.maxLines}`;
  container.appendChild(comboEl);
  container.appendChild(maxLinesEl);
}

function refreshStartScreen() {
  renderHighscoreTable(startHighscoreTableEl, null);
  renderStats(startStatsEl);
}

function submitHighscoreName() {
  const raw = nameInputEl.value.trim();
  const name = (raw || 'AAA').slice(0, 12);
  const entry = insertHighscore(name, score, lines, level);
  nameEntryEl.classList.add('hidden');
  renderHighscoreTable(overlayHighscoresEl, entry);
  overlayHighscoresEl.classList.remove('hidden');
  restartBtn.classList.remove('hidden');
}

playBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  gameWrapper.classList.remove('hidden');
  init();
});

resetRecordsBtn.addEventListener('click', () => {
  resetRecordsBtn.classList.add('hidden');
  resetConfirmEl.classList.remove('hidden');
});

resetConfirmYesBtn.addEventListener('click', () => {
  resetHighscores();
  refreshStartScreen();
  resetConfirmEl.classList.add('hidden');
  resetRecordsBtn.classList.remove('hidden');
});

resetConfirmNoBtn.addEventListener('click', () => {
  resetConfirmEl.classList.add('hidden');
  resetRecordsBtn.classList.remove('hidden');
});

nameSubmitBtn.addEventListener('click', submitHighscoreName);

nameInputEl.addEventListener('keydown', e => {
  if (e.code === 'Enter') {
    e.preventDefault();
    submitHighscoreName();
  }
});

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
  return cleared;
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
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    if (combo > maxComboThisGame) maxComboThisGame = combo;
  } else {
    combo = 0;
  }
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
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
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

  const stats = loadStats();
  let statsChanged = false;
  if (maxComboThisGame > stats.bestCombo) {
    stats.bestCombo = maxComboThisGame;
    statsChanged = true;
  }
  if (lines > stats.maxLines) {
    stats.maxLines = lines;
    statsChanged = true;
  }
  if (statsChanged) saveStats(stats);

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  const qualifies = qualifiesForHighscore(score);
  if (qualifies) {
    nameInputEl.value = '';
    nameEntryEl.classList.remove('hidden');
    overlayHighscoresEl.classList.add('hidden');
    // Hide restart while a qualifying score awaits a name, so it can't be
    // discarded by accident before it's saved.
    restartBtn.classList.add('hidden');
  } else {
    nameEntryEl.classList.add('hidden');
    renderHighscoreTable(overlayHighscoresEl, null);
    overlayHighscoresEl.classList.remove('hidden');
    restartBtn.classList.remove('hidden');
  }
  overlay.classList.remove('hidden');
  if (qualifies) nameInputEl.focus();
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
  combo = 0;
  maxComboThisGame = 0;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  // Clear any leftover game-over UI (name entry / highscore list / hidden
  // restart button) so it doesn't bleed into a subsequent pause screen.
  nameEntryEl.classList.add('hidden');
  overlayHighscoresEl.classList.add('hidden');
  restartBtn.classList.remove('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
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

applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || 'dark');
refreshStartScreen();
