// ====================== game state ======================
const levels = [
    { encrypted: "<БІЛІМ>", answer: "3136233633", timeLimit: 40 },
    { encrypted: "<ҒОӨҒҰЮ> Цезарь шифрын шеш. Қадам 5 ", answer: "112333114426", timeLimit: 50 },
];

let gameFinished = false;

let levelPenalties = Array(levels.length).fill(0);
let currentLevel = 0;
let userInput = "";
let totalScore = 0;


// ====================== UI / экран ======================
function updateScreen() {
    const screen = document.getElementById("screen");
    const level = levels[currentLevel];

    // Обновляем текст зашифрованного слова
    const encryptedText = document.getElementById("encrypted-text");
    encryptedText.textContent = level.encrypted;

    // Разбиваем ответ на пары (если ответ не кратен 2 — отработает нормально)
    const pairs = level.answer.match(/.{1,2}/g) || [level.answer];
    const placeholder = pairs
        .map((_, i) => (userInput.slice(i * 2, i * 2 + 2) || "--"))
        .join(" ");
    screen.textContent = placeholder;

    // обновляем вид таймера
    updateTimerDisplay();
    // обновляем очки (если у тебя отдельный элемент)
    const scoreEl = document.getElementById("score");
    if (scoreEl) scoreEl.textContent = `Очки: ${totalScore}`;
}

// ====================== level control ======================
function startLevel(index) {
    // установим индекс (на случай явного вызова)
    currentLevel = index;
    userInput = "";
    updateScreen();
}

function finishGame() {
    stopTimer();
    // отправляем итог
    sendProgress();
    // показываем result-box — можно оставить твою логику
    const percentage = Math.round((totalScore / (levels.length * 50)) * 100); // если 50 очков за уровень
    let comment = "";
    if (percentage >= 90) comment = "🎉 Керемет жұмыс! Шифрларды өте жақсы меңгердің.";
    else if (percentage >= 70) comment = "👍 Жақсы нәтиже! Тағы да тәжірибе жасап көр.";
    else if (percentage >= 50) comment = "🙂 Орташа. Қайтадан өтіп көрсең, жақсырақ болады.";
    else comment = "⚠️ Жетілдіру қажет. Сабыр сақтап, тағы байқап көр.";

    document.getElementById('result-score').innerText = `Жалпы ұпай: ${totalScore} (${percentage}%)`;
    document.getElementById('result-comment').innerText = comment;
    document.getElementById('result-box').style.display = 'block';
}

// ====================== input handlers ======================
function pressKey(key) {
    const level = levels[currentLevel];
    if (userInput.length < level.answer.length) {
        userInput += String(key);
        updateScreen();
    }
}

function clearScreen() {
    userInput = "";
    updateScreen();
}

function submitCode() {
    const level = levels[currentLevel];
    const message = document.getElementById("message");

    if (userInput === level.answer) {
        message.textContent = "Дұрыс! Сейф ашылды.";
        message.style.color = "lime";

        // Базовая награда
        const baseReward = 50;
        const penalty = levelPenalties[currentLevel];

        // Итоговая награда за уровень (но не меньше 0)
        const reward = Math.max(0, baseReward - penalty);
        totalScore += reward;

        // Обнуляем штраф для этого уровня
        levelPenalties[currentLevel] = 0;

        currentLevel++;

        if (currentLevel < levels.length) {
            alert(`Келесі деңгейге өттіңіз! Деңгейге: ${reward} ұпай (штрафтар: ${penalty}).`);
            message.textContent = "";
            userInput = "";
            startLevel(currentLevel);
        } else {
            finishGame();
        }
        } else {
            message.textContent = "Қате! Қайта көріңіз.";
            message.style.color = "red";

            const wrongPenalty = 5; // штраф за неправильный ввод
            levelPenalties[currentLevel] += wrongPenalty;

            alert(`Код қате! Жиналған штраф ${wrongPenalty} ұпай. Жалпы штраф: ${levelPenalties[currentLevel]}`);
            // При этом мы НЕ списываем очки сразу, списание будет при успешном завершении уровня
        }
}

// ======== Таймер ========
let timeLeft = 120; // например, 2 минуты на прохождение
let timerInterval = null;

function formatTime(s) {
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function updateTimerDisplay() {
  const el = document.getElementById('time-value');
  if (el) el.textContent = formatTime(timeLeft);
  const badge = document.getElementById('timer');
  if (badge) {
    if (timeLeft <= 10) badge.classList.add('low');
    else badge.classList.remove('low');
  }
}

function startTimer(seconds) {
  stopTimer();
  timeLeft = seconds;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      stopTimer();
      onTimeOut();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  const badge = document.getElementById('timer');
  if (badge) badge.classList.remove('low');
}

function onTimeOut() {
  if (gameFinished) return;
  gameFinished = true;

  // Сообщение пользователю (если есть элемент для этого)
  const message = document.getElementById("message");
  if (message) {
    message.textContent = "⏰ Уақыт бітті!";
    message.style.color = "red";
  }

  sendProgress(); // Отправляем набранные баллы
  document.getElementById('result-score').innerText = `Ұпай: ${totalScore}`;
  document.getElementById('result-comment').innerText = "Уақыт аяқталды! Келесіде тезірек әрекет ет.";
  document.getElementById('result-box').style.display = 'block';
}

// ====================== network helpers (твоё) ======================
async function sendProgress() {
  await fetch("/game_result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_name: "cipher_game",
      score:     totalScore,
      completed: currentLevel >= levels.length
    })
  });
}

async function sendPenalty() {
  // отправляем фиксированное -5 на сервер
  await fetch("/game_result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_name: "cipher_game",
      score: -5,
      completed: false
    })
  });
}

// ====================== init ======================
document.addEventListener("DOMContentLoaded", () => {
    // Общий таймер на все уровни
    startTimer(180); // например, 3 минуты на всю игру
    startLevel(0);
});

