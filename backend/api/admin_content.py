from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import Book, ReadingUnit
from .repository import ContentNotFoundError, encode_json


class BookCreate(BaseModel):
    id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    title: str = Field(min_length=1, max_length=200)
    book_series: str | None = Field(default=None, alias="bookSeries", max_length=200)
    dynasty: str | None = Field(default=None, max_length=120)
    author: str | None = Field(default=None, max_length=120)
    description: str | None = None


class BookUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    book_series: str | None = Field(default=None, alias="bookSeries", max_length=200)
    dynasty: str | None = Field(default=None, max_length=120)
    author: str | None = Field(default=None, max_length=120)
    description: str | None = None


class ChapterCreate(BaseModel):
    id: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    title: str = Field(min_length=1, max_length=240)
    subtitle: str | None = Field(default=None, max_length=240)
    year: int | None = None
    period: str | None = Field(default=None, max_length=120)
    original: str = Field(min_length=1)
    translation: str | None = None


class BookResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    title: str
    book_series: str | None = Field(default=None, alias="bookSeries")
    dynasty: str | None = None
    author: str | None = None
    description: str | None = None
    chapter_count: int = Field(alias="chapterCount")
    article_count: int = Field(alias="articleCount")


class DuplicateContentError(ValueError):
    pass


class AdminContentRepository:
    def __init__(self, session: Session):
        self.session = session

    def list_books(self) -> list[BookResponse]:
        return [self._book_response(book) for book in self.session.scalars(select(Book).order_by(Book.id))]

    def create_book(self, payload: BookCreate) -> BookResponse:
        book = Book(
            id=payload.id,
            title=payload.title,
            book_series=payload.book_series,
            dynasty=payload.dynasty,
            author=payload.author,
            description=payload.description,
            era_events_json="[]",
        )
        self.session.add(book)
        try:
            self.session.flush()
        except IntegrityError as exc:
            self.session.rollback()
            raise DuplicateContentError("Book already exists") from exc
        return self._book_response(book)

    def update_book(self, book_id: str, payload: BookUpdate) -> BookResponse:
        book = self.session.get(Book, book_id)
        if not book:
            raise ContentNotFoundError(f"Book not found: {book_id}")
        changes = payload.model_dump(exclude_unset=True, by_alias=False)
        for field, value in changes.items():
            setattr(book, field, value)
        self.session.flush()
        return self._book_response(book)

    def delete_book(self, book_id: str) -> None:
        book = self.session.get(Book, book_id)
        if not book:
            raise ContentNotFoundError(f"Book not found: {book_id}")
        self.session.delete(book)
        self.session.flush()

    def add_chapter(self, book_id: str, payload: ChapterCreate) -> dict:
        book = self.session.get(Book, book_id)
        if not book:
            raise ContentNotFoundError(f"Book not found: {book_id}")
        existing = self.session.scalar(
            select(ReadingUnit).where(
                ReadingUnit.book_id == book_id,
                ReadingUnit.id == payload.id,
                ReadingUnit.kind == "chapter",
            )
        )
        if existing:
            raise DuplicateContentError("Chapter already exists")
        position = len([unit for unit in book.reading_units if unit.kind == "chapter"])
        document = {
            "id": payload.id,
            "title": payload.title,
            "subtitle": payload.subtitle,
            "year": payload.year,
            "period": payload.period,
            "paragraphs": [
                {
                    "id": "p1",
                    "original": payload.original,
                    "translation": payload.translation,
                    "entities": [],
                    "routes": [],
                }
            ],
        }
        unit = ReadingUnit(
            id=payload.id,
            book_id=book.id,
            kind="chapter",
            title=payload.title,
            subtitle=payload.subtitle,
            year=payload.year,
            year_start=None,
            year_end=None,
            position=position,
            document_json=encode_json(document),
        )
        self.session.add(unit)
        self.session.flush()
        return document

    def _book_response(self, book: Book) -> BookResponse:
        return BookResponse(
            id=book.id,
            title=book.title,
            bookSeries=book.book_series,
            dynasty=book.dynasty,
            author=book.author,
            description=book.description,
            chapterCount=sum(1 for unit in book.reading_units if unit.kind == "chapter"),
            articleCount=sum(1 for unit in book.reading_units if unit.kind == "article"),
        )
