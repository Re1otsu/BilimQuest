const gameContainer = document.getElementById("game-container");
const feedback = document.getElementById("feedback");
const gameOver = document.getElementById("game-over");
const finalScoreEl = document.getElementById("final-score");
const starContainer = document.getElementById("star-container");

const maxScore = 1.4;
const maxMistakes = 2;
let score = 0;
let mistakes = 0;
let stars = 0;

const ballSize = 60;



// Пример шариков: двоичное и десятичное
function convertBalls(oldBalls, isBinary) {
  return oldBalls.map(b => {
    const relX = b.x / gameContainer.clientWidth;
    const relY = b.y / gameContainer.clientHeight;
    return createBall(b.val, relX, relY, b.dx, b.dy, isBinary);
  });
}

// старые массивы в пикселях
const oldBinary = [
  {val: "E", x: 50, y: 50, dx: 1, dy: 1},
  {val: "S", x: 200, y: 100, dx: -1, dy: 1},
  {val: "c", x: 300, y: 200, dx: 1, dy: -1},
  {val: "z", x: 400, y: 50, dx: -1, dy: 1},
  {val: "H", x: 500, y: 150, dx: 1, dy: -1}
];

const oldDecimal = [
  {val: 69, x: 600, y: 50, dx: -1, dy: 1},
  {val: 83, x: 700, y: 100, dx: 1, dy: -1},
  {val: 99, x: 650, y: 200, dx: -1, dy: 1},
  {val: 122, x: 550, y: 150, dx: 1, dy: 1},
  {val: 72, x: 750, y: 50, dx: -1, dy: -1}
];

// новые массивы с относительными координатами
const binaryBalls = convertBalls(oldBinary, true);
const decimalBalls = convertBalls(oldDecimal, false);

const totalPairs = binaryBalls.length;


let firstSelected = null;

function createBall(val, relX, relY, dx, dy, isBinary) {
  const el = document.createElement("div");
  el.classList.add("ball");
  el.style.position = "absolute";
  el.style.width = ballSize + "px";
  el.style.height = ballSize + "px";
  el.style.borderRadius = "50%";
  el.style.background = isBinary ? "#6cf" : "#fc6"; // разные цвета
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.fontWeight = "bold";
  el.style.cursor = "pointer";

  // координаты
  const x = relX * gameContainer.clientWidth;
  const y = relY * gameContainer.clientHeight;
  el.style.left = x + "px";
  el.style.top = y + "px";

  el.textContent = val;

  gameContainer.appendChild(el);

  return { val, x, y, dx, dy, el, matched:false };
}

let totalTime = 90; // 120 секунд
let timeLeft = totalTime;
let timerEnded = false;
const timeValue = document.getElementById('time-value');

function updateTimer() {
    let minutes = Math.floor(timeLeft / 60).toString().padStart(2,'0');
    let seconds = (timeLeft % 60).toString().padStart(2,'0');
    timeValue.textContent = `${minutes}:${seconds}`;
    if(timeLeft <= 10) timeValue.style.color = "red";
}

const timerInterval = setInterval(() => {
    if(timerEnded) return;
    timeLeft--;
    updateTimer();
    if(timeLeft <= 0){
        clearInterval(timerInterval);
        timerEnded = true;
        alert("⏰ Уақыт аяқталды!");
        endGame();
    }
}, 1000);

updateTimer();

// Обработка кликов
function handleClick(ball, type) {
  if(timerEnded){
    feedback.textContent = "⏰ Уақыт аяқталды! Жауап қабылданбайды.";
    return;
  }
  if(ball.matched) return;
  if(!firstSelected) {
    firstSelected = {ball, type};
    ball.el.style.border = "3px solid gold";
    return;
  }

    if(firstSelected.type !== type) {
        // Проверка совпадения через код символа
        let isCorrect = false;
        if(type === "decimal") {
            isCorrect = firstSelected.ball.val.charCodeAt(0) === ball.val;
        } else {
            isCorrect = ball.val.charCodeAt(0) === firstSelected.ball.val;
        }

        if(isCorrect){
            feedback.textContent = "✅ Дұрыс!";
            firstSelected.ball.el.classList.add("correct");
            ball.el.classList.add("correct");
            drawLine(firstSelected.ball, ball);
            firstSelected.ball.matched = true;
            ball.matched = true;
            score += maxScore / totalPairs;
            checkEnd();
        } else {
            feedback.textContent = "❌ Қате!";
            mistakes++;
            checkEnd();
        }
    }

  // Сброс
  if(firstSelected) firstSelected.ball.el.style.border = "none";
  firstSelected = null;
}

