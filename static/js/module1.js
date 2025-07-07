document.addEventListener('DOMContentLoaded', () => {
  const words = document.querySelectorAll('.word');
  const targets = document.querySelectorAll('.target');
  const checkBtn = document.getElementById('check-btn');
  const wordsContainer = document.getElementById('words-container');
  const targetsContainer = document.getElementById('targets-container');

  function shuffleElements(container) {
    const elements = Array.from(container.children);
    elements.sort(() => Math.random() - 0.5);
    elements.forEach(el => container.appendChild(el));
  }

  shuffleElements(targetsContainer);

  // Перемешивание элементов
  function shuffleElements(container) {
    const elements = Array.from(container.children);
    elements.sort(() => Math.random() - 0.5);
    elements.forEach(element => container.appendChild(element));
  }

  shuffleElements(wordsContainer);

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
        const draggedElement = document.getElementById(wordId);

        if (draggedElement) {
            const existingImg = target.querySelector('img');
            if (existingImg && existingImg !== draggedElement) {
                wordsContainer.appendChild(existingImg);
            }

            target.innerHTML = '';  // очищаем описание/текст

            target.appendChild(draggedElement);
            checkCompletion();
        }
    });
  });

  function checkCompletion() {
    let placedCount = 0;
    targets.forEach(target => {
      if (target.children.length > 0) placedCount++;
    });

    checkBtn.disabled = placedCount !== words.length;
  }

  checkBtn.addEventListener('click', () => {
    targets.forEach(target => {
      const expectedWord = target.dataset.word;
      const placedWord = target.firstChild ? target.firstChild.id : null;

      if (placedWord === expectedWord) {
        target.classList.add('correct');
        target.classList.remove('incorrect');
      } else {
        target.classList.add('incorrect');
        target.classList.remove('correct');
      }
    });
  });
});
