import re
from flask import Flask, render_template, request, redirect, session, send_from_directory, jsonify
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
import sys
import mimetypes

# На части систем (Windows-реестр без записи, минимальные Linux-образы) .webp
# не зарегистрирован в mimetypes, и Flask отдаёт картинки как
# application/octet-stream — некоторые браузеры их тогда не отрисовывают.
mimetypes.add_type("image/webp", ".webp")

# Консоль Windows по умолчанию cp1251 и не может вывести казахские/кириллические
# символы в print() — переключаем поток вывода на UTF-8, иначе любой такой print
# роняет запрос с UnicodeEncodeError.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except Exception:
        pass

app = Flask(__name__)

load_dotenv()
app.secret_key = os.getenv("SECRET_KEY") or "dev-fallback-key-change-in-prod"

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
if db_url and db_url.startswith("postgresql://"):
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        # Railway-прокси закрывает простаивающие соединения — эти опции делают пул
        # устойчивым к разрывам и не дают приложению падать с "connection timed out".
        "pool_pre_ping": True,   # проверять соединение перед использованием (авто-реконнект)
        "pool_recycle": 280,     # пересоздавать соединение раньше, чем его закроет сервер
        "connect_args": {
            "sslmode": "require",
            "connect_timeout": 10,  # не зависать надолго, если БД недоступна
        },
    }

# app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///local.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
migrate = Migrate(app, db)

class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    # name оставляем как "имя", чтобы не делать переименование колонки
    name = db.Column(db.String(100), nullable=False)
    surname = db.Column(db.String(100), nullable=False)  # NEW

    student_class = db.Column(db.String(10), nullable=False)
    password = db.Column(db.String(200), nullable=False)
    score = db.Column(db.Float, default=0)

    progress = db.relationship('StudentProgress', backref='student', lazy=True)

    # было: ('name','student_class')
    __table_args__ = (
        db.UniqueConstraint('name', 'surname', 'student_class', name='uq_name_surname_class'),
    )

    def __repr__(self):
        return f"<Student {self.name} {self.surname}>"


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
    score = db.Column(db.Float, default=0)   # 10 ұпайлық шкала (0–10)
    stars = db.Column(db.Integer, default=0) # ⭐ счётчик звёзд
    completed = db.Column(db.Boolean, default=False)
    attempt = db.Column(db.Integer, nullable=False, default=1)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())

    student = db.relationship('Student', backref='games')


class AppMeta(db.Model):
    """Бір реттік деректер көшірулерінің белгісі (мысалы, 10 ұпайлық шкалаға көшу)."""
    key = db.Column(db.String(64), primary_key=True)
    value = db.Column(db.String(255), nullable=True)

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

# Бастапқы бет (Мұғалім/Білім алушы таңдау)
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
# ===================== Ғылыми еңбектер (мұғалімге) =====================
# Файлдар: static/docs/. Тізімге жаңа құжат қосу — осы жерге бір жол жазу жеткілікті.
DOCS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "docs")
TEACHER_DOCS = [
    {"id": "frontiers-2026", "file": "feduc-11-1749909 2.pdf", "kind": "Мақала", "lang": "EN",
     "title": "Enhancing secondary education through gamification and Bloom’s taxonomy: the BilimQuest portal",
     "source": "Frontiers in Education, 11:1749909 · 2026 · DOI 10.3389/feduc.2026.1749909"},
    {"id": "vak-2024", "file": "Балтабаева Н.А ВАК 2.pdf", "kind": "Мақала", "lang": "RU",
     "title": "О проблеме готовности будущих учителей информатики к геймификации обучения",
     "source": "Reports of the Academy of Sciences of the Republic of Kazakhstan · 2024 · ҚР ҒЖБССҚК (ВАК)"},
    {"id": "vak-2023", "file": "Балтабаева вак.pdf", "kind": "Мақала", "lang": "EN",
     "title": "Game technologies on Internet resources for training",
     "source": "Bulletin of the National Academy of Sciences of the RK, №5(405) · 2023 · ҚР ҒЖБССҚК (ВАК)"},
    {"id": "penza-2025", "file": "Балтабаева Н 3 статья международная 2.pdf", "kind": "Мақала", "lang": "RU",
     "title": "Инновационные образовательные технологии на базе электронного портала «BilimQuest»: "
              "геймификация, аналитика и развитие мотивации учащихся",
     "source": "«Актуальные вопросы науки и образования 2025», халықаралық конференция, Пенза · 2025"},
    {"id": "amanzholov-2025", "file": "Аманжоловские-чтения-5-секция-Сборник-2025.pdf", "kind": "Жинақ", "lang": "KZ",
     "title": "Болашақ информатика мұғалімдерін даярлауда жасанды интеллект пен геймификация "
              "технологияларын интеграциялаудың ғылыми негіздері",
     "source": "«Аманжолов оқулары-2025» халықаралық конференциясы, материалдар жинағы · мақала 58-беттен"},
    {"id": "amanzholov-cert", "file": "Балтабаева Н.А., Адиканова С. 3.pdf", "kind": "Сертификат", "lang": "KZ",
     "title": "«Аманжолов оқулары-2025» халықаралық ғылыми-тәжірибелік конференциясына қатысу сертификаты",
     "source": "С. Аманжолов атындағы ШҚУ · 25.11.2025"},
    {"id": "copyright-bilimquest", "file": "Свидетельство Назым Докторант 2.pdf", "kind": "Куәлік", "lang": "KZ",
     "title": "Авторлық құқық куәлігі: «BilimQuest» инновациялық әдістемелік электронды білім беру порталы",
     "source": "№ 62039 · 10.09.2025"},
    {"id": "copyright-course", "file": "Свидетельство 9.pdf", "kind": "Куәлік", "lang": "KZ",
     "title": "Авторлық құқық куәлігі: «Цифрлық білім беру ортасын және аналитиканы жобалау» электрондық оқу курсы",
     "source": "№ 79492 · 08.10.2026"},
]
TEACHER_DOCS_BY_ID = {d["id"]: d for d in TEACHER_DOCS}


def _doc_size(d):
    try:
        b = os.path.getsize(os.path.join(DOCS_DIR, d["file"]))
    except OSError:
        return None
    return f"{b / 1048576:.1f} МБ" if b >= 1048576 else f"{max(1, round(b / 1024))} КБ"


@app.route("/articles")
@login_required("teacher")
def articles():
    docs = [dict(d, size=_doc_size(d)) for d in TEACHER_DOCS]
    return render_template("articles.html", docs=[d for d in docs if d["size"]],
                           page_title="Ғылыми еңбектер",
                           page_desc="Геймификация және BilimQuest порталы бойынша мақалалар, конференция "
                                     "материалдары мен авторлық куәліктер. Керектісін белгілеп, бірге жүктеп алыңыз.")


# «Теориялық білім» / «Практикалық білім» — материалдар келгенше бос күйде (404 емес)
@app.route("/theory")
@login_required("teacher")
def theory():
    return render_template("articles.html", docs=[], page_title="Теориялық білім",
                           page_desc="Әдістеме мен теориялық материалдар.")


@app.route("/practice")
@login_required("teacher")
def practice():
    return render_template("articles.html", docs=[], page_title="Практикалық білім",
                           page_desc="Сабаққа арналған тапсырмалар мен жаттығулар.")


@app.route("/articles/file/<doc_id>")
@login_required("teacher")
def article_file(doc_id):
    d = TEACHER_DOCS_BY_ID.get(doc_id)
    if not d:
        return "Құжат табылмады", 404
    # ?view=1 — браузерде ашу, әйтпесе жүктеп алу
    return send_from_directory(DOCS_DIR, d["file"], as_attachment=not request.args.get("view"),
                               download_name=d["file"])


@app.route("/articles/zip")
@login_required("teacher")
def articles_zip():
    """Таңдалған құжаттарды бір ZIP-архив етіп береді (?id=...&id=...)."""
    import io
    import zipfile
    ids = [i for i in request.args.getlist("id") if i in TEACHER_DOCS_BY_ID]
    if not ids:
        return redirect("/articles")
    buf = io.BytesIO()
    # PDF өзі сығылған — қайта сықпаймыз (жылдамырақ)
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:
        for i in ids:
            d = TEACHER_DOCS_BY_ID[i]
            path = os.path.join(DOCS_DIR, d["file"])
            if os.path.exists(path):
                z.write(path, arcname=d["file"])
    buf.seek(0)
    from flask import send_file
    return send_file(buf, mimetype="application/zip", as_attachment=True,
                     download_name="BilimQuest_gylymi_enbekter.zip")


@app.route("/teacher")
@login_required("teacher")
def teacher():
    user_email = session.get("email")
    announcements = Announcement.query.order_by(Announcement.timestamp.desc()).all()
    teacher = Teacher.query.get(session.get("user_id"))

    # Егер қандай да бір student керек болса (мысалы, тест үшін)
    student = Student.query.first()  # Немесе нақты ID арқылы
    return render_template("teacher.html", email=user_email, announcements=announcements, student=student, teacher=teacher)


# Негізгі бет білім алушы үшін
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
    default_modules = ['Сәйкестік', 'maze', 'cipher_game']
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
        surname = request.form["surname"].strip()
        student_class = request.form["class"]
        password = request.form["password"]

        # Проверка на дубль (имя+фамилия+класс)
        existing_student = Student.query.filter_by(
            name=name, surname=surname, student_class=student_class
        ).first()

        if existing_student:
            error = f"{name} {surname} {student_class} сыныбында бұрын тіркелген. Кіру бетіне өтіңіз."
            return render_template("register.html", error=error)

        hashed_password = generate_password_hash(password)
        new_student = Student(
            name=name,
            surname=surname,
            student_class=student_class,
            password=hashed_password
        )
        db.session.add(new_student)
        db.session.commit()

        # Можно сразу залогинить и отправить на /student
        session["user_id"] = new_student.id
        session["user_name"] = new_student.name
        session["student_class"] = new_student.student_class
        session["role"] = "student"  # важно для login_required("student")

        return redirect("/student")

    return render_template("register.html")


# Кіру
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        name = request.form["name"].strip()
        surname = request.form["surname"].strip()
        password = request.form["password"]
        student_class = request.form["class"]

        student = Student.query.filter_by(
            name=name, surname=surname, student_class=student_class
        ).first()

        if student and check_password_hash(student.password, password):
            session["user_id"] = student.id
            session["user_name"] = student.name
            session["student_class"] = student.student_class
            session["role"] = "student"
            return redirect("/student")
        else:
            return "Қате: Есім, тегі, сынып немесе құпиясөз дұрыс емес."

    return render_template("login.html")




@app.route("/register_teacher", methods=["GET", "POST"])
def register_teacher():
    if request.method == "POST":
        name = request.form["name"]
        email = request.form["email"]
        password = request.form["password"]
        invite_code = request.form.get("invite_code", "")

        expected_code = os.getenv("TEACHER_INVITE_CODE")
        if not expected_code or invite_code != expected_code:
            return render_template("register_tchr.html",
                                    error="Мұғалімдер үшін код дұрыс емес.",
                                    form_name=name, form_email=email)

        # Проверка на существующий email
        existing_teacher = Teacher.query.filter_by(email=email).first()
        if existing_teacher:
            return render_template("register_tchr.html",
                                    error="Осындай почтасы бар қолданушы тіркелген.",
                                    form_name=name, form_email=email)

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

        if teacher and check_password_hash(teacher.password, password):
            session["user_id"] = teacher.id
            session["email"] = teacher.email
            session["role"] = "teacher"
            session["user_name"] = teacher.name
            return redirect("/teacher")
        else:
            return "Қате: Есім, почта немесе құпиясөз дұрыс емес."
    return render_template("login_tchr.html")

