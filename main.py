from flask import Flask, render_template, request, redirect, session, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import os
from flask import flash
from flask_migrate import Migrate
from functools import wraps
from datetime import datetime
import pytz
from sqlalchemy import text
from sqlalchemy import func

app = Flask(__name__)

load_dotenv()
app.secret_key = os.getenv("SECRET_KEY")

def format_name_initials(full_name):
    if not full_name:
        return ""
    # разбиваем на слова, убираем лишние пробелы
    parts = [p for p in full_name.split() if p]
    if len(parts) == 1:
        return parts[0]  # только одно слово — оставляем как есть
    # составляем инициалы от всех слов кроме последнего
    initials = " ".join(f"{p[0]}." for p in parts[:-1])
    last = parts[-1]
    return f"{initials} {last}"

# зарегистрировать фильтр в Jinja
app.jinja_env.filters["initials"] = format_name_initials
#app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL")

db_url = os.getenv("DATABASE_URL")
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    "connect_args": {"sslmode": "require"}
}
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
migrate = Migrate(app, db)

class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    student_class = db.Column(db.String(10), nullable=False)
    password = db.Column(db.String(200), nullable=False)
    score = db.Column(db.Float, default=0)

    progress = db.relationship('StudentProgress', backref='student', lazy=True)

    __table_args__ = (db.UniqueConstraint('name', 'student_class', name='uq_name_class'),)

    def __repr__(self):
        return f"<Student {self.name}>"

class Teacher(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(50), nullable=False, unique=True)
    password = db.Column(db.String(200), nullable=False)

    def __repr__(self):
        return f"<Teacher {self.name}>"

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    module = db.Column(db.String(50), nullable=False)
    question = db.Column(db.Text, nullable=False)
    correct_answer = db.Column(db.String(100), nullable=False)
    explanation = db.Column(db.Text, nullable=True)

    attempts = db.relationship('StudentProgress', backref='task', lazy=True)

    def __repr__(self):
        return f"<Task {self.id} - {self.module}>"
class StudentProgress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"))
    task_id = db.Column(db.Integer, db.ForeignKey("task.id"))
    is_correct = db.Column(db.Boolean)

    __table_args__ = (
        db.Index('ix_student_task', 'student_id', 'task_id'),  # Индекс
    )

    def __repr__(self):
        return f"<Progress student={self.student_id} task={self.task_id} correct={self.is_correct}>"

class GameProgress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"))
    game_name = db.Column(db.String(100), nullable=False)
    score = db.Column(db.Float, default=0)   # лучше float, т.к. 0.3 балла
    stars = db.Column(db.Integer, default=0) # ⭐ счётчик звёзд
    completed = db.Column(db.Boolean, default=False)
    attempt = db.Column(db.Integer, nullable=False, default=1)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())

    student = db.relationship('Student', backref='games')

