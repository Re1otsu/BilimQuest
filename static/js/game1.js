const gameArea = document.getElementById("game-area");
const scoreDisplay = document.getElementById("score");
const message = document.getElementById("message");
const gameOverModal = document.getElementById("game-over");
const finalScore = document.getElementById("final-score");

let score = 0;
let mistakes = 0;
let missed = 0;

const infoSources = ["кітап", "телефон", "газет", "компьютер", "теледидар"];
const items = [
  {name: "кітап", img: "static/img/book.png"},
  {name: "телефон", img: "static/img/phone.png"},
  {name: "алма", img: "static/img/apple.png"},
  {name: "доп", img: "static/img/ball.png"},
  {name: "орындық", img: "static/img/chair.png"},
  {name: "теледидар", img: "static/img/tv.png"},
  {name: "табиғат", img: "static/img/nature.png"},
  {name: "компьютер", img: "static/img/computer.png"},
  {name: "газет", img: "static/img/newspaper.png"},
  {name: "машина", img: "static/img/car.png"}
];

let remainingItems = [...items];

const maxScore = 0.3;
const scoreIncrement = maxScore / infoSources.length; // дробное значение за каждую правильную картинку

function spawnItem() {
  if (!remainingItems.length) return;

  const index = Math.floor(Math.random() * remainingItems.length);
  const itemData = remainingItems.splice(index, 1)[0];

  const item = document.createElement("img");
  item.src = itemData.img;
  item.classList.add("item");

  let x = Math.random() * (gameArea.clientWidth - 80);
  let y = gameArea.clientHeight;
  item.style.left = x + "px";
  item.style.top = y + "px";

  gameArea.appendChild(item);

  const interval = setInterval(() => {
    y -= 2;
    item.style.top = y + "px";
    if (y < -100) {
      clearInterval(interval);
      item.remove();
      if (infoSources.includes(itemData.name)) {
        missed++;
        score = 0; // обнуляем сразу
      }
      checkGameEnd();
    }
  }, 20);

  item.onclick = () => {
    if (infoSources.includes(itemData.name)) {
      score += scoreIncrement;
      if (score > maxScore) score = maxScore;
    } else {
      mistakes++;
    }

    if (mistakes >= 2 || missed >= 1) {
      score = 0;
    }

    clearInterval(interval);
    item.remove();
    checkGameEnd();
  };
}

function checkGameEnd() {
  if (!remainingItems.length && !gameArea.querySelector(".item")) {
    clearInterval(gameInterval);
    showGameOver();
  }
}

function showGameOver() {
  finalScore.textContent = `Ұпай: ${score.toFixed(2)}`;
  gameOverModal.classList.remove("hidden");

  let stars = (score === maxScore) ? 1 : 0;
  const starElement = document.getElementById("star");
  starElement.style.display = stars === 1 ? "block" : "none";

  fetch("/game_result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_name: "Қағып ал",
      score: score.toFixed(2),
      stars: stars,
      completed: true
    })
  }).then(res => res.json()).then(data => {
    document.getElementById('result-box').style.display = 'block';
  });
}

const gameInterval = setInterval(() => {
  if (remainingItems.length) spawnItem();
}, 1500);
