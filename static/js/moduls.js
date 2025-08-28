document.addEventListener("DOMContentLoaded", function() {
    const modal = document.getElementById('module-modal');
    const iframe = document.getElementById('module-frame');
    const closeBtn = document.querySelector('.close-button');

    document.querySelectorAll('.module').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault(); // блокируем переход на другую страницу
            const url = this.getAttribute('href');
            iframe.src = url;
            modal.style.display = 'block';
        });
    });

    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
        iframe.src = ""; // очищаем iframe
    });

    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
            iframe.src = "";
        }
    });
});
