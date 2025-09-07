document.addEventListener("DOMContentLoaded", () => {
    const pieces = document.querySelectorAll(".puzzle-piece");
    const modal = document.getElementById("modal");
    const miniTask = document.getElementById("mini-task");
    const closeModal = document.getElementById("close-modal");
    const submitTask = document.getElementById("submit-task");
    const answerInput = document.getElementById("task-answer");
    const taskFeedback = document.getElementById("task-feedback");

    const gameOver = document.getElementById("game-over");
    const finalScoreEl = document.getElementById("final-score");
    const starContainer = document.getElementById("star-container");

    let score = 0;
    const maxScore = 2;
    let stars = 0;

    let totalTime = 60; // 3 минуты
    let timeLeft = totalTime;
    let timerEnded = false;
    const timeValue = document.getElementById('time-value');

    let mistakes = 0; // счетчик ошибок

    submitTask.addEventListener("click", ()=>{
        const userAnswer = answerInput.value.trim();
        if(userAnswer.toLowerCase() === tasks[currentPiece].answer.toLowerCase()){
            taskFeedback.textContent = "✅ Дұрыс!";
            const pieceEl = document.getElementById(currentPiece);
            pieceEl.classList.remove("locked");
            pieceEl.classList.add("unlocked");
            score += 0.5;
            modal.classList.add("hidden");
            checkEnd();
        } else {
            mistakes++; // увеличиваем счетчик ошибок
            taskFeedback.textContent = `❌ Қате! (${mistakes}/2)`;
            if(mistakes >= 2){
                score = 0; // обнуляем баллы
                alert("Сіз екі қате жасадыңыз. Ойын аяқталды!");
                endGame();
            }
        }
    });
    // Таймер
    function updateTimer(){
        let minutes = Math.floor(timeLeft/60).toString().padStart(2,'0');
        let seconds = (timeLeft % 60).toString().padStart(2,'0');
        timeValue.textContent = `${minutes}:${seconds}`;
        if(timeLeft <= 10) timeValue.style.color = "red";
    }

    const timerInterval = setInterval(()=>{
        if(timerEnded) return;
        timeLeft--;
        updateTimer();
        if(timeLeft <= 0){
            clearInterval(timerInterval);
            timerEnded = true;
            alert("⏰ Уақыт аяқталды!");
            endGame();
        }
    }, 1000);
    updateTimer();

    // Мини задания
    const tasks = {
        piece1: {question: "Ақпарат түрлерін сәйкестендір: Мәтін, Бейне, Дыбыс", answer: "текст"},
        piece2: {question: "Сөзді анықта 'Ңжлұжс' (шифр Цезаря +2)", answer: "Мектеп"},
        piece3: {question: "Екілік → сөзге: '01000011-01001111-01000100- 01000101'", answer: "Code"},
        piece4: {question: "Ондық → сөзге: 83-84-65-82", answer: "Star"}
    };

    let currentPiece = null;

    pieces.forEach(piece=>{
        piece.addEventListener("click", ()=>{
            if(piece.classList.contains("unlocked")) return;
            currentPiece = piece.id;
            miniTask.textContent = tasks[currentPiece].question;
            taskFeedback.textContent = "";
            answerInput.value = "";

            if(currentPiece === "piece1") {
                // === Drag & Drop блок ===
                document.getElementById("drag-container").classList.remove("hidden");
                document.getElementById("drop-container").classList.remove("hidden");
                document.getElementById("task-answer").classList.add("hidden");

                const dragContainer = document.getElementById("drag-container");
                const dropContainer = document.getElementById("drop-container");
                const dragItems = dragContainer.querySelectorAll(".drag-item");
                const dropZones = dropContainer.querySelectorAll(".drop-zone");

                // Сброс видимости картинок
                dragItems.forEach(item => item.style.display = "block");

                const correctDrops = {};
                dropZones.forEach(zone => correctDrops[zone.dataset.type] = false);

                dragItems.forEach(item => {
                    if(!item.hasListener){
                        item.addEventListener("dragstart", e => {
                            e.dataTransfer.setData("text/plain", item.dataset.type);
                        });
                        item.hasListener = true;
                    }
                });

                dropZones.forEach(zone => {
                    if(!zone.hasListener){
                        zone.addEventListener("dragover", e => {
                            e.preventDefault();
                            zone.classList.add("hovered");
                        });
                        zone.addEventListener("dragleave", () => zone.classList.remove("hovered"));
                        zone.addEventListener("drop", e => {
                            e.preventDefault();
                            zone.classList.remove("hovered");
                            const draggedType = e.dataTransfer.getData("text/plain");
                            const draggedItem = document.querySelector(`.drag-item[data-type='${draggedType}']`);
                            if(draggedType === zone.dataset.type){
                                correctDrops[zone.dataset.type] = true;
                                taskFeedback.textContent = "✅ Дұрыс!";
                                if(draggedItem) draggedItem.style.display = "none";
                            } else {
                                mistakes++;
                                taskFeedback.textContent = `❌ Қате! (${mistakes}/2)`;
                                if(mistakes >= 2){
                                    score = 0;
                                    alert("Сіз екі қате жасадыңыз. Ойын аяқталды!");
                                    endGame();
                                }
                            }
                            if(Object.values(correctDrops).every(v => v)){
                                score += 0.5;
                                const pieceEl = document.getElementById(currentPiece);
                                pieceEl.classList.remove("locked");
                                pieceEl.classList.add("unlocked");
                                modal.classList.add("hidden");
                                checkEnd();
                            }
                        });
                        zone.hasListener = true;
                    }
                });

            } else {
                // === Текстовые задания ===
                document.getElementById("task-answer").classList.remove("hidden");
                document.getElementById("drag-container").classList.add("hidden");
                document.getElementById("drop-container").classList.add("hidden");
            }

            modal.classList.remove("hidden"); // открываем модал
        });
    });
    closeModal.addEventListener("click", ()=>{
        modal.classList.add("hidden");
    });

    submitTask.addEventListener("click", ()=>{
        const userAnswer = answerInput.value.trim();
        if(userAnswer.toLowerCase() === tasks[currentPiece].answer.toLowerCase()){
            taskFeedback.textContent = "✅ Дұрыс!";
            const pieceEl = document.getElementById(currentPiece);
            pieceEl.classList.remove("locked");
            pieceEl.classList.add("unlocked"); // картинка появится
            modal.classList.add("hidden");
            checkEnd();
        } else {
            taskFeedback.textContent = "❌ Қате!";
        }
    });

    function checkEnd(){
        if(score >= maxScore){
            stars = 1;
        }
        if([...pieces].every(p=>p.classList.contains("unlocked")) || timerEnded){
            endGame();
        }
    }

    function endGame(){
        clearInterval(timerInterval);
        finalScoreEl.textContent = `Ұпай: ${score.toFixed(2)}`;
        starContainer.innerHTML = "";
        if(stars === 1){
            const star = document.createElement("img");
            star.src = "static/img/star.png";
            starContainer.appendChild(star);
        }
        gameOver.classList.remove("hidden");

        fetch("/game_result",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({
                game_name:"Пазл",
                score:score.toFixed(2),
                stars:stars,
                completed:true
            })
        }).then(r=>r.json()).then(d=>console.log("Жіберілді:",d));
    }
});
