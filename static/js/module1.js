document.addEventListener('DOMContentLoaded', () => {
  const words = document.querySelectorAll('.word');
  const targets = document.querySelectorAll('.target');
  const checkBtn = document.getElementById('check-btn');
  const wordsContainer = document.getElementById('words-container');
  const targetsContainer = document.getElementById('targets-container');
  const timerEl = document.getElementById('timer');

  let totalTime = 90; // 60 секунд на игру
  let timeLeft = totalTime;
  let timerId = null;
  let finished = false; // чтобы не отправлять дважды

  function formatTime(s) {
    const mm = Math.floor(s / 60).toString().padStart(2,'0');
    const ss = (s % 60).toString().padStart(2,'0');
    return `${mm}:${ss}`;
  }

  function updateTimer() {
    timerEl.textContent = `Таймер: ${formatTime(timeLeft)}`;
    if (timeLeft <= 10) timerEl.classList.add('low');
  }

  function startTimer() {
    updateTimer();
    timerId = setInterval(() => {
      timeLeft--;
      updateTimer();
      if (timeLeft <= 0) {
        clearInterval(timerId);
        if (!finished) {
          finished = true;
          alert("Уақыт бітті!");
          autoSubmitScore();
        }
      }
    }, 1000);
  }

  function autoSubmitScore() {
    // считаем сколько правильных, как в checkBtn
    let correctCount = 0;
    targets.forEach(target => {
      const expected = target.dataset.word;
      const placed = target.firstChild ? target.firstChild.id : null;
      if (placed === expected) correctCount++;
    });
    const score = correctCount * 10;

    fetch("/game_result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game_name: "words_match",
        score: score,
        completed: true
      })
    }).then(r=>r.json()).then(data=>{
      const percentage = Math.round((correctCount / words.length) * 100);
      document.getElementById('result-score').innerText = `Ұпай: ${score} (${percentage}%)`;
      document.getElementById('result-comment').innerText = "Уақыт аяқталды!";
      document.getElementById('result-box').style.display = 'block';
    }).catch(()=>alert("Серверге қосыла алмады."));
  }

  startTimer();

  // --- далее твоя логика dnd ---
  function shuffleElements(container) {
    const elements = Array.from(container.children);
    elements.sort(() => Math.random() - 0.5);
    elements.forEach(el => container.appendChild(el));
  }
  shuffleElements(targetsContainer);
  shuffleElements(wordsContainer);

  checkBtn.disabled = true;

  words.forEach(word => {
    word.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', e.target.id);
      e.dataTransfer.effectAllowed = 'move';
    });
  });

  targets.forEach(target => {
    target.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    target.addEventListener('drop', e => {
      e.preventDefault();
      const wordId = e.dataTransfer.getData('text/plain');
      const dragged = document.getElementById(wordId);
      if (!dragged) return;
      const existing = target.querySelector('img');
      if (existing && existing !== dragged) {
        wordsContainer.appendChild(existing);
      }
      target.innerHTML = '';
      target.appendChild(dragged);
      checkCompletion();
    });
  });

  function checkCompletion() {
    const placedCount = Array.from(targets).filter(t => t.children.length > 0).length;
    checkBtn.disabled = placedCount !== words.length;
  }

  checkBtn.addEventListener('click', () => {
    if (finished) return;
    clearInterval(timerId);
    finished = true;

    let correctCount = 0;
    targets.forEach(target => {
      const expected = target.dataset.word;
      const placed   = target.firstChild ? target.firstChild.id : null;

      if (placed === expected) {
        target.classList.add('correct');
        target.classList.remove('incorrect');
        correctCount++;
      } else {
        target.classList.add('incorrect');
        target.classList.remove('correct');
      }
    });

    const score = correctCount * 10;

    fetch("/game_result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game_name: "words_match",
        score: score,
        completed: true
      })
    }).then(res => res.json()).then(data => {
      const percentage = Math.round((correctCount / words.length) * 100);
      document.getElementById('result-score').innerText = `Ұпай: ${score} (${percentage}%)`;
      document.getElementById('result-comment').innerText = `Дұрыс ${correctCount}/${words.length}`;
      document.getElementById('result-box').style.display = 'block';
    });
  });
});
