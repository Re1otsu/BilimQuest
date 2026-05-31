// Шифры для объектов
const puzzles = {
  envelope: { task: "📚✏️🖥️. Сөзді тап:", answer: "ИНФОРМАТИКА", solved: false },
  safe: { task: "Сандармен шифр: 33-36-34-25-44-36-42", answer: "МОНИТОР", solved: false },
  computer: { task: "Цезарь шифры +3: ГҢЖН", answer: "ӘЛЕМ", solved: false }
};

const agent = document.getElementById("agent");
const modal = document.getElementById("modal");
const modalTask = document.getElementById("modal-task");
const modalInput = document.getElementById("modal-input");
const modalSubmit = document.getElementById("modal-submit");
const modalFeedback = document.getElementById("modal-feedback");
const gameOver = document.getElementById("game-over");
const finalScoreEl = document.getElementById("final-score");
const starContainer = document.getElementById("star-container");

const maxScore = 0.7;
const maxMistakes = 2;

let score = 0;
let mistakes = 0;
let solvedCount = 0;
const scorePerPuzzle = maxScore / Object.keys(puzzles).length;

// Движение агента
function moveAgentTo(element, callback) {
  const rect = element.getBoundingClientRect();
  const bodyRect = document.body.getBoundingClientRect();
  const left = rect.left - bodyRect.left;
  agent.style.left = `${left}px`;
  setTimeout(callback, 600);
}

// Открытие модалки
function openModal(key) {
  if (puzzles[key].solved) return; // уже решён — выходим

  modal.style.display = "flex";
  modalTask.textContent = puzzles[key].task;
  modalInput.value = "";
  modalFeedback.textContent = "";
  modalSubmit.onclick = () => checkAnswer(key);
}

let totalTime = 180; // 60 секунд на всю игру
let timeLeft = totalTime;
const timeValue = document.getElementById('time-value');
let timerEnded = false;

function updateTimer() {
  let minutes = Math.floor(timeLeft / 60).toString().padStart(2,'0');
  let seconds = (timeLeft % 60).toString().padStart(2,'0');
  timeValue.textContent = `${minutes}:${seconds}`;

  const timerBadge = document.getElementById('timer');
  if(timeLeft <= 10) timerBadge.classList.add('low');
}

const timerInterval = setInterval(() => {
  timeLeft--;
  updateTimer();
  if(timeLeft <= 0){
    clearInterval(timerInterval);
    alert("⏰ Уақыт аяқталды!");
    timerEnded = true;
    endGame(); // завершение игры
  }
}, 1000);

updateTimer();

// Проверка ответа
function checkAnswer(key) {
  if(timerEnded){
    modal.style.display = "none";
    return; // не начисляем очки, если время вышло
  }

  const user = modalInput.value.trim().toUpperCase();
  const correct = puzzles[key].answer.toUpperCase();
    if(user === correct){
      modalFeedback.textContent = "✅ Дұрыс!";
      score += scorePerPuzzle;
      solvedCount++;
      puzzles[key].solved = true;   // <--- помечаем как решён
      modal.style.display = "none";
      if(solvedCount === Object.keys(puzzles).length) endGame();
    } else {
    mistakes++;
    modalFeedback.textContent = `❌ Қате! Қалған мүмкіндік: ${maxMistakes - mistakes}`;
    if(mistakes >= maxMistakes) endGame();
  }
}

const modalClose = document.getElementById("modal-close");

// Клик по крестику закрывает модалку
modalClose.onclick = () => {
  modal.style.display = "none";
  modalFeedback.textContent = "";
}

// Также можно закрывать кликом по фону модалки
modal.onclick = (e) => {
  if(e.target === modal) {
    modal.style.display = "none";
    modalFeedback.textContent = "";
  }
}
// Завершение игры
function endGame() {
  // Если таймер закончился, счет всегда 0
  const finalScore = timerEnded ? 0 : (mistakes >= maxMistakes ? 0 : Math.round(score * 1000) / 1000);

  let stars = 0;
  starContainer.innerHTML = "";

  if (!timerEnded && Math.abs(finalScore - maxScore) < 0.001) {
    stars = 1;
    const star = document.createElement("img");
    star.src = "static/img/star.png";
    star.style.width = "30vw";
    star.style.height = "auto";
    starContainer.appendChild(star);
  }

  finalScoreEl.textContent = `Ұпай: ${finalScore.toFixed(2)}`;

  // Отправка на сервер
  fetch("/game_result", {
    method:"POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_name: "Агент",
      score: finalScore,
      stars: stars,
      completed: true
    })
  }).then(r=>r.json()).then(d=>showGameResult(d))
    .catch(()=>showGameResult({score:0,stars:0,total_score:0,total_stars:0}));
}

// Клики по объектам
document.getElementById("envelope").onclick = () => moveAgentTo(document.getElementById("envelope"), ()=>openModal("envelope"));
document.getElementById("computer").onclick = () => moveAgentTo(document.getElementById("computer"), ()=>openModal("computer"));
document.getElementById("safe").onclick = () => moveAgentTo(document.getElementById("safe"), ()=>openModal("safe"));