class GameAccess(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"))
    game_name = db.Column(db.String(100), nullable=False)
    is_unlocked = db.Column(db.Boolean, default=False)

    student = db.relationship('Student', backref='accesses')
class Announcement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    class_name = db.Column(db.String(10), nullable=False)
    message = db.Column(db.Text, nullable=False)
    # храним в UTC
    timestamp = db.Column(
        db.DateTime,
        default=lambda: datetime.utcnow()
    )

    def local_time(self):
        # конвертация в Алматы
        tz = pytz.timezone("Asia/Almaty")
        return pytz.utc.localize(self.timestamp).astimezone(tz)

with app.app_context():
    db.create_all()

def login_required(role):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if session.get("user_id") is None or session.get("role") != role:
                # Перенаправляем в зависимости от роли
                if role == "teacher":
                    return redirect("/login_teacher")
                else:
                    return redirect("/login")
            return func(*args, **kwargs)
        return wrapper
    return decorator


@app.route("/edit_announcement/<int:id>", methods=["GET", "POST"])
@login_required("teacher")
def edit_announcement(id):
    announcement = Announcement.query.get_or_404(id)
    if request.method == "POST":
        announcement.class_name = request.form["class_name"]
        announcement.message = request.form["message"]
        db.session.commit()
        flash("Хабарлама жаңартылды.")
        return redirect("/teacher")
    return render_template("edit_announcement.html", announcement=announcement)

# Бастапқы бет (Мұғалім/Оқушы таңдау)
@app.route("/", methods=["GET", "POST"])
def home():
    if request.method == "POST":
        role = request.form.get("role")
        if role == "teacher":
            return redirect("/login_teacher")
        elif role == "student":
            return redirect("/student")
        else:
            return "Қате: Рөл таңдалмады."
    return render_template("home.html")


# Мұғалімге арналған бет
@app.route("/teacher")
@login_required("teacher")
def teacher():
    user_email = session.get("email")
    announcements = Announcement.query.order_by(Announcement.timestamp.desc()).all()
    teacher = Teacher.query.get(session.get("user_id"))

    # Егер қандай да бір student керек болса (мысалы, тест үшін)
    student = Student.query.first()  # Немесе нақты ID арқылы
    return render_template("teacher.html", email=user_email, announcements=announcements, student=student, teacher=teacher)


# Негізгі бет оқушы үшін
@app.route("/student")
@login_required("student")
def student():
    student_id = session.get("user_id")
    student = Student.query.get(student_id)
    progress = db.session.execute(
        text("SELECT game_name, completed FROM game_progress WHERE student_id = :sid"),
        {"sid": student_id}
    ).fetchall()

    announcements = (Announcement.query
                     .filter_by(class_name=student.student_class)
                     .order_by(Announcement.timestamp.desc())
                     .all())

    # Определяем порядок модулей и создаём словарь completed
    default_modules = ['words_match', 'maze', 'cipher_game', 'push_blocks_all']
    completed = {m: False for m in default_modules}
    for row in progress:
        if row.game_name in completed:
            completed[row.game_name] = bool(row.completed)

    return render_template("student.html", student=student, completed=completed, announcements=announcements)

# Тіркеу
@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form["name"].strip()
        student_class = request.form["class"]
        password = request.form["password"]

        # Проверка: зарегистрирован ли уже такой ученик
        existing_student = Student.query.filter_by(name=name, student_class=student_class).first()
        if existing_student:
            error = f"{name} {student_class} сыныбында бұрын тіркелген. Кіру бетіне өтіңіз."
            return render_template("register.html", error=error)

        hashed_password = generate_password_hash(password)
        new_student = Student(name=name, student_class=student_class, password=hashed_password)
        db.session.add(new_student)
        db.session.commit()

        # Автоматический вход после регистрации (по желанию)
        session["user_id"] = new_student.id
        session["user_name"] = new_student.name
        session["student_class"] = new_student.student_class

        return redirect("/login")  # Немедленно перенаправить ученика
    return render_template("register.html")

# Кіру
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        name = request.form["name"]
        password = request.form["password"]
        student_class = request.form["class"]

        student = Student.query.filter_by(name=name, student_class=student_class).first()

        if student and check_password_hash(student.password, password):
            session["user_id"] = student.id
            session["user_name"] = student.name
            session["student_class"] = student.student_class
            session["role"] = "student"
            return redirect("/student")
        else:
            return "Қате: Есім, сынып немесе құпиясөз дұрыс емес."
    return render_template("login.html")



@app.route("/register_teacher", methods=["GET", "POST"])
def register_teacher():
    if request.method == "POST":
        name = request.form["name"]
        email = request.form["email"]
        password = request.form["password"]

        # Проверка на существующий email
        existing_teacher = Teacher.query.filter_by(email=email).first()
        if existing_teacher:
            return "Қате: Осындай почтасы бар қолданушы тіркелген."

        hashed_password = generate_password_hash(password)
        new_teacher = Teacher(name=name, email=email, password=hashed_password)
        db.session.add(new_teacher)
        db.session.commit()

        return redirect("/login_teacher")
    return render_template("register_tchr.html")

@app.route("/choose_login_teacher", methods=["GET", "POST"])
def choose_login_teacher():
    if request.method == "POST":
        action = request.form.get("action")
        if action == "login":
            return redirect("/login_teacher")
        elif action == "register":
            return redirect("/register_teacher")
    return render_template("choose_login_teacher.html")


@app.route("/login_teacher", methods=["GET", "POST"])
def login_teacher():
    if request.method == "POST":
        password = request.form["password"]
        email = request.form["email"]

        teacher = Teacher.query.filter_by(email=email).first()
        print("Кірген email:", email)
        print("Табылған:", teacher)

        if teacher and check_password_hash(teacher.password, password):
            session["user_id"] = teacher.id
            session["email"] = teacher.email
            session["role"] = "teacher"
            session["user_name"] = teacher.name
            return redirect("/teacher")
        else:
            return "Қате: Есім, почта немесе құпиясөз дұрыс емес."
    return render_template("login_tchr.html")

@app.route("/student_dashboard/<int:student_id>")
def student_dashboard(student_id):
    student = Student.query.get(student_id)
    if not student:
        return "Студент не найден", 404

    games = GameProgress.query.filter_by(student_id=student_id, completed=True).all()

    # Таксономия Bloom по главам
    GAME_TO_CHAPTER = {
        "Ақпарат-алу": "Білу",
        "Көпір": "Білу",
        "words_match": "Білу",
        "Лабиринт": "Түсіну",
        "Ғарыш хабаршысы": "Түсіну",
        "Хабаршы": "Түсіну",
        "Қамал": "Қолдану",
        "Шифр": "Қолдану",
        "Агент Шифр": "Қолдану",
        "Робот": "Анализ",
        "Сиқырлы шарлар": "Анализ",
        "game4_3": "Анализ",
        "game5_1": "Синтез",
        "game5_2": "Синтез",
        "game5_3": "Синтез",
        "game6_1": "Бағалау",
        "game6_2": "Бағалау",
        "game6_3": "Бағалау",
    }

    CHAPTER_MAX_SCORE = {
        "Білу": 1,  # 3 игры по 0,3 каждая
        "Түсіну": 1,  # тоже 3 игры
        "Қолдану": 2,  # 3 игры по 0,4
        "Анализ": 2,
        "Синтез": 2,
        "Бағалау": 2
    }
    # Подсчет прогресса по категориям
    chapters = {chapter: {"score_sum": 0, "max_score": max_score}
                for chapter, max_score in CHAPTER_MAX_SCORE.items()}

    for g in games:
        chapter = GAME_TO_CHAPTER.get(g.game_name)
        if chapter:
            chapters[chapter]["score_sum"] += g.score

    chapters_progress = {
        chapter: f"{data['score_sum']} / {data['max_score']}"
        for chapter, data in chapters.items()
    }

    # Добавляем главу к каждой игре
    for g in games:
        g.chapter = GAME_TO_CHAPTER.get(g.game_name, "—")  # если нет в словаре, ставим "—"

    # Считаем сумму звезд студента
    stars_sum = sum(g.stars for g in games)

    # Общий балл
    total_score = sum(g.score for g in games)

    return render_template(
        "dashboard.html",
        student=student,
        games=games,
        chapters_progress=chapters_progress,
        stars_sum=stars_sum,
        total_score=total_score
    )

@app.route("/game_result", methods=["POST"])
def game_result():
    if "user_id" not in session:
        return {"error": "Unauthorized"}, 401

    student_id = session["user_id"]
    data = request.get_json()
    game_name = data.get("game_name")
    score = float(data.get("score", 0))  # дробное значение
    stars = int(data.get("stars", 0))
    completed = bool(data.get("completed", True))

    # максимальные очки для игры
    MAX_SCORE = {
        "words_match": 0.4,
        "Көпір": 0.3,
        "Ақпарат-алу": 0.3,
        "Лабиринт": 0.3,
        "Ғарыш хабаршысы":0.3,
        "Хабаршы":0.3,
        "Қамал":0.6,
        "Шифр":0.7,
        "Агент Шифр":0.7,
        "Робот": 0.6,
        "Сиқырлы шарлар": 0.7
    }

    max_score = MAX_SCORE.get(game_name)
    score = min(score, max_score)  # ограничение максимальным
    stars = 1 if score == max_score else 0  # звезда, если набрали максимум

    attempts = GameProgress.query.filter_by(student_id=student_id, game_name=game_name).count()
    access = GameAccess.query.filter_by(student_id=student_id, game_name=game_name).first()

    if attempts >= 1 and not (access and access.is_unlocked):
        return {"status": "denied", "message": "Мұғалім рұқсат бермейінше қайта өтуге болмайды."}, 403

    allow_score_add = False
    if access and access.is_unlocked:
        allow_score_add = True
        access.is_unlocked = False

    # Сохраняем результат
    new_result = GameProgress(
        student_id=student_id,
        game_name=game_name,
        score=score,
        stars=stars,
        completed=completed,
        attempt=attempts + 1
    )
    db.session.add(new_result)

    student = Student.query.get(student_id)
    if attempts == 0 or allow_score_add:
        student.score += score

    db.session.commit()
    return {"status": "ok", "score": score, "stars": stars}


@app.route("/create_announcement", methods=["POST"])
@login_required("teacher")
def create_announcement():
    class_name = request.form.get("class_name").strip()
    message = request.form.get("message").strip()

    if class_name and message:
        ann = Announcement(class_name=class_name, message=message)
        db.session.add(ann)
        db.session.commit()
    return redirect("/teacher")

@app.route("/delete_announcement/<int:announcement_id>", methods=["POST"])
@login_required("teacher")
def delete_announcement(announcement_id):
    ann = Announcement.query.get_or_404(announcement_id)
    db.session.delete(ann)
    db.session.commit()
    return redirect("/teacher/announcement")

@app.route("/teacher/announcement", methods=["GET"])
@login_required("teacher")
def announcement_history():
    announcements = Announcement.query.order_by(Announcement.timestamp.desc()).all()
    return render_template("announcement_history.html", announcements=announcements)

@app.route("/rating")
def rating():
    students = (
        db.session.query(
            Student.id,
            Student.name,
            Student.student_class,
            func.coalesce(func.sum(GameProgress.stars), 0).label("stars_sum"),
            func.count(GameProgress.id).label("completed_games"),
            func.coalesce(func.sum(GameProgress.score), 0).label("score_sum")  # максимальный балл за игру
        )
        .outerjoin(GameProgress, GameProgress.student_id == Student.id)
        .group_by(Student.id)
        .order_by(func.coalesce(func.sum(GameProgress.stars), 0).desc())
        .limit(20)
        .all()
    )
    return render_template("rating.html", students=students)

@app.route("/reset_module/<int:student_id>")
@login_required("teacher")
def reset_module(student_id):
    GameProgress.query.filter_by(student_id=student_id, game_name="words_match").delete()
    db.session.commit()
    flash("Оқушыға қайта өтуге рұқсат берілді")
    return redirect("/teacher_dashboard")


@app.route("/unlock_game", methods=["POST"])
@login_required("teacher")
def unlock_game():
    student_id = request.form["student_id"]
    game_name = request.form["game_name"]

    # Бұрынғы прогресс жазбаларын алу
    old_progresses = GameProgress.query.filter_by(student_id=student_id, game_name=game_name).all()
    total_old_score = sum(p.score for p in old_progresses)

    # Прогрессті өшіру
    for p in old_progresses:
        db.session.delete(p)

    # Жалпы баллдан шегеру
    student = Student.query.get(student_id)
    student.score = max(0, student.score - total_old_score)

    # Рұқсат беру (is_unlocked = True)
    access = GameAccess.query.filter_by(student_id=student_id, game_name=game_name).first()
    if access:
        access.is_unlocked = True
    else:
        access = GameAccess(student_id=student_id, game_name=game_name, is_unlocked=True)
        db.session.add(access)

    db.session.commit()
    flash("Қайта өтуге рұқсат берілді. Бұрынғы нәтиже өшірілді.")
    return redirect("/teacher_panel")


@app.route("/teacher_panel")
@login_required("teacher")
def teacher_panel():
    selected_class = request.args.get("student_class", "5А")  # по умолчанию 5А

    students = Student.query.filter_by(student_class=selected_class).all()

    all_progress = (
        GameProgress.query.join(Student)
        .filter(Student.student_class == selected_class, GameProgress.completed == True)
        .all()
    )
    # словарь "игра → глава"
    GAME_TO_CHAPTER = {
        "Ақпарат-алу": "Білу",
        "Көпір": "Білу",
        "words_match": "Білу",
        "Лабиринт": "Түсіну",
        "Ғарыш хабаршысы": "Түсіну",
        "Хабаршы": "Түсіну",
        "Қамал": "Қолдану",
        "Шифр": "Қолдану",
        "Агент Шифр": "Қолдану",
        "Робот": "Анализ",
        "Сиқырлы шарлар": "Анализ",
        "game4_3": "Анализ",
        "game5_1": "Синтез",
        "game5_2": "Синтез",
        "game5_3": "Синтез",
        "game6_1": "Бағалау",
        "game6_2": "Бағалау",
        "game6_3": "Бағалау",
    }

    chapter_scores, chapter_max_scores = {}, {}
    for gp in all_progress:
        chapter = GAME_TO_CHAPTER.get(gp.game_name, "Басқада")
        chapter_scores[chapter] = chapter_scores.get(chapter, 0) + gp.score
        chapter_max_scores[chapter] = chapter_max_scores.get(chapter, 0) + getattr(gp, 'max_score', 1)

    labels = list(chapter_scores.keys())
    scores = [
        round((chapter_scores[c] / chapter_max_scores[c] * 100) if chapter_max_scores[c] > 0 else 0, 2)
        for c in labels
    ]

    all_progress_all = GameProgress.query.filter(GameProgress.completed == True).all()

    chapter_scores_all, chapter_max_all = {}, {}
    for gp in all_progress_all:
        chapter = GAME_TO_CHAPTER.get(gp.game_name, "Прочее")
        chapter_scores_all[chapter] = chapter_scores_all.get(chapter, 0) + gp.score
        chapter_max_all[chapter] = chapter_max_all.get(chapter, 0) + getattr(gp, 'max_score', 1)

    labels_all = list(chapter_scores_all.keys())
    scores_all = [
        round((chapter_scores_all[c] / chapter_max_all[c] * 100) if chapter_max_all[c] > 0 else 0, 2)
        for c in labels_all
    ]


    # Получаем все уникальные классы для выпадающего списка
    class_list = [row[0] for row in db.session.query(Student.student_class).distinct().all()]


    return render_template(
        "teacher_panel.html",
        students=students,
        labels=labels,
        scores=scores,
        labels_all=labels_all,
        scores_all=scores_all,
        selected_class=selected_class,
        class_list=class_list
    )



@app.route("/instruction-t")
@login_required("teacher")
def instruction_p():
    # Показываем страницу с текстом инструкции и кнопкой
    return render_template("instruction-t.html")

@app.route("/download-t")
@login_required("teacher")
def download_t():
    # Файл будет скачиваться
    return send_from_directory("static", "Portal_Mugalim_Nuskau.pdf", as_attachment=True)

@app.route("/download-g")
@login_required("teacher")
def download_g():
    # Скачивание второго файла
    return send_from_directory("static", "Anykhtama_Geymifikatsiya_portal.pdf", as_attachment=True)

@app.route("/1module")
@login_required("student")
def module_1():
    student_id = session.get("user_id")
    student = Student.query.get(student_id)

    # Загружаем прогресс из GameProgress
    progress = db.session.execute(
        text("SELECT game_name, completed FROM game_progress WHERE student_id = :sid"),
        {"sid": student_id}
    ).fetchall()

    # Определяем порядок модулей и создаём словарь completed
    default_modules = ['words_match', 'maze', 'cipher_game', 'push_blocks_all']
    completed = {m: False for m in default_modules}
    for row in progress:
        if row.game_name in completed:
            completed[row.game_name] = bool(row.completed)

    return render_template("1module.html", completed=completed, student=student)


@app.route("/bolim1_1")
@login_required("student")
def bolim1_1():
    student_id = session.get("user_id")
    student = Student.query.get(student_id)

    # Загружаем прогресс из GameProgress
    progress = db.session.execute(
        text("SELECT game_name, completed FROM game_progress WHERE student_id = :sid"),
        {"sid": student_id}
    ).fetchall()

    # Определяем порядок модулей и создаём словарь completed
    default_modules = ['words_match', 'maze', 'cipher_game', 'push_blocks_all', 'Ақпарат-алу', 'Көпір']
    completed = {m: False for m in default_modules}
    for row in progress:
        if row.game_name in completed:
            completed[row.game_name] = bool(row.completed)

    return render_template("bolim1_1.html", completed=completed, student=student)

@app.route("/bolim1_2")
@login_required("student")
def bolim1_2():
    student_id = session.get("user_id")
    student = Student.query.get(student_id)

    # Загружаем прогресс из GameProgress
    progress = db.session.execute(
        text("SELECT game_name, completed FROM game_progress WHERE student_id = :sid"),
        {"sid": student_id}
    ).fetchall()

    # Определяем порядок модулей и создаём словарь completed
    default_modules = ['words_match', 'maze', 'cipher_game', 'push_blocks_all', 'Ақпарат-алу', 'Көпір', 'Лабиринт', 'Ғарыш хабаршысы']
    completed = {m: False for m in default_modules}
    for row in progress:
        if row.game_name in completed:
            completed[row.game_name] = bool(row.completed)

    return render_template("bolim1_2.html", completed=completed, student=student)

@app.route("/bolim1_3")
@login_required("student")
def bolim1_3():
    student_id = session.get("user_id")
    student = Student.query.get(student_id)

    # Загружаем прогресс из GameProgress
    progress = db.session.execute(
        text("SELECT game_name, completed FROM game_progress WHERE student_id = :sid"),
        {"sid": student_id}
    ).fetchall()

    # Определяем порядок модулей и создаём словарь completed
    default_modules = ['words_match', 'maze', 'cipher_game', 'push_blocks_all', 'Ақпарат-алу', 'Көпір', 'Лабиринт', 'Ғарыш хабаршысы', 'Хабаршы', 'Қамал', 'Шифр']
    completed = {m: False for m in default_modules}
    for row in progress:
        if row.game_name in completed:
            completed[row.game_name] = bool(row.completed)

    return render_template("bolim1_3.html", completed=completed, student=student)

@app.route("/bolim1_4")
@login_required("student")
def bolim1_4():
    student_id = session.get("user_id")
    student = Student.query.get(student_id)

    # Загружаем прогресс из GameProgress
    progress = db.session.execute(
        text("SELECT game_name, completed FROM game_progress WHERE student_id = :sid"),
        {"sid": student_id}
    ).fetchall()

    # Определяем порядок модулей и создаём словарь completed
    default_modules = ['Шифр', 'Агент Шифр',  'Робот', 'Сиқырлы шарлар']
    completed = {m: False for m in default_modules}
    for row in progress:
        if row.game_name in completed:
            completed[row.game_name] = bool(row.completed)

    return render_template("bolim1_4.html", completed=completed, student=student)

@app.route("/game1")
@login_required("student")
def game1():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(student_id=student_id, game_name="Ақпарат-алу") \
                                 .order_by(GameProgress.attempt.desc()).first()

    # Егер бұрын тапсырған болса
    if progress:
        # Егер қайта өтуге рұқсат жоқ болса — тек нәтиже көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="Ақпарат-алу").first()
        if not (access and access.is_unlocked):
            return render_template("module1_result.html", score=progress.score, attempt=progress.attempt)

    return render_template("game1.html")


@app.route("/game2")
@login_required("student")
def game2():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(student_id=student_id, game_name="Көпір") \
                                 .order_by(GameProgress.attempt.desc()).first()

    # Егер бұрын тапсырған болса
    if progress:
        # Егер қайта өтуге рұқсат жоқ болса — тек нәтиже көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="Көпір").first()
        if not (access and access.is_unlocked):
            return render_template("module1_result.html", score=progress.score, attempt=progress.attempt)

    return render_template("game2.html")


@app.route("/game3")
@login_required("student")
def game3():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(student_id=student_id, game_name="Ғарыш хабаршысы") \
                                 .order_by(GameProgress.attempt.desc()).first()

    # Егер бұрын тапсырған болса
    if progress:
        # Егер қайта өтуге рұқсат жоқ болса — тек нәтиже көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="Ғарыш хабаршысы").first()
        if not (access and access.is_unlocked):
            return render_template("module1_result.html", score=progress.score, attempt=progress.attempt)

    return render_template("game3.html")

@app.route("/game4")
@login_required("student")
def game4():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(student_id=student_id, game_name="Хабаршы") \
                                 .order_by(GameProgress.attempt.desc()).first()

    # Егер бұрын тапсырған болса
    if progress:
        # Егер қайта өтуге рұқсат жоқ болса — тек нәтиже көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="Хабаршы").first()
        if not (access and access.is_unlocked):
            return render_template("module1_result.html", score=progress.score, attempt=progress.attempt)

    return render_template("game4.html")

@app.route("/game5")
@login_required("student")
def game5():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(student_id=student_id, game_name="Қамал") \
                                 .order_by(GameProgress.attempt.desc()).first()

    # Егер бұрын тапсырған болса
    if progress:
        # Егер қайта өтуге рұқсат жоқ болса — тек нәтиже көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="Қамал").first()
        if not (access and access.is_unlocked):
            return render_template("module1_result.html", score=progress.score, attempt=progress.attempt)

    return render_template("game5.html")

@app.route("/game6")
@login_required("student")
def game6():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(student_id=student_id, game_name="Шифр") \
                                 .order_by(GameProgress.attempt.desc()).first()

    # Егер бұрын тапсырған болса
    if progress:
        # Егер қайта өтуге рұқсат жоқ болса — тек нәтиже көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="Шифр").first()
        if not (access and access.is_unlocked):
            return render_template("module1_result.html", score=progress.score, attempt=progress.attempt)

    return render_template("game6.html")

@app.route("/game7")
@login_required("student")
def game7():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(student_id=student_id, game_name="Агент Шифр") \
                                 .order_by(GameProgress.attempt.desc()).first()

    # Егер бұрын тапсырған болса
    if progress:
        # Егер қайта өтуге рұқсат жоқ болса — тек нәтиже көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="Агент Шифр").first()
        if not (access and access.is_unlocked):
            return render_template("module1_result.html", score=progress.score, attempt=progress.attempt)

    return render_template("game7.html")

@app.route("/game8")
@login_required("student")
def game8():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(student_id=student_id, game_name="Робот") \
                                 .order_by(GameProgress.attempt.desc()).first()

    # Егер бұрын тапсырған болса
    if progress:
        # Егер қайта өтуге рұқсат жоқ болса — тек нәтиже көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="Робот").first()
        if not (access and access.is_unlocked):
            return render_template("module1_result.html", score=progress.score, attempt=progress.attempt)

    return render_template("game8.html")

@app.route("/game9")
@login_required("student")
def game9():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(student_id=student_id, game_name="Сиқырлы шарлар") \
                                 .order_by(GameProgress.attempt.desc()).first()

    # Егер бұрын тапсырған болса
    if progress:
        # Егер қайта өтуге рұқсат жоқ болса — тек нәтиже көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="Сиқырлы шарлар").first()
        if not (access and access.is_unlocked):
            return render_template("module1_result.html", score=progress.score, attempt=progress.attempt)

    return render_template("game9.html")

@app.route("/game10")
@login_required("student")
def game10():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(student_id=student_id, game_name="Екілік код") \
                                 .order_by(GameProgress.attempt.desc()).first()

    # Егер бұрын тапсырған болса
    if progress:
        # Егер қайта өтуге рұқсат жоқ болса — тек нәтиже көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="Екілік код").first()
        if not (access and access.is_unlocked):
            return render_template("module1_result.html", score=progress.score, attempt=progress.attempt)

    return render_template("game10.html")

@app.route("/module1")
@login_required("student")
def module1():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(student_id=student_id, game_name="words_match") \
                                 .order_by(GameProgress.attempt.desc()).first()

    # Егер бұрын тапсырған болса
    if progress:
        # Егер қайта өтуге рұқсат жоқ болса — тек нәтиже көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="words_match").first()
        if not (access and access.is_unlocked):
            return render_template("module1_result.html", score=progress.score, attempt=progress.attempt)

    # Әйтпесе ойын интерфейсін көрсету
    return render_template("module1.html")


@app.route('/module2')
@login_required("student")
def module2():
    student_id = session.get("user_id")

    # Соңғы нәтижені алу
    progress = GameProgress.query.filter_by(student_id=student_id, game_name="Лабиринт") \
                                 .order_by(GameProgress.attempt.desc()).first()

    if progress:
        # Егер қайта өтуге рұқсат жоқ болса — тек нәтиже көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="Лабиринт").first()
        if not (access and access.is_unlocked):
            return render_template("module1_result.html", score=progress.score, attempt=progress.attempt)

    return render_template("module2.html")




@app.route('/module3')
@login_required("student")
def module3():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(student_id=student_id, game_name="cipher_game") \
        .order_by(GameProgress.attempt.desc()).first()

    # Егер бұрын тапсырған болса
    if progress:
        # Егер қайта өтуге рұқсат жоқ болса — тек нәтиже көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="cipher_game").first()
        if not (access and access.is_unlocked):
            return render_template("module1_result.html", score=progress.score, attempt=progress.attempt)

    return render_template('module3.html')

@app.route('/module4')
def module4():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(student_id=student_id, game_name="push_blocks_all") \
        .order_by(GameProgress.attempt.desc()).first()

    # Егер бұрын тапсырған болса
    if progress:
        # Егер қайта өтуге рұқсат жоқ болса — тек нәтиже көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="push_blocks_all").first()
        if not (access and access.is_unlocked):
            return render_template("module1_result.html", score=progress.score, attempt=progress.attempt)

    return render_template('module4.html')

@app.route('/module6')
@login_required("student")
def module6():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(student_id=student_id, game_name="paint") \
        .order_by(GameProgress.attempt.desc()).first()

    # Егер бұрын тапсырған болса
    if progress:
        # Егер қайта өтуге рұқсат жоқ болса — тек нәтиже көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="paint").first()
        if not (access and access.is_unlocked):
            return render_template("module1_result.html", score=progress.score, attempt=progress.attempt)

    return render_template('module6.html')

@app.route('/module7')
@login_required("student")
def module7():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(student_id=student_id, game_name="shape_builder") \
        .order_by(GameProgress.attempt.desc()).first()

    # Егер бұрын тапсырған болса
    if progress:
        # Егер қайта өтуге рұқсат жоқ болса — тек нәтиже көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="shape_builder").first()
        if not (access and access.is_unlocked):
            return render_template("module1_result.html", score=progress.score, attempt=progress.attempt)

    return render_template('module7.html')


# Шығу
@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect("/")

from functools import wraps

def update_score(student_id, points=10):
    student = Student.query.get(student_id)
    if student:
        student.score = (student.score or 0) + points
        db.session.commit()
        return True
    return False

@app.route("/reset_module_score", methods=["POST"])
@login_required("teacher")
def reset_module_score():
    session.pop('_flashes', None)
    student_id = request.form["student_id"]
    game_name = request.form["game_name"]

    old_progress = GameProgress.query.filter_by(student_id=student_id, game_name=game_name).all()
    total_score = sum(p.score for p in old_progress)

    student = Student.query.get(student_id)
    student.score = max(0, student.score - total_score)

    for p in old_progress:
        db.session.delete(p)

    access = GameAccess.query.filter_by(student_id=student_id, game_name=game_name).first()
    if access:
        access.is_unlocked = True
    else:
        access = GameAccess(student_id=student_id, game_name=game_name, is_unlocked=True)
        db.session.add(access)

    db.session.commit()
    flash(f"{game_name} үшін ұпай өшірілді және қайта рұқсат берілді.")
    return redirect("/teacher/progress")


@app.route("/teacher/progress")
@login_required("teacher")
def teacher_progress():
    students = Student.query.all()
    progress_data = []

    for s in students:
        games = GameProgress.query.filter_by(student_id=s.id).all()
        progress_data.append({
            "id": s.id,
            "name": s.name,
            "student_class": s.student_class,
            "score": s.score,
            "correct_tasks": sum(1 for g in games if g.completed),
            "games": games
        })

    return render_template("teacher_progress.html", progress_data=progress_data)



if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port,)