from sqlalchemy import text
from main import app, db

with app.app_context():
    db.session.execute(text("DELETE FROM alembic_version"))
    db.session.commit()

print("OK: alembic_version cleared")
