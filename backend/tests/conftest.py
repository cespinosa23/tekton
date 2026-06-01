import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import Base, get_db
from app.models.role import Role
from app.models.user import User
from app.models.role import UserRole
from app.core.security import hash_password

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    # Seed roles
    for role_name in ["Admin", "HR", "Engineer", "Accounting", "Liaison", "Others"]:
        if not db.query(Role).filter(Role.name == role_name).first():
            db.add(Role(name=role_name))
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


def _create_user(db, email, password, role_names):
    user = User(email=email, hashed_password=hash_password(password), is_active=True)
    db.add(user)
    db.flush()
    for rname in role_names:
        role = db.query(Role).filter(Role.name == rname).first()
        db.add(UserRole(user_id=user.id, role_id=role.id))
    db.commit()
    return user


def _token_for(client, email, password):
    resp = client.post("/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture
def admin_token(client):
    db = TestingSessionLocal()
    _create_user(db, "admin@test.com", "password123", ["Admin"])
    db.close()
    return _token_for(client, "admin@test.com", "password123")


@pytest.fixture
def engineer_token(client):
    db = TestingSessionLocal()
    _create_user(db, "eng@test.com", "password123", ["Engineer"])
    db.close()
    return _token_for(client, "eng@test.com", "password123")


@pytest.fixture
def accounting_token(client):
    db = TestingSessionLocal()
    _create_user(db, "acc@test.com", "password123", ["Accounting"])
    db.close()
    return _token_for(client, "acc@test.com", "password123")
