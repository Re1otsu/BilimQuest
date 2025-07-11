// === HTML элементтерімен жұмыс істеу үшін DOMContentLoaded ===
document.addEventListener("DOMContentLoaded", () => {
    startLevel(currentLevelIndex);
    document.addEventListener("keydown", handleKeyPress);
});

// === Ойын деңгейлері ===
const levels = [
  {
    characterStart: { x: 5, y: 5 },
    blocks: [
      { x: 2, y: 2, id: "01000111" }, // G
      { x: 3, y: 3, id: "01000001" }, // A
      { x: 1, y: 3, id: "01001101" }, // M
      { x: 5, y: 6, id: "01000101" }, // E
    ],
    targets: [
      { x: 8, y: 8, id: "G" },
      { x: 4, y: 5, id: "A" },
      { x: 9, y: 1, id: "M" },
      { x: 2, y: 6, id: "E" },
    ],
    obstacles: [
      { x: 4, y: 4 }, { x: 7, y: 7 }, { x: 5, y: 2 },
      { x: 2, y: 8 }, { x: 3, y: 7 }, { x: 2, y: 4 }
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

// === Жалпы айнымалылар ===
const boardSize = 10;
let currentLevelIndex = 0;
let characterPosition;
let blocks = [];
let targets = [];
let obstacles = [];
let score = 0;
let firstWarningShown = false;
let firstMistake = true;

// === Деңгейді бастау ===
function startLevel(index) {
  const level = levels[index];
  characterPosition = { ...level.characterStart };
  blocks = level.blocks.map(b => ({ ...b, startX: b.x, startY: b.y }));
  targets = level.targets;
  obstacles = level.obstacles;
  firstWarningShown = false;
  firstMistake = true;
  renderBoard();
}

// === Ойын өрісін салу ===
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

  document.getElementById("score").textContent = `Очки: ${score}`;
}

// === Персонажды жылжыту ===
function moveCharacter(dx, dy) {
  const newX = characterPosition.x + dx;
  const newY = characterPosition.y + dy;

  if (newX < 0 || newX >= boardSize || newY < 0 || newY >= boardSize) return;
  if (obstacles.find(o => o.x === newX && o.y === newY)) return;

  const block = blocks.find(b => b.x === newX && b.y === newY);
  if (block) {
    const nextX = block.x + dx;
    const nextY = block.y + dy;

    if (
      nextX >= 0 && nextX < boardSize &&
      nextY >= 0 && nextY < boardSize &&
      !blocks.find(b => b.x === nextX && b.y === nextY) &&
      !obstacles.find(o => o.x === nextX && o.y === nextY)
    ) {
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
            alert("Нельзя ставить блоки на неправильные места!");
            firstWarningShown = true;
          } else {
            alert("Блок возвращается на исходное место!");
          }

          block.x = block.startX;
          block.y = block.startY;

          if (!firstMistake) {
            score -= 5;
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
      sendProgress();
    }
  }
}

// === Клавиатура басқару ===
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

// === Нәтиже жіберу ===
async function sendProgress() {
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

  // Комментарийді шығару
  document.getElementById("result-score").textContent = `Нәтиже: ${score} / ${maxScore} (${Math.round(percentage)}%)`;
  document.getElementById("result-comment").textContent = comment;
  document.getElementById("result-box").style.display = "block";

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

