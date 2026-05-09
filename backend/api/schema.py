from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def migrate_schema(engine: Engine) -> None:
    if engine.dialect.name == "sqlite":
        _migrate_sqlite_reading_units(engine)


def _migrate_sqlite_reading_units(engine: Engine) -> None:
    inspector = inspect(engine)
    if "reading_units" not in inspector.get_table_names():
        return
    columns = {column["name"]: column for column in inspector.get_columns("reading_units")}
    if "pk" in columns and columns["pk"].get("primary_key"):
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE reading_units RENAME TO reading_units_legacy"))
        conn.execute(
            text(
                """
                CREATE TABLE reading_units (
                    pk INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    id VARCHAR(120) NOT NULL,
                    book_id VARCHAR(80) NOT NULL,
                    kind VARCHAR(20) NOT NULL,
                    title VARCHAR(240) NOT NULL,
                    subtitle VARCHAR(240),
                    year INTEGER,
                    year_start INTEGER,
                    year_end INTEGER,
                    position INTEGER NOT NULL,
                    document_json TEXT NOT NULL,
                    FOREIGN KEY(book_id) REFERENCES books (id) ON DELETE CASCADE,
                    CONSTRAINT uq_reading_units_book_id_id UNIQUE (book_id, id)
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO reading_units
                (id, book_id, kind, title, subtitle, year, year_start, year_end, position, document_json)
                SELECT id, book_id, kind, title, subtitle, year, year_start, year_end, position, document_json
                FROM reading_units_legacy
                """
            )
        )
        conn.execute(text("DROP TABLE reading_units_legacy"))
