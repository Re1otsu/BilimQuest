const modal = document.getElementById('modal');
const studentBtn = document.getElementById('studentBtn');
const closeBtn = document.querySelector('.close');

studentBtn.onclick = () => {
    modal.style.display = 'block';
}

closeBtn.onclick = () => {
    modal.style.display = 'none';
}

window.onclick = (e) => {
    if (e.target == modal) {
        modal.style.display = 'none';
    }
}

document.getElementById('loginBtn').onclick = () => {
    window.location.href = "/login"; // укажи реальный путь к странице входа
}

document.getElementById('registerBtn').onclick = () => {
    window.location.href = "/register"; // укажи реальный путь к регистрации
}
