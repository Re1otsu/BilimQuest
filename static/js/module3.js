const levels = [
    { encrypted: "<БІЛІМ>", answer: "3136233633" },
    { encrypted: "<ҒОӨҒҰЮ> Цезарь шифрын шеш. Қадам 5 ", answer: "112333114426" },
];

let currentLevel = 0;
let userInput = "";

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

        currentLevel++; // Переходим к следующему уровню

        if (currentLevel < levels.length) {
            alert("Келесі деңгейге өттіңіз!");
            message.textContent = ""; // Очищаем сообщение
            userInput = ""; // Сбрасываем ввод пользователя
            updateScreen(); // Обновляем экран для нового уровня
        } else {
            alert("Барлық деңгей аяқталды! Жарайсыз!");
            message.textContent = "Ойын аяқталды!";
        }
    } else {
        message.textContent = "Қате! Қайта көріңіз.";
        message.style.color = "red";
    }
}


// Инициализация экрана при загрузке
document.addEventListener("DOMContentLoaded", () => {
    updateScreen();
});
