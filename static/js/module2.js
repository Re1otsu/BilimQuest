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
let mistakes = 0; // счетчик неправильных ответов
const totalKeys = maze.filter(cell => cell === 'K').length;
const maxScore = 0.3;
const pointsPerKey = maxScore / totalKeys;

const grid = document.getElementById('grid');
const info = document.getElementById('info');
const scoreDisplay = document.getElementById('score');
const gameOverModal = document.getElementById('game-over');
const finalScore = document.getElementById('final-score');

let gameFinished = false;

// --- Отправка результата на сервер ---
function sendResultToServer() {
    fetch("/game_result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            game_name: "Лабиринт",
            score: score.toFixed(2),
            stars: (score === maxScore ? 1 : 0),
            completed: true
        })
    })
    .then(res => res.json())
    .then(data => console.log("Результат отправлен:", data))
    .catch(err => console.error("Ошибка отправки:", err));
}

// --- Таймер ---
let timeLeft = 90;
let timerInterval = null;

function formatTime(s) {
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
}

function updateTimerDisplay() {
    const el = document.getElementById('time-value');
    if (el) el.textContent = formatTime(timeLeft);
}

function startTimer() {
    stopTimer();
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            stopTimer();
            endGame(false, "⏰ Уақыт бітті!");
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// --- Окончание игры ---
function endGame(allKeysCollected, message = "") {
    if (gameFinished) return;
    gameFinished = true;
    stopTimer();

    if (!allKeysCollected) info.textContent = message;

    if (mistakes >= 2) score = 0;

    showGameOver();
    sendResultToServer();
}

// --- Финальное окно с звездой ---
function showGameOver() {
    finalScore.textContent = `Ұпай: ${score.toFixed(2)}`;
    gameOverModal.classList.remove("hidden");

    const starContainer = document.getElementById("star-container");
    starContainer.innerHTML = "";

    if (score === maxScore) {
        const star = document.createElement("img");
        star.src = "static/img/star.png";
        star.style.width = "30vw";
        star.style.height = "auto";
        starContainer.appendChild(star);
    }
}

// --- Обновление счёта ---
function updateScore() {
    scoreDisplay.textContent = `Сіздің баллыңыз: ${score.toFixed(2)}`;
}

// --- Создание сетки ---
function createGrid() {
    grid.innerHTML = '';
    for (let i = 0; i < maze.length; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');

        if (maze[i] === 1) cell.classList.add('blocked');
        else if (maze[i] === 'S') { cell.classList.add('start'); cell.textContent = '🚦'; }
        else if (maze[i] === 'F') { cell.classList.add('finish'); cell.textContent = collectedKeys === totalKeys ? '✅' : '🏁'; }
        else if (maze[i] === 'K') cell.textContent = '🔑';

        if (i === currentIndex) {
            cell.classList.add('player');
            cell.textContent = '🙂';
        }

        cell.id = `cell-${i}`;
        grid.appendChild(cell);
    }
}

// --- Проверка соседних ячеек ---
function isNeighbor(index1, index2) {
    const row1 = Math.floor(index1 / size), col1 = index1 % size;
    const row2 = Math.floor(index2 / size), col2 = index2 % size;
    return Math.abs(row1 - row2) + Math.abs(col1 - col2) === 1;
}

// --- Модальное окно с вопросом ---
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
        modal.style.padding = '2vw';
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

// --- Клик по сетке ---
grid.addEventListener('click', async e => {
    if (gameFinished) return;
    const target = e.target;
    if (!target.classList.contains('cell')) return;

    const clickedIndex = parseInt(target.id.split('-')[1]);
    if (maze[clickedIndex] === 1) {
        info.textContent = 'Бұл ұяшықта бөгет бар!';
        return;
    }

    if (!isNeighbor(currentIndex, clickedIndex)) {
        info.textContent = 'Тек көрші ұяшыққа ғана қозғала аласыз.';
        return;
    }

    currentIndex = clickedIndex;

    if (maze[currentIndex] === 'K') {
        const correct = await showModalQuestion(currentIndex);
        if (correct) {
            collectedKeys++;
            score += pointsPerKey;
            maze[currentIndex] = 0;
            info.textContent = `Кілт жиналды! ${collectedKeys}/${totalKeys}`;
        } else {
            mistakes++;
            score -= pointsPerKey / 2;
            if (score < 0) score = 0;
            info.textContent = 'Қате жауап! Кілт алынған жоқ.';
        }
        updateScore();
    }

    if (maze[currentIndex] === 'F') {
        if (collectedKeys === totalKeys) endGame(true);
        else info.textContent = 'Барлық кілттерді жинауыңыз қажет!';
    }

    createGrid();
});

// --- Инициализация ---
createGrid();
updateScore();
startTimer();
