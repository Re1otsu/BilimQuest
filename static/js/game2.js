let correct = 0;
let score = 0; // очки
const items = document.querySelectorAll('.item');
const targets = document.querySelectorAll('.target');
const planks = [document.getElementById('p1'),
                document.getElementById('p2'),
                document.getElementById('p3')];

const gameOverModal = document.getElementById("game-over");
const finalScore = document.getElementById("final-score");

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
      score += 5; // +5 ұпай әр дұрыс жауап үшін

      if (correct === 3) {
        setTimeout(showGameOver, 1000);
      }
    } else {
      target.style.background = '#ffcdd2';
    }
  });
});

function showGameOver() {
  finalScore.textContent = `Ұпай: ${score}`;
  gameOverModal.classList.remove("hidden");

  // жұлдыз қосу
  const starContainer = document.getElementById("star-container");
  starContainer.innerHTML = "";
  const star = document.createElement("div");
  star.classList.add("star");
  star.textContent = "⭐";
  starContainer.appendChild(star);

  // отправляем результат на сервер
  fetch("/game_result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_name: "Көпір",
      score: score,
      completed: true
    })
  });
}

function restartGame() {
  location.reload();
}