def _render_dashboard(student_id):
    """Барлық ойындар бойынша прогресс + Блум таксономиясы + қорытынды."""
    student = Student.query.get(student_id)
    if not student:
        return "Білім алушы табылмады", 404

    all_progress = GameProgress.query.filter_by(student_id=student_id).all()
    best = {p.game_name: p for p in all_progress}   # бір ойын — бір жазба (ең үздік)

    def earned_of(gname):
        p = best.get(gname)
        return min(float(p.score), MAX_SCORE.get(gname, 0)) if p else 0.0

    # ── Блум таксономиясы: тек ойналған ойындар бойынша, ойналмаса — «дерек жоқ» ──
    chapters_progress = bloom_breakdown({g: float(p.score or 0) for g, p in best.items()})

    # ── Тарау (тоқсан) прогрессі ──
    chapters_progress_display = {}
    for ck, info in GAME_CHAPTERS.items():
        mx = sum(MAX_SCORE.get(g, 0) for g in info["games"])
        earned = sum(earned_of(g) for g in info["games"])
        chapters_progress_display[CHAPTER_LABELS.get(ck, ck)] = {
            "score": round(earned, 2),
            "max_score": round(mx, 2),
            "percent": round(earned / mx * 100, 1) if mx > 0 else 0,
        }

    # ── Значки по главам (тоқсан жетондары) ──
    CHAPTER_BADGE = {
        "info": ("Жұлдыз", "⭐"), "graphics": ("Пазл", "🧩"),
        "robotics": ("Карта", "🗺️"), "security": ("Чип", "🔩"),
    }
    chapter_badges = []
    badges_total = 0
    for ck, info in GAME_CHAPTERS.items():
        cnt = sum(int(best[g].stars or 0) for g in info["games"] if g in best)
        mx = len(info["games"]) * 3
        label, icon = CHAPTER_BADGE.get(ck, (ck, "⭐"))
        chapter_badges.append({
            "kind": ck, "label": label, "icon": icon,
            "count": cnt, "max": mx, "done": mx > 0 and cnt >= 0.8 * mx,
        })
        badges_total += cnt

    # ── Жалпы қорытынды ──
    total_games = len(MAX_SCORE)
    played = sum(1 for g in MAX_SCORE if g in best)
    completed_cnt = sum(1 for p in all_progress if p.completed)
    max_total = sum(MAX_SCORE.values())
    earned_total = sum(earned_of(g) for g in MAX_SCORE)
    summary = {
        "total_games": total_games,
        "played": played,
        "play_percent": round(played / total_games * 100) if total_games else 0,
        "completed": completed_cnt,
        "earned": round(earned_total, 2),
        "max_total": round(max_total, 2),
        "earned_percent": round(earned_total / max_total * 100, 1) if max_total else 0,
        "badges": badges_total,
        "badges_max": sum(len(i["games"]) * 3 for i in GAME_CHAPTERS.values()),
        "score": round(float(student.score), 2),
    }

    # ── Ойын тарихы ──
    games = sorted(all_progress, key=lambda p: p.id, reverse=True)
    for p in games:
        ck = GAME_TO_CHAPTER.get(p.game_name, "info")
        p.chapter = CHAPTER_LABELS.get(ck, "—")
        p.bloom = GAME_BLOOM.get(p.game_name, "—")

    return render_template(
        "dashboard.html",
        student=student,
        games=games,
        chapters_progress=chapters_progress,
        chapters_progress_display=chapters_progress_display,
        chapter_badges=chapter_badges,
        badges_total=badges_total,
        summary=summary,
        stars_sum=badges_total,
        total_score=summary["score"],
    )


@app.route("/student_dashboard/<int:student_id>")
@login_required("teacher")
def student_dashboard(student_id):
    return _render_dashboard(student_id)


@app.route("/my_profile")
@login_required("student")
def my_profile():
    """Student views their own progress dashboard."""
    return _render_dashboard(session["user_id"])

# Тарау (глава) → жетон түрі + сол тарауға жататын ойындар
GAME_CHAPTERS = {
    "info": {
        "kind": "star", "back": "/1module",
        "games": ["Сәйкестік", "Көпір", "Қағып ал", "Лабиринт", "Ғарыш хабаршысы",
                  "Хабаршы", "Қамал", "Шифр", "Агент", "Робот",
                  "Сиқырлы шарлар", "Блоктар"],
    },
    "graphics": {
        "kind": "puzzle", "back": "/toqsan_2",
        "games": ["Пиксель шебері", "Фотолаб", "Лазер жолы", "Вектор ядро", "Графика текетірес"],
    },
    "robotics": {
        "kind": "map", "back": "/toqsan_3",
        "games": ["Робот орны", "Робот тарихы", "Гироскоп", "Лабиринт ойыны", "Сызық робот", "Сумо"],
    },
    "security": {
        "kind": "chip", "back": "/toqsan_4",
        "games": ["Эргономика", "Цифрлық детектив", "Кибер-бекініс", "Файл әлемі", "Желілік жүгіруші"],
    },
}
GAME_TO_CHAPTER = {g: ck for ck, info in GAME_CHAPTERS.items() for g in info["games"]}

# Ойынның максимал ұпайы (барлық ойын — бір жерде)
# Барлық ойын 10 ұпайлық шкала бойынша бағаланады. Ойындар өз ішкі ұпайын жібереді
# (мысалы 0.3 / 0.3) — сервер оны 10 ұпайға айналдырады: score10 = шикі / GAME_RAW_MAX × 10.
SCORE_SCALE = 10.0
GAME_RAW_MAX = {
    "Сәйкестік": 0.4, "Көпір": 0.3, "Қағып ал": 0.3, "Лабиринт": 0.3,
    "Ғарыш хабаршысы": 0.3, "Хабаршы": 0.3, "Қамал": 0.6, "Шифр": 0.7,
    "Агент": 0.7, "Робот": 0.6, "Сиқырлы шарлар": 1.4, "Блоктар": 1.4,
    "Робот орны": 0.3, "Робот тарихы": 0.5, "Гироскоп": 0.3, "Лабиринт ойыны": 0.5,
    "Сызық робот": 0.5, "Сумо": 0.5,
    "Эргономика": 0.1, "Цифрлық детектив": 0.2, "Кибер-бекініс": 0.3,
    "Файл әлемі": 0.3, "Желілік жүгіруші": 0.3,
    "Пиксель шебері": 0.5, "Фотолаб": 0.5, "Лазер жолы": 0.5,
    "Вектор ядро": 0.5, "Графика текетірес": 0.6,
}
# Сақталған және көрсетілетін ұпайлар — бәрі 10-нан
MAX_SCORE = {g: SCORE_SCALE for g in GAME_RAW_MAX}


def to_scale10(game_name, raw_score):
    """Ойынның шикі ұпайын 10 ұпайлық шкалаға айналдырады (0–10, 2 таңба)."""
    raw_max = GAME_RAW_MAX.get(game_name)
    if not raw_max:
        return None
    raw = max(0.0, min(float(raw_score or 0), raw_max))
    return round(raw / raw_max * SCORE_SCALE, 2)

# Блум таксономиясы: әр ойынның деңгейлері (тапсырыс берушінің «Блум рубрикасы, 28 ойын»,
# 2-кесте). Ойынның ұпайы оның деңгейлеріне ТЕҢ бөлінеді (рубриканың 4-бөлімі, 1-ереже).
BLOOM_LEVELS = ["Білу", "Түсіну", "Қолдану", "Талдау", "Бағалау", "Жасау"]
GAME_BLOOM_LEVELS = {
    # 1-бөлім. Ақпаратты ұсыну
    "Қағып ал": ["Білу"],
    "Сәйкестік": ["Түсіну"],
    "Көпір": ["Түсіну"],
    "Лабиринт": ["Түсіну", "Қолдану"],
    "Ғарыш хабаршысы": ["Қолдану"],
    "Хабаршы": ["Қолдану", "Талдау"],
    "Қамал": ["Қолдану"],
    "Шифр": ["Қолдану"],
    "Агент": ["Қолдану", "Талдау"],
    "Робот": ["Қолдану", "Талдау"],
    "Сиқырлы шарлар": ["Қолдану"],
    "Блоктар": ["Қолдану", "Талдау"],
    # 2-бөлім. Компьютерлік графика
    "Пиксель шебері": ["Түсіну", "Қолдану"],
    "Фотолаб": ["Қолдану", "Бағалау"],
    "Лазер жолы": ["Қолдану", "Жасау"],
    "Вектор ядро": ["Талдау", "Жасау"],
    "Графика текетірес": ["Талдау"],
    # 3-бөлім. Робототехника
    "Робот орны": ["Түсіну"],
    "Робот тарихы": ["Білу", "Талдау"],
    "Гироскоп": ["Қолдану", "Талдау"],      # 2-фазада Ki керек екенін өзі анықтайды
    "Лабиринт ойыны": ["Қолдану", "Жасау"],
    "Сызық робот": ["Қолдану", "Талдау"],
    "Сумо": ["Қолдану", "Бағалау"],
    # 4-бөлім. Жасанды интеллект зертханасы
    "Эргономика": ["Түсіну", "Бағалау"],
    "Цифрлық детектив": ["Білу", "Қолдану", "Бағалау"],
    "Желілік жүгіруші": ["Түсіну", "Қолдану"],
    "Кибер-бекініс": ["Қолдану", "Бағалау", "Жасау"],
    "Файл әлемі": ["Қолдану", "Бағалау"],
}
# Қысқа көрсету үшін (ойын тарихы, ИИ контексі): «Қолдану / Талдау»
GAME_BLOOM = {g: " / ".join(lv) for g, lv in GAME_BLOOM_LEVELS.items()}


def bloom_breakdown(best_scores):
    """Блум деңгейлері бойынша ұпай мен пайыз (рубриканың 4-бөлімі).

    best_scores: {ойын: ең үздік ұпай} — ТЕК ойналған ойындар.
    Ойын ұпайы мен максимумы оның деңгейлеріне тең бөлінеді. Деңгей пайызы =
    жиналған ұпай / ойналған ойындардың максимумы. Бірде-бір ойын ойналмаса — percent=None
    («дерек жоқ»), сонда «ойнамаған» мен «нашар орындаған» шатаспайды.
    """
    agg = {lvl: {"earned": 0.0, "max": 0.0, "games": 0} for lvl in BLOOM_LEVELS}
    for gname, score in best_scores.items():
        levels = GAME_BLOOM_LEVELS.get(gname)
        mx = MAX_SCORE.get(gname, 0)
        if not levels or mx <= 0:
            continue
        share = 1.0 / len(levels)
        for lvl in levels:
            agg[lvl]["earned"] += min(float(score), mx) * share
            agg[lvl]["max"] += mx * share
            agg[lvl]["games"] += 1
    return {
        lvl: {
            "score": round(d["earned"], 3),
            "max_score": round(d["max"], 3),
            "games": d["games"],
            "percent": round(d["earned"] / d["max"] * 100, 1) if d["max"] > 0 else None,
        }
        for lvl, d in agg.items()
    }


CHAPTER_LABELS = {
    "info": "Ақпаратты ұсыну",
    "graphics": "Компьютерлік графика",
    "robotics": "Робототехника",
    "security": "Жасанды интеллект зертханасы",
}


def _chapter_reward(student_id, game_name):
    """Тарау жетоны: түрі + сол тарау бойынша жұлдыз қосындысы + карта адресі."""
    ck = GAME_TO_CHAPTER.get(game_name, "info")
    ch = GAME_CHAPTERS[ck]
    total = db.session.query(func.coalesce(func.sum(GameProgress.stars), 0))\
        .filter(GameProgress.student_id == student_id,
                GameProgress.game_name.in_(ch["games"])).scalar()
    return {"kind": ch["kind"], "total": int(total), "back": ch["back"]}


