from sqlalchemy import create_engine, inspect, text

from api.database import get_database_url, init_db, session_scope
from api.models import Book, ReadingUnit


def test_fresh_schema_scopes_reading_unit_ids_by_book(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'fresh.db'}"
    init_db(db_url)
    engine = create_engine(db_url)
    inspector = inspect(engine)

    columns = {column["name"]: column for column in inspector.get_columns("reading_units")}
    assert columns["pk"]["primary_key"] == 1
    assert columns["id"]["primary_key"] == 0

    unique_columns = {tuple(item["column_names"]) for item in inspector.get_unique_constraints("reading_units")}
    assert ("book_id", "id") in unique_columns


def test_legacy_sqlite_reading_units_table_is_migrated(tmp_path):
    db_path = tmp_path / "legacy.db"
    db_url = f"sqlite:///{db_path}"
    engine = create_engine(db_url)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE books (
                    id VARCHAR(80) PRIMARY KEY,
                    title VARCHAR(200) NOT NULL,
                    book_series VARCHAR(200),
                    dynasty VARCHAR(120),
                    author VARCHAR(120),
                    description TEXT,
                    era_events_json TEXT NOT NULL
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE reading_units (
                    id VARCHAR(120) PRIMARY KEY,
                    book_id VARCHAR(80) NOT NULL,
                    kind VARCHAR(20) NOT NULL,
                    title VARCHAR(240) NOT NULL,
                    subtitle VARCHAR(240),
                    year INTEGER,
                    year_start INTEGER,
                    year_end INTEGER,
                    position INTEGER NOT NULL,
                    document_json TEXT NOT NULL
                )
                """
            )
        )
        conn.execute(text("INSERT INTO books (id, title, era_events_json) VALUES ('book-a', 'Book A', '[]')"))
        conn.execute(
            text(
                """
                INSERT INTO reading_units
                (id, book_id, kind, title, position, document_json)
                VALUES ('intro', 'book-a', 'chapter', 'Intro', 0, '{"id":"intro"}')
                """
            )
        )

    init_db(db_url)

    inspector = inspect(create_engine(db_url))
    columns = {column["name"]: column for column in inspector.get_columns("reading_units")}
    assert columns["pk"]["primary_key"] == 1
    assert columns["id"]["primary_key"] == 0

    with session_scope(db_url) as session:
        book_b = Book(id="book-b", title="Book B", era_events_json="[]")
        session.add(book_b)
        session.add(
            ReadingUnit(
                id="intro",
                book_id="book-b",
                kind="chapter",
                title="Intro",
                position=0,
                document_json='{"id":"intro"}',
            )
        )
        assert len(session.query(ReadingUnit).filter(ReadingUnit.id == "intro").all()) == 2


def test_render_postgres_url_uses_psycopg_driver():
    assert get_database_url("postgres://user:pass@host:5432/db") == "postgresql+psycopg://user:pass@host:5432/db"
