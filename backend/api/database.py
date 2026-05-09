from collections.abc import Iterator
from contextlib import contextmanager
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import Session

from .models import Base
from .schema import migrate_schema


DEFAULT_DATABASE_URL = "sqlite:///backend/.data/content.db"


def get_database_url(db_url: str | None = None) -> str:
    resolved = db_url or os.environ.get("DATABASE_URL") or DEFAULT_DATABASE_URL
    if resolved.startswith("postgres://"):
        return "postgresql+psycopg://" + resolved.removeprefix("postgres://")
    if resolved.startswith("postgresql://"):
        return "postgresql+psycopg://" + resolved.removeprefix("postgresql://")
    return resolved


def make_engine(db_url: str | None = None) -> Engine:
    resolved = get_database_url(db_url)
    if resolved.startswith("sqlite"):
        database = make_url(resolved).database
        if database and database != ":memory:":
            Path(database).parent.mkdir(parents=True, exist_ok=True)
    connect_args = {"check_same_thread": False} if resolved.startswith("sqlite") else {}
    return create_engine(resolved, connect_args=connect_args)


def init_db(db_url: str | None = None) -> None:
    engine = make_engine(db_url)
    Base.metadata.create_all(engine)
    migrate_schema(engine)


@contextmanager
def session_scope(db_url: str | None = None) -> Iterator[Session]:
    engine = make_engine(db_url)
    session = Session(engine)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
