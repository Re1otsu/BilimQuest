const messages = [
  { text: "Жаңа планета табылды", correct: "text" },
  { text: "Ғарыш кемесі ұшуға дайын", correct: "video" },
  { text: "Марста су бар", correct: "text" },
  { text: "Зымыран 12 минутта ұшады", correct: "audio" },
  { text: "Марста температура –70°С", correct: "text" },
  { text: "Жерде онлайн конференция басталды", correct: "video" },
  { text: "Марс базасындағы робот істен шықты", correct: "text" },
  { text: "Ғылыми тәжірибенің нәтижесі сәтті болды", correct: "text" },
  { text: "Хабарды жеткіз, тек радиосигнал қолайлы!", correct: "audio" }
];

let index = -1, score = 0;

function nextMessage() {
  index++;
  const msg = document.getElementById("message");
  if (index < messages.length) {
    msg.textContent = messages[index].text;
  } else {
    endGame();
  }
}

function choose(answer) {
  if (index >= messages.length) return;
  const rocket = document.getElementById("rocket");
  const msg = document.getElementById("message");

  if (messages[index].correct === answer) {
    score++;
    rocket.classList.remove("fly");
    void rocket.offsetWidth;      // перезапуск анимации
    rocket.classList.add("fly");
  } else {
    msg.innerHTML = `<span class="noise">${messages[index].text}</span>`;
  }
  setTimeout(nextMessage, 1200);
}

function endGame() {
  const result = document.getElementById("result");
  document.getElementById("message").textContent = "Ойын аяқталды!";
  let stars = "";
  if (score === messages.length) stars += "🌟 Кемел хабаршы ";
  if (score >= messages.length - 1) stars += "🌟 Жылдам ғарышкер ";
  if (score > messages.length / 2) stars += "🌟 Ғарыш хабаршысы";
  result.textContent = `Ұпай: ${score}/${messages.length} ${stars}`;
}

// ——— Предыстория с печатью
const introText = `Жыл 3025...
Адамзат Жерден тыс ғарышқа қоныс тепті.
Сен — жас ғарыш хабаршысы. 🌠

Бүгінгі миссия:
Байланыс каналдарын ашып, хабарды дұрыс жеткізу.
Сәтсіздікке жол жоқ... 🌍➡️🌌`;

let i = 0;
function typeEffect() {
  if (i < introText.length) {
    document.getElementById("intro-text").innerHTML += introText.charAt(i++);
    setTimeout(typeEffect, 40);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // печатаем предысторию
  typeEffect();

  // старт игры
  document.getElementById("start-btn").addEventListener("click", () => {
    document.getElementById("intro").style.display = "none";
    document.getElementById("game").style.display = "flex";
    nextMessage();
  });

  // обработчик кликов по вариантам ответа
  document.getElementById("choices").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const answer = btn.dataset.answer;
    if (answer) choose(answer);
  });
});