def stars_map(student_id, game_names):
    """{game_name: stars(0–3)} — карта көрсету үшін."""
    rows = GameProgress.query.filter(
        GameProgress.student_id == student_id,
        GameProgress.game_name.in_(list(game_names))).all()
    return {r.game_name: int(r.stars or 0) for r in rows}


def game_tier(game_name, score, max_score, completed):
    """Белгіше саны (0–3), 10 ұпайлық шкала бойынша: 9–10 → 3, 7–8 → 2, 1–6 → 1, 0 → 0."""
    if not completed or score <= 0:
        return 0          # жеңіліс (0 ұпай) — белгіше берілмейді
    s10 = (score / max_score * SCORE_SCALE) if max_score and max_score > 0 else 0.0
    if s10 >= 9: return 3
    if s10 >= 7: return 2
    return 1


def render_game_or_gate(game_name, template, back_url=None):
    """Ойынды ашпас бұрын: егер бұрын ойналған болса — нәтиже терезесін (gate)
    көрсетеміз. attempt<2 (немесе мұғалім ашқан) болса — «Қайта өту» батырмасы,
    әйтпесе — «мүмкіндік бітті» хабары. ?play=1 параметрі гейтті аттап өтеді."""
    student_id = session.get("user_id")
    student = Student.query.get_or_404(student_id)
    progress = GameProgress.query.filter_by(student_id=student_id, game_name=game_name).first()
    access = GameAccess.query.filter_by(student_id=student_id, game_name=game_name).first()
    unlocked = bool(access and access.is_unlocked)
    back = back_url or _chapter_reward(student_id, game_name)["back"]

    if progress:
        can_replay = (progress.attempt < 2) or unlocked
        play = request.args.get("play")
        if (not play) or (not can_replay):
            return render_template(
                "game_gate.html",
                student=student,
                game_name=game_name,
                play_url=request.path + "?play=1",
                score=round(float(progress.score), 2),
                attempt=progress.attempt,
                total_score=round(float(student.score), 2),
                reward=_chapter_reward(student_id, game_name),
                can_replay=can_replay,
                back=back,
            )
    return render_template(template, student=student)


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

    score = to_scale10(game_name, score)     # ойынның шикі ұпайы → 10 ұпай
    if score is None:
        return {"error": "Unknown game"}, 400
    max_score = SCORE_SCALE
    stars = game_tier(game_name, score, max_score, completed)   # 0–3 значок

    # бір ойынға — бір жазба; attempt = өту саны
    progress = GameProgress.query.filter_by(student_id=student_id, game_name=game_name).first()
    attempts = progress.attempt if progress else 0
    access = GameAccess.query.filter_by(student_id=student_id, game_name=game_name).first()
    unlocked = bool(access and access.is_unlocked)

    if attempts >= 2 and not unlocked:
        return {"status": "denied", "message": "Мұғалім рұқсат бермейінше қайта өтуге болмайды."}, 403

    if unlocked:
        access.is_unlocked = False  # бір реттік рұқсат жұмсалды

    # ЕҢ ҮЗДІК нәтиже есепке алынады
    prev_best = float(progress.score) if progress else 0.0
    prev_stars = int(progress.stars) if progress else 0
    new_best = max(prev_best, score)
    new_stars = max(prev_stars, stars)
    added = round(new_best - prev_best, 2)   # балансқа тек жақсарған айырма қосылады

    if progress:
        progress.score = new_best
        progress.stars = new_stars
        progress.completed = progress.completed or completed
        progress.attempt = attempts + 1
    else:
        progress = GameProgress(
            student_id=student_id, game_name=game_name,
            score=new_best, stars=new_stars, completed=completed, attempt=1
        )
        db.session.add(progress)

    student = Student.query.get(student_id)
    if student and added > 0:
        student.score += added

    db.session.commit()

    total_stars = db.session.query(func.coalesce(func.sum(GameProgress.stars), 0))\
        .filter_by(student_id=student_id).scalar()

    # тарау жетоны: осы тараудағы ойындар бойынша жұлдыз қосындысы
    chapter_key = GAME_TO_CHAPTER.get(game_name, "info")
    chapter = GAME_CHAPTERS[chapter_key]
    chapter_total = db.session.query(func.coalesce(func.sum(GameProgress.stars), 0))\
        .filter(GameProgress.student_id == student_id,
                GameProgress.game_name.in_(chapter["games"])).scalar()

    return {
        "status": "ok",
        "score": round(score, 2),
        "stars": stars,
        "added": round(added, 2),
        "total_score": round(float(student.score), 2) if student else 0,
        "total_stars": int(total_stars),
        "reward": {
            "kind": chapter["kind"],
            "total": int(chapter_total),
            "back": chapter["back"],
        },
    }


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
    rows = (
        db.session.query(
            Student.id,
            Student.name,
            Student.surname,
            Student.student_class,
            Student.score.label("total_score"),          # жалпы ұпай (тиын) — басқа беттердегімен бірдей
            func.coalesce(func.sum(GameProgress.stars), 0).label("stars_sum"),   # белгішелер
            func.count(GameProgress.id).label("completed_games"),
        )
        .outerjoin(GameProgress, GameProgress.student_id == Student.id)
        .group_by(Student.id)
        # белгіше тең болса — жалпы ұпай шешеді
        .order_by(func.coalesce(func.sum(GameProgress.stars), 0).desc(),
                  func.coalesce(Student.score, 0).desc(), Student.name)
        .limit(20)
        .all()
    )
    # Белгіше де, ұпай да тең болса — орын да бірдей (1, 2, 2, 4 ...)
    students, prev, rank = [], None, 0
    for i, r in enumerate(rows):
        d = dict(r._mapping)
        d["total_score"] = round(float(d["total_score"] or 0), 2)
        key = (int(d["stars_sum"]), d["total_score"])
        if key != prev:
            rank, prev = i + 1, key
        d["rank"] = rank
        students.append(d)
    return render_template("rating.html", students=students)

