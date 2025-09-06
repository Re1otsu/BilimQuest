// Шифры для объектов
const puzzles = {
  envelope: { task: "📚✏️🖥️. Сөзді тап:", answer: "ИНФОРМАТИКА" },
  safe: { task: "Сандармен шифр: 33-36-34-25-44-36-42", answer: "МОНИТОР" },
  computer: { task: "Цезарь шифры +3: ГҢЖН", answer: "ӘЛЕМ" }
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
  modal.style.display = "flex";
  modalTask.textContent = puzzles[key].task;
  modalInput.value = "";
  modalFeedback.textContent = "";
  modalSubmit.onclick = () => checkAnswer(key);
}

// Проверка ответа
function checkAnswer(key) {
  const user = modalInput.value.trim().toUpperCase();
  const correct = puzzles[key].answer.toUpperCase();
  if(user === correct){
    modalFeedback.textContent = "✅ Дұрыс!";
    score += scorePerPuzzle;
    solvedCount++;
    modal.style.display = "none";
    if(solvedCount === Object.keys(puzzles).length) endGame();
  } else {
    mistakes++;
    modalFeedback.textContent = `❌ Қате! Қалған мүмкіндік: ${maxMistakes - mistakes}`;
    if(mistakes >= maxMistakes) endGame();
  }
}

// Завершение игры
function endGame() {
  const finalScore = mistakes >= maxMistakes ? 0 : Math.round(score * 1000) / 1000;
  let stars = 0;
  starContainer.innerHTML = "";

  if (Math.abs(finalScore - maxScore) < 0.001) {
    stars = 1;
    const star = document.createElement("img");
    star.src = "static/img/star.png";
    star.style.width = "30vw";
    star.style.height = "auto";
    starContainer.appendChild(star);
  }

  finalScoreEl.textContent = `Ұпай: ${finalScore.toFixed(2)}`;
  gameOver.classList.remove('hidden');

  // Отправка на сервер
  fetch("/game_result", {
    method:"POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_name: "Агент Шифр",
      score: finalScore,
      stars: stars,
      completed: true
    })
  }).then(r=>r.json()).then(d=>console.log("Жіберілді:", d));
}

// Клики по объектам
document.getElementById("envelope").onclick = () => moveAgentTo(document.getElementById("envelope"), ()=>openModal("envelope"));
document.getElementById("computer").onclick = () => moveAgentTo(document.getElementById("computer"), ()=>openModal("computer"));
document.getElementById("safe").onclick = () => moveAgentTo(document.getElementById("safe"), ()=>openModal("safe"));
