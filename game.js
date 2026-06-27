const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestScoreEl = document.querySelector("#bestScore");
const speedLabelEl = document.querySelector("#speedLabel");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const refreshButton = document.querySelector("#refreshButton");
const leaderboardEl = document.querySelector("#leaderboard");
const playerNameEl = document.querySelector("#playerName");
const nameStatusEl = document.querySelector("#nameStatus");
const speedModeEl = document.querySelector("#speedMode");

const gridSize = 20;
const tileCount = canvas.width / gridSize;
const speedModes = {
  novice: { label: "新手", startSpeed: 260, minSpeed: 170, speedStep: 3 },
  expert: { label: "高手", startSpeed: 190, minSpeed: 105, speedStep: 5 },
  master: { label: "绝世高手", startSpeed: 125, minSpeed: 65, speedStep: 7 },
};

let snake;
let food;
let direction;
let nextDirection;
let score;
let bestScore = 0;
let timer = null;
let running = false;
let paused = false;
let speedModeKey = localStorage.getItem("snakeSpeedMode") || "expert";
let currentPlayerName = "";
let leaderboardScores = [];

bestScoreEl.textContent = bestScore;
speedModeEl.value = speedModes[speedModeKey] ? speedModeKey : "expert";
speedModeKey = speedModeEl.value;
playerNameEl.value = localStorage.getItem("snakePlayerName") || "";

function resetGame() {
  snake = [
    { x: 12, y: 13 },
    { x: 11, y: 13 },
    { x: 10, y: 13 },
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  scoreEl.textContent = score;
  updateSpeedLabel();
  food = createFood();
  draw();
}

function startGame() {
  if (!requirePlayerName()) {
    return;
  }

  currentPlayerName = getPlayerName();
  playerNameEl.disabled = true;
  resetGame();
  running = true;
  paused = false;
  overlay.classList.remove("is-visible");
  pauseButton.disabled = false;
  pauseButton.textContent = "暂停";
  scheduleTick();
}

function scheduleTick() {
  clearTimeout(timer);
  if (!running || paused) return;
  const mode = getSpeedMode();
  const delay = Math.max(
    mode.minSpeed,
    mode.startSpeed - Math.floor(score / 5) * mode.speedStep
  );
  timer = setTimeout(() => {
    update();
    scheduleTick();
  }, delay);
}

function update() {
  direction = nextDirection;
  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  if (
    head.x < 0 ||
    head.y < 0 ||
    head.x >= tileCount ||
    head.y >= tileCount ||
    snake.some((part) => part.x === head.x && part.y === head.y)
  ) {
    endGame();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreEl.textContent = score;
    food = createFood();
    updateSpeedLabel();
  } else {
    snake.pop();
  }

  draw();
}

function updateSpeedLabel() {
  speedLabelEl.textContent = getSpeedMode().label;
}

function getSpeedMode() {
  return speedModes[speedModeKey] || speedModes.expert;
}

function createFood() {
  let point;
  do {
    point = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };
  } while (snake.some((part) => part.x === point.x && part.y === point.y));
  return point;
}

function draw() {
  ctx.fillStyle = "#0b0c0f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawFood();
  drawSnake();
}

function drawGrid() {
  ctx.strokeStyle = "rgba(246, 240, 223, 0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= tileCount; i += 1) {
    const pos = i * gridSize + 0.5;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(canvas.width, pos);
    ctx.stroke();
  }
}

function drawSnake() {
  snake.forEach((part, index) => {
    const inset = index === 0 ? 2 : 3;
    ctx.fillStyle = index === 0 ? "#4ee6a8" : "#28bd86";
    ctx.fillRect(
      part.x * gridSize + inset,
      part.y * gridSize + inset,
      gridSize - inset * 2,
      gridSize - inset * 2
    );
  });
}

function drawFood() {
  const cx = food.x * gridSize + gridSize / 2;
  const cy = food.y * gridSize + gridSize / 2;
  ctx.fillStyle = "#ffca5c";
  ctx.beginPath();
  ctx.arc(cx, cy, gridSize * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 202, 92, 0.35)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, gridSize * 0.48, 0, Math.PI * 2);
  ctx.stroke();
}

