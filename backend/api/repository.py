import json

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .models import Book, Period, ReadingUnit


class ContentNotFoundError(LookupError):
    pass


class ContentRepository:
    def __init__(self, session: Session):
        self.session = session

    def health(self) -> dict:
        books = []
        total_chapters = 0
        total_articles = 0
        for book in self.session.scalars(select(Book).order_by(Book.id)):
            chapter_count = sum(1 for unit in book.reading_units if unit.kind == "chapter")
            article_count = sum(1 for unit in book.reading_units if unit.kind == "article")
            books.append(
                {
                    "id": book.id,
                    "title": book.title,
                    "chapters": chapter_count,
                    "articles": article_count,
                }
            )
            total_chapters += chapter_count
            total_articles += article_count

        periods = [period.id for period in self.session.scalars(select(Period).order_by(Period.position))]
        return {
            "status": "ok",
            "database": "ok",
            "books": books,
            "totalChapters": total_chapters,
            "totalArticles": total_articles,
            "periods": periods,
        }

    def replace_all_content(self, payload: dict) -> None:
        self.session.execute(delete(ReadingUnit))
        self.session.execute(delete(Book))
        self.session.execute(delete(Period))
        self.session.flush()

        for book_payload in payload.get("books", []):
            book = Book(
                id=book_payload["id"],
                title=book_payload["title"],
                book_series=book_payload.get("bookSeries"),
                dynasty=book_payload.get("dynasty"),
                author=book_payload.get("author"),
                description=book_payload.get("description"),
                era_events_json=encode_json(book_payload.get("eraEvents", [])),
            )
            self.session.add(book)

            for position, article in enumerate(book_payload.get("articles", [])):
                self.session.add(self._reading_unit(book.id, "article", article, position))
            for position, chapter in enumerate(book_payload.get("chapters", [])):
                self.session.add(self._reading_unit(book.id, "chapter", chapter, position))

        for position, period_payload in enumerate(payload.get("periods", [])):
            self.session.add(
                Period(
                    id=period_payload["id"],
                    label=period_payload.get("label", period_payload["id"]),
                    position=position,
                    data_json=encode_json(period_payload),
                )
            )

    def list_books(self) -> list[dict]:
        books = []
        for book in self.session.scalars(select(Book).order_by(Book.id)):
            chapter_count = sum(1 for unit in book.reading_units if unit.kind == "chapter")
            article_count = sum(1 for unit in book.reading_units if unit.kind == "article")
            books.append(
                {
                    "id": book.id,
                    "title": book.title,
                    "bookSeries": book.book_series,
                    "dynasty": book.dynasty,
                    "author": book.author,
                    "description": book.description,
                    "chapterCount": chapter_count,
                    "articleCount": article_count,
                }
            )
        return books

    def get_book(self, book_id: str) -> dict:
        book = self.session.get(Book, book_id)
        if not book:
            raise ContentNotFoundError(f"Book not found: {book_id}")
        result = {
            "id": book.id,
            "title": book.title,
            "bookSeries": book.book_series,
            "dynasty": book.dynasty,
            "author": book.author,
            "description": book.description,
            "eraEvents": decode_json(book.era_events_json),
        }
        chapters = [self._summarize_unit(unit) for unit in book.reading_units if unit.kind == "chapter"]
        articles = [self._summarize_unit(unit) for unit in book.reading_units if unit.kind == "article"]
        if chapters:
            result["chapters"] = chapters
            result["chapterCount"] = len(chapters)
        if articles:
            result["articles"] = articles
            result["articleCount"] = len(articles)
        return result

    def get_chapter(self, book_id: str, chapter_id: str) -> dict:
        return self._get_document(book_id, chapter_id, "chapter")

    def get_article(self, book_id: str, article_id: str) -> dict:
        return self._get_document(book_id, article_id, "article")

    def get_period(self, period_id: str) -> dict:
        period = self.session.get(Period, period_id)
        if not period:
            raise ContentNotFoundError(f"Period not found: {period_id}")
        return decode_json(period.data_json)

    def _get_document(self, book_id: str, unit_id: str, kind: str) -> dict:
        unit = self.session.scalar(
            select(ReadingUnit).where(
                ReadingUnit.book_id == book_id,
                ReadingUnit.id == unit_id,
                ReadingUnit.kind == kind,
            )
        )
        if not unit:
            raise ContentNotFoundError(f"{kind.title()} not found: {book_id}/{unit_id}")
        return decode_json(unit.document_json)

    def _reading_unit(self, book_id: str, kind: str, payload: dict, position: int) -> ReadingUnit:
        document = payload.get("document", payload)
        return ReadingUnit(
            id=payload["id"],
            book_id=book_id,
            kind=kind,
            title=payload["title"],
            subtitle=payload.get("subtitle"),
            year=payload.get("year"),
            year_start=payload.get("yearStart"),
            year_end=payload.get("yearEnd"),
            position=position,
            document_json=encode_json(document),
        )

    def _summarize_unit(self, unit: ReadingUnit) -> dict:
        result = {
            "id": unit.id,
            "title": unit.title,
            "subtitle": unit.subtitle,
            "year": unit.year,
        }
        if unit.kind == "article":
            result["yearStart"] = unit.year_start
            result["yearEnd"] = unit.year_end
        return result


def encode_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def decode_json(value: str):
    return json.loads(value)
