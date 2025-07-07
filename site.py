from flask import Flask, render_template, request, redirect, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import os

app = Flask(__name__)

load_dotenv()  # .env файлын жүктеу
app.secret_key = os.getenv("SECRET_KEY")  # Құпия кілтті пайдалану

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///school.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    student_class = db.Column(db.String(10), nullable=False)
    password = db.Column(db.String(200), nullable=False)

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
    explanation = db.Column(db.Text, nullable=True)  # Жауап түсіндірмесі (қосымша)

class StudentProgress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"))
    task_id = db.Column(db.Integer, db.ForeignKey("task.id"))
    is_correct = db.Column(db.Boolean)

with app.app_context():
    db.create_all()


# Бастапқы бет (Мұғалім/Оқушы таңдау)
@app.route("/", methods=["GET", "POST"])
def home():
    if request.method == "POST":
        role = request.form.get("role")  # Рөлді таңдау (мұғалім немесе оқушы)
        if role == "teacher":
            return redirect("/teacher")
        elif role == "student":
            return redirect("/student")
        else:
            return "Қате: Рөл таңдалмады."
    return render_template("home.html")

# Мұғалімге арналған бет
@app.route("/teacher")
def teacher():
    user_email = session.get("email")
    return render_template("teacher.html", email=user_email)

# Негізгі бет оқушы үшін
@app.route("/student")
def index():
    user_name = session.get("user_name")
    return render_template("student.html", user_name=user_name)

# Тіркеу
@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form["name"]
        student_class = request.form["class"]
        password = request.form["password"]

        hashed_password = generate_password_hash(password)
        new_student = Student(name=name, student_class=student_class, password=hashed_password)
        db.session.add(new_student)
        db.session.commit()

        return redirect("/login")
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



@app.route("/login_teacher", methods=["GET", "POST"])
def login_teacher():
    if request.method == "POST":
        password = request.form["password"]
        email = request.form["email"]

        teacher = Teacher.query.filter_by(email=email).first()

        if teacher and check_password_hash(teacher.password, password):
            session["user_id"] = teacher.id
            session["email"] = teacher.email
            return redirect("/teacher")
        else:
            return "Қате: Есім, почта немесе құпиясөз дұрыс емес."
    return render_template("login_tchr.html")


@app.route("/tasks/<module>", methods=["GET", "POST"])
def tasks(module):
    index = int(request.args.get("index", 0))
    tasks = Task.query.filter_by(module=module).all()

    if index >= len(tasks):
        return "Сіз бұл модульдегі барлық тапсырмаларды аяқтадыңыз ✅"

    task = tasks[index]
    result = None

    if request.method == "POST":
        answer = request.form["answer"].strip().lower()
        correct = answer == task.correct_answer.strip().lower()

        # Сақтау прогресса
        if "user_id" in session:
            student_id = session["user_id"]
            existing = StudentProgress.query.filter_by(student_id=student_id, task_id=task.id).first()
            if not existing:
                progress = StudentProgress(student_id=student_id, task_id=task.id, is_correct=correct)
                db.session.add(progress)
                db.session.commit()

        result = correct
        return render_template("task.html", task=task, module=module, result=result, next_index=index + 1)

    return render_template("task.html", task=task, module=module, index=index)

@app.route("/my_progress")
def my_progress():
    student_id = session.get("user_id")
    results = StudentProgress.query.filter_by(student_id=student_id).all()
    return render_template("progress.html", results=results)


@app.route('/module1')
def module1():
    return render_template('module1.html')

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

def login_required(role):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if session.get("user_id") is None or session.get("role") != role:
                return redirect("/login")
            return func(*args, **kwargs)
        return wrapper
    return decorator

@app.route("/students")
@login_required("teacher")
def students():
    all_students = Student.query.all()
    return render_template("students.html", students=all_students)


if __name__ == "__main__":
    app.run(debug=True)
