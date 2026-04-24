from main import app, db, Teacher
from werkzeug.security import generate_password_hash

with app.app_context():
    teacher = Teacher(
        name="Бекжан Лұқпанов",
        email="test@mail.com",
        password=generate_password_hash("test")
    )
    db.session.add(teacher)
    db.session.commit()
    print("Учитель создан!")