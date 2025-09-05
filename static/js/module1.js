document.addEventListener("DOMContentLoaded", () => {
  const words = document.querySelectorAll(".word");
  const targets = document.querySelectorAll(".target");
  const checkBtn = document.getElementById("check-btn");
  const wordsContainer = document.getElementById("words-container");
  const targetsContainer = document.getElementById("targets-container");
  const timerEl = document.getElementById("timer");
  const gameOverBox = document.getElementById("game-over");
  const finalScore = document.getElementById("final-score");
  const starContainer = document.getElementById("star-container");

  let totalTime = 90;
  let timeLeft = totalTime;
  let timerId = null;
  let finished = false;
  let mistakes = 0;

  function formatTime(s) {
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function updateTimer() {
    timerEl.textContent = `Таймер: ${formatTime(timeLeft)}`;
    if (timeLeft <= 10) timerEl.classList.add("low");
  }

  function startTimer() {
    updateTimer();
    timerId = setInterval(() => {
      timeLeft--;
      updateTimer();
      if (timeLeft <= 0) endGame("Уақыт бітті!");
    }, 1000);
  }

  function shuffleElements(container) {
    [...container.children]
      .sort(() => Math.random() - 0.5)
      .forEach(el => container.appendChild(el));
  }

  function checkCompletion() {
    const placedCount = [...targets].filter(t => t.children.length > 0).length;
    checkBtn.disabled = placedCount !== words.length;
  }

    function calcScore() {
      let correct = 0;
      targets.forEach(target => {
        const expected = target.dataset.word;
        const placed = target.firstChild?.id;
        if (placed === expected) correct++;
      });
      return correct;
    }

  function sendResult(score) {
    fetch("/game_result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_name: "words_match", score, completed: true })
    }).catch(() => alert("Серверге қосыла алмады."));
  }
  // --- Drag&Drop ---
  words.forEach(word => {
    word.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", e.target.id);
    });
  });

    targets.forEach(target => {
      target.addEventListener("dragover", e => e.preventDefault()); // ОБЯЗАТЕЛЬНО
      target.addEventListener("drop", e => {
        e.preventDefault();
        const wordId = e.dataTransfer.getData("text/plain");
        const dragged = document.getElementById(wordId);
        if (!dragged) return;

        const existing = target.firstChild;
        if (existing && existing !== dragged) {
          wordsContainer.appendChild(existing);
        }

        target.innerHTML = "";
        target.appendChild(dragged);
        checkCompletion();

        if (target.dataset.word !== dragged.id) mistakes++;
      });
    });

function endGame(message = "") {
  if (finished) return;
  clearInterval(timerId);
  finished = true;

  let correct = 0;
  targets.forEach(target => {
    const expected = target.dataset.word;
    const placed = target.firstChild?.id;
    if (placed === expected) correct++;
  });

  let maxScore = 0.4; // вместо 4
  let score = 0;

  if (mistakes === 0) {
    score = ((correct / targets.length) * maxScore).toFixed(2); // дробный результат
    score = parseFloat(score); // приводим к числу
  }

  finalScore.textContent = `Ұпай: ${score}`;
  gameOverBox.classList.remove("hidden");

  // звезда, если набрали максимум
  starContainer.innerHTML = "";
  if (score === maxScore && mistakes === 0) {
      const star = document.createElement("img");
      star.src = "static/img/star.png";
      star.style.width = "30vw";
      starContainer.appendChild(star);
  }

  fetch("/game_result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_name: "words_match",
      score: score,
      stars: score === maxScore && mistakes === 0 ? 1 : 0,
      completed: true
    })
  });
}


  checkBtn.addEventListener("click", () => endGame());

  document.getElementById("restart-btn")?.addEventListener("click", () => location.reload());

  shuffleElements(wordsContainer);
  shuffleElements(targetsContainer);
  checkBtn.disabled = true;
  startTimer();
});
