document.addEventListener("DOMContentLoaded", () => {
  let correct = 0;
  let score = 0;
  let mistakes = 0;

  const maxScore = 0.3;
  const scoreIncrement = maxScore / 3; // 3 правильные пары → 0.1 за каждую

  const items = document.querySelectorAll('.item');
  const targets = document.querySelectorAll('.target');
  const planks = [
      document.getElementById('p1'),
      document.getElementById('p2'),
      document.getElementById('p3')
  ];

  const gameOverModal = document.getElementById("game-over");
  const finalScore = document.getElementById("final-score");

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
              target.classList.add('done');
              planks[correct].classList.add('active');

              correct++;
              score += scoreIncrement;
              if (score > maxScore) score = maxScore; // ограничение максимумом

              if (correct === 3) {
                  setTimeout(showGameOver, 1000);
              }
          } else {
              target.style.background = '#ffcdd2';
              mistakes++;
              score = 0; // обнуляем при ошибке
          }
      });
  });

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
