document.addEventListener("DOMContentLoaded", () => {
  let correct = 0;
  let score = 0;
  let mistakes = 0;

  const maxScore = 0.3;
  const scoreIncrement = maxScore / 3; // 3 правильные пары → 0.1 за каждую

  const items = document.querySelectorAll('.item');
  const targets = document.querySelectorAll('.target');
    const correctCounts = { 'мәтін': 0, 'дыбыс': 0, 'бейне': 0 };
    const planks = [document.getElementById('p1'), document.getElementById('p2'), document.getElementById('p3')];
    let plankIndex = 0;
  const gameOverModal = document.getElementById("game-over");
  const finalScore = document.getElementById("final-score");

const gameDuration = 60; // время игры в секундах
let timeLeft = gameDuration;
const timerEl = document.createElement('p');
timerEl.id = 'timer';
timerEl.style.fontSize = '2em';
timerEl.style.color = '#fff';
document.querySelector('.game').prepend(timerEl); // добавляем таймер в блок игры
updateTimerDisplay();

const timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 0) {
        clearInterval(timerInterval);
        score = 0; // при истечении времени 0 баллов
        showGameOver();
    }
}, 1000);

function updateTimerDisplay() {
    timerEl.textContent = `Уақыт: ${timeLeft} сек`;
}


  function shuffleElements(container) {
    [...container.children]
      .sort(() => Math.random() - 0.5)
      .forEach(el => container.appendChild(el));
  }

  shuffleElements(document.querySelector('.items'));
  shuffleElements(document.querySelector('.targets'));

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

            // Игра окончена, когда все доски активны
            if (plankIndex === planks.length) {
                setTimeout(showGameOver, 1000);
            }
        } else {
            target.style.background = '#ffcdd2';
            mistakes++;
            score = 0;
        }
    });
});

  function showGameOver() {
      clearInterval(timerInterval);
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

      fetch("/game_result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              game_name: "Көпір",
              score: score.toFixed(2),
              stars: (score === maxScore ? 1 : 0),
              completed: true
          })
      });
  }

  function restartGame() {
      location.reload();
  }
});
