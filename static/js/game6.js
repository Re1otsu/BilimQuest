// Настройка игры
const words = ["Literature", "МАТЕМАТИКА", "ИНФОРМАТИКА"];
const scorePerWord = 0.7 / 3; // 0.23333333333333334
let currentIndex = 0;
let score = 0;
let mistakes = 0;
const maxMistakes = 2;
const maxScore = 0.7;

const letterToCode = {
  "А": "11","Ә":"12","Б":"13","В":"14","Г":"15","Ғ":"16","Д":"17",
  "Е":"21","Ё":"22","Ж":"23","З":"24","И":"25","Й":"26","К":"27",
  "Қ":"31","Л":"32","М":"33","Н":"34","Ң":"35","О":"36","Ө":"37",
  "П":"41","Р":"42","С":"43","Т":"44","У":"45","Ұ":"46","Ү":"47",
  "Ф":"51","Х":"52","Һ":"53","Ц":"54","Ч":"55","Ш":"56","Щ":"57",
  "Ъ":"61","Ы":"62","І":"63","Ь":"64","Э":"65","Ю":"66","Я":"67"
};

const wordBox = document.getElementById("word-box");
const input = document.getElementById("code-input");
const btn = document.getElementById("submit-btn");
const feedback = document.getElementById("feedback");
const gameOver = document.getElementById("game-over");


function showWord() {
  if(currentIndex >= words.length || mistakes >= maxMistakes) {
    endGame();
    return;
  }
  wordBox.textContent = words[currentIndex];
  input.value = "";
  feedback.textContent = "";
}

btn.addEventListener("click", () => {
  // Убираем дефисы и пробелы
  const userCode = input.value.replace(/[\s\-]/g,'');
  const word = words[currentIndex];
  const correctCode = word.toUpperCase().split("").map(l => letterToCode[l] || "").join("");

  if(userCode === correctCode) {
    feedback.textContent = "✅ Дұрыс!";
    score += scorePerWord;
  } else {
    mistakes++;
    feedback.textContent = `❌ Қате! Қалған мүмкіндік: ${maxMistakes - mistakes}`;
  }
  currentIndex++;
  setTimeout(showWord, 1500);
});

input.addEventListener('input', () => {
  let digits = input.value.replace(/\D/g,''); // оставляем только цифры
  let formatted = '';
  for(let i = 0; i < digits.length; i+=2){
    formatted += digits.substr(i, 2);
    if(i+2 < digits.length) formatted += '-';
  }
  input.value = formatted;
});

let totalTime = 150; // всего 60 секунд
let timeLeft = totalTime;
let timeOutEnded = false;
const timeValue = document.getElementById('time-value');

function updateTimer() {
    let minutes = Math.floor(timeLeft / 60).toString().padStart(2,'0');
    let seconds = (timeLeft % 60).toString().padStart(2,'0');
    timeValue.textContent = `${minutes}:${seconds}`;

    // если меньше 10 секунд - добавляем эффект low
    const timerBadge = document.getElementById('timer');
    if(timeLeft <= 10) timerBadge.classList.add('low');
}

const timerInterval = setInterval(() => {
    timeLeft--;
    updateTimer();
    if(timeLeft <= 0) {
        clearInterval(timerInterval);
        timeOutEnded = true; // игра закончилась по времени
        alert("⏰ Уақыт аяқталды!");
        endGame();
    }
}, 1000);

// обновляем таймер сразу при старте игры
updateTimer();

function endGame() {
    // если время вышло или количество ошибок превышено, очки = 0
    let finalScore = (mistakes >= maxMistakes || timeOutEnded) ? 0 : Math.round(score * 1000) / 1000;
    let stars = 0;

    const starContainer = document.getElementById('star-container');
    starContainer.innerHTML = "";

    if (!timeOutEnded && Math.abs(finalScore - maxScore) < 0.001) {
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
          game_name: "Шифр",
          score: finalScore,
          stars: stars,
          completed: true
        })
    }).then(r=>r.json()).then(d=>console.log("Жіберілді:", d));
}
showWord();
