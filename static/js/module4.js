document.addEventListener("DOMContentLoaded", () => {
  startLevel(currentLevelIndex);
  document.addEventListener("keydown", handleKeyPress);
});

// ========== Таймер ==========
const totalTimeLimit = 240; // общее время на все уровни
let timeLeft = totalTimeLimit;
let timerInterval = null;
let timerStarted = false;

function formatTime(s) {
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function updateTimerDisplay() {
  const el = document.getElementById('timer');
  if (!el) return;
  el.textContent = `Таймер: ${formatTime(timeLeft)}`;
  if (timeLeft <= 10) el.classList.add('low');
  else el.classList.remove('low');
}

function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      stopTimer();
      onTimeOut();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  const el = document.getElementById('timer');
  if (el) el.classList.remove('low');
}

// ========== Уровни и карта ==========
const levels = [
  {
    characterStart: { x: 5, y: 5 },
    blocks: [
      { x: 2, y: 2, id: "01000111" },
      { x: 3, y: 3, id: "01000001" },
      { x: 1, y: 3, id: "01001101" },
      { x: 5, y: 6, id: "01000101" },
    ],
    targets: [
      { x: 8, y: 8, id: "G" },
      { x: 4, y: 5, id: "A" },
      { x: 9, y: 1, id: "M" },
      { x: 2, y: 6, id: "E" },
    ],
    obstacles: [
      { x: 4, y: 4 }, { x: 7, y: 7 }, { x: 5, y: 2 },
      { x: 2, y: 9 }, { x: 3, y: 7 }, { x: 2, y: 4 }
    ]
  },
  {
    characterStart: { x: 0, y: 9 },
    blocks: [
      { x: 1, y: 8, id: 66 },
      { x: 2, y: 7, id: 105 },
      { x: 3, y: 6, id: 108 },
      { x: 4, y: 5, id: 105 },
      { x: 5, y: 4, id: 109 },
    ],
    targets: [
      { x: 8, y: 2, id: "B" },
      { x: 2, y: 1, id: "i" },
      { x: 7, y: 3, id: "l" },
      { x: 6, y: 9, id: "i" },
      { x: 5, y: 7, id: "m" },
    ],
    obstacles: [
      { x: 3, y: 3 }, { x: 4, y: 4 }, { x: 6, y: 6 },
      { x: 3, y: 8 }, { x: 7, y: 4 }, { x: 2, y: 6 }
    ]
  }
];

// ========== Общие переменные ==========
const boardSize = 10;
let currentLevelIndex = 0;
let characterPosition;
let blocks = [];
let targets = [];
let obstacles = [];
let score = 0;
let firstWarningShown = false;
let firstMistake = true;

// ========== Старт уровня ==========
function startLevel(index) {
  const level = levels[index];
  characterPosition = { ...level.characterStart };
  blocks = level.blocks.map(b => ({ ...b, startX: b.x, startY: b.y }));
  targets = level.targets.map(t => ({ ...t }));
  obstacles = level.obstacles.map(o => ({ ...o }));
  firstWarningShown = false;
  firstMistake = true;
  renderBoard();

  // старт таймера для уровня (использует timeLimit если задан)
    if (!timerStarted) {
      timerStarted = true;
      startTimer();
    }
}

// ========== Рендер ==========
function renderBoard() {
  const board = document.getElementById("board");
  board.innerHTML = "";

  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";

      if (characterPosition.x === x && characterPosition.y === y) {
        cell.classList.add("character");
      }

      const block = blocks.find(b => b.x === x && b.y === y);
      if (block) {
        cell.classList.add("block");
        cell.textContent = block.id;
      }

      const target = targets.find(t => t.x === x && t.y === y);
      if (target) {
        cell.classList.add("target");
        cell.textContent = target.id;
      }

      const obstacle = obstacles.find(o => o.x === x && o.y === y);
      if (obstacle) {
        cell.classList.add("obstacle");
      }

      board.appendChild(cell);
    }
  }

  // Обновим счёт
  const scoreEl = document.getElementById("score");
  if (scoreEl) scoreEl.textContent = `Очки: ${score}`;
}

// обновление отображения очков (если использовал кастомный HUD)
function updateScoreDisplay() {
  const scoreEl = document.getElementById('score');
  if (!scoreEl) return;
  scoreEl.textContent = `Очки: ${score}`;
  // небольшой визуальный эффект, если есть класс .score-badge
  const badge = scoreEl.closest('.score-badge') || scoreEl;
  badge.classList.remove('pop');
  void badge.offsetWidth;
  badge.classList.add('pop');
}

