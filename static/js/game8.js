const mazeSize = 10;
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
let score = 0;
let mistakes = 0;
const maxMistakes = 2;

// Пример лабиринта: 0 - путь, 1 - стена
const maze = [
[0,0,1,0,0,0,1,0,0,0],
[1,0,1,0,1,0,1,0,1,0],
[0,0,0,0,1,0,0,0,1,0],
[0,1,1,0,0,0,1,0,0,0],
[0,0,0,1,1,0,0,1,0,1],
[1,0,1,0,0,0,1,0,0,0],
[0,0,0,1,0,1,0,0,1,0],
[0,1,0,0,0,0,0,1,0,0],
[0,0,1,0,1,0,1,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
];

const moveMap = {
  "0001": {dx:0, dy:-1}, // вверх
  "0010": {dx:0, dy:1},  // вниз
  "0011": {dx:1, dy:0},  // вправо
  "0100": {dx:-1, dy:0}  // влево
};

function updateRobot(){
  robot.style.left = robotPos.x*40+"px";
  robot.style.top = robotPos.y*40+"px";
}

function endGame(){
  let finalScore = mistakes>=maxMistakes ? 0 : Math.round(score*1000)/1000;
  let stars = 0;
  starContainer.innerHTML="";
  if(Math.abs(finalScore-maxScore)<0.001){
    stars=1;
    const star = document.createElement("img");
    star.src="star.png";
    star.style.width="40px";
    starContainer.appendChild(star);
  }
  finalScoreEl.textContent = `Ұпай: ${finalScore.toFixed(2)}`;
  gameOver.classList.remove("hidden");

  fetch("/game_result",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({game_name:"Робот Лабиринт", score:finalScore, stars:stars, completed:true})
  }).then(r=>r.json()).then(d=>console.log("Жіберілді:",d));
}

btn.addEventListener("click", ()=>{
  const code = input.value.trim();
  if(!(code in moveMap)){
    feedback.textContent="❌ Қате код!";
    mistakes++;
    if(mistakes>=maxMistakes) endGame();
    return;
  }
  const move = moveMap[code];
  const nextX = robotPos.x + move.dx;
  const nextY = robotPos.y + move.dy;

  // проверка границ и стены
  if(nextX<0||nextX>=mazeSize||nextY<0||nextY>=mazeSize||maze[nextY][nextX]===1){
    feedback.textContent="❌ Қате! Қабырғаға соқты.";
    mistakes++;
    if(mistakes>=maxMistakes) endGame();
    return;
  }

  robotPos.x = nextX;
  robotPos.y = nextY;
  score += maxScore / 10; // максимум 0.6 за все шаги
  feedback.textContent="✅ Дұрыс!";
  updateRobot();

  // проверка достижения батарейки
  if(robotPos.x===9 && robotPos.y===9) endGame();

  input.value="";
});

updateRobot();