@app.route("/reset_module/<int:student_id>")
@login_required("teacher")
def reset_module(student_id):
    GameProgress.query.filter_by(student_id=student_id, game_name="words_match").delete()
    db.session.commit()
    flash("Білім алушыға қайта өтуге рұқсат берілді")
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

    from collections import defaultdict

    # ---- «Класс бойынша меңгеру» — білім алушы профиліндегі Блум диаграммасымен БІРДЕЙ ----
    # Әр білім алушының әр ойындағы ең үздік нәтижесі; ойын ұпайы деңгейлеріне тең бөлінеді;
    # пайыз тек ойналған ойындар бойынша; сыныпта ешкім ойнамаған деңгей — «дерек жоқ» (None).
    num_students = len(students)
    ids = [st.id for st in students]
    best = {}
    for gp in (GameProgress.query.filter(GameProgress.student_id.in_(ids)).all() if ids else []):
        k = (gp.student_id, gp.game_name)
        if k not in best or gp.score > best[k]:
            best[k] = float(gp.score or 0)
    lvl_earned = defaultdict(float)
    lvl_max = defaultdict(float)
    for (sid, gname), sc in best.items():
        levels = GAME_BLOOM_LEVELS.get(gname)
        mx = MAX_SCORE.get(gname, 0)
        if not levels or mx <= 0:
            continue
        for lvl in levels:
            lvl_earned[lvl] += min(sc, mx) / len(levels)
            lvl_max[lvl] += mx / len(levels)
    labels = list(BLOOM_LEVELS)
    scores = [round(lvl_earned[l] / lvl_max[l] * 100, 1) if lvl_max[l] > 0 else None for l in labels]

    # ---- ГРАФИК "Тақырып бойынша" С ФИЛЬТРОМ ПО ЧЕТВЕРТЯМ ----
    # Четверть = тарау (info/graphics/robotics/security). Тема = игра четверти.
    QUARTER_ORDER = ["info", "graphics", "robotics", "security"]
    QUARTER_PREFIX = {"info": "1-тоқсан", "graphics": "2-тоқсан",
                      "robotics": "3-тоқсан", "security": "4-тоқсан"}
    quarters = [
        {"key": k, "label": f"{QUARTER_PREFIX[k]} · {CHAPTER_LABELS.get(k, k)}"}
        for k in QUARTER_ORDER if k in GAME_CHAPTERS
    ]
    selected_quarter = request.args.get("quarter", "info")
    if selected_quarter not in GAME_CHAPTERS:
        selected_quarter = "info"
    quarter_label = next((q["label"] for q in quarters if q["key"] == selected_quarter), "")

    # 1-я четверть: игры объединяются в 4 темы (главы). Остальные: тема = игра.
    QUARTER1_TOPICS = [
        ("Айналамыздағы ақпарат", ["Қағып ал", "Көпір", "Сәйкестік"]),
        ("Ақпаратты беру", ["Лабиринт", "Ғарыш хабаршысы", "Хабаршы"]),
        ("Ақпаратты шифрлау", ["Қамал", "Шифр", "Агент"]),
        ("Екілік ақпаратты көрсету", ["Робот", "Сиқырлы шарлар", "Блоктар"]),
    ]

    # Среднее усвоение на ученика (по всем классам).
    all_progress_all = GameProgress.query.filter(GameProgress.completed == True).all()
    total_students = Student.query.count()
    score_by_game = defaultdict(float)
    for gp in all_progress_all:
        score_by_game[gp.game_name] += gp.score

    labels_all = []
    scores_all = []
    if selected_quarter == "info":
        groups = QUARTER1_TOPICS
    else:
        groups = [(g, [g]) for g in GAME_CHAPTERS[selected_quarter]["games"]]
    for topic, games in groups:
        gmax = sum(MAX_SCORE.get(g, 0) for g in games)
        denom = gmax * total_students
        total = sum(score_by_game.get(g, 0) for g in games)
        pct = (total / denom * 100) if denom > 0 else 0
        labels_all.append(topic)
        scores_all.append(min(round(pct, 2), 100))

    class_list = [row[0] for row in db.session.query(Student.student_class).distinct().all()]
    return render_template(
        "teacher_panel.html",
        students=students,
        labels=labels,
        scores=scores,
        labels_all=labels_all,
        scores_all=scores_all,
        selected_class=selected_class,
        class_list=class_list,
        quarters=quarters,
        selected_quarter=selected_quarter,
        quarter_label=quarter_label,
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
    default_modules = ['Сәйкестік', 'maze', 'cipher_game']
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
    default_modules = ['Сәйкестік', 'maze', 'cipher_game', 'push_blocks_all', 'Қағып ал', 'Көпір']
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
    default_modules = ['Сәйкестік', 'maze', 'cipher_game', 'push_blocks_all', 'Қағып ал', 'Көпір', 'Лабиринт', 'Ғарыш хабаршысы']
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
    default_modules = ['Сәйкестік', 'maze', 'cipher_game', 'push_blocks_all', 'Қағып ал', 'Көпір', 'Лабиринт', 'Ғарыш хабаршысы', 'Хабаршы', 'Қамал', 'Шифр']
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
    default_modules = ['Шифр', 'Агент',  'Робот', 'Сиқырлы шарлар']
    completed = {m: False for m in default_modules}
    for row in progress:
        if row.game_name in completed:
            completed[row.game_name] = bool(row.completed)

    return render_template("bolim1_4.html", completed=completed, student=student)

@app.route("/bolim1_5")
@login_required("student")
def bolim1_5():
    student_id = session.get("user_id")
    student = Student.query.get(student_id)

    # Загружаем прогресс из GameProgress
    progress = db.session.execute(
        text("SELECT game_name, completed FROM game_progress WHERE student_id = :sid"),
        {"sid": student_id}
    ).fetchall()

    # Определяем порядок модулей и создаём словарь completed
    default_modules = ['Шифр', 'Агент',  'Робот', 'Сиқырлы шарлар','Блоктар']
    completed = {m: False for m in default_modules}
    for row in progress:
        if row.game_name in completed:
            completed[row.game_name] = bool(row.completed)

    return render_template("bolim1_5.html", completed=completed, student=student)

@app.route("/toqsan_2")
@login_required("student")
def toqsan_2():
    student_id = session.get("user_id")

    student = Student.query.get_or_404(student_id)

    progress = db.session.execute(
        text("""
            SELECT game_name, completed
            FROM game_progress
            WHERE student_id = :sid
        """),
        {"sid": student_id}
    ).fetchall()

    default_modules = [
        'matching',
        'maze',
        'cipher_game',
        'push_blocks_all'
    ]

    completed = {m: False for m in default_modules}

    for game_name, is_completed in progress:
        if game_name in completed:
            completed[game_name] = bool(is_completed)

    return render_template(
        "toqsan_2.html",
        student=student,
        stars=stars_map(student_id, GAME_CHAPTERS["graphics"]["games"]),
        completed=completed
    )

@app.route("/toqsan2/g1")
@login_required("student")
def toqsan2_g1():
    return render_game_or_gate("Пиксель шебері", "toqsan2_g1.html", "/toqsan_2")

@app.route("/toqsan2/g2")
@login_required("student")
def toqsan2_g2():
    return render_game_or_gate("Фотолаб", "toqsan2_g2.html", "/toqsan_2")

@app.route("/toqsan2/g3")
@login_required("student")
def toqsan2_g3():
    return render_game_or_gate("Лазер жолы", "toqsan2_g3.html", "/toqsan_2")

@app.route("/toqsan2/g4")
@login_required("student")
def toqsan2_g4():
    return render_game_or_gate("Вектор ядро", "toqsan2_g4.html", "/toqsan_2")

@app.route("/toqsan2/g5")
@login_required("student")
def toqsan2_g5():
    return render_game_or_gate("Графика текетірес", "toqsan2_g5.html", "/toqsan_2")

@app.route("/toqsan_3")
@login_required("student")
def toqsan_3():
    student_id = session.get("user_id")

    student = Student.query.get_or_404(student_id)

    progress = db.session.execute(
        text("""
            SELECT game_name, completed
            FROM game_progress
            WHERE student_id = :sid
        """),
        {"sid": student_id}
    ).fetchall()

    default_modules = [
        'Робот орны',
        'Робот тарихы',
        'Гироскоп',
        'Лабиринт ойыны',
        'Сызық робот',
        'Сумо',
    ]

    completed = {m: False for m in default_modules}

    for game_name, is_completed in progress:
        if game_name in completed:
            completed[game_name] = bool(is_completed)

    return render_template(
        "toqsan_3.html",
        student=student,
        stars=stars_map(student_id, GAME_CHAPTERS["robotics"]["games"]),
        completed=completed
    )

@app.route("/toqsan_4")
@login_required("student")
def toqsan_4():
    student_id = session.get("user_id")
    student = Student.query.get_or_404(student_id)
    return render_template(
        "toqsan_4.html", student=student,
        stars=stars_map(student_id, GAME_CHAPTERS["security"]["games"])
    )

@app.route("/toqsan4/g1")
@login_required("student")
def toqsan4_g1():
    return render_game_or_gate("Эргономика", "toqsan4_g1.html", "/toqsan_4")

@app.route("/toqsan4/g2")
@login_required("student")
def toqsan4_g2():
    return render_game_or_gate("Цифрлық детектив", "toqsan4_g2.html", "/toqsan_4")

@app.route("/toqsan4/g3")
@login_required("student")
def toqsan4_g3():
    return render_game_or_gate("Желілік жүгіруші", "toqsan4_g3.html", "/toqsan_4")

@app.route("/toqsan4/g4")
@login_required("student")
def toqsan4_g4():
    return render_game_or_gate("Кибер-бекініс", "toqsan4_g4.html", "/toqsan_4")

@app.route("/toqsan4/g5")
@login_required("student")
def toqsan4_g5():
    return render_game_or_gate("Файл әлемі", "toqsan4_g5.html", "/toqsan_4")

@app.route("/game1")
@login_required("student")
def game1():
    return render_game_or_gate("Қағып ал", "game1.html", "/1module")

@app.route("/game2")
@login_required("student")
def game2():
    return render_game_or_gate("Көпір", "game2.html", "/1module")


@app.route("/game3")
@login_required("student")
def game3():
    return render_game_or_gate("Ғарыш хабаршысы", "game3.html", "/1module")

@app.route("/game4")
@login_required("student")
def game4():
    return render_game_or_gate("Хабаршы", "game4.html", "/1module")

@app.route("/game5")
@login_required("student")
def game5():
    return render_game_or_gate("Қамал", "game5.html", "/1module")

@app.route("/game6")
@login_required("student")
def game6():
    return render_game_or_gate("Шифр", "game6.html", "/1module")

@app.route("/game7")
@login_required("student")
def game7():
    return render_game_or_gate("Агент", "game7.html", "/1module")

@app.route("/game8")
@login_required("student")
def game8():
    return render_game_or_gate("Робот", "game8.html", "/1module")

@app.route("/game9")
@login_required("student")
def game9():
    return render_game_or_gate("Сиқырлы шарлар", "game9.html", "/1module")

@app.route("/module1")
@login_required("student")
def module1():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(
        student_id=student_id, game_name="Сәйкестік"
    ).order_by(GameProgress.attempt.desc()).first()

    if progress:
        # Егер 2 реттен аз тапсырса — ойынды қайтадан ашамыз
        if progress.attempt < 2:
            return render_template("module1.html")

        # Егер барлық 2 мүмкіндікті қолданса, тек нәтижесін көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="Сәйкестік").first()
        if not (access and access.is_unlocked):
            return render_template(
                "module1_result.html",
                score=progress.score,
                attempt=progress.attempt
            )

    # Әйтпесе ойын интерфейсін көрсету
    return render_template("module1.html")


@app.route('/module2')
@login_required("student")
def module2():
    student_id = session.get("user_id")

    # Соңғы нәтижені алу
    progress = GameProgress.query.filter_by(
        student_id=student_id, game_name="Лабиринт"
    ).order_by(GameProgress.attempt.desc()).first()

    if progress:
        # Егер 2 реттен аз тапсырса — ойынды қайтадан ашамыз
        if progress.attempt < 2:
            return render_template("module2.html")

        # Егер барлық 2 мүмкіндікті қолданса, тек нәтижесін көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="Лабиринт").first()
        if not (access and access.is_unlocked):
            return render_template(
                "module1_result.html",
                score=progress.score,
                attempt=progress.attempt
            )

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
@login_required("student")
def module4():
    student_id = session.get("user_id")

    # Соңғы attempt-ті табамыз
    progress = GameProgress.query.filter_by(
        student_id=student_id, game_name="Блоктар"
    ).order_by(GameProgress.attempt.desc()).first()

    if progress:
        # Егер 2 реттен аз тапсырса — ойынды қайтадан ашамыз
        if progress.attempt < 2:
            return render_template("module4.html")

        # Егер барлық 2 мүмкіндікті қолданса, тек нәтижесін көрсетеміз
        access = GameAccess.query.filter_by(student_id=student_id, game_name="Блоктар").first()
        if not (access and access.is_unlocked):
            return render_template(
                "module1_result.html",
                score=progress.score,
                attempt=progress.attempt
            )

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


# ── Quest 3: Robotics missions ──────────────────────────────
@app.route("/quest3/m1")
@login_required("student")
def quest3_m1():
    return render_game_or_gate("Робот орны", "quest3_m1.html", "/toqsan_3")

@app.route("/quest3/m2")
@login_required("student")
def quest3_m2():
    return render_game_or_gate("Робот тарихы", "quest3_m2.html", "/toqsan_3")

@app.route("/quest3/m3")
@login_required("student")
def quest3_m3():
    return render_game_or_gate("Гироскоп", "quest3_m3.html", "/toqsan_3")

@app.route("/quest3/m4")
@login_required("student")
def quest3_m4():
    return render_game_or_gate("Лабиринт ойыны", "quest3_m4.html", "/toqsan_3")

@app.route("/quest3/m5")
@login_required("student")
def quest3_m5():
    return render_game_or_gate("Сызық робот", "quest3_m5.html", "/toqsan_3")

@app.route("/quest3/m6")
@login_required("student")
def quest3_m6():
    return render_game_or_gate("Сумо", "quest3_m6.html", "/toqsan_3")


# ===================== BilimAI чат-ассистент =====================
import anthropic as _anthropic

# Фича-флаг ИИ-чата. По умолчанию ВЫКЛЮЧЕН — в проде ИИ не появляется,
# пока явно не задана переменная окружения AI_CHAT_ENABLED=true.
AI_CHAT_ENABLED = os.getenv("AI_CHAT_ENABLED", "false").strip().lower() in ("1", "true", "yes", "on")

CHAT_SYSTEM_PROMPTS = {
    "student": (
        "Сен — BilimAI, BilimQuest білім беру платформасының достық көмекшісісің. "
        "Қолданушы — 5-сынып білім алушысы. Әрқашан қазақ тілінде, қарапайым әрі қысқа жауап бер. "
        "Сенің екі негізгі міндетің бар:\n"
        "1) ОЙЫНДАРҒА КӨМЕК: Информатика тақырыптарын (ақпарат, кодтау, екілік жүйе, "
        "компьютерлік графика, робототехника, қауіпсіздік) түсіндір. Ойындар мен тапсырмаларға "
        "ТЕК КЕҢЕС пен бағыттаушы сұрақтар бер, бірақ ЕШҚАШАН дайын жауапты толық берме — "
        "білім алушы өзі ойлансын. Қадам-қадаммен ойлауға бағытта.\n"
        "2) ӨЗІН-ӨЗІ ДАМЫТУ КЕҢЕСТЕРІ: Білім алушыға қалай жақсы оқуға болатынын үйрет — "
        "зейінді шоғырландыру, уақытты дұрыс бөлу, демалыс пен оқуды кезектестіру, "
        "қателерден қорықпау, мақсат қою және өзіне сенімді болу туралы қарапайым, "
        "практикалық кеңестер бер. Білім алушыны қолда, мотивация бер.\n"
        "Әрқашан мейірімді бол, мадақта. Сұрақ оқуға не өзін дамытуға қатысы болмаса, "
        "жұмсақ түрде тақырыпқа қайтар. Жауаптарды қысқа абзацтармен жаз."
    ),
    "teacher": (
        "Сен — BilimQuest платформасындағы мұғалімнің көмекшісісің. Білім алушылардың үлгерімін талдауға, "
        "хабарландыру мәтінін жазуға және әдістемелік кеңес беруге көмектесесің. Қазақ тілінде "
        "(немесе сұрақ тілінде), нақты әрі құрылымды жауап бер. Деректер жоқ жерде болжам жасама."
    ),
}


# ИИ моделі .env арқылы ауыстырылады (әдепкі — Claude Haiku 5.5: 1M контекст, жылдам әрі арзан)
AI_MODEL = os.getenv("AI_MODEL", "claude-haiku-5-5").strip() or "claude-haiku-5-5"


def _claude_call(system, messages, max_tokens=4000, effort="low"):
    """Claude-ке бір сұраныс. (text, error) қайтарады — біреуі None.

    Haiku 5.5-те ойлау (adaptive thinking) әдепкі бойынша қосулы: жауап алдымен
    `thinking` блогынан басталуы мүмкін, сондықтан мәтінді блок ТҮРІ бойынша аламыз.
    Ойлау да max_tokens-ке кіреді — сондықтан қор қалдырамыз; терең ойлауды effort басқарады
    (low — чат пен кеңес үшін жылдам, medium — мұғалімге талдау/жоспар үшін).
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None, "⚙️ ANTHROPIC_API_KEY орнатылмаған."
    try:
        client = _anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model=AI_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
            output_config={"effort": effort},
        )
    except _anthropic.AuthenticationError as e:
        print("Claude auth error (ANTHROPIC_API_KEY жарамсыз):", e)
        return None, "⚙️ ИИ кілті жарамсыз. Әкімші жаңа ANTHROPIC_API_KEY орнатуы керек."
    except _anthropic.RateLimitError as e:
        print("Claude rate limit:", e)
        return None, "ИИ қазір бос емес. Бір минуттан соң қайталап көр."
    except _anthropic.APIStatusError as e:
        print("Claude API error:", e.status_code, e)
        return None, "Байланыс қатесі. Кейінірек қайталаңыз."
    except _anthropic.APIConnectionError as e:
        print("Claude connection error:", e)
        return None, "Байланыс қатесі. Интернетті тексеріп, қайталаңыз."

    if resp.stop_reason == "refusal":
        return None, "Бұл сұраққа жауап бере алмаймын. Сұрақты басқаша қойып көр."
    text = "".join(b.text for b in resp.content if b.type == "text").strip()
    if not text:
        print("Claude empty answer, stop_reason:", resp.stop_reason)
        return None, "Жауап дайын болмады. Сұрақты қысқарақ қойып, қайталап көр."
    return text, None


def _claude_reply(role, message, history, page, page_text=""):
    """Call Claude API via Anthropic SDK. Returns reply text or a graceful fallback."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    system = CHAT_SYSTEM_PROMPTS.get(role, CHAT_SYSTEM_PROMPTS["student"])

    name = session.get("user_name", "")
    ctx = f"Қолданушы: {name or 'белгісіз'}."
    if role == "student":
        ctx += f" Сынып: {session.get('student_class', '?')}."
    if page:
        ctx += f" Ағымдағы бет: {page}."
    # Егер білім алушы ойын бетінде болса — ойын контекстін қосамыз
    if role == "student" and _game_from_path(page):
        ctx += "\n" + _game_context(page, page_text)
    system = system + "\n\n[Контекст] " + ctx

    if not api_key:
        return ("⚙️ BilimAI әзірге толық қосылмаған: серверде ANTHROPIC_API_KEY орнатылмаған. "
                "Кілт қосылғаннан кейін мен сұрақтарыңа толық жауап беремін.")

    messages = []
    for turn in (history or [])[-20:]:
        r = "user" if turn.get("role") == "user" else "assistant"
        t = (turn.get("text") or "").strip()
        if t:
            messages.append({"role": r, "content": t})
    if not messages or messages[-1]["role"] != "user":
        messages.append({"role": "user", "content": message})

    text, error = _claude_call(system, messages, max_tokens=4000, effort="low")
    return text or error


@app.route("/api/ai-progress/<int:student_id>")
def api_ai_progress(student_id):
    """Return an AI-generated analysis of a student's game progress."""
    if not AI_CHAT_ENABLED:
        return jsonify({"error": "disabled"}), 404
    role = session.get("role")
    # студент может смотреть только свой прогресс; учитель — любой
    if role == "student" and session.get("user_id") != student_id:
        return jsonify({"error": "unauthorized"}), 401
    if role not in ("student", "teacher"):
        return jsonify({"error": "unauthorized"}), 401

    student = Student.query.get_or_404(student_id)
    games = (GameProgress.query
             .filter_by(student_id=student_id)
             .order_by(GameProgress.game_name)
             .all())

    # Формируем текст прогресса для промпта
    if not games:
        lines = ["Білім алушы әлі бірде-бір ойын ойнамаған."]
    else:
        best = {}
        for g in games:
            prev = best.get(g.game_name)
            if prev is None or g.score > prev["score"]:
                best[g.game_name] = {"score": g.score, "stars": g.stars, "completed": g.completed}
        lines = []
        for gname, d in best.items():
            chapter = GAME_TO_CHAPTER.get(gname, "?")
            label = CHAPTER_LABELS.get(chapter, chapter)
            max_s = MAX_SCORE.get(gname, 1)
            pct = round(d["score"] / max_s * 100) if max_s else 0
            stars = "★" * d["stars"] + "☆" * (3 - d["stars"])
            status = "✅" if d["completed"] else "⏳"
            lines.append(f"{status} {gname} ({label}): {d['score']:.2f}/{max_s} ұпай ({pct}%) {stars}")

    progress_text = "\n".join(lines)
    prompt = (
        f"Білім алушы: {student.name} {student.surname}, {student.student_class} сынып.\n"
        f"Ойын нәтижелері:\n{progress_text}\n\n"
        "Білім алушының күшті тұстарын атап өт, қандай ойындарда қиындық бар екенін анықта, "
        "мотивациялық кеңес бер. Қазақ тілінде, 4 сөйлем."
    )

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return jsonify({"analysis": "⚙️ ANTHROPIC_API_KEY орнатылмаған."})

    text, error = _claude_call(CHAT_SYSTEM_PROMPTS["teacher"],
                               [{"role": "user", "content": prompt}], max_tokens=4000, effort="low")
    return jsonify({"analysis": text or error})


# ============== ИИ-Орталық: панель учителя ==============

def _claude_text(system, prompt, max_tokens=1200, effort="medium"):
    """Бір сұрақ — бір жауап. (text, error) қайтарады.
    max_tokens — жауаптың өз көлемі; модельдің ойлауына үстіне қор қосылады."""
    return _claude_call(system, [{"role": "user", "content": prompt}],
                        max_tokens=max_tokens + 4000, effort=effort)


def _collect_class_data(class_name):
    """Сыныптың толық прогресс деректерін жинайды (промпт үшін)."""
    students = Student.query.filter_by(student_class=class_name).all()
    max_total = sum(MAX_SCORE.values())
    chapter_totals = {ck: {"earned": 0.0, "max": 0.0} for ck in GAME_CHAPTERS}
    student_rows = []

    for s in students:
        progress = GameProgress.query.filter_by(student_id=s.id).all()
        best = {}
        for p in progress:
            if p.game_name not in best or p.score > best[p.game_name].score:
                best[p.game_name] = p
        earned = sum(min(best[g].score, MAX_SCORE.get(g, 0)) for g in best if g in MAX_SCORE)
        stars = sum(int(best[g].stars or 0) for g in best)
        pct = round(earned / max_total * 100, 1) if max_total else 0
        student_rows.append({
            "id": s.id, "name": f"{s.name} {s.surname}",
            "played": len(best), "total_games": len(MAX_SCORE),
            "stars": stars, "earned": round(earned, 2), "percent": pct,
        })
        for ck, info in GAME_CHAPTERS.items():
            for g in info["games"]:
                chapter_totals[ck]["max"] += MAX_SCORE.get(g, 0)
                if g in best:
                    chapter_totals[ck]["earned"] += min(best[g].score, MAX_SCORE.get(g, 0))

    chapters = {}
    for ck, d in chapter_totals.items():
        label = CHAPTER_LABELS.get(ck, ck)
        chapters[label] = round(d["earned"] / d["max"] * 100, 1) if d["max"] > 0 else 0

    return {
        "class_name": class_name,
        "num_students": len(students),
        "students": student_rows,
        "chapters": chapters,
    }


def _class_data_to_text(data):
    """Сынып деректерін промпт үшін мәтінге айналдырады."""
    if data["num_students"] == 0:
        return "Бұл сыныпта тіркелген білім алушы жоқ."
    lines = [f"Сынып: {data['class_name']}, білім алушылар саны: {data['num_students']}.", ""]
    lines.append("Тараулар бойынша орташа игеру (%):")
    for label, pct in data["chapters"].items():
        lines.append(f"  • {label}: {pct}%")
    lines.append("")
    lines.append("Білім алушылар (ойналған/барлығы, жұлдыз, жалпы үлгерім %):")
    for r in sorted(data["students"], key=lambda x: x["percent"], reverse=True):
        lines.append(f"  • {r['name']}: {r['played']}/{r['total_games']} ойын, "
                     f"{r['stars']} ⭐, {r['percent']}%")
    return "\n".join(lines)


AI_PANEL_PROMPTS = {
    "analytics": (
        "Сен — мектеп мұғаліміне арналған білім беру аналитигісің. Сынып деректерін талда. "
        "Қай тарау жақсы игерілген, қайсысы әлсіз екенін нақты сандармен көрсет. "
        "Жалпы қорытынды жаса және мұғалімге 2-3 практикалық ұсыныс бер. "
        "Қазақ тілінде, тақырыпшалармен құрылымдап жаз. Маркдаун қолдан (**қалың**, тізімдер)."
    ),
    "at_risk": (
        "Сен — білім алушылардың үлгерімін бақылайтын ИИ-кеңесшісің. Берілген сынып деректерінен "
        "АРТТА ҚАЛУ ҚАУПІ бар білім алушыларды анықта (аз ойын ойнаған немесе үлгерімі төмен). "
        "Әр білім алушы үшін: есімі, қандай белгі бойынша қауіпте, нақты көмек шарасы. "
        "Егер қауіп тобы жоқ болса — соны айт. Қазақ тілінде, маркдаунмен."
    ),
    "lesson_plan": (
        "Сен — информатика пәнінің тәжірибелі әдіскерісің. Сынып деректеріне сүйеніп, "
        "КЕЛЕСІ САБАҚҚА нақты жоспар ұсын: қай тақырыпты қайталау керек, қандай "
        "тапсырмалар мен белсенділіктер беру керек, уақыт бөлінісі. "
        "Қазақ тілінде, нөмірленген қадамдармен, маркдаунмен."
    ),
    "parent_report": (
        "Сен — мұғалімнің атынан ата-анаға хабарлама жазатын көмекшісің. Білім алушының нәтижелері "
        "бойынша СЫПАЙЫ әрі жылы хат жаз: баланың жетістіктері, нені жақсартуға болады, "
        "үйде қалай қолдау көрсетуге болады. Айыптамай, ынталандыра жаз. "
        "Қазақ тілінде, ата-анаға түсінікті тілмен, 1-2 абзац."
    ),
}


def _teacher_only_json():
    """Returns an error response tuple if caller is not a teacher, else None."""
    if not AI_CHAT_ENABLED:
        return jsonify({"error": "disabled"}), 404
    if session.get("role") != "teacher":
        return jsonify({"error": "unauthorized"}), 401
    return None


@app.route("/teacher/ai-panel")
@login_required("teacher")
def teacher_ai_panel():
    # ИИ мұғалім рөлінен алынып тасталды — басты бетке қайтарамыз
    return redirect("/teacher")


@app.route("/api/ai/class-analytics")
def api_ai_class_analytics():
    err = _teacher_only_json()
    if err:
        return err
    class_name = request.args.get("class", "").strip()
    data = _collect_class_data(class_name)
    if data["num_students"] == 0:
        return jsonify({"result": "Бұл сыныпта білім алушы жоқ немесе сынып таңдалмаған."})
    text, error = _claude_text(AI_PANEL_PROMPTS["analytics"], _class_data_to_text(data), max_tokens=2800)
    return jsonify({"result": text or error})


@app.route("/api/ai/at-risk")
def api_ai_at_risk():
    err = _teacher_only_json()
    if err:
        return err
    class_name = request.args.get("class", "").strip()
    data = _collect_class_data(class_name)
    if data["num_students"] == 0:
        return jsonify({"result": "Бұл сыныпта білім алушы жоқ немесе сынып таңдалмаған."})
    prompt = (_class_data_to_text(data) +
              "\n\nАртта қалу қаупі бар білім алушыларды анықтап, көмек шараларын ұсын.")
    text, error = _claude_text(AI_PANEL_PROMPTS["at_risk"], prompt, max_tokens=2800)
    return jsonify({"result": text or error})


@app.route("/api/ai/lesson-plan")
def api_ai_lesson_plan():
    err = _teacher_only_json()
    if err:
        return err
    class_name = request.args.get("class", "").strip()
    data = _collect_class_data(class_name)
    if data["num_students"] == 0:
        return jsonify({"result": "Бұл сыныпта білім алушы жоқ немесе сынып таңдалмаған."})
    prompt = (_class_data_to_text(data) +
              "\n\nОсы деректерге сүйеніп, келесі сабаққа жоспар құр.")
    text, error = _claude_text(AI_PANEL_PROMPTS["lesson_plan"], prompt, max_tokens=3500)
    return jsonify({"result": text or error})


@app.route("/api/ai/parent-report/<int:student_id>")
def api_ai_parent_report(student_id):
    err = _teacher_only_json()
    if err:
        return err
    student = Student.query.get_or_404(student_id)
    games = GameProgress.query.filter_by(student_id=student_id).all()
    best = {}
    for g in games:
        if g.game_name not in best or g.score > best[g.game_name].score:
            best[g.game_name] = g
    if not best:
        lines = ["Білім алушы әлі ойын ойнамаған."]
    else:
        lines = []
        for gname, p in best.items():
            label = CHAPTER_LABELS.get(GAME_TO_CHAPTER.get(gname, "?"), "?")
            max_s = MAX_SCORE.get(gname, 1)
            pct = round(p.score / max_s * 100) if max_s else 0
            lines.append(f"  • {gname} ({label}): {pct}%, {int(p.stars or 0)} ⭐")
    prompt = (f"Білім алушы: {student.name} {student.surname}, {student.student_class} сынып.\n"
              f"Нәтижелері:\n" + "\n".join(lines) +
              "\n\nАта-анаға арналған хат жаз.")
    text, error = _claude_text(AI_PANEL_PROMPTS["parent_report"], prompt)
    return jsonify({"result": text or error})

# ============== /ИИ-Орталық ==============


@app.route("/api/chat", methods=["POST"])
def api_chat():
    if not AI_CHAT_ENABLED:
        return jsonify({"error": "disabled"}), 404
    role = session.get("role")
    if role not in ("student", "teacher"):
        return jsonify({"error": "unauthorized"}), 401
    body = request.get_json(silent=True) or {}
    message = (body.get("message") or "").strip()
    if not message:
        return jsonify({"error": "empty"}), 400
    if len(message) > 2000:
        message = message[:2000]
    reply = _claude_reply(role, message, body.get("history"), body.get("page"), body.get("page_text", ""))
    return jsonify({"reply": reply})


# ====== Ойын ішіндегі көмек: подсказка + разбор ошибок ======

# Бет адресі → ойын атауы (контекст үшін)
PATH_TO_GAME = {
    "/game1": "Қағып ал", "/game2": "Көпір", "/game3": "Ғарыш хабаршысы",
    "/game4": "Хабаршы", "/game5": "Қамал", "/game6": "Шифр",
    "/game7": "Агент", "/game8": "Робот", "/game9": "Сиқырлы шарлар",
    "/module1": "Сәйкестік", "/module2": "Лабиринт", "/module4": "Блоктар",
    "/toqsan2/g1": "Пиксель шебері", "/toqsan2/g2": "Фотолаб", "/toqsan2/g3": "Лазер жолы",
    "/toqsan2/g4": "Вектор ядро", "/toqsan2/g5": "Графика текетірес",
    "/toqsan4/g1": "Эргономика", "/toqsan4/g2": "Цифрлық детектив",
    "/toqsan4/g3": "Желілік жүгіруші", "/toqsan4/g4": "Кибер-бекініс", "/toqsan4/g5": "Файл әлемі",
    "/quest3/m1": "Робот орны", "/quest3/m2": "Робот тарихы", "/quest3/m3": "Гироскоп",
    "/quest3/m4": "Лабиринт ойыны", "/quest3/m5": "Сызық робот", "/quest3/m6": "Сумо",
}


def _game_from_path(page):
    """Бет адресінен ойын атауын анықтайды (?play=1 сияқты параметрлерсіз)."""
    if not page:
        return None
    path = page.split("?", 1)[0].rstrip("/")
    return PATH_TO_GAME.get(path) or PATH_TO_GAME.get(page.split("?", 1)[0])


# Ойындардың қысқаша сипаттамасы (ИИ ойын мазмұнын түсінуі үшін).
# Canvas-та салынатын ойындарда экран мәтіні аз болады — осы сипаттама көмектеседі.
GAME_INFO = {
    "Сәйкестік": "Суреттерді/ұғымдарды дұрыс анықтамасына сүйреп апарып сәйкестендіру ойыны. Мақсат — ұғымдарды тану.",
    "Көпір": "Дұрыс жауаптарды таңдау арқылы көпір/жол құрастыру ойыны. Ақпаратты тану тақырыбы.",
    "Қағып ал": "Дұрыс нысандарды (жауаптарды) себетпен қағып алу ойыны, қателерден қашу керек.",
    "Лабиринт": "Кейіпкерді лабиринт ішінде дұрыс бағытпен жүргізу. Алгоритм мен бағдарды түсіну.",
    "Ғарыш хабаршысы": "Хабарды ғарыш арқылы дұрыс жеткізу ойыны. Ақпаратты беру/жіберу тақырыбы.",
    "Хабаршы": "Ақпаратты дұрыс кодпен немесе жолмен жеткізу ойыны. Ақпаратты беру тақырыбы.",
    "Қамал": "Сұрақтарға жауап беріп қамалды қорғау/салу ойыны. Ақпаратты қолдану.",
    "Шифр": "Қазақ сөздерін кодтау кестесі арқылы сандарға айналдырып шифрлау. Ақпаратты сандармен кодтау.",
    "Агент": "Шифрланған хабарды ашатын құпия агент тапсырмалары. Кодтау мен шешуді қолдану.",
    "Робот": "Роботқа командалар/екілік код беру арқылы тапсырманы орындату. Талдау деңгейі.",
    "Сиқырлы шарлар": "Шарлар арқылы екілік (бинарлық) санды құрастыру/бағалау ойыны.",
    "Блоктар": "Блоктардан екілік ақпаратты немесе суретті құрастыру. Жасау деңгейі.",
    "Пиксель шебері": "Пиксельдерді бояп сурет салу. Растрлық (пиксельдік) графиканы түсіну.",
    "Фотолаб": "Фотосуретті өңдеу (жарық, түс, фильтр). Графиканы өңдеуді қолдану.",
    "Лазер жолы": "Айналар арқылы лазер сәулесінің жолын дұрыс бағыттау басқатырғышы.",
    "Вектор ядро": "Векторлық фигуралардан сурет құрастыру. Векторлық графиканы жасау.",
    "Графика текетірес": "Компьютерлік графика бойынша сұрақ-жауап жарысы (викторина).",
    "Робот орны": "Роботтың дұрыс орнын/позициясын анықтау. Робототехника негіздері.",
    "Робот тарихы": "Робототехника тарихы бойынша сұрақ-жауап ойыны.",
    "Гироскоп": "Гироскоп пен сенсорлар жұмысын түсіну тапсырмасы.",
    "Лабиринт ойыны": "Роботты лабиринттен алгоритм/командалармен өткізу.",
    "Сызық робот": "Сызықпен жүретін роботты бағдарламалау/бағыттау. Талдау деңгейі.",
    "Сумо": "Сумо-робот жарысы: роботты дұрыс басқару стратегиясы.",
    "Эргономика": "Компьютерде дұрыс, қауіпсіз отыру ережелерін үйрену.",
    "Цифрлық детектив": "Цифрлық іздерден жұмбақты шешетін детектив тапсырмалары.",
    "Кибер-бекініс": "Кибер-қорғаныс ойыны: базаны хакер шабуылынан қорғау, энергия мен жұлдыз жинау. Киберқауіпсіздік негіздері.",
    "Файл әлемі": "Файлдар мен қалталарды дұрыс реттеу/орналастыру. Файлдық жүйені түсіну.",
    "Желілік жүгіруші": "Желі (интернет) арқылы деректі дұрыс жеткізу ойыны. Желі негіздері.",
}


def _game_context(page, page_text):
    """Ойын контекстін құрайды: атауы, тарауы, сипаттамасы + экрандағы нақты мәтін."""
    parts = []
    game = _game_from_path(page)
    if game:
        bloom = GAME_BLOOM.get(game, "")
        chapter = CHAPTER_LABELS.get(GAME_TO_CHAPTER.get(game, ""), "")
        line = f"Білім алушы қазір «{game}» ойынында ойнап жатыр."
        if chapter:
            line += f" Тарау: {chapter}."
        if bloom:
            line += f" Танымдық деңгей: {bloom}."
        parts.append(line)
        if game in GAME_INFO:
            parts.append("Ойын туралы: " + GAME_INFO[game])
    if page_text:
        snippet = " ".join(str(page_text).split())[:3000]
        if snippet:
            parts.append("Білім алушының экранында көрініп тұрған мәтін: «" + snippet + "»")
    return "\n".join(parts) if parts else "Білім алушы ойын бетінде."


# Ойынның өзінде нұсқаулық терезесі бар — оларға қоспаймыз (қосарланбау үшін)
GAMES_WITH_OWN_INTRO = {"Желілік жүгіруші"}

# Ойын алдындағы нұсқаулық: icon + тарих (subtitle) + басқару ережелері + мақсат.
# rules: (эмодзи, қалың жазу, түсіндірме). Қалың жазу бос болса — тек мәтін.
GAME_GUIDES = {
    "Қағып ал": {"icon": "🧺", "subtitle": "Ақпарат көздерін аңда! Экраннан қалқып шығатын суреттерден дұрысын тап.",
        "rules": [("👆", "БАС", "ақпарат көзі болатын суретті көрсең, басып ұста"),
                  ("📚", "Ақпарат көздері", "кітап, телефон, газет, компьютер, теледидар"),
                  ("🍎", "Артық зат", "алма, доп, орындық — оларды БАСПА"),
                  ("⚠️", "Абайла", "ақпарат көзін жіберіп алсаң — ұпай нөлденеді")],
        "goal": "Барлық ақпарат көзін жинап, ұпайыңды сақта!"},
    "Көпір": {"icon": "🌉", "subtitle": "Заттарды түріне қарай сұрыптап, өзеннен өтетін көпір сал!",
        "rules": [("🖐️", "СҮЙРЕ", "затты дұрыс тақтайға апар"),
                  ("📜", "Мәтін", "газет, кітап"), ("🎵", "Дыбыс", "ән, радио"),
                  ("🎬", "Бейне", "фильм, теледидар")],
        "goal": "Барлық затты дұрыс түрге қойып, арғы бетке өт!"},
    "Ғарыш хабаршысы": {"icon": "🚀", "subtitle": "Хабарды жеткізудің дұрыс түрін таңдап, зымыранды Марсқа ұшыр!",
        "rules": [("▶️", "Бастау", "ойынды бастау батырмасын бас"),
                  ("📞", "Дыбыс", "дауыстық хабар"), ("📜", "Мәтін", "жазбаша хабар"),
                  ("📺", "Бейне", "видео хабар")],
        "goal": "Зымыранды Жерден Марсқа жеткіз!"},
    "Хабаршы": {"icon": "🕵️", "subtitle": "Әр кейіпкерге жақында да, хабарды жеткізудің дұрыс тәсілін тап!",
        "rules": [("🚶", "Жақында", "кейіпкерге барсаң тапсырма ашылады"),
                  ("📖", "Оқы", "тапсырманы мұқият оқы"),
                  ("☎️", "Тәсіл", "Телефон / Жазбаша / Бейне / Ауызша — дұрысын таңда")],
        "goal": "Барлық кейіпкерге дұрыс тәсілмен жауап бер!"},
    "Қамал": {"icon": "🏰", "subtitle": "Құпия кодты тауып, қамалдың үш құлпын аш!",
        "rules": [("🔢", "Код", "шифрды тауып өріске жаз"),
                  ("🔓", "Аш", "«OK» басып құлыпты аш"), ("3️⃣", "Үш құлып", "барлығын дұрыс кодпен аш")],
        "goal": "Қамалдың 3 құлпын да аш!"},
    "Шифр": {"icon": "🔐", "subtitle": "Кодтау кестесімен сөзді сандарға айналдыр!",
        "rules": [("🔎", "Кесте", "әр әріптің санын кестеден тап"),
                  ("⌨️", "Жаз", "сандарды ретімен өріске тер"),
                  ("✅", "Тексер", "«Check» басып тексер"), ("⏱️", "Уақыт", "уақытты бақыла")],
        "goal": "Сөзді дұрыс шифрла!"},
    "Агент": {"icon": "🕶️", "subtitle": "Сен — құпия агентсің! Шифрланған тапсырмаларды шеш.",
        "rules": [("🖱️", "Бас", "хат / компьютер / сейфке бас — тапсырма ашылады"),
                  ("🧩", "Шеш", "шифрды шешіп жауапты жаз"),
                  ("✅", "Тексеру", "жауапты тексер"), ("⏱️", "Уақыт", "1 минут — асықпай, бірақ тез")],
        "goal": "Барлық шифрды ашып, миссияны орында!"},
    "Робот": {"icon": "🤖", "subtitle": "Бинарлық кодпен команда беріп, роботты батарейкаға жеткіз!",
        "rules": [("🔼", "0001 / 0010", "жоғары / төмен"),
                  ("▶️", "0011 / 0100", "оңға / солға"),
                  ("⌨️", "Жаз", "код пен қадам санын тер (мысалы: 0010 3)"),
                  ("📨", "Жіберу", "робот қабырғаға соқпай батареяға жетсін")],
        "goal": "Роботты батарейкаға дұрыс жеткіз!"},
    "Сиқырлы шарлар": {"icon": "🔢", "subtitle": "Символдарды дұрыс ондық (decimal) санымен сәйкестендір!",
        "rules": [("👀", "Қара", "әр символға назар аудар"),
                  ("🔢", "Тап", "оның ондық санын анықта"),
                  ("🔗", "Сәйкестендір", "дұрыс жұптарды қос"), ("⏱️", "Уақыт", "2 минут")],
        "goal": "Барлық символды дұрыс санмен қос!"},
    "Сәйкестік": {"icon": "👁️", "subtitle": "Сезім мүшелерін олардың қызметімен сәйкестендір!",
        "rules": [("🖐️", "Сүйре", "суретті мағынасы жазылған шаршыға апар"),
                  ("🧩", "Барлығын қой", "әр суретке дұрыс орын тап"),
                  ("✅", "Тексеру", "«Тексеру» батырмасын бас")],
        "goal": "Барлық мүшені дұрыс қызметпен сәйкестендір!"},
    "Лабиринт": {"icon": "🗝️", "subtitle": "Лабиринт ішінде жүріп, барлық кілттерді жина!",
        "rules": [("👆", "Қозғал", "жанындағы ұяшыққа басып жүр"),
                  ("🗝️", "Жина", "жолдағы барлық кілтті ал"),
                  ("🚪", "Шық", "кілттерді жинап шығуға жет")],
        "goal": "Барлық кілтті жинап лабиринттен шық!"},
    "Блоктар": {"icon": "🧱", "subtitle": "Блоктарды тақтаға дұрыс орналастыр!",
        "rules": [("👀", "Қара", "тапсырма мен үлгіні оқы"),
                  ("🖐️", "Қой", "блокты дұрыс орынға апар"),
                  ("✅", "Аяқта", "барлығын дұрыс жина")],
        "goal": "Барлық блокты дұрыс орналастыр!"},
    "Пиксель шебері": {"icon": "🎨", "subtitle": "Бүлінген цифрлық суретті пиксельдеп қалпына келтір!",
        "rules": [("🖼️", "Үлгі", "үлгі суретке қара"),
                  ("🖌️", "Боя", "әр пиксельді дұрыс түспен боя"),
                  ("✨", "Қалпына келтір", "суретті толық жаса")],
        "goal": "Суретті пиксельмен толық қалпына келтір!"},
    "Фотолаб": {"icon": "🎚️", "subtitle": "Түстер зертханасында фотоны дұрыс түске келтір!",
        "rules": [("📋", "Тапсырма", "нені өзгерту керегін оқы"),
                  ("🎚️", "Бапта", "RGB / жарық параметрлерін реттеп"),
                  ("🎯", "Сәйкестендір", "нәтижені үлгіге жеткіз")],
        "goal": "Фотоны үлгідегі түске келтір!"},
    "Лазер жолы": {"icon": "🔦", "subtitle": "Лазер сәулесін айналармен нысанаға бағытта!",
        "rules": [("🪞", "Айна", "айналарды орналастыр / бұр"),
                  ("➡️", "Жол", "сәуленің жолын дұрыс құр"),
                  ("🎯", "Нысана", "лазерді нысанаға жеткіз")],
        "goal": "Лазерді нысанаға дәл бағытта!"},
    "Вектор ядро": {"icon": "✏️", "subtitle": "Нүктелерді жылжытып, үлгідегі векторлық суретті құр!",
        "rules": [("🟢", "Нүкте", "нүктелерді сүйреп орналастыр (кемінде 3)"),
                  ("📐", "Фигура", "үлгіге ұқсат"), ("✅", "Тексер", "дайын болғанда тексер")],
        "goal": "Векторлық суретті үлгідей жаса!"},
    "Графика текетірес": {"icon": "⚔️", "subtitle": "Растр vs Вектор: салыстыру дуэлінде жең!",
        "rules": [("❓", "Сұрақ", "бұл растрға ма, әлде векторға ма қатысты?"),
                  ("👆", "Жауап", "дұрысын таңда"), ("🏆", "Оз", "қарсыластан көп ұпай жина")],
        "goal": "Дуэльді жеңіп шық!"},
    "Робот орны": {"icon": "🦾", "subtitle": "Зертхана дабыл берді! Роботтарды дұрыс секторға сұрыпта.",
        "rules": [("📋", "Паспорт", "робот паспортын оқы"),
                  ("🖐️", "Сүйре", "роботты дұрыс шлюзге апар"),
                  ("🏭", "Секторлар", "Зауыт / Аурухана / Мектеп / Үй"),
                  ("⏱️", "Уақыт", "тек 90 секунд!")],
        "goal": "Барлық роботты дұрыс секторға жібер!"},
    "Робот тарихы": {"icon": "⏳", "subtitle": "Уақыт порталын ашу үшін робот тарихын ретке келтір!",
        "rules": [("🖐️", "Сүйре", "карточканы уақыт сызығына қой"),
                  ("📅", "Ретте", "ежелгіден болашаққа қарай"),
                  ("🔬", "Талдау", "әр кезеңнің сұрағына жауап бер")],
        "goal": "5 кезеңді дұрыс ретпен қойып порталды аш!"},
    "Гироскоп": {"icon": "⚙️", "subtitle": "Роботты тік ұстау үшін PID параметрлерін бапта!",
        "rules": [("🎚️", "Kp / Ki / Kd", "сырғытпалармен мәндерін өзгерт"),
                  ("📈", "Тұрақтылық", "робот құламасын — %-ды арттыр"),
                  ("💡", "Кеңес", "экрандағы кеңестерге қара"), ("3️⃣", "Кезең", "3 кезеңді өт")],
        "goal": "Роботты 3 кезеңде де тік ұста!"},
    "Лабиринт ойыны": {"icon": "🧭", "subtitle": "Роботқа командалар жазып, лабиринттен өткіз!",
        "rules": [("🧩", "Командалар", "қозғалысты ретімен қос"),
                  ("🔁", "×N", "қайталау санын қой"),
                  ("▶️", "Іске қос", "программаны жіберіп көр"),
                  ("🏁", "3 деңгей", "бірінен соң бірін өт")],
        "goal": "3 деңгейде де роботты финишке жеткіз!"},
    "Сызық робот": {"icon": "➰", "subtitle": "Роботты қара сызық бойымен жүргіз!",
        "rules": [("🎚️", "Бапта", "жылдамдық / сенсор параметрлерін реттеп"),
                  ("▶️", "Қос", "роботты іске қос"),
                  ("➰", "Сызық", "робот трассадан шықпасын")],
        "goal": "Роботты сызықпен дұрыс өткіз!"},
    "Сумо": {"icon": "🥊", "subtitle": "Сумо-аренада қарсыласты шеңберден шығар!",
        "rules": [("🃏", "Стратегия", "соққы / итеру картасын таңда"),
                  ("⚡", "Энергия", "шабуыл энергия жұмсайды — бақыла"),
                  ("⚔️", "ЖҮРУ", "«ЖҮРУ!» басып әрекет жаса"),
                  ("🏆", "Жең", "қарсыласты шеңберден ит")],
        "goal": "Қарсыласты жеңіп, чемпион бол!"},
    "Эргономика": {"icon": "💺", "subtitle": "Компьютерде дұрыс әрі қауіпсіз отырудың ережелерін біл!",
        "rules": [("❓", "Сұрақ", "эргономика туралы сұрақты оқы"),
                  ("👆", "Жауап", "дұрысын таңда"), ("❤️", "Денсаулық", "деңгейді 100%-ға жеткіз")],
        "goal": "Көмекшінің денсаулығын 100%-ға толтыр!"},
    "Цифрлық детектив": {"icon": "🕵️", "subtitle": "Ақпарат тасымалдаушылар туралы құпияны аш!",
        "rules": [("🎬", "Сахна", "сұрақты оқы (3 сахна)"),
                  ("💾", "Таңда", "дұрыс құрылғыны / жауапты тап (флешка, бұлт…)"),
                  ("💎", "Кристалл", "қателеспей кристалл жина")],
        "goal": "3 сахнаны өтіп, барлық кристалды жина!"},
    "Кибер-бекініс": {"icon": "🛡️", "subtitle": "Базаны хакер шабуылынан қорға!",
        "rules": [("🖱️", "Орналастыр", "қорғаныс / қалқанды тақтаға қой"),
                  ("🚀", "Тойтар", "келе жатқан шабуылды тоқтат"),
                  ("📊", "Шкала", "қорғаныс шкаласы нөлге түспесін")],
        "goal": "Базаны аман сақтап, шабуылды тойтар!"},
    "Файл әлемі": {"icon": "🗂️", "subtitle": "Файлдарды ретке келтіріп, бөлісуді үйрен!",
        "rules": [("📁", "Сұрыпта", "6 файлды дұрыс папкаға сүйре"),
                  ("✏️", "Түзет", "презентацияны (.pptx) аш та қатені түзе"),
                  ("👥", "Бөліс", "файлды дұрыс құқықпен бөліс (Share)")],
        "goal": "Барлық тапсырманы орындап, файл әлемін ретте!"},
}


def _game_guide(page):
    """Бет адресіне қарай ойын нұсқаулығын қайтарады (жоқ болса — None)."""
    name = _game_from_path(page)
    if not name or name in GAMES_WITH_OWN_INTRO:
        return None
    g = GAME_GUIDES.get(name)
    if not g:
        info = GAME_INFO.get(name)
        if not info:
            return None
        g = {"icon": "🎮", "subtitle": info,
             "rules": [("📖", "Оқы", "тапсырманы мұқият оқы"),
                       ("✅", "Орында", "дұрыс жауапты тауып орында"),
                       ("⭐", "Ұпай", "тапсырманы аяқтап ұпай жина")],
             "goal": "Тапсырманы сәтті аяқта!"}
    rules = [{"ic": ic, "b": b, "t": t} for (ic, b, t) in g["rules"]]
    chapter = CHAPTER_LABELS.get(GAME_TO_CHAPTER.get(name, ""), "")
    back = GAME_CHAPTERS.get(GAME_TO_CHAPTER.get(name, ""), {}).get("back", "/student")
    return {"title": name, "icon": g.get("icon", "🎮"),
            "subtitle": g.get("subtitle", ""), "rules": rules,
            "goal": g["goal"], "chapter": chapter, "back": back}


GAME_HELP_PROMPTS = {
    "hint": (
        "Сен — BilimAI, 5-сынып білім алушысының достық көмекшісісің. Білім алушы қазір ойын ойнап жатыр "
        "және көмек сұрап тұр. Қазақ тілінде, ҚЫСҚА (2-3 сөйлем), қарапайым тілмен жауап бер. "
        "МАҢЫЗДЫ: дайын жауапты ЕШҚАШАН берме! Тек бағыттаушы кеңес, ой салатын сұрақ немесе "
        "бірінші қадамды ғана айт — білім алушы өзі шешсін. Жылы әрі мадақтаушы бол."
    ),
    "mistake": (
        "Сен — BilimAI, 5-сынып білім алушысының достық көмекшісісің. Білім алушы ойында қателесті немесе "
        "бірдеңе түсінбеді. Қазақ тілінде, ҚЫСҚА, мейірімді тілмен түсіндір: қате неден болуы "
        "мүмкін екенін жұмсақ айт, ҚАЛАЙ түзетуге болатынын қадаммен көрсет. Айыптама, "
        "ынталандыр — «қателесу — үйренудің бөлігі» деген көңіл-күй сыйла. Дайын жауап берме."
    ),
}


@app.route("/api/game-help", methods=["POST"])
def api_game_help():
    if not AI_CHAT_ENABLED:
        return jsonify({"error": "disabled"}), 404
    if session.get("role") != "student":
        return jsonify({"error": "unauthorized"}), 401

    body = request.get_json(silent=True) or {}
    mode = body.get("mode", "hint")
    if mode not in GAME_HELP_PROMPTS:
        mode = "hint"
    user_msg = (body.get("message") or "").strip()[:1000]

    ctx = _game_context(body.get("page", ""), body.get("page_text", ""))
    name = session.get("user_name", "")
    if name:
        ctx += f"\nБілім алушының есімі: {name}."

    system = GAME_HELP_PROMPTS[mode] + "\n\n[Контекст]\n" + ctx

    if mode == "hint":
        prompt = user_msg or "Маған осы ойынды шешуге бағыттаушы кеңес бер."
    else:
        prompt = user_msg or "Мен осы ойында қателесіп жатырмын, маған түсінуге көмектес."

    text, error = _claude_text(system, prompt, max_tokens=800, effort="low")
    return jsonify({"reply": text or error})

# ====== /Ойын ішіндегі көмек ======


@app.after_request
def inject_bilimai_widget(response):
    """Inject the BilimAI chat widget into logged-in HTML pages (no per-template edits)."""
    if not AI_CHAT_ENABLED:
        return response
    try:
        role = session.get("role")
        ctype = response.content_type or ""
        # ИИ-чат тек ОҚУШЫҒА көрсетіледі (мұғалімде ИИ жоқ)
        if (role == "student"
                and ctype.startswith("text/html")
                and not response.direct_passthrough):
            html = response.get_data(as_text=True)
            if "</body>" in html and 'id="bq-chat"' not in html:
                snippet = render_template(
                    "_chat_widget.html", chat_role=role,
                    chat_name=session.get("user_name", ""),
                )
                html = html.replace("</body>", snippet + "\n</body>", 1)
                response.set_data(html)
    except Exception as e:
        print("widget inject skipped:", e)
    return response
# =================== /BilimAI чат-ассистент ===================


@app.after_request
def inject_game_intro(response):
    """Ойын беттеріне нұсқаулық терезесін автоматты қосады (барлық ойындар үшін)."""
    try:
        ctype = response.content_type or ""
        if not ctype.startswith("text/html") or response.direct_passthrough:
            return response
        guide = _game_guide(request.path)
        if not guide:
            return response
        html = response.get_data(as_text=True)
        if "<body" not in html or 'id="bqGameIntro"' in html:
            return response
        snippet = render_template(
            "_game_intro.html",
            game_title=guide["title"], icon=guide["icon"],
            subtitle=guide["subtitle"], rules=guide["rules"],
            goal=guide["goal"], chapter=guide["chapter"],
        )
        # <body> ашылғаннан кейін бірден қоямыз — кідірту скрипті ойын
        # скриптерінен бұрын іске қосылуы үшін.
        import re
        new_html, n = re.subn(r"(<body[^>]*>)", lambda m: m.group(1) + snippet,
                              html, count=1, flags=re.IGNORECASE)
        if n:
            response.set_data(new_html)
    except Exception as e:
        print("game intro inject skipped:", e)
    return response


# Әр тоқсандағы ойындардың реті (картадағы ретпен) — «Келесі ойын» батырмасы үшін
GAME_ORDER = [
    ["/game1", "/game2", "/module1", "/module2", "/game3", "/game4",
     "/game5", "/game6", "/game7", "/game8", "/game9", "/module4"],
    ["/toqsan2/g1", "/toqsan2/g2", "/toqsan2/g3", "/toqsan2/g4", "/toqsan2/g5"],
    ["/quest3/m1", "/quest3/m2", "/quest3/m3", "/quest3/m4", "/quest3/m5", "/quest3/m6"],
    ["/toqsan4/g2", "/toqsan4/g1", "/toqsan4/g3", "/toqsan4/g4", "/toqsan4/g5"],
]


def _game_nav(path):
    """Ойын беті үшін: модульге қайту адресі және келесі ойын (тоқсан ішінде)."""
    path = path.split("?", 1)[0].rstrip("/")
    name = PATH_TO_GAME.get(path)
    ck = GAME_TO_CHAPTER.get(name or "")
    if not ck:
        return None
    nxt = None
    for seq in GAME_ORDER:
        if path in seq:
            i = seq.index(path)
            if i + 1 < len(seq):
                nxt = {"url": seq[i + 1], "title": PATH_TO_GAME.get(seq[i + 1], "")}
            break
    return {"back": GAME_CHAPTERS[ck]["back"], "next": nxt}


@app.after_request
def inject_game_nav(response):
    """Барлық ойындарға «Артқа» (модульге) және «Келесі ойын» батырмаларын қосады."""
    try:
        if (not (response.content_type or "").startswith("text/html")
                or response.direct_passthrough or response.status_code != 200):
            return response
        nav = _game_nav(request.path)
        if not nav:
            return response
        html = response.get_data(as_text=True)
        if "</body>" not in html or 'id="bqGameNav"' in html:
            return response
        snippet = render_template(
            "_game_nav.html", back=nav["back"], nxt=nav["next"],
            # ойында модульге қайтатын өз батырмасы болса — қосымша «Артқа» керек емес
            has_back=re.search(r'<a[^>]*href="%s"' % re.escape(nav["back"]), html) is not None,
        )
        response.set_data(html.replace("</body>", snippet + "\n</body>", 1))
    except Exception as e:
        print("game nav inject skipped:", e)
    return response


# Тоқсан картасы → тарау кілті және аяқталу анимациясының мәтіндері
CHAPTER_PAGES = {"/1module": "info", "/toqsan_2": "graphics",
                 "/toqsan_3": "robotics", "/toqsan_4": "security"}
CHAPTER_FINALE = {
    "info":     {"title": "Ақпарат галактикасы бағындырылды!", "acc": "#8fd0ff", "glow": "rgba(143,208,255,.6)"},
    "graphics": {"title": "Пазл әлемі толық жиналды!",          "acc": "#ffd24a", "glow": "rgba(255,210,74,.55)"},
    "robotics": {"title": "Квест жолы аяқталды!",               "acc": "#ffb35a", "glow": "rgba(255,170,60,.55)"},
    "security": {"title": "ЖИ зертханасы толық іске қосылды!",  "acc": "#5ef2ff", "glow": "rgba(94,242,255,.55)"},
}


@app.after_request
def inject_chapter_complete(response):
    """Тоқсанның барлық ойыны өтілсе — картаға тақырыптық аяқталу анимациясын қосады."""
    try:
        ck = CHAPTER_PAGES.get(request.path)
        if (not ck or session.get("role") != "student"
                or not (response.content_type or "").startswith("text/html")
                or response.direct_passthrough or response.status_code != 200):
            return response
        sid = session.get("user_id")
        games = GAME_CHAPTERS[ck]["games"]
        rows = GameProgress.query.filter(GameProgress.student_id == sid,
                                         GameProgress.game_name.in_(games)).all()
        if {r.game_name for r in rows} != set(games):
            return response
        html = response.get_data(as_text=True)
        if "</body>" not in html or 'id="bqCC"' in html:
            return response
        cc = dict(CHAPTER_FINALE[ck], key=ck, sid=sid, label=CHAPTER_LABELS[ck],
                  games=len(games), stars=sum(int(r.stars or 0) for r in rows),
                  max_stars=len(games) * 3)
        snippet = render_template("_chapter_complete.html", cc=cc)
        response.set_data(html.replace("</body>", snippet + "\n</body>", 1))
    except Exception as e:
        print("chapter finale inject skipped:", e)
    return response


def migrate_to_scale10():
    """Бір рет: ескі ұпайларды (0.05 / 0.3 …) 10 ұпайлық шкалаға көшіру.

    Әр жазба: score10 = ескі ұпай / GAME_RAW_MAX × 10; белгіше жаңа ережемен қайта есептеледі;
    білім алушының жалпы ұпайы = оның ойындарындағы 10 ұпайлық нәтижелердің қосындысы.
    AppMeta белгісі сол транзакцияда жазылады — бірнеше worker бір уақытта іске қосылса да,
    көшіру тек бір рет орындалады (екіншісі primary key қақтығысына тап болып, өткізіп жібереді).
    """
    from sqlalchemy.exc import IntegrityError
    with app.app_context():
        if db.session.get(AppMeta, "score_scale_10"):
            return
        try:
            db.session.add(AppMeta(key="score_scale_10", value=datetime.utcnow().isoformat()))
            db.session.flush()
        except IntegrityError:
            db.session.rollback()
            return
        totals = {}
        for gp in GameProgress.query.all():
            s10 = to_scale10(gp.game_name, gp.score)
            if s10 is None:          # белгісіз ойын (ескі сынақ жазбасы) — жалпы ұпайға кірмейді
                continue
            gp.score = s10
            gp.stars = game_tier(gp.game_name, s10, SCORE_SCALE, bool(gp.completed))
            totals[gp.student_id] = totals.get(gp.student_id, 0.0) + s10
        for st in Student.query.all():
            st.score = round(totals.get(st.id, 0.0), 2)
        db.session.commit()
        print(f"[migrate] 10 ұпайлық шкалаға көшірілді: {len(totals)} білім алушы")


migrate_to_scale10()


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port,)