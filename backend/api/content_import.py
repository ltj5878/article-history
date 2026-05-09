from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import Book, ReadingUnit
from .repository import encode_json


ID_PATTERN = r"^[a-z0-9][a-z0-9_-]*$"


class ParagraphPackage(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1, max_length=120)
    original: str = Field(min_length=1)
    translation: str | None = None
    entities: list[dict[str, Any]] = Field(default_factory=list)
    routes: list[dict[str, Any]] = Field(default_factory=list)


class ChapterPackage(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1, max_length=120, pattern=ID_PATTERN)
    title: str = Field(min_length=1, max_length=240)
    subtitle: str | None = Field(default=None, max_length=240)
    year: int | None = None
    period: str | None = Field(default=None, max_length=120)
    paragraphs: list[ParagraphPackage] = Field(min_length=1)


class ArticlePackage(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    id: str = Field(min_length=1, max_length=120, pattern=ID_PATTERN)
    title: str = Field(min_length=1, max_length=240)
    subtitle: str | None = Field(default=None, max_length=240)
    year: int | None = None
    year_start: int | None = Field(default=None, alias="yearStart")
    year_end: int | None = Field(default=None, alias="yearEnd")
    sections: list[dict[str, Any]] = Field(min_length=1)


class BookPackage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(min_length=1, max_length=80, pattern=ID_PATTERN)
    title: str = Field(min_length=1, max_length=200)
    book_series: str | None = Field(default=None, alias="bookSeries", max_length=200)
    dynasty: str | None = Field(default=None, max_length=120)
    author: str | None = Field(default=None, max_length=120)
    description: str | None = None
    era_events: list[dict[str, Any]] = Field(default_factory=list, alias="eraEvents")
    chapters: list[ChapterPackage] = Field(default_factory=list)
    articles: list[ArticlePackage] = Field(default_factory=list)

    @model_validator(mode="after")
    def has_reading_units(self):
        if not self.chapters and not self.articles:
            raise ValueError("Book package must include chapters or articles")
        return self


class ContentImportPackage(BaseModel):
    books: list[BookPackage] = Field(min_length=1)


class ContentImportResult(BaseModel):
    books_imported: int = Field(alias="booksImported")
    reading_units_imported: int = Field(alias="readingUnitsImported")


class ContentImportError(ValueError):
    pass


class ContentPackageImporter:
    def __init__(self, session: Session):
        self.session = session

    def import_package(self, package: ContentImportPackage) -> ContentImportResult:
        self._validate_reading_unit_ids(package)

        reading_units_imported = 0
        for book_payload in package.books:
            book = self.session.get(Book, book_payload.id)
            if not book:
                book = Book(id=book_payload.id, title=book_payload.title, era_events_json="[]")
                self.session.add(book)

            book.title = book_payload.title
            book.book_series = book_payload.book_series
            book.dynasty = book_payload.dynasty
            book.author = book_payload.author
            book.description = book_payload.description
            book.era_events_json = encode_json(book_payload.era_events)
            self.session.flush()

            self.session.execute(delete(ReadingUnit).where(ReadingUnit.book_id == book.id))
            for position, article in enumerate(book_payload.articles):
                self.session.add(self._article_unit(book.id, article, position))
                reading_units_imported += 1
            for position, chapter in enumerate(book_payload.chapters):
                self.session.add(self._chapter_unit(book.id, chapter, position))
                reading_units_imported += 1

        try:
            self.session.flush()
        except IntegrityError as exc:
            self.session.rollback()
            raise ContentImportError("Content package violates database constraints") from exc

        return ContentImportResult(
            booksImported=len(package.books),
            readingUnitsImported=reading_units_imported,
        )

    def _validate_reading_unit_ids(self, package: ContentImportPackage) -> None:
        book_ids = [book.id for book in package.books]
        duplicate_book_ids = sorted({book_id for book_id in book_ids if book_ids.count(book_id) > 1})
        if duplicate_book_ids:
            raise ContentImportError(f"Duplicate book ids in package: {', '.join(duplicate_book_ids)}")

        for book in package.books:
            unit_ids = [article.id for article in book.articles] + [chapter.id for chapter in book.chapters]
            duplicate_unit_ids = sorted({unit_id for unit_id in unit_ids if unit_ids.count(unit_id) > 1})
            if duplicate_unit_ids:
                raise ContentImportError(
                    f"Duplicate reading unit ids in book {book.id}: {', '.join(duplicate_unit_ids)}"
                )

    def _article_unit(self, book_id: str, article: ArticlePackage, position: int) -> ReadingUnit:
        document = article.model_dump(by_alias=True, exclude_none=True)
        return ReadingUnit(
            id=article.id,
            book_id=book_id,
            kind="article",
            title=article.title,
            subtitle=article.subtitle,
            year=article.year,
            year_start=article.year_start,
            year_end=article.year_end,
            position=position,
            document_json=encode_json(document),
        )

    def _chapter_unit(self, book_id: str, chapter: ChapterPackage, position: int) -> ReadingUnit:
        document = chapter.model_dump(by_alias=True, exclude_none=True)
        return ReadingUnit(
            id=chapter.id,
            book_id=book_id,
            kind="chapter",
            title=chapter.title,
            subtitle=chapter.subtitle,
            year=chapter.year,
            year_start=None,
            year_end=None,
            position=position,
            document_json=encode_json(document),
        )
