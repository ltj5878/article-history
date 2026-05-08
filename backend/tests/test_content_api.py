import json

from fastapi.testclient import TestClient

from api.app import create_app
from api.database import init_db, session_scope
from api.repository import ContentRepository
from api.seed import seed_from_static_data


def test_health_reports_empty_database(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'content.db'}"
    init_db(db_url)
    app = create_app(db_url=db_url)

    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "database": "ok",
        "books": [],
        "totalChapters": 0,
        "totalArticles": 0,
        "periods": [],
    }


def test_books_and_reading_documents_are_served_in_frontend_shape(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'content.db'}"
    init_db(db_url)
    seed_sample_content(db_url)
    client = TestClient(create_app(db_url=db_url))

    books = client.get("/api/books")
    assert books.status_code == 200
    assert books.json() == [
        {
            "id": "shiji",
            "title": "史记",
            "bookSeries": "纪传体通史",
            "dynasty": "西汉",
            "author": "司马迁",
            "description": "史记选读",
            "chapterCount": 0,
            "articleCount": 1,
        },
        {
            "id": "zuozhuan",
            "title": "左传",
            "bookSeries": "春秋三传",
            "dynasty": "春秋",
            "author": "左丘明",
            "description": "左传选读",
            "chapterCount": 1,
            "articleCount": 0,
        },
    ]

    book = client.get("/api/books/shiji")
    assert book.status_code == 200
    assert book.json()["articles"] == [
        {
            "id": "xiangyu-benji",
            "title": "项羽本纪",
            "subtitle": "卷七",
            "year": -209,
            "yearStart": -209,
            "yearEnd": -202,
        }
    ]
    assert book.json()["eraEvents"][0]["label"] == "起兵会稽"

    article = client.get("/api/books/shiji/articles/xiangyu-benji")
    assert article.status_code == 200
    assert article.json()["sections"][0]["paragraphs"][0]["original"] == "项籍少时，学书不成。"

    chapter = client.get("/api/books/zuozhuan/chapters/changshao")
    assert chapter.status_code == 200
    assert chapter.json()["paragraphs"][0]["entities"][0]["text"] == "齐师"


def test_unknown_content_ids_return_404(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'content.db'}"
    init_db(db_url)
    seed_sample_content(db_url)
    client = TestClient(create_app(db_url=db_url))

    assert client.get("/api/books/missing").status_code == 404
    assert client.get("/api/books/shiji/articles/missing").status_code == 404
    assert client.get("/api/books/zuozhuan/chapters/missing").status_code == 404


def test_periods_are_served_in_frontend_shape(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'content.db'}"
    init_db(db_url)
    seed_sample_content(db_url)
    client = TestClient(create_app(db_url=db_url))

    health = client.get("/api/health")
    assert health.json()["periods"] == ["spring_autumn_mid"]

    period = client.get("/api/maps/period/spring_autumn_mid")
    assert period.status_code == 200
    assert period.json() == {
        "id": "spring_autumn_mid",
        "label": "春秋中期",
        "states": [{"name": "鲁", "color": "#8A6F3D", "polygon": [[116.5, 35.0], [118.5, 35.0], [118.5, 36.5]]}],
        "cities": [{"name": "曲阜", "role": "鲁都", "lat": 35.58, "lng": 116.99, "type": "capital"}],
    }

    assert client.get("/api/maps/period/missing").status_code == 404


def test_seed_from_static_data_imports_books_documents_and_periods(tmp_path):
    data_dir = tmp_path / "data"
    write_json(
        data_dir / "books.json",
        [
            {
                "id": "zuozhuan",
                "title": "左传",
                "bookSeries": "春秋三传",
                "dynasty": "春秋",
                "author": "左丘明",
                "description": "左传选读",
                "chapterCount": 1,
                "articleCount": 0,
            }
        ],
    )
    write_json(
        data_dir / "books" / "zuozhuan.json",
        {
            "id": "zuozhuan",
            "title": "左传",
            "bookSeries": "春秋三传",
            "dynasty": "春秋",
            "author": "左丘明",
            "description": "左传选读",
            "eraEvents": [{"year": -684, "label": "长勺之战", "chapter": "changshao"}],
            "chapters": [{"id": "changshao", "title": "长勺之战", "subtitle": "曹刿论战", "year": -684}],
        },
    )
    write_json(
        data_dir / "books" / "zuozhuan" / "changshao.json",
        {
            "id": "changshao",
            "title": "长勺之战",
            "subtitle": "曹刿论战",
            "year": -684,
            "period": "spring_autumn_mid",
            "paragraphs": [{"id": "p1", "original": "齐师伐我。", "entities": [], "routes": []}],
        },
    )
    write_json(
        data_dir / "periods" / "spring_autumn_mid.json",
        {"label": "春秋中期", "states": [], "cities": []},
    )

    db_url = f"sqlite:///{tmp_path / 'content.db'}"
    init_db(db_url)
    seed_from_static_data(db_url, data_dir)
    client = TestClient(create_app(db_url=db_url))

    assert client.get("/api/books/zuozhuan").json()["chapters"][0]["id"] == "changshao"
    assert client.get("/api/books/zuozhuan/chapters/changshao").json()["paragraphs"][0]["original"] == "齐师伐我。"
    assert client.get("/api/maps/period/spring_autumn_mid").json()["id"] == "spring_autumn_mid"


