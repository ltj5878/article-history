from fastapi.testclient import TestClient
from sqlalchemy import select

from api.app import create_app
from api.database import init_db, session_scope
from api.models import User


def test_admin_can_import_book_package(tmp_path):
    client, db_url = admin_client(tmp_path)
    token = make_user(client, db_url, "admin@example.com", role="admin")

    response = client.post("/api/admin/import", headers=auth_header(token), json=package_payload())

    assert response.status_code == 201
    assert response.json() == {"booksImported": 1, "readingUnitsImported": 1}
    assert client.get("/api/books/guoyu").json()["chapters"] == [
        {"id": "guoyu-zhouyu", "title": "周语", "subtitle": "敬王问治", "year": -520}
    ]
    chapter = client.get("/api/books/guoyu/chapters/guoyu-zhouyu")
    assert chapter.status_code == 200
    assert chapter.json()["paragraphs"][0]["original"] == "敬王问于史伯。"


def test_admin_can_import_article_book_package(tmp_path):
    client, db_url = admin_client(tmp_path)
    token = make_user(client, db_url, "admin@example.com", role="admin")

    response = client.post("/api/admin/import", headers=auth_header(token), json=article_package_payload())

    assert response.status_code == 201
    public_book = client.get("/api/books/shiji-xuan")
    assert public_book.status_code == 200
    assert public_book.json()["articles"] == [
        {
            "id": "shiji-xiangyu",
            "title": "项羽本纪",
            "subtitle": "巨鹿之战",
            "year": -207,
            "yearStart": -207,
            "yearEnd": -206,
        }
    ]
    article = client.get("/api/books/shiji-xuan/articles/shiji-xiangyu")
    assert article.status_code == 200
    assert article.json()["sections"][0]["paragraphs"][0]["original"] == "项籍者，下相人也。"


def test_import_replaces_only_the_reimported_book(tmp_path):
    client, db_url = admin_client(tmp_path)
    token = make_user(client, db_url, "admin@example.com", role="admin")
    assert client.post("/api/admin/import", headers=auth_header(token), json=package_payload()).status_code == 201
    assert client.post("/api/admin/import", headers=auth_header(token), json=package_payload(book_id="mengzi", unit_id="mengzi-lianghuiwang", title="孟子")).status_code == 201

    replacement = package_payload()
    replacement["books"][0]["chapters"] = [
        {
            "id": "guoyu-jinyu",
            "title": "晋语",
            "subtitle": None,
            "year": -650,
            "period": "spring_autumn_middle",
            "paragraphs": [{"id": "p1", "original": "晋献公伐骊戎。", "translation": None}],
        }
    ]
    response = client.post("/api/admin/import", headers=auth_header(token), json=replacement)

    assert response.status_code == 201
    assert [item["id"] for item in client.get("/api/books/guoyu").json()["chapters"]] == ["guoyu-jinyu"]
    assert client.get("/api/books/guoyu/chapters/guoyu-zhouyu").status_code == 404
    assert client.get("/api/books/mengzi/chapters/mengzi-lianghuiwang").status_code == 200


def test_import_rejects_unit_id_collision_with_another_book(tmp_path):
    client, db_url = admin_client(tmp_path)
    token = make_user(client, db_url, "admin@example.com", role="admin")
    assert client.post("/api/admin/import", headers=auth_header(token), json=package_payload()).status_code == 201

    collision = package_payload(book_id="mengzi", unit_id="guoyu-zhouyu", title="孟子")
    response = client.post("/api/admin/import", headers=auth_header(token), json=collision)

    assert response.status_code == 409
    assert "Reading unit id already belongs to another book" in response.json()["detail"]


def test_regular_user_cannot_import_content_package(tmp_path):
    client, db_url = admin_client(tmp_path)
    token = make_user(client, db_url, "reader@example.com", role="user")

    response = client.post("/api/admin/import", headers=auth_header(token), json=package_payload())

    assert response.status_code == 403


def package_payload(book_id="guoyu", unit_id="guoyu-zhouyu", title="国语"):
    return {
        "books": [
            {
                "id": book_id,
                "title": title,
                "bookSeries": "国别体",
                "dynasty": "春秋",
                "author": "左丘明",
                "description": "春秋国别史料汇编",
                "eraEvents": [{"id": f"{book_id}-event", "year": -520, "label": "敬王问治"}],
                "chapters": [
                    {
                        "id": unit_id,
                        "title": "周语",
                        "subtitle": "敬王问治",
                        "year": -520,
                        "period": "spring_autumn_late",
                        "paragraphs": [
                            {
                                "id": "p1",
                                "original": "敬王问于史伯。",
                                "translation": "周敬王向史伯询问政事。",
                                "entities": [],
                                "routes": [],
                            }
                        ],
                    }
                ],
            }
        ]
    }


def article_package_payload():
    return {
        "books": [
            {
                "id": "shiji-xuan",
                "title": "史记选读",
                "bookSeries": "纪传体",
                "dynasty": "西汉",
                "author": "司马迁",
                "articles": [
                    {
                        "id": "shiji-xiangyu",
                        "title": "项羽本纪",
                        "subtitle": "巨鹿之战",
                        "year": -207,
                        "yearStart": -207,
                        "yearEnd": -206,
                        "sections": [
                            {
                                "id": "julu",
                                "title": "巨鹿",
                                "year": -207,
                                "period": "chu_han",
                                "paragraphs": [
                                    {
                                        "id": "p1",
                                        "original": "项籍者，下相人也。",
                                        "translation": "项籍是下相人。",
                                        "entities": [],
                                        "routes": [],
                                    }
                                ],
                            }
                        ],
                    }
                ],
            }
        ]
    }


def admin_client(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'import.db'}"
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