async function endGame() {
  running = false;
  paused = false;
  clearTimeout(timer);
  pauseButton.disabled = true;
  playerNameEl.disabled = false;

  if (score > bestScore) {
    bestScore = score;
    bestScoreEl.textContent = bestScore;
  }

  await submitScore(score);
  overlayTitle.textContent = "游戏结束";
  overlayText.textContent = `本局得分 ${score}。再来一局，把排行榜顶上去。`;
  startButton.textContent = "重新开始";
  overlay.classList.add("is-visible");
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  pauseButton.textContent = paused ? "继续" : "暂停";

  if (paused) {
    clearTimeout(timer);
    overlayTitle.textContent = "已暂停";
    overlayText.textContent = "按空格或点击继续。";
    startButton.textContent = "继续";
    overlay.classList.add("is-visible");
  } else {
    overlay.classList.remove("is-visible");
    scheduleTick();
  }
}

function setDirection(newDirection) {
  const isReverse =
    newDirection.x + direction.x === 0 && newDirection.y + direction.y === 0;
  if (!isReverse) {
    nextDirection = newDirection;
  }
}

async function loadLeaderboard() {
  try {
    const response = await fetch("/api/leaderboard");
    leaderboardScores = await response.json();
    renderLeaderboard(leaderboardScores);
    updatePlayerBest();
  } catch {
    leaderboardEl.innerHTML = `<li class="empty">排行榜暂时不可用</li>`;
  }
}

async function submitScore(finalScore) {
  const name = currentPlayerName || getPlayerName();
  if (finalScore <= 0 || !name) {
    await loadLeaderboard();
    return;
  }

  try {
    const response = await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        score: finalScore,
      }),
    });
    leaderboardScores = await response.json();
    renderLeaderboard(leaderboardScores);
    updatePlayerBest();
  } catch {
    await loadLeaderboard();
  }
}

function renderLeaderboard(scores) {
  if (!scores.length) {
    leaderboardEl.innerHTML = `<li class="empty">还没有成绩，第一名等你来拿。</li>`;
    return;
  }

  leaderboardEl.innerHTML = scores
    .map(
      (item, index) => `
        <li>
          <span class="rank">${index + 1}</span>
          <span class="name">${escapeHtml(item.name)}</span>
          <span class="points">${item.score}</span>
        </li>
      `
    )
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPlayerName() {
  return playerNameEl.value.trim().slice(0, 16);
}

function requirePlayerName() {
  if (updateNameGate(true)) {
    return true;
  }

  overlayTitle.textContent = "请输入游戏名";
  overlayText.textContent = "游戏名会作为排行榜名称；填写后才能开始。";
  startButton.textContent = "开始游戏";
  overlay.classList.add("is-visible");
  playerNameEl.focus();
  return false;
}

function updateNameGate(showPrompt = false) {
  const name = getPlayerName();
  const hasName = name.length > 0;
  startButton.disabled = !hasName;
  playerNameEl.classList.toggle("is-invalid", showPrompt && !hasName);
  nameStatusEl.classList.toggle("is-ok", hasName);
  nameStatusEl.textContent = hasName
    ? `当前玩家：${name}`
    : "输入游戏名后才能开始游戏。";
  updatePlayerBest();
  return hasName;
}

function updatePlayerBest() {
  const name = currentPlayerName || getPlayerName();
  const playerScore = leaderboardScores.find((item) => item.name === name);
  bestScore = playerScore ? playerScore.score : 0;
  bestScoreEl.textContent = bestScore;
}

window.addEventListener("keydown", (event) => {
  if (["INPUT", "SELECT"].includes(event.target.tagName)) {
    return;
  }

  const keys = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
  };

  if (keys[event.key]) {
    event.preventDefault();
    if (!running) {
      startGame();
    }
    setDirection(keys[event.key]);
  }

  if (event.code === "Space") {
    event.preventDefault();
    togglePause();
  }
});

startButton.addEventListener("click", () => {
  if (running && paused) {
    togglePause();
  } else {
    startGame();
  }
});

pauseButton.addEventListener("click", togglePause);
refreshButton.addEventListener("click", loadLeaderboard);
speedModeEl.addEventListener("change", () => {
  speedModeKey = speedModeEl.value;
  localStorage.setItem("snakeSpeedMode", speedModeKey);
  updateSpeedLabel();
  scheduleTick();
});
playerNameEl.addEventListener("input", () => {
  localStorage.setItem("snakePlayerName", playerNameEl.value);
  if (!running) {
    currentPlayerName = getPlayerName();
  }
  updateNameGate();
});

resetGame();
if (!updateNameGate()) {
  overlayTitle.textContent = "请输入游戏名";
  overlayText.textContent = "游戏名会作为排行榜名称；填写后才能开始。";
  startButton.textContent = "开始游戏";
}
loadLeaderboard();