// ========== Сброс позиции (reset) ==========
function resetPositions() {
  // вернуть блоки на исходные координаты и игрока на старт уровня
  const level = levels[currentLevelIndex];
  blocks.forEach(b => {
    b.x = b.startX;
    b.y = b.startY;
  });
  characterPosition = { ...level.characterStart };
  renderBoard();
}

// ========== Обработка таймаута ==========
function onTimeOut() {
  stopTimer();
  alert("Уақыт аяқталды! Ойын аякталды!.");
  sendProgress(); // показываем результат
}

// ========== Движение персонажа (включая wrap-around) ==========
function moveCharacter(dx, dy) {
  let newX = characterPosition.x + dx;
  let newY = characterPosition.y + dy;

  if (newX < 0) newX = boardSize - 1;
  if (newX >= boardSize) newX = 0;
  if (newY < 0) newY = boardSize - 1;
  if (newY >= boardSize) newY = 0;

  if (obstacles.find(o => o.x === newX && o.y === newY)) return;

  const block = blocks.find(b => b.x === newX && b.y === newY);
  if (block) {
    let nextX = block.x + dx;
    let nextY = block.y + dy;

    if (nextX < 0) nextX = boardSize - 1;
    if (nextX >= boardSize) nextX = 0;
    if (nextY < 0) nextY = boardSize - 1;
    if (nextY >= boardSize) nextY = 0;

    if (!blocks.find(b => b.x === nextX && b.y === nextY) &&
        !obstacles.find(o => o.x === nextX && o.y === nextY)) {

      block.x = nextX;
      block.y = nextY;

      const target = targets.find(t => t.x === block.x && t.y === block.y);
      if (target) {
        let charFromBlock = block.id;
        if (typeof charFromBlock === "string" && /^[01]+$/.test(charFromBlock)) {
          charFromBlock = String.fromCharCode(parseInt(charFromBlock, 2));
        } else {
          charFromBlock = String.fromCharCode(block.id);
        }

        if (String(target.id) === charFromBlock) {
          score += 10;
          blocks = blocks.filter(b => b !== block);
          targets = targets.filter(t => t !== target);
        } else {
          if (!firstWarningShown) {
            alert("Блоктарды бұрыс орындарға қоюға болмайды!");
            firstWarningShown = true;
          } else {
            alert("Блоктар бастапқы орындарына орналасты!");
          }

          block.x = block.startX;
          block.y = block.startY;

          if (!firstMistake) {
            score = Math.max(0, score - 5);
          }
          firstMistake = false;
        }
      }
    } else {
      return;
    }
  }

  characterPosition.x = newX;
  characterPosition.y = newY;
  renderBoard();

  if (blocks.length === 0) {
    if (currentLevelIndex + 1 < levels.length) {
      alert("Келесі деңгейге өттіңіз!");
      currentLevelIndex++;
      startLevel(currentLevelIndex);
    } else {
      alert("Барлық деңгей аяқталды!");
      stopTimer();
      sendProgress();
    }
  }
}

// ========== Клавиатура ==========
function handleKeyPress(event) {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
  }

  switch (event.key) {
    case "ArrowUp": moveCharacter(0, -1); break;
    case "ArrowDown": moveCharacter(0, 1); break;
    case "ArrowLeft": moveCharacter(-1, 0); break;
    case "ArrowRight": moveCharacter(1, 0); break;
  }
}

// ========== Отправка результата ==========
async function sendProgress() {
  stopTimer();
  const maxScore = levels.reduce((sum, level) => sum + level.blocks.length * 10, 0);
  const percentage = (score / maxScore) * 100;

  let comment = "";
  if (percentage >= 90) {
    comment = "🎉 Керемет жұмыс! Шифрларды өте жақсы меңгердің.";
  } else if (percentage >= 70) {
    comment = "👍 Жақсы нәтиже! Тағы да тәжірибе жасап көр.";
  } else if (percentage >= 50) {
    comment = "🙂 Орташа. Қайтадан өтіп көрсең, жақсырақ болады.";
  } else {
    comment = "⚠️ Жетілдіру қажет. Сабыр сақтап, тағы байқап көр.";
  }

  // Показ результата
  document.getElementById("result-score").textContent = `Нәтиже: ${score} / ${maxScore} (${Math.round(percentage)}%)`;
  document.getElementById("result-comment").textContent = comment;
  document.getElementById("result-box").style.display = "block";

  // Отправка на сервер
  await fetch("/game_result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_name: "push_blocks_all",
      score: score,
      completed: true
    })
  });
}

// ========== Горячие клавиши ==========
document.addEventListener("keydown", (e) => {
  if (e.key === "r") resetPositions(); // R — ресет
});
