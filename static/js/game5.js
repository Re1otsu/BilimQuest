const locks = document.querySelectorAll('.lock');
const modal = document.getElementById('modal');
const answerInput = document.getElementById('answer');
const submitBtn = document.getElementById('submit');
let currentLock = null;

let score = 0;
let mistakes = 0;
const maxScore = 0.6; // 3 замка × 0.2

// Задачи для каждого замка
const puzzles = {
  lock1: {
    task: "Морзе:\n-.- .-.. ..-- ---.",
    answer: "ключ"
  },
  lock2: {
    task: "Сандар коды:\n36-44-11-34 ",
    answer: "отан"
  },
  lock3: {
    task: "Цезарь +3:\nЛэнұ",
    answer: "кілт"
  }
};
const modalContent = document.querySelector(".modal-content h3");

locks.forEach(lock => {
  lock.addEventListener('click', () => {
    if (lock.classList.contains("unlock")) return;
    currentLock = lock;
    modal.classList.add('active');
    answerInput.value = "";
    answerInput.focus();

    // Вставляем красиво Морзе/код/шифр
    modalContent.innerHTML = puzzles[lock.id].task
      .replace("Морзе:", '<div class="morse">Морзе:')
      .replace("(Морзе)", '</div>');
  });
});
submitBtn.addEventListener('click', () => {
  const code = answerInput.value.trim().toLowerCase();
  if (code === puzzles[currentLock.id].answer.toLowerCase()) {
    score += 0.2;
    currentLock.src = "static/img/lock2.png";
    currentLock.classList.add('unlock');
  } else {
    mistakes++;
    alert(`❌ Қате код! Қалған мүмкіндік: ${2 - mistakes}`);
  }
  modal.classList.remove('active');
  checkEndGame();
});

function checkEndGame() {
  const opened = document.querySelectorAll('.lock.unlock').length;
  if (opened === Object.keys(puzzles).length || mistakes >= 2) {
    endGame();
  }
}

function endGame() {
  let finalScore = mistakes >= 2 ? 0 : score;
  let stars = 0;

  // Добавляем звезду при максимальном балле
    const starContainer = document.getElementById('star-container');
    starContainer.innerHTML = "";
    if (Math.abs(finalScore - maxScore) < 0.001) {  // проверка на макс. балл
        stars = 1;
        const star = document.createElement("img");
        star.src = "static/img/star.png";
        star.style.width = "30vw";
        star.style.height = "auto";
        starContainer.appendChild(star);
    }

  document.getElementById('final-score').textContent = `Ұпай: ${finalScore.toFixed(2)}`;
  document.getElementById('game-over').classList.remove('hidden');

  fetch("/game_result", {
    method:"POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_name: "Қамал",
      score: finalScore,
      stars: stars,
      completed: true
    })
  }).then(r=>r.json()).then(d=>console.log("Жіберілді:", d));
}