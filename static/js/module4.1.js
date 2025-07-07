const boardSize = 10;

// Позиция персонажа
let characterPosition = { x: 5, y: 5 };

// Позиции блоков с уникальными идентификаторами
let blocks = [
    { x: 2, y: 2, id: "01000111", startX: 2, startY: 2 }, // G
    { x: 3, y: 3, id: "01000001", startX: 3, startY: 3 }, // A
    { x: 1, y: 3, id: "01001101", startX: 1, startY: 3 }, // M
    { x: 5, y: 6, id: "01000101", startX: 5, startY: 6 }, // E
];

// Позиции целей с соответствующими идентификаторами
let targets = [
    { x: 8, y: 8, id: "G" },
    { x: 4, y: 5, id: "A" },
    { x: 9, y: 1, id: "M" },
    { x: 2, y: 6, id: "E" },
];

// Позиции препятствий
let obstacles = [
    { x: 4, y: 4 },
    { x: 7, y: 7 },
    { x: 5, y: 2 },
    { x: 2, y: 8 },
    { x: 3, y: 7 },
    { x: 2, y: 4 },
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
                const charFromBlock = String.fromCharCode(parseInt(block.id, 2)); // Преобразование
                if (String(target.id) === charFromBlock) {
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
        setTimeout(() => alert("Поздравляем! Уровень завершен!"), 100);
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
