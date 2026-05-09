"""Export the database content into the static JSON fallback artifact.

The database is the source of truth; this dumps it into app/public/data so the
frontend can degrade to static-only deployments (e.g. Netlify) when the API is
unavailable.
"""

import argparse
import json
import shutil
from pathlib import Path

from sqlalchemy import select

from .database import init_db, session_scope
from .models import Book, Period, ReadingUnit
from .repository import decode_json


GEO_LAYERS = (
    "ne_coastline_china",
    "ne_rivers_china",
    "ne_lakes_china",
    "ne_land_china",
    "china_provinces",
)
DEFAULT_GEO_DIR = Path(__file__).resolve().parents[1] / "data" / "geo"


def export(db_url: str, out_dir: str | Path, geo_dir: str | Path | None = None) -> dict:
    init_db(db_url)
    out_root = Path(out_dir)
    geo_root = Path(geo_dir) if geo_dir else DEFAULT_GEO_DIR

    if out_root.exists():
        shutil.rmtree(out_root)
    (out_root / "books").mkdir(parents=True)
    (out_root / "periods").mkdir(parents=True)
    (out_root / "geo").mkdir(parents=True)

    counts = {"books": 0, "chapters": 0, "articles": 0, "periods": 0, "geo": 0}

    with session_scope(db_url) as session:
        listing = []
        for book in session.scalars(select(Book).order_by(Book.id)):
            chapters = [u for u in book.reading_units if u.kind == "chapter"]
            articles = [u for u in book.reading_units if u.kind == "article"]
            chapters.sort(key=lambda u: u.position)
            articles.sort(key=lambda u: u.position)

            listing.append(
                {
                    "id": book.id,
                    "title": book.title,
                    "bookSeries": book.book_series,
                    "dynasty": book.dynasty,
                    "author": book.author,
                    "description": book.description,
                    "chapterCount": len(chapters),
                    "articleCount": len(articles),
                }
            )

            meta = {
                "id": book.id,
                "title": book.title,
                "bookSeries": book.book_series,
                "dynasty": book.dynasty,
                "author": book.author,
                "description": book.description,
                "eraEvents": decode_json(book.era_events_json),
            }
            if chapters:
                meta["chapters"] = [_summarize(u) for u in chapters]
                meta["chapterCount"] = len(chapters)
            if articles:
                meta["articles"] = [_summarize(u) for u in articles]
                meta["articleCount"] = len(articles)
            _write_json(out_root / "books" / f"{book.id}.json", meta)

            book_dir = out_root / "books" / book.id
            book_dir.mkdir(exist_ok=True)
            for unit in chapters + articles:
                _write_json(book_dir / f"{unit.id}.json", decode_json(unit.document_json))

            counts["books"] += 1
            counts["chapters"] += len(chapters)
            counts["articles"] += len(articles)

        _write_json(out_root / "books.json", listing)

        for period in session.scalars(select(Period).order_by(Period.position)):
            data = decode_json(period.data_json)
            data.setdefault("id", period.id)
            _write_json(out_root / "periods" / f"{period.id}.json", data)
            counts["periods"] += 1

    for layer in GEO_LAYERS:
        src = geo_root / f"{layer}.geojson"
        if not src.exists():
            raise FileNotFoundError(f"Missing geo layer: {src}")
        shutil.copyfile(src, out_root / "geo" / f"{layer}.geojson")
        counts["geo"] += 1

    return counts


def _summarize(unit: ReadingUnit) -> dict:
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


def _write_json(path: Path, value) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Export DB content to static JSON fallback artifact.")
    parser.add_argument("--db-url", required=True)
    parser.add_argument("--out-dir", default="app/public/data")
    parser.add_argument("--geo-dir", default=None)
    args = parser.parse_args()
    counts = export(args.db_url, args.out_dir, args.geo_dir)
    print(
        f"[export-static] {counts['books']} books / {counts['chapters']} chapters / "
        f"{counts['articles']} articles / {counts['periods']} periods / {counts['geo']} geo layers → {args.out_dir}"
    )


if __name__ == "__main__":
    main()
