async function sendProgress() {
  await fetch("/game_result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_name: "cipher_game",
      score:     totalScore,               // ✅ итоговый балл
      completed: currentLevel >= levels.length
    })
  });
}


async function sendPenalty() {
  const safeLevel = Math.min(currentLevel, levels.length);  // чтобы не выйти за пределы
  await fetch("/game_result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_name: "cipher_game",
      score: -5,  // ⬅️ минус 5 баллов
      completed: false
    })
  });
}

const levels = [
    { encrypted: "<БІЛІМ>", answer: "3136233633" },
    { encrypted: "<ҒОӨҒҰЮ> Цезарь шифрын шеш. Қадам 5 ", answer: "112333114426" },
];

let currentLevel = 0;
let userInput = "";
let totalScore = 0;

// Функция для обновления экрана с парами цифр
// Функция для обновления зашифрованного текста и экрана
function updateScreen() {
    const screen = document.getElementById("screen");
    const level = levels[currentLevel];

    // Обновляем текст зашифрованного слова
    const encryptedText = document.getElementById("encrypted-text");
    encryptedText.textContent = level.encrypted;

    // Разделяем строку на пары для отображения
    const pairs = level.answer.match(/.{1,2}/g);
    const placeholder = pairs
        .map((_, i) => (userInput.slice(i * 2, i * 2 + 2) || "--"))
        .join(" ");
    screen.textContent = placeholder;
}

// Инициализация экрана при загрузке
document.addEventListener("DOMContentLoaded", () => {
    updateScreen();
});


// Функция для обработки нажатия кнопки
function pressKey(key) {
    const level = levels[currentLevel];
    if (userInput.length < level.answer.length) {
        userInput += key;
        updateScreen();
    }
}

// Очистка экрана
function clearScreen() {
    userInput = "";
    updateScreen();
}

// Проверка ответа
function submitCode() {
    const level = levels[currentLevel];
    const message = document.getElementById("message");

    if (userInput === level.answer) {
        message.textContent = "Дұрыс! Сейф ашылды.";
        message.style.color = "lime";

        totalScore += 10; // ✅ прибавляем баллы

        currentLevel++; // Переходим к следующему уровню

        if (currentLevel < levels.length) {
            alert("Келесі деңгейге өттіңіз!");
            message.textContent = ""; // Очищаем сообщение
            userInput = ""; // Сбрасываем ввод пользователя
            updateScreen(); // Обновляем экран для нового уровня
        } else {
            alert("Барлық деңгей аяқталды! Жарайсыз!");
            message.textContent = "Ойын аяқталды!";

            // ✅ Отправляем итоговый результат
            sendProgress();
            const percentage = Math.round((totalScore / (levels.length * 10)) * 100);
            let comment = "";

            if (percentage >= 90) {
                comment = "🎉 Керемет жұмыс! Шифрларды өте жақсы меңгердің.";
            } else if (percentage >= 70) {
                comment = "👍 Жақсы нәтиже! Тағы да тәжірибе жасап көр.";
            } else if (percentage >= 50) {
                comment = "🙂 Орташа. Қайтадан өтіп көрсең, жақсырақ болады.";
            } else {
                comment = "⚠️ Жетілдіру қажет. Сабыр сақтап, тағы байқап көр.";
            }

            document.getElementById('result-score').innerText = `Жалпы ұпай: ${totalScore} (${percentage}%)`;
            document.getElementById('result-comment').innerText = comment;
            document.getElementById('result-box').style.display = 'block';
        }
    } else {
        message.textContent = "Қате! Қайта көріңіз.";
        message.style.color = "red";

        totalScore -= 5; // ✅ отнимаем баллы локально, но не отправляем
    }
}


// Инициализация экрана при загрузке
document.addEventListener("DOMContentLoaded", () => {
    updateScreen();
});
