// JS
document.addEventListener("DOMContentLoaded", () => {
  let score = 0;
  let mistakes = 0;
  const maxScore = 0.3;
  const scoreIncrement = maxScore / 6;
  let hadMistake = false;

  const items = document.querySelectorAll('.item');
  const targets = document.querySelectorAll('.target');
  const correctCounts = { 'мәтін': 0, 'дыбыс': 0, 'бейне': 0 };
  const planks = [document.getElementById('p1'), document.getElementById('p2'), document.getElementById('p3')];
  let plankIndex = 0;

  const gameOverModal = document.getElementById("game-over");
  const finalScore = document.getElementById("final-score");

  // ===== Таймер =====
  let timeLeft = 60; // 3 минуты
  let timerInterval = null;

  function formatTime(s) {
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function updateTimerDisplay() {
    const el = document.getElementById('time-value');
    if (el) el.textContent = formatTime(timeLeft);

    // Если осталось меньше 30 секунд, добавляем класс "low"
    const timerBadge = document.getElementById('timer');
    if (timeLeft <= 30) {
      timerBadge.classList.add('low');
    }
  }

  function startTimer() {
    stopTimer();
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      timeLeft--;
      updateTimerDisplay();
      if (timeLeft <= 0) {
        stopTimer();
        hadMistake = true; // при истечении времени 0 баллов
        showGameOver();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  startTimer(); // запускаем таймер

  // ===== Перемешивание карточек =====
  function shuffleElements(container) {
    [...container.children]
      .sort(() => Math.random() - 0.5)
      .forEach(el => container.appendChild(el));
  }
  shuffleElements(document.querySelector('.items'));
  shuffleElements(document.querySelector('.targets'));

  // ===== Drag & Drop =====
  items.forEach(item => {
    item.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text', item.dataset.answer);
    });
  });

  targets.forEach(target => {
    target.addEventListener('dragover', e => e.preventDefault());
    target.addEventListener('drop', e => {
      e.preventDefault();
      const ans = e.dataTransfer.getData('text');

      if (target.dataset.match === ans && !target.classList.contains('done')) {
        target.style.background = '#c8e6c9';
        correctCounts[ans]++;

        // Доска появляется после 2 правильных картинок
        if (correctCounts[ans] === 2) {
          planks[plankIndex].classList.add('active');
          plankIndex++;
        }

        score += scoreIncrement;
        if (score > maxScore) score = maxScore;

        // Скрываем использованную карточку
        const draggedItem = document.querySelector(`.item[data-answer="${ans}"]`);
        if (draggedItem) draggedItem.remove();

        // Игра окончена, когда все доски активны
        if (plankIndex === planks.length) {
          setTimeout(showGameOver, 500);
        }
      } else {
        target.style.background = '#ffcdd2';
        mistakes++;
        hadMistake = true;
      }
    });
  });

  // ===== Окончание игры =====
  function showGameOver() {
    stopTimer();
    const finalScoreValue = hadMistake ? 0 : score;
    finalScore.textContent = `Ұпай: ${finalScoreValue.toFixed(2)}`;
    gameOverModal.classList.remove("hidden");

    const starContainer = document.getElementById("star-container");
    starContainer.innerHTML = "";

    if (finalScoreValue === maxScore) {
        const star = document.createElement("img");
        star.src = "static/img/star.png";
        star.style.width = "30vw";
        star.style.height = "auto";
        starContainer.appendChild(star);
    }

    fetch("/game_result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game_name: "Көпір",
        score: finalScoreValue.toFixed(2),
        stars: (finalScoreValue === maxScore ? 1 : 0),
        completed: true
      })
    });
  }
});
