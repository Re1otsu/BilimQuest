const boardSize = 10;

// Позиция персонажа
let characterPosition = { x: 0, y: 9 };

// Позиции блоков с уникальными идентификаторами
let blocks = [
    { x: 1, y: 8, id: 66, startX: 1, startY: 8 },
    { x: 2, y: 7, id: 105, startX: 2, startY: 7 },
    { x: 3, y: 6, id: 108, startX: 3, startY: 6 },
    { x: 4, y: 5, id: 105, startX: 4, startY: 5 },
    { x: 5, y: 4, id: 109, startX: 5, startY: 4 },
];

// Позиции целей с соответствующими идентификаторами
let targets = [
    { x: 8, y: 2, id: "B" },
    { x: 2, y: 1, id: "i" },
    { x: 7, y: 3, id: "l" },
    { x: 6, y: 9, id: "i" },
    { x: 5, y: 7, id: "m" },
];

// Позиции препятствий
let obstacles = [
    { x: 3, y: 3 },
    { x: 4, y: 4 },
    { x: 6, y: 6 },
    { x: 3, y: 8 },
    { x: 7, y: 4 },
    { x: 2, y: 6 },
];
// Очки
let score = 0;

// Флаг первого предупреждения
let firstWarningShown = false;

// Флаг первой ошибки
let firstMistake = true;

// Обновление игрового поля
function renderBoard() {
    const board = document.getElementById("board");
    board.innerHTML = "";

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            const cell = document.createElement("div");
            cell.className = "cell";

            if (characterPosition.x === x && characterPosition.y === y) {
                cell.classList.add("character");
            }

            const block = blocks.find(b => b.x === x && b.y === y);
            if (block) {
                cell.classList.add("block");
                cell.textContent = block.id;
            }

            const target = targets.find(t => t.x === x && t.y === y);
            if (target) {
                cell.classList.add("target");
                cell.textContent = target.id;
            }

            const obstacle = obstacles.find(o => o.x === x && o.y === y);
            if (obstacle) {
                cell.classList.add("obstacle");
            }

            board.appendChild(cell);
        }
    }

    document.getElementById("score").textContent = `Очки: ${score}`;
}

// Перемещение персонажа
function moveCharacter(dx, dy) {
    const newX = characterPosition.x + dx;
    const newY = characterPosition.y + dy;

    if (newX < 0 || newX >= boardSize || newY < 0 || newY >= boardSize) return;

    if (obstacles.find(o => o.x === newX && o.y === newY)) return;

    const block = blocks.find(b => b.x === newX && b.y === newY);
    if (block) {
        const nextX = block.x + dx;
        const nextY = block.y + dy;

        if (
            nextX >= 0 &&
            nextX < boardSize &&
            nextY >= 0 &&
            nextY < boardSize &&
            !blocks.find(b => b.x === nextX && b.y === nextY) &&
            !obstacles.find(o => o.x === nextX && o.y === nextY)
        ) {
            block.x = nextX;
            block.y = nextY;

            const target = targets.find(t => t.x === block.x && t.y === block.y);
            if (target) {
                if (String(target.id) === String.fromCharCode(block.id)) {
                    score += 10;
                    blocks = blocks.filter(b => b !== block);
                    targets = targets.filter(t => t !== target);
                } else {
                    if (!firstWarningShown) {
                        alert("Нельзя ставить блоки на неправильные места!");
                        firstWarningShown = true;
                    } else {
                        alert("Блок возвращается на исходное место!");
                    }

                    if (blocks.includes(block)) {
                        block.x = block.startX;
                        block.y = block.startY;
                    }

                    if (!firstMistake) {
                        score -= 5;
                    }
                    firstMistake = false;
                }
            }
        } else {
            return;
        }
    }

    characterPosition.x = newX;
    characterPosition.y = newY;
    renderBoard();

    if (checkWin()) {
        setTimeout(() => {
            alert("Поздравляем! Уровень завершен!");
             window.location.href = "http://127.0.0.1:5000/module4_l2"; // Переход на следующую страницу
        }, 100);
    }
}


// Проверка победы
function checkWin() {
    return blocks.length === 0;
}

// Перезапуск игры
function restartGame() {
    characterPosition = { x: 0, y: 9 };

    blocks = blocks.map(block => ({
        ...block,
        x: block.startX,
        y: block.startY,
    }));

    firstWarningShown = false;
    firstMistake = true;

    renderBoard();
}

// Обработчик клавиш
document.addEventListener("keydown", event => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
    }

    switch (event.key) {
        case "ArrowUp":
            moveCharacter(0, -1);
            break;
        case "ArrowDown":
            moveCharacter(0, 1);
            break;
        case "ArrowLeft":
            moveCharacter(-1, 0);
            break;
        case "ArrowRight":
            moveCharacter(1, 0);
            break;
    }
});

// Инициализация
document.addEventListener("DOMContentLoaded", () => {
    renderBoard();
});
