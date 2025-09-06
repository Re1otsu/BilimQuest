const message = document.getElementById("message");
const inputContainer = document.getElementById("input-container");
const feedback = document.getElementById("feedback");
const imagePieces = [...document.querySelectorAll(".piece")];
const gameOver = document.getElementById("game-over");
const finalScoreEl = document.getElementById("final-score");
const starContainer = document.getElementById("star-container");

const maxScore = 0.7;
const maxMistakes = 2;
let score = 0;
let mistakes = 0;
let stars = 0;

const binaryMessage = ["01001000","01000001","01010100"]; // H A T
const asciiMessage = ["H","A","T"];

binaryMessage.forEach((bin, i) => {
  const input = document.createElement("input");
  input.maxLength = 1;
  inputContainer.appendChild(input);

  input.addEventListener("input", () => {
    const val = input.value.toUpperCase();
    if(val === asciiMessage[i]){
      feedback.textContent = "✅ Дұрыс!";
      score += maxScore / binaryMessage.length;
      imagePieces[i].style.opacity = 1;
      input.disabled = true;
      checkEnd();
    } else if(val !== "") {
      feedback.textContent = "❌ Қате!";
      mistakes++;
      checkEnd();
      input.value = "";
    }
  });
});

function checkEnd(){
  if(score >= maxScore || mistakes >= maxMistakes){
    endGame();
  }
}

function endGame(){
  stars = (mistakes < maxMistakes && score >= maxScore) ? 1 : 0;
  finalScoreEl.textContent = `Ұпай: ${score.toFixed(2)}`;
  starContainer.innerHTML = "";
  if(stars === 1){
    const star = document.createElement("img");
    star.src = "static/img/star.png"; // замените на свой путь
    starContainer.appendChild(star);
  }
  gameOver.classList.remove("hidden");

  fetch("/game_result",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({game_name:"Binary to ASCII", score:score.toFixed(2), stars:stars, completed:true})
  }).then(r=>r.json()).then(d=>console.log("Жіберілді:",d));
}
