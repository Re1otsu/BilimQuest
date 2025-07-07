document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('module-modal');
    const iframe = document.getElementById('module-frame');
    const closeButton = document.querySelector('.close-button');

    // Добавляем обработчики для всех ссылок модулей
    document.querySelectorAll('.sidebar a').forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            const moduleUrl = link.getAttribute('href');
            iframe.src = moduleUrl; // Загружаем модуль в iframe
            modal.style.display = 'block'; // Показываем модальное окно
        });
    });

    // Закрытие модального окна
    closeButton.addEventListener('click', () => {
        modal.style.display = 'none';
        iframe.src = ''; // Очищаем содержимое iframe при закрытии
    });

    window.addEventListener('click', event => {
        if (event.target === modal) {
            modal.style.display = 'none';
            iframe.src = '';
        }
    });
});