// Добавляем события
binaryBalls.forEach(b => b.el.addEventListener("click", ()=>handleClick(b,"binary")));
decimalBalls.forEach(b => b.el.addEventListener("click", ()=>handleClick(b,"decimal")));

// Анимация шариков
function moveBalls(){
  [...binaryBalls, ...decimalBalls].forEach(b => {
    if(b.matched) return;
    b.x += b.dx;
    b.y += b.dy;

    // ограничение строго в пределах поля
    if(b.x < 0) { b.x = 0; b.dx *= -1; }
    if(b.x + ballSize > gameContainer.clientWidth) { b.x = gameContainer.clientWidth - ballSize; b.dx *= -1; }
    if(b.y < 0) { b.y = 0; b.dy *= -1; }
    if(b.y + ballSize > gameContainer.clientHeight) { b.y = gameContainer.clientHeight - ballSize; b.dy *= -1; }

    b.el.style.left = b.x + "px";
    b.el.style.top = b.y + "px";
  });
  requestAnimationFrame(moveBalls);
}
moveBalls();
window.addEventListener("resize", () => {
  [...binaryBalls, ...decimalBalls].forEach(b => {
    // нормализуем координаты в относительные (0..1)
    let relX = b.x / gameContainer.clientWidth;
    let relY = b.y / gameContainer.clientHeight;

    // пересчитываем новые координаты с учётом размеров
    b.x = Math.min(gameContainer.clientWidth - ballSize, Math.max(0, relX * gameContainer.clientWidth));
    b.y = Math.min(gameContainer.clientHeight - ballSize, Math.max(0, relY * gameContainer.clientHeight));

    // обновляем CSS
    b.el.style.left = b.x + "px";
    b.el.style.top = b.y + "px";
  });
});


// Линия между шарами
function drawLine(b1, b2){
  const line = document.createElement("div");
  line.style.position = "absolute";
  line.style.background = "gold";
  line.style.height = "3px";
  line.style.transformOrigin = "0 0";

  const x1 = b1.x + ballSize/2;
  const y1 = b1.y + ballSize/2;
  const x2 = b2.x + ballSize/2;
  const y2 = b2.y + ballSize/2;

  const length = Math.hypot(x2-x1, y2-y1);
  const angle = Math.atan2(y2-y1, x2-x1) * 180 / Math.PI;

  line.style.width = length + "px";
  line.style.left = x1 + "px";
  line.style.top = y1 + "px";
  line.style.transform = `rotate(${angle}deg)`;

  gameContainer.appendChild(line);
}

// Проверка конца игры
function checkEnd(){
  if(score >= maxScore || mistakes >= maxMistakes || binaryBalls.every(b=>b.matched)){
    endGame();
  }
}

function endGame(){
  clearInterval(timerInterval); // останавливаем таймер
  let finalScore = 0;
  let finalStars = 0;

  // Начисляем очки только если ошибок меньше maxMistakes и время не вышло
  if(!timerEnded && mistakes < maxMistakes){
    finalScore = score;
    finalStars = (score >= maxScore) ? 1 : 0;
  }

  finalScoreEl.textContent = `Ұпай: ${finalScore.toFixed(2)}`;
  starContainer.innerHTML = "";
  if(finalStars === 1){
    const star = document.createElement("img");
    star.src = "static/img/star.png";
    starContainer.appendChild(star);
  }

  gameOver.classList.remove("hidden");

  // Отправка на сервер
  fetch("/game_result", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      game_name: "Сиқырлы шарлар",
      score: finalScore.toFixed(2),
      stars: finalStars,
      completed: true
    })
  }).then(r => r.json()).then(d => console.log("Жіберілді:", d));
}