let score = 0;
let mistakes = 0;
let currentCharacter = null;

const detective = document.getElementById("detective");
const characters = document.querySelectorAll(".character");
const taskText = document.getElementById("task-text");
const choicesEl = document.getElementById("choices");
const finalScore = document.getElementById("final-score");
const starContainer = document.getElementById("star-container");
const gameOverModal = document.getElementById("game-over");
const dialogModal = document.getElementById("dialog-modal");

let visited = new Set();

// Порядок прохождения
const order = ["friend", "mother", "grandpa", "teacher"];

// detective бастапқы орын
let posX = window.innerWidth * 0.05;  // сол жақтан 5%
let posY = window.innerHeight * 0.55;  // төменнен 20%
detective.style.left = posX + "px";
detective.style.top = posY + "px";

// Клавиштермен қозғалу
document.addEventListener("keydown", (e) => {
  const step = 70;
  const rect = detective.getBoundingClientRect();

  if (e.key === "ArrowUp") detective.style.top = rect.top - step + "px";
  if (e.key === "ArrowDown") detective.style.top = rect.top + step + "px";
  if (e.key === "ArrowLeft") detective.style.left = rect.left - step + "px";
  if (e.key === "ArrowRight") detective.style.left = rect.left + step + "px";

  checkCollision();
});

let totalTime = 120; // время в секундах
const timeValueEl = document.getElementById("time-value");
const timerEl = document.getElementById("timer");

const timerInterval = setInterval(() => {
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;
  timeValueEl.textContent = `${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  if (totalTime <= 10) {
    timerEl.classList.add("low"); // меняем стиль на красный
  }

  if (totalTime <= 0) {
    clearInterval(timerInterval);
    timeValueEl.textContent = "00:00";
    endGameTimeUp(); // функция окончания игры при таймауте
  }
  totalTime--;
}, 1000);

// Функция при окончании времени
function endGameTimeUp() {
  // Показываем модалку конца игры
  const gameOverModal = document.getElementById("game-over");
  const finalScore = document.getElementById("final-score");

  finalScore.textContent = "Ұпай: 0"; // обнуляем счёт
  gameOverModal.style.display = "flex";

  // Можно отправить на сервер результат
  fetch("/game_result", {
    method:"POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_name: "Хабаршы",
      score: 0,
      stars: 0,
      completed: false
    })
  }).then(res => res.json()).then(data => console.log("Отправлено:", data));
}

// Жақындағанын тексеру
function checkCollision() {
  const dRect = detective.getBoundingClientRect();

  characters.forEach(char => {
    const cRect = char.getBoundingClientRect();
    const overlap = !(dRect.right < cRect.left ||
                      dRect.left > cRect.right ||
                      dRect.bottom < cRect.top ||
                      dRect.top > cRect.bottom);

    if(overlap && !visited.has(char.id)) {
      // проверяем, правильный ли порядок
      const expected = order[visited.size];
      if (char.id !== expected) {
        taskText.textContent = "⏳ Алдымен басқа кейіпкерге бар!";
        dialogModal.style.display = "flex";
        choicesEl.style.display = "none";
        setTimeout(() => {
          dialogModal.style.display = "none";
          choicesEl.style.display = "block";
        }, 1500);
        return;
      }

      currentCharacter = char;
      taskText.textContent = char.dataset.task;
      dialogModal.style.display = "flex";
      choicesEl.style.display = "block";
    }
  });
}

// Таңдау логикасы
choicesEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if(!btn || !currentCharacter) return;

  // прячем кнопки сразу после выбора
  choicesEl.style.display = "none";

  if(currentCharacter.dataset.correct === btn.dataset.answer) {
    visited.add(currentCharacter.id);
    taskText.textContent = currentCharacter.dataset.dialog || "✅ Дұрыс!";
    setTimeout(() => {
      dialogModal.style.display = "none";
      choicesEl.style.display = "block"; // вернём кнопки для следующего задания
    }, 2500);
  } else {
    mistakes++;
    taskText.textContent = "❌ Қате, қайта байқап көр!";
    setTimeout(() => {
      dialogModal.style.display = "none";
      choicesEl.style.display = "block";
    }, 1500);
  }

  if(visited.size === characters.length) {
    endGame();
  }
});

function endGame() {
  const finalScoreValue = mistakes >= 2 ? 0 : 0.3;
  finalScore.textContent = `Ұпай: ${finalScoreValue.toFixed(2)}`;

  starContainer.innerHTML = "";
  if(finalScoreValue === 0.3){
        const star = document.createElement("img");
        star.src = "static/img/star.png";
        star.style.width = "30vw";
        star.style.height = "auto";
        starContainer.appendChild(star);
  }

  gameOverModal.style.display = "flex";

  // Отправка результата на сервер
  fetch("/game_result", {
    method:"POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_name: "Хабаршы",
      score: finalScoreValue,
      stars: finalScoreValue === 0.3 ? 1 : 0,
      completed: true
    })
  }).then(res => res.json()).then(data=>console.log("Отправлено:",data));
}