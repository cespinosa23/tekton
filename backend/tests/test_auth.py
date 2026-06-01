from tests.conftest import TestingSessionLocal, _create_user


def test_login_success(client):
    db = TestingSessionLocal()
    _create_user(db, "user@test.com", "secret123", ["Others"])
    db.close()

    resp = client.post("/auth/login", data={"username": "user@test.com", "password": "secret123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client):
    db = TestingSessionLocal()
    _create_user(db, "user@test.com", "correct", ["Others"])
    db.close()

    resp = client.post("/auth/login", data={"username": "user@test.com", "password": "wrong"})
    assert resp.status_code == 401


def test_login_unknown_email(client):
    resp = client.post("/auth/login", data={"username": "nobody@test.com", "password": "x"})
    assert resp.status_code == 401


def test_me_requires_auth(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_me_returns_current_user(client):
    db = TestingSessionLocal()
    _create_user(db, "me@test.com", "pass123", ["HR"])
    db.close()

    token = client.post("/auth/login", data={"username": "me@test.com", "password": "pass123"}).json()["access_token"]
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "me@test.com"


def test_inactive_user_cannot_login(client):
    from app.models.user import User
    from app.core.security import hash_password
    db = TestingSessionLocal()
    user = User(email="inactive@test.com", hashed_password=hash_password("pass"), is_active=False)
    db.add(user)
    db.commit()
    db.close()

    resp = client.post("/auth/login", data={"username": "inactive@test.com", "password": "pass"})
    assert resp.status_code == 400
