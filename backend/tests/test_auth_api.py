from sqlalchemy import select
from fastapi.testclient import TestClient

from api.app import create_app
from api.database import init_db, session_scope
from api.models import User


def test_user_table_initializes_empty(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'auth.db'}"

    init_db(db_url)

    with session_scope(db_url) as session:
        assert session.scalars(select(User)).all() == []


def test_register_creates_user_without_leaking_password_hash(tmp_path):
    client, db_url = auth_client(tmp_path)

    response = client.post("/api/auth/register", json={"email": "USER@Example.COM", "password": "correct horse battery staple"})

    assert response.status_code == 201
    body = response.json()
    assert body == {"id": body["id"], "email": "user@example.com", "role": "user", "isActive": True}
    assert "password_hash" not in body
    assert "passwordHash" not in body

    with session_scope(db_url) as session:
        user = session.scalar(select(User).where(User.email == "user@example.com"))
        assert user is not None
        assert user.password_hash != "correct horse battery staple"
        assert user.password_hash.startswith("$argon2")


def test_register_rejects_duplicate_email(tmp_path):
    client, _ = auth_client(tmp_path)
    payload = {"email": "user@example.com", "password": "correct horse battery staple"}

    assert client.post("/api/auth/register", json=payload).status_code == 201
    duplicate = client.post("/api/auth/register", json={"email": "USER@example.com", "password": "correct horse battery staple"})

    assert duplicate.status_code == 409


def test_login_returns_bearer_token_for_valid_credentials(tmp_path):
    client, _ = auth_client(tmp_path)
    register(client, "reader@example.com", "correct horse battery staple")

    response = client.post("/api/auth/login", json={"email": "reader@example.com", "password": "correct horse battery staple"})

    assert response.status_code == 200
    body = response.json()
    assert body["tokenType"] == "bearer"
    assert body["accessToken"]
    assert body["user"]["email"] == "reader@example.com"
    assert "password_hash" not in body["user"]


def test_login_rejects_bad_password(tmp_path):
    client, _ = auth_client(tmp_path)
    register(client, "reader@example.com", "correct horse battery staple")

    response = client.post("/api/auth/login", json={"email": "reader@example.com", "password": "wrong password"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_me_returns_authenticated_user(tmp_path):
    client, _ = auth_client(tmp_path)
    register(client, "reader@example.com", "correct horse battery staple")
    token = login(client, "reader@example.com", "correct horse battery staple")

    response = client.get("/api/auth/me", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json()["email"] == "reader@example.com"
    assert response.json()["role"] == "user"


def test_me_rejects_missing_token(tmp_path):
    client, _ = auth_client(tmp_path)

    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_admin_ping_rejects_regular_user(tmp_path):
    client, _ = auth_client(tmp_path)
    register(client, "reader@example.com", "correct horse battery staple")
    token = login(client, "reader@example.com", "correct horse battery staple")

    response = client.get("/api/admin/ping", headers=auth_header(token))

    assert response.status_code == 403


def test_admin_ping_accepts_admin_user(tmp_path):
    client, db_url = auth_client(tmp_path)
    register(client, "admin@example.com", "correct horse battery staple")
    with session_scope(db_url) as session:
        user = session.scalar(select(User).where(User.email == "admin@example.com"))
        user.role = "admin"
    token = login(client, "admin@example.com", "correct horse battery staple")

    response = client.get("/api/admin/ping", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "role": "admin"}


def auth_client(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'auth.db'}"
    init_db(db_url)
    return TestClient(create_app(db_url=db_url, jwt_secret="test-secret")), db_url


def register(client, email, password):
    response = client.post("/api/auth/register", json={"email": email, "password": password})
    assert response.status_code == 201
    return response.json()


def login(client, email, password):
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["accessToken"]


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}
