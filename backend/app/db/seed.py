from sqlalchemy.orm import Session
from app.db.database import SessionLocal, engine, Base
from app.models import user, role, employee  # noqa
from app.models.role import Role  # adjust import to match your model


ROLES = ["Admin", "Engineer", "Accounting", "HR", "Liaison"]

def seed_roles(db: Session) -> None:
    existing = {r.name for r in db.query(Role).all()}
    new_roles = [Role(name=r) for r in ROLES if r not in existing]

    if new_roles:
        db.add_all(new_roles)
        db.commit()
        print(f"Seeded {len(new_roles)} role(s): {[r.name for r in new_roles]}")
    else:
        print("Roles already seeded — skipping.")

def run():
    Base.metadata.create_all(bind=engine)  # ensures tables exist first
    db: Session = SessionLocal()
    try:
        seed_roles(db)
    finally:
        db.close()

if __name__ == "__main__":
    run()