from sqlalchemy import text
from main import app, db

with app.app_context():
    db.session.execute(text("UPDATE student SET surname = '—' WHERE surname IS NULL"))
    db.session.commit()

print("OK: filled surname for existing students")
