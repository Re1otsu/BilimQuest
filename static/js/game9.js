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
const binaryBalls = [
  {val: "E", x: 50, y: 50, dx: 1, dy: 1},
  {val: "S", x: 200, y: 100, dx: -1, dy: 1},
  {val: "c", x: 300, y: 200, dx: 1, dy: -1},
  {val: "z", x: 400, y: 50, dx: -1, dy: 1},
  {val: "H", x: 500, y: 150, dx: 1, dy: -1}
];

const decimalBalls = [
  {val: 69, x: 600, y: 50, dx: -1, dy: 1},
  {val: 83, x: 700, y: 100, dx: 1, dy: -1},
  {val: 99, x: 650, y: 200, dx: -1, dy: 1},
  {val: 122, x: 550, y: 150, dx: 1, dy: 1},
  {val: 72, x: 750, y: 50, dx: -1, dy: -1}
];

const totalPairs = binaryBalls.length;

// Создаём шарики
[binaryBalls, decimalBalls].forEach(group => {
  group.forEach((b, i) => {
    const el = document.createElement("div");
    el.classList.add("ball");
    el.style.left = b.x + "px";
    el.style.top = b.y + "px";
    el.style.background = group === binaryBalls ? "#0077ff" : "#fff";
    el.style.color = group === binaryBalls ? "#fff" : "#000";
    el.style.fontSize = /^[A-Z]$/.test(b.val) ? "28px" : "20px";
    el.textContent = b.val;
    gameContainer.appendChild(el);
    b.el = el;
  });
});

let firstSelected = null;

// Обработка кликов
function handleClick(ball, type) {
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

    if(b.x <= 0 || b.x + ballSize >= gameContainer.clientWidth) b.dx *= -1;
    if(b.y <= 0 || b.y + ballSize >= gameContainer.clientHeight) b.dy *= -1;

    b.el.style.left = b.x + "px";
    b.el.style.top = b.y + "px";
  });
  requestAnimationFrame(moveBalls);
}
moveBalls();

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
  stars = (mistakes < maxMistakes && score >= maxScore) ? 1 : 0;
  finalScoreEl.textContent = `Ұпай: ${score.toFixed(2)}`;
  starContainer.innerHTML = "";
  if(stars === 1){
    const star = document.createElement("img");
    star.src = "static/img/star.png";
    starContainer.appendChild(star);
  }
  gameOver.classList.remove("hidden");

  // Отправка на сервер
  fetch("/game_result",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({game_name:"Сиқырлы шарлар", score:score.toFixed(2), stars:stars, completed:true})
  }).then(r=>r.json()).then(d=>console.log("Жіберілді:",d));
}
