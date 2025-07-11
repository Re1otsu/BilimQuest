const size = 8;
const maze = [
  'S', 0, 1, 0, 1, 'K', 1, 1,
  0, 0, 'K', 1, 1, 0, 1, 1,
  1, 1, 0, 0, 0, 0, 1, 'K',
  1, 1, 1, 0, 1, 1, 1, 0,
  'K', 1, 0, 0, 1, 0, 0, 0,
  0, 0, 1, 0, 1, 0, 1, 0,
  1, 0, 0, 0, 1, 0, 1, 0,
  1, 1, 1, 'K', 0, 0, 1, 'F'
];
const initialMaze = [...maze];

const questions = {
  5: { image: "static/img/bluray-player.jpg", options: ["Сандық", "Мәтіндік", "Графикалық", "Дыбыстық", "Видео"], correct: "Видео" },
  10: { image: "static/img/graphic.jpg", options: ["Сандық", "Мәтіндік", "Графикалық", "Дыбыстық", "Видео"], correct: "Графикалық" },
  23: { image: "static/img/number.jpg", options: ["Сандық", "Мәтіндік", "Графикалық", "Дыбыстық", "Видео"], correct: "Сандық" },
  32: { image: "static/img/text.jpg", options: ["Сандық", "Мәтіндік", "Графикалық", "Дыбыстық", "Видео"], correct: "Мәтіндік" },
  59: { image: "static/img/69.jpg", options: ["Сандық", "Мәтіндік", "Графикалық", "Дыбыстық", "Видео"], correct: "Дыбыстық" }
};

let currentIndex = maze.indexOf('S');
let collectedKeys = 0;
let score = 0;
const totalKeys = maze.filter(cell => cell === 'K').length;
const grid = document.getElementById('grid');
const info = document.getElementById('info');
const scoreDisplay = document.getElementById('score');
let gameFinished = false;  // Ойын аяқталғанын бақылау үшін

// ——— Функция отправки прогресса на сервер —————————
async function sendProgress() {
  try {
    await fetch("/game_result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game_name:  "maze",  // уникальный идентификатор этой игры
        score:      score,         // текущий счёт
        completed:  gameFinished   // true, если лабиринт пройден
      })
    });
  } catch (err) {
    console.error("Ошибка сохранения прогресса:", err);
  }
}

function restartGame() {
  currentIndex = initialMaze.indexOf('S');
  collectedKeys = 0;
  score = 0;
  gameFinished = false;  // Ойынды қайта бастағанда аяқталмаған деп есептейміз
  for (let i = 0; i < maze.length; i++) {
    maze[i] = initialMaze[i];
  }
  updateScore();
  info.textContent = 'Ойын қайта басталды!';
  createGrid();
}

function updateScore() {
  scoreDisplay.textContent = `Сіздің баллыңыз: ${score}`;
}

function createGrid() {
  grid.innerHTML = '';
  for (let i = 0; i < maze.length; i++) {
    const cell = document.createElement('div');
    cell.classList.add('cell');
    if (maze[i] === 1) {
      cell.classList.add('blocked');
    } else if (maze[i] === 'S') {
      cell.classList.add('start');
      cell.textContent = '🚦';
    } else if (maze[i] === 'F') {
      cell.classList.add('finish');
      cell.textContent = collectedKeys === totalKeys ? '✅' : '🏁';
    } else if (maze[i] === 'K') {
      cell.textContent = '🔑';
    }
    if (i === currentIndex) {
      cell.classList.add('player');
      cell.textContent = '🙂';
    }
    cell.id = `cell-${i}`;
    grid.appendChild(cell);
  }
}

function isNeighbor(index1, index2) {
  const row1 = Math.floor(index1 / size);
  const col1 = index1 % size;
  const row2 = Math.floor(index2 / size);
  const col2 = index2 % size;
  return Math.abs(row1 - row2) + Math.abs(col1 - col2) === 1;
}

function showModalQuestion(index) {
  return new Promise(resolve => {
    const question = questions[index];
    if (!question) return resolve(false);

    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.background = '#fff';
    modal.style.padding = '20px';
    modal.style.borderRadius = '8px';
    modal.style.textAlign = 'center';
    modal.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';

    const img = document.createElement('img');
    img.src = question.image;
    img.style.width = '100%';
    img.style.marginBottom = '10px';

    const options = document.createElement('div');
    question.options.forEach(option => {
      const button = document.createElement('button');
      button.textContent = option;
      button.style.margin = '5px';
      button.style.padding = '10px';
      button.style.cursor = 'pointer';
      button.style.border = '1px solid #ccc';
      button.style.backgroundColor = '#f0f0f0';
      button.style.borderRadius = '5px';
      button.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(option === question.correct);
      });
      options.appendChild(button);
    });

    modal.appendChild(img);
    modal.appendChild(options);
    document.body.appendChild(modal);
  });
}

grid.addEventListener('click', async (e) => {
  if (gameFinished) return;  // Егер ойын аяқталған болса, ешқандай әрекет жасалмайды

  const target = e.target;
  if (!target.classList.contains('cell')) return;

  const clickedIndex = parseInt(target.id.split('-')[1]);
  if (maze[clickedIndex] === 1) {
    info.textContent = 'Бұл ұяшықта бөгет бар!';
    return;
  }

  if (isNeighbor(currentIndex, clickedIndex)) {
    currentIndex = clickedIndex;

    if (maze[currentIndex] === 'K') {
      const correct = await showModalQuestion(clickedIndex);
      if (correct) {
        collectedKeys++;
        score += 20; // Дұрыс жауап үшін ұпай қосу
        maze[currentIndex] = 0;
        info.textContent = `Кілт жиналды! ${collectedKeys}/${totalKeys}`;
        updateScore();
      } else {
        score -= 10; // Қате жауап үшін ұпай алу
        info.textContent = 'Қате жауап! Кілт алынған жоқ.';
        updateScore();
      }
    } else if (maze[currentIndex] === 'F') {
      if (collectedKeys === totalKeys) {
        info.textContent = `Құттықтаймыз! Барлық кілт жиналды. Сіздің ұпайыңыз: ${score}`;
        gameFinished = true;  // Ойын аяқталды
        sendProgress();
        const percentage = Math.round((score / (totalKeys * 20)) * 100);
        let comment = "";

        if (percentage >= 90) {
            comment = "🎉 Өте жақсы нәтиже! Сен лабиринтті тамаша меңгердің.";
        } else if (percentage >= 70) {
            comment = "👍 Жақсы! Тағы да біраз жаттығу артық етпейді.";
        } else if (percentage >= 50) {
            comment = "🙂 Орташа. Қайтадан өтіп көруге болады.";
        } else {
            comment = "⚠️ Тағы бірнеше рет тәжірибе жасаған дұрыс.";
        }

        document.getElementById('result-score').innerText = `Ұпай: ${score} (${percentage}%)`;
        document.getElementById('result-comment').innerText = comment;
        document.getElementById('result-box').style.display = 'block';
      } else {
        info.textContent = 'Барлық кілттерді жинауыңыз қажет!';
      }
    }

    createGrid();
  } else {
    info.textContent = 'Тек көрші ұяшыққа ғана қозғала аласыз.';
  }
});

// Бастапқы рендеринг
createGrid();
updateScore();
