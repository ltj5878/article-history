from fastapi.testclient import TestClient
from sqlalchemy import select

from api.app import create_app
from api.database import init_db, session_scope
from api.models import User


def test_admin_can_create_list_update_and_delete_books(tmp_path):
    client, db_url = admin_client(tmp_path)
    token = make_user(client, db_url, "admin@example.com", role="admin")

    created = client.post(
        "/api/admin/books",
        headers=auth_header(token),
        json={
            "id": "guoyu",
            "title": "国语",
            "bookSeries": "国别体",
            "dynasty": "春秋",
            "author": "左丘明",
            "description": "春秋国别史料汇编",
        },
    )

    assert created.status_code == 201
    assert created.json()["id"] == "guoyu"
    assert client.get("/api/books/guoyu").json()["title"] == "国语"

    listed = client.get("/api/admin/books", headers=auth_header(token))
    assert listed.status_code == 200
    assert [book["id"] for book in listed.json()] == ["guoyu"]

    updated = client.patch(
        "/api/admin/books/guoyu",
        headers=auth_header(token),
        json={"title": "国语选读", "description": "已校订"},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "国语选读"
    assert client.get("/api/books/guoyu").json()["description"] == "已校订"

    deleted = client.delete("/api/admin/books/guoyu", headers=auth_header(token))
    assert deleted.status_code == 204
    assert client.get("/api/books/guoyu").status_code == 404


def test_admin_book_create_rejects_duplicate_id(tmp_path):
    client, db_url = admin_client(tmp_path)
    token = make_user(client, db_url, "admin@example.com", role="admin")
    payload = {"id": "guoyu", "title": "国语"}

    assert client.post("/api/admin/books", headers=auth_header(token), json=payload).status_code == 201
    duplicate = client.post("/api/admin/books", headers=auth_header(token), json=payload)

    assert duplicate.status_code == 409


def test_regular_user_cannot_access_admin_content_endpoints(tmp_path):
    client, db_url = admin_client(tmp_path)
    token = make_user(client, db_url, "reader@example.com", role="user")

    response = client.get("/api/admin/books", headers=auth_header(token))

    assert response.status_code == 403


def test_admin_can_add_basic_chapter_to_book(tmp_path):
    client, db_url = admin_client(tmp_path)
    token = make_user(client, db_url, "admin@example.com", role="admin")
    assert client.post(
        "/api/admin/books",
        headers=auth_header(token),
        json={"id": "guoyu", "title": "国语", "dynasty": "春秋"},
    ).status_code == 201

    created = client.post(
        "/api/admin/books/guoyu/chapters",
        headers=auth_header(token),
        json={
            "id": "zhouyu",
            "title": "周语",
            "subtitle": "敬王问治",
            "year": -520,
            "period": "spring_autumn_late",
            "original": "敬王问于史伯。",
            "translation": "周敬王向史伯询问政事。",
        },
    )

    assert created.status_code == 201
    assert created.json()["paragraphs"][0]["entities"] == []

    public_book = client.get("/api/books/guoyu")
    assert public_book.status_code == 200
    assert public_book.json()["chapters"] == [
        {"id": "zhouyu", "title": "周语", "subtitle": "敬王问治", "year": -520}
    ]

    public_chapter = client.get("/api/books/guoyu/chapters/zhouyu")
    assert public_chapter.status_code == 200
    assert public_chapter.json()["paragraphs"][0]["original"] == "敬王问于史伯。"


def admin_client(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'admin.db'}"
    init_db(db_url)
    return TestClient(create_app(db_url=db_url, jwt_secret="test-secret")), db_url


def make_user(client, db_url, email, role):
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "correct horse battery staple"},
    )
    assert response.status_code == 201
    with session_scope(db_url) as session:
        user = session.scalar(select(User).where(User.email == email))
        user.role = role
    login = client.post(
        "/api/auth/login",
        json={"email": email, "password": "correct horse battery staple"},
    )
    assert login.status_code == 200
    return login.json()["accessToken"]


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}
