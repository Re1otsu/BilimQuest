const mazeSize = 12;
let robotPos = {x:0,y:0};
const robot = document.getElementById("robot");
const battery = document.getElementById("battery");
const input = document.getElementById("code-input");
const btn = document.getElementById("submit-btn");
const feedback = document.getElementById("feedback");
const gameOver = document.getElementById("game-over");
const finalScoreEl = document.getElementById("final-score");
const starContainer = document.getElementById("star-container");

const maxScore = 0.6;
const maxMistakes = 2;
let score = 0;
let mistakes = 0;

const maze = [
  [0,0,1,1,1,1,1,1,1,1,1,1],
  [1,0,1,0,1,0,1,0,0,1,0,1],
  [1,0,1,0,1,0,1,0,1,0,1,1],
  [1,0,0,0,0,0,0,0,1,1,0,1],
  [1,1,1,0,1,1,1,0,1,0,0,1],
  [1,0,0,0,0,0,1,1,0,1,0,1],
  [1,0,1,1,1,1,0,0,0,1,0,1],
  [1,0,1,0,0,0,1,1,0,0,0,1],
  [1,0,0,0,1,0,0,1,1,1,0,1],
  [1,1,0,1,1,1,0,1,0,0,0,1],
  [1,0,0,0,1,0,0,0,0,1,0,1],
  [1,1,1,1,1,1,1,1,1,1,0,0],
];
const mazeContainer = document.getElementById("maze");

const moveMap = {
  "0001": {dx:0, dy:-1},
  "0010": {dx:0, dy:1},
  "0011": {dx:1, dy:0},
  "0100": {dx:-1, dy:0}
};

// Открытие/закрытие модалки с инструкцией
document.addEventListener("DOMContentLoaded", () => {
    const showBtn = document.getElementById("show-instructions");
    const modal = document.getElementById("instructions-modal");
    const closeBtn = document.getElementById("close-instructions");

    showBtn.addEventListener("click", () => modal.style.display = "flex");
    closeBtn.addEventListener("click", () => modal.style.display = "none");
    modal.addEventListener("click", e => {
        if(e.target === modal) modal.style.display = "none";
    });
});

function getCellSize() {
  const mazeRect = mazeContainer.getBoundingClientRect();
  return { width: mazeRect.width / mazeSize, height: mazeRect.height / mazeSize };
}

function updateRobot(){
  const cellSize = getCellSize();
  robot.style.left = robotPos.x * cellSize.width + "px";
  robot.style.top  = robotPos.y * cellSize.height + "px";
}

for (let y = 0; y < mazeSize; y++) {
  for (let x = 0; x < mazeSize; x++) {
    const cell = document.createElement("div");
    cell.classList.add("cell");
    if (maze[y][x] === 1) cell.classList.add("wall");
    mazeContainer.appendChild(cell);
  }
}

const batteryPos = {x: 11, y: 11};

function updateBattery(){
  const cellSize = getCellSize();
  battery.style.left = batteryPos.x * cellSize.width + "px";
  battery.style.top  = batteryPos.y * cellSize.height + "px";
}
updateBattery();
updateRobot();

let timeLeft = 30; // секунд
const timerEl = document.getElementById("timer");
let timerInterval = setInterval(() => {
  timeLeft--;
  timerEl.textContent = `Уақыт: ${timeLeft}`;

  if(timeLeft <= 0){
    clearInterval(timerInterval);
    endGame(true); // true = окончание по таймеру
  }
}, 1000);

// Конец игры
function endGame(byTimer = false) {
  let finalScore = 0;
  let stars = 0;

  if(!byTimer && mistakes < maxMistakes && robotPos.x===11 && robotPos.y===11){
      finalScore = maxScore;
      stars = 1;
  }

  starContainer.innerHTML = "";
  if(stars === 1){
      const star = document.createElement("img");
      star.src = "static/img/star.png";
      star.style.width = "30vw";
      starContainer.appendChild(star);
  }

  finalScoreEl.textContent = `Ұпай: ${finalScore.toFixed(2)}`;
  gameOver.classList.remove("hidden");

  fetch("/game_result",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({game_name:"Робот", score:finalScore, stars:stars, completed:true})
  }).then(r=>r.json()).then(d=>console.log("Жіберілді:",d));

  clearInterval(timerInterval); // таймер останавливаем
}

// Логика хода робота
btn.addEventListener("click", () => {
    const inputValue = input.value.trim();
    const match = inputValue.match(/^([01]{4})\s*(\d+)$/);

    if(!match){
        feedback.textContent = "❌ Қате формат! Мысалы: 0010 3";
        mistakes++;
        if(mistakes >= maxMistakes) endGame();
        return;
    }

    const code = match[1];
    const steps = parseInt(match[2],10);
    if(!(code in moveMap) || steps <=0){
        feedback.textContent = "❌ Қате код немесе қадам!";
        mistakes++;
        if(mistakes >= maxMistakes) endGame();
        return;
    }

    const move = moveMap[code];
    let nextX = robotPos.x;
    let nextY = robotPos.y;
    let movedSteps = 0;

    for(let i=0; i<steps; i++){
        const trialX = nextX + move.dx;
        const trialY = nextY + move.dy;
        if(trialX<0 || trialX>=mazeSize || trialY<0 || trialY>=mazeSize || maze[trialY][trialX]===1) break;
        nextX = trialX;
        nextY = trialY;
        movedSteps++;
    }

    // Если робот не смог пройти все шаги, засчитываем ошибку
    if(movedSteps < steps){
        feedback.textContent = `❌ Қате! Сен ${steps} қадам жаздың, бірақ тек ${movedSteps} қадам өтті.`;
        mistakes++;
        if(mistakes >= maxMistakes) endGame();
        return;
    }

    // Если ход успешный — обновляем позицию
    robotPos.x = nextX;
    robotPos.y = nextY;
    updateRobot();
    feedback.textContent = `✅ Дұрыс! Жүрісті қадамдар: ${movedSteps}`;

    if(robotPos.x === 11 && robotPos.y === 11) endGame();
    input.value = "";
});
