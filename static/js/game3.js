const messages = [
  {
    text: "Сен әріптесіңнен маңызды хабар алдың: деректерді жылдам өңдеу қажет. Сен қалай әрекет етесің?",
    choices: { audio: "Дауыстық хабарды тыңдау", text: "Мәтінді оқу", video: "Бейне қарау" },
    correct: "text"
  },
  {
    text: "Командада дау шықты, тез шешім қабылдау керек. Сен не істейсің?",
    choices: { audio: "Дауыспен талқылау", text: "Жазбаша жауап жіберу", video: "Қысқа бейне түсіндіру жасау" },
    correct: "audio"
  },
  {
    text: "Жаңа құрал туралы бейнеқұрал көрдің. Сен не істейсің?",
    choices: { audio: "Нұсқаулықты тыңдау", text: "Нұсқаулықты оқу", video: "Бейне қарау" },
    correct: "video"
  },
  {
    text: "Жобаны 5 минутта бағалау қажет. Сен қалай әрекет етесің?",
    choices: { audio: "Қысқа есепті тыңдау", text: "Есепті оқу", video: "Презентацияны қарау" },
    correct: "text"
  },
  {
    text: "Жүйеден дабыл келді. Сен қалай әрекет етесің?",
    choices: { audio: "Сигналды тыңдау", text: "Хабарламаны оқу", video: "Камерадан бейне қарау" },
    correct: "audio"
  }
];


let index = -1;
let score = 0;
let mistakes = 0;

const rocket = document.getElementById("rocket");
const messageEl = document.getElementById("message");
const choicesEl = document.getElementById("choices");
const finalScore = document.getElementById("final-score");
const starContainer = document.getElementById("star-container");
const gameOverModal = document.getElementById("game-over");

// Расчет шага ракеты
const earth = document.getElementById("earth");
const mars = document.getElementById("mars");
const totalSteps = messages.length;
let currentStep = 0;

function showChoices() {
  const current = messages[index];
  choicesEl.innerHTML = "";
  for (const key in current.choices) {
    const btn = document.createElement("button");
    btn.dataset.answer = key;
    btn.textContent = current.choices[key]; // теперь текст из messages
    choicesEl.appendChild(btn);
  }
}

function nextMessage() {
  index++;
  if(index < messages.length) {
    messageEl.textContent = messages[index].text;
    showChoices();  // <-- добавляем вызов отображения кнопок
  } else {
    endGame();
  }
}

function choose(answer) {
  if(index >= messages.length) return;

  if(messages[index].correct === answer) {
    score += 0.3 / totalSteps; // маленький шаг к max 0.3
    currentStep++;
    moveRocket();
  } else {
    mistakes++;
    messageEl.innerHTML = `<span class="noise">${messages[index].text}</span>`;
  }
  setTimeout(nextMessage, 1200);
}

function moveRocket() {
  const earthPos = earth.offsetLeft;
  const marsPos = mars.offsetLeft;
  const totalDistance = marsPos - earthPos;
  const stepDistance = totalDistance / totalSteps;

  rocket.style.left = `${earthPos + stepDistance * currentStep}px`;

  // Визуальный эффект прыжка при неправильном ответе
  if (mistakes > 0) {
    rocket.style.bottom = "20px";
    setTimeout(() => { rocket.style.bottom = "0"; }, 500);
  }
}

function endGame() {
  const finalScoreValue = mistakes > 0 ? 0 : 0.3;
  finalScore.textContent = `Ұпай: ${finalScoreValue.toFixed(2)}`;

  starContainer.innerHTML = "";
  if(finalScoreValue === 0.3){
        const star = document.createElement("img");
        star.src = "static/img/star.png";
        star.style.width = "30vw";
        star.style.height = "auto";
        starContainer.appendChild(star);
  }

  gameOverModal.style.display = "flex";

  // Отправка результата на сервер
  fetch("/game_result", {
    method:"POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_name: "Ғарыш хабаршысы",
      score: finalScoreValue,
      stars: finalScoreValue === 0.3 ? 1 : 0,
      completed: true
    })
  }).then(res => res.json()).then(data=>console.log("Отправлено:",data));
}

// Начало игры
nextMessage();

choicesEl.addEventListener("click", (e)=>{
  const btn = e.target.closest("button");
  if(!btn) return;
  choose(btn.dataset.answer);
});
