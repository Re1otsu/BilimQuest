from flask import Flask, render_template, request, redirect, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import os
from functools import wraps
from flask import flash
from flask_migrate import Migrate


app = Flask(__name__)

load_dotenv()  # .env файлын жүктеу
app.secret_key = os.getenv("SECRET_KEY")  # Құпия кілтті пайдалану

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///school.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
migrate = Migrate(app, db)


class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    student_class = db.Column(db.String(10), nullable=False)
    password = db.Column(db.String(200), nullable=False)
    score = db.Column(db.Integer, default=0)

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
    score = db.Column(db.Integer, default=0)
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
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())

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


app.route("/delete_announcement/<int:id>", methods=["POST"])
@login_required("teacher")
def delete_announcement(id):
    announcement = Announcement.query.get(id)
    if announcement:
        db.session.delete(announcement)
        db.session.commit()
        flash("Хабарлама өшірілді.")
    return redirect("/teacher")

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
            return redirect("/choose_login_teacher")
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

    # Егер қандай да бір student керек болса (мысалы, тест үшін)
    student = Student.query.first()  # Немесе нақты ID арқылы
    return render_template("teacher.html", email=user_email, announcements=announcements, student=student)


# Негізгі бет оқушы үшін
@app.route("/student")
def index():
    user_name = session.get("user_name")
    student_class = session.get("student_class")
    student_id = session.get("user_id")

    student = Student.query.get(student_id)  # ✅ Оқушыны базадан алу

    announcements = Announcement.query.filter_by(class_name=student_class).order_by(Announcement.timestamp.desc()).all()

    return render_template("student.html",
                           user_name=user_name,
                           student_class=student_class,
                           announcements=announcements,
                           student=student)  # ✅ жіберу

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
            return redirect("/teacher")
        else:
            return "Қате: Есім, почта немесе құпиясөз дұрыс емес."
    return render_template("login_tchr.html")

@app.route("/teacher/announcement", methods=["GET", "POST"])
@login_required("teacher")
def make_announcement():
    if request.method == "POST":
        class_name = request.form["class_name"]
        message = request.form["message"]

        new_announcement = Announcement(message=message, class_name=class_name)
        db.session.add(new_announcement)
        db.session.commit()

        return redirect("/teacher")
    return render_template("announcement_form.html")


@app.route("/student_dashboard")
def student_dashboard():
    student_id = session.get("user_id")
    if not student_id:
        return redirect("/login")

    student = Student.query.get(student_id)
    progress_count = StudentProgress.query.filter_by(student_id=student_id).count()
    game_results = GameProgress.query.filter_by(student_id=student_id).all()

    return render_template("dashboard.html",
                           student=student,
                           progress_count=progress_count,
                           games=game_results)

@app.route("/game_result", methods=["POST"])
def game_result():
    if "user_id" not in session:
        return {"error": "Unauthorized"}, 401

    student_id = session["user_id"]
    data = request.get_json()
    game_name = data.get("game_name")
    score = int(data.get("score", 0))
    completed = bool(data.get("completed", True))

    # Бұрын қанша рет өткенін тексеру
    attempts = GameProgress.query.filter_by(student_id=student_id, game_name=game_name).count()
    access = GameAccess.query.filter_by(student_id=student_id, game_name=game_name).first()

    # Егер бір рет өткен және рұқсат жоқ болса – тыйым
    if attempts >= 1 and not (access and access.is_unlocked):
        return {"status": "denied", "message": "Мұғалім рұқсат бермейінше қайта өтуге болмайды."}, 403

    # Егер рұқсат болса – тек 1 рет қолданамыз, кейін is_unlocked = False
    allow_score_add = False
    if access and access.is_unlocked:
        allow_score_add = True
        access.is_unlocked = False

    # Нәтижені сақтау
    new_result = GameProgress(
        student_id=student_id,
        game_name=game_name,
        score=score,
        completed=completed,
        attempt=attempts + 1
    )
    db.session.add(new_result)

    # Жалпы балл қосу (тек 1-рет немесе рұқсат болса)
    student = Student.query.get(student_id)
    if attempts == 0 or allow_score_add:
        student.score += score

    db.session.commit()
    return {"status": "ok"}



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
    announcement = Announcement.query.get_or_404(announcement_id)
    db.session.delete(announcement)
    db.session.commit()
    return redirect("/teacher")

@app.route("/rating")
@login_required("student")
def rating():
    students = Student.query.order_by(Student.score.desc()).limit(20).all()  # топ 20
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
    students = Student.query.all()
    return render_template("teacher_panel.html", students=students)

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
def module2():
    return render_template('module2.html')

@app.route('/module3')
def module3():
    return render_template('module3.html')

@app.route('/module4')
def module4():
    return render_template('module4.html')

@app.route('/module4_l2')
def module4_l2():
    return render_template('module4_l2.html')


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
    app.run()
