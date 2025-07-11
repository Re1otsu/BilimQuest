document.addEventListener('DOMContentLoaded', () => {
  const words = document.querySelectorAll('.word');
  const targets = document.querySelectorAll('.target');
  const checkBtn = document.getElementById('check-btn');
  const wordsContainer = document.getElementById('words-container');
  const targetsContainer = document.getElementById('targets-container');

  // Функция перемешивания
  function shuffleElements(container) {
    const elements = Array.from(container.children);
    elements.sort(() => Math.random() - 0.5);
    elements.forEach(el => container.appendChild(el));
  }

  shuffleElements(targetsContainer);
  shuffleElements(wordsContainer);

  // Изначально блокируем кнопку проверки
  checkBtn.disabled = true;

  // Drag & drop
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

      // Если в целевом уже есть картинка — возвращаем её назад
      const existing = target.querySelector('img');
      if (existing && existing !== dragged) {
        wordsContainer.appendChild(existing);
      }

      target.innerHTML = ''; // очищаем описание
      target.appendChild(dragged);
      checkCompletion();
    });
  });

  function checkCompletion() {
    const placedCount = Array.from(targets).filter(t => t.children.length > 0).length;
    checkBtn.disabled = placedCount !== words.length;
  }

  // Обработчик кнопки «Тексеру»
  checkBtn.addEventListener('click', () => {
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
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "ok") {
            const percentage = Math.round((correctCount / words.length) * 100);
            let comment = "";

            if (percentage >= 90) {
                comment = "🎉 Өте жақсы! Сен бұл тақырыпты жақсы меңгердің.";
            } else if (percentage >= 70) {
                comment = "👍 Жақсы нәтиже. Тағы да қайталап көрсең болады.";
            } else if (percentage >= 50) {
                comment = "🙂 Орташа. Біраз жаттығу қажет.";
            } else {
                comment = "⚠️ Бұл тақырыпты тағы бір қарап шыққан дұрыс.";
            }

            document.getElementById('result-score').innerText = `Ұпай: ${score} (${percentage}%)`;
            document.getElementById('result-comment').innerText = comment;
            document.getElementById('result-box').style.display = 'block';
        } else if (data.status === "denied") {
            alert("Бұл тапсырманы бұрын орындадыңыз. Қайта орындау үшін мұғалімге жүгініңіз.");
                location.href = "/module1";
        } else {
          alert("Нәтижені сақтау кезінде қате кетті.");
        }
    })
    .catch(() => {
      alert("Серверге қосыла алмады.");
    });
  });
});