def test_geo_layers_are_served_from_allowed_geo_directory(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'content.db'}"
    init_db(db_url)
    geo_dir = tmp_path / "geo"
    write_json(
        geo_dir / "china_provinces.geojson",
        {"type": "FeatureCollection", "features": []},
    )
    client = TestClient(create_app(db_url=db_url, geo_dir=geo_dir))

    geo = client.get("/api/geo/china_provinces")

    assert geo.status_code == 200
    assert geo.headers["content-type"].startswith("application/geo+json")
    assert geo.json() == {"type": "FeatureCollection", "features": []}
    assert client.get("/api/geo/not_allowed").status_code == 404


def seed_sample_content(db_url):
    payload = {
        "books": [
            {
                "id": "shiji",
                "title": "史记",
                "bookSeries": "纪传体通史",
                "dynasty": "西汉",
                "author": "司马迁",
                "description": "史记选读",
                "eraEvents": [{"year": -209, "label": "起兵会稽", "article": "xiangyu-benji", "section": "wu"}],
                "articles": [
                    {
                        "id": "xiangyu-benji",
                        "title": "项羽本纪",
                        "subtitle": "卷七",
                        "year": -209,
                        "yearStart": -209,
                        "yearEnd": -202,
                        "document": {
                            "id": "xiangyu-benji",
                            "title": "项羽本纪",
                            "subtitle": "卷七",
                            "sections": [
                                {
                                    "id": "wu",
                                    "title": "起兵会稽",
                                    "subtitle": "江东举事",
                                    "year": -209,
                                    "period": "qin_end",
                                    "paragraphs": [
                                        {
                                            "id": "wu-p1",
                                            "original": "项籍少时，学书不成。",
                                            "translation": "项籍年轻时，学书没有学成。",
                                            "entities": [{"text": "项籍", "type": "person", "description": "项羽"}],
                                            "routes": [],
                                        }
                                    ],
                                }
                            ],
                        },
                    }
                ],
            },
            {
                "id": "zuozhuan",
                "title": "左传",
                "bookSeries": "春秋三传",
                "dynasty": "春秋",
                "author": "左丘明",
                "description": "左传选读",
                "eraEvents": [{"year": -684, "label": "长勺之战", "chapter": "changshao"}],
                "chapters": [
                    {
                        "id": "changshao",
                        "title": "长勺之战",
                        "subtitle": "曹刿论战",
                        "year": -684,
                        "document": {
                            "id": "changshao",
                            "title": "长勺之战",
                            "subtitle": "曹刿论战",
                            "year": -684,
                            "period": "spring_autumn_mid",
                            "paragraphs": [
                                {
                                    "id": "p1",
                                    "original": "齐师伐我。",
                                    "translation": "齐国军队攻打我国。",
                                    "entities": [{"text": "齐师", "type": "person", "description": "齐国军队"}],
                                    "routes": [],
                                }
                            ],
                        },
                    }
                ],
            },
        ],
        "periods": [
            {
                "id": "spring_autumn_mid",
                "label": "春秋中期",
                "states": [{"name": "鲁", "color": "#8A6F3D", "polygon": [[116.5, 35.0], [118.5, 35.0], [118.5, 36.5]]}],
                "cities": [{"name": "曲阜", "role": "鲁都", "lat": 35.58, "lng": 116.99, "type": "capital"}],
            }
        ],
    }
    with session_scope(db_url) as session:
        ContentRepository(session).replace_all_content(payload)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
