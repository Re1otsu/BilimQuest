"""Мұғалімнің құпиясөзін ауыстыру (ұмытылған жағдайда).

Іске қосу:  venv\\Scripts\\python.exe reset_password.py
Email мен жаңа құпиясөзді сұрайды; құпиясөз экранда көрінбейді.
Қай базаға жазатыны .env ішіндегі DATABASE_URL-ға байланысты
(жергілікті — sqlite, Railway үшін — Railway-дің DATABASE_URL мәні).
"""
from getpass import getpass

from werkzeug.security import generate_password_hash

from main import app, db, Teacher


def main():
    with app.app_context():
        print("База:", app.config["SQLALCHEMY_DATABASE_URI"].split("@")[-1])
        email = input("Мұғалімнің email-ы: ").strip()
        teacher = Teacher.query.filter_by(email=email).first()
        if not teacher:
            print("Мұндай email-мен мұғалім табылмады.")
            return
        print("Табылды:", teacher.name)
        pw = getpass("Жаңа құпиясөз: ")
        if len(pw) < 6:
            print("Құпиясөз кемінде 6 таңба болуы керек.")
            return
        if getpass("Қайталаңыз: ") != pw:
            print("Құпиясөздер сәйкес емес.")
            return
        teacher.password = generate_password_hash(pw)
        db.session.commit()
        print("Дайын! Енді жаңа құпиясөзбен кіре аласыз.")


if __name__ == "__main__":
    main()
