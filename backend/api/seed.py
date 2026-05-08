import argparse
import json
from pathlib import Path

from .database import init_db, session_scope
from .repository import ContentRepository


def load_static_data(data_dir: str | Path) -> dict:
    root = Path(data_dir)
    listing = read_json(root / "books.json")
    books = []
    for item in listing:
        book_id = item["id"]
        meta = read_json(root / "books" / f"{book_id}.json")
        book_payload = {
            "id": meta["id"],
            "title": meta["title"],
            "bookSeries": meta.get("bookSeries"),
            "dynasty": meta.get("dynasty"),
            "author": meta.get("author"),
            "description": meta.get("description"),
            "eraEvents": meta.get("eraEvents", []),
        }
        if "articles" in meta:
            book_payload["articles"] = [
                {**summary, "document": read_json(root / "books" / book_id / f"{summary['id']}.json")}
                for summary in meta["articles"]
            ]
        if "chapters" in meta:
            book_payload["chapters"] = [
                {**summary, "document": read_json(root / "books" / book_id / f"{summary['id']}.json")}
                for summary in meta["chapters"]
            ]
        books.append(book_payload)

    periods = []
    periods_dir = root / "periods"
    if periods_dir.exists():
        for path in sorted(periods_dir.glob("*.json")):
            period = read_json(path)
            period.setdefault("id", path.stem)
            periods.append(period)

    return {"books": books, "periods": periods}


def seed_from_static_data(db_url: str, data_dir: str | Path) -> None:
    init_db(db_url)
    payload = load_static_data(data_dir)
    with session_scope(db_url) as session:
        ContentRepository(session).replace_all_content(payload)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the content database from generated static JSON.")
    parser.add_argument("--db-url", required=True)
    parser.add_argument("--data-dir", default="app/public/data")
    args = parser.parse_args()
    seed_from_static_data(args.db_url, args.data_dir)


if __name__ == "__main__":
    main()
