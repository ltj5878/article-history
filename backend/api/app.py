from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

from .database import get_database_url, init_db, session_scope
from .repository import ContentNotFoundError, ContentRepository

ALLOWED_GEO_LAYERS = {
    "ne_coastline_china",
    "ne_rivers_china",
    "ne_lakes_china",
    "ne_land_china",
    "china_provinces",
}
DEFAULT_GEO_DIR = Path(__file__).resolve().parents[2] / "server" / "geo"


def create_app(db_url: str | None = None, geo_dir: str | Path | None = None) -> FastAPI:
    resolved_db_url = get_database_url(db_url)
    resolved_geo_dir = Path(geo_dir) if geo_dir else DEFAULT_GEO_DIR
    init_db(resolved_db_url)
    app = FastAPI(title="经史舆图 Content API")

    @app.get("/api/health")
    def health():
        with session_scope(resolved_db_url) as session:
            return ContentRepository(session).health()

    @app.get("/api/books")
    def list_books():
        with session_scope(resolved_db_url) as session:
            return ContentRepository(session).list_books()

    @app.get("/api/books/{book_id}")
    def get_book(book_id: str):
        with session_scope(resolved_db_url) as session:
            return _or_404(lambda: ContentRepository(session).get_book(book_id))

    @app.get("/api/books/{book_id}/chapters/{chapter_id}")
    def get_chapter(book_id: str, chapter_id: str):
        with session_scope(resolved_db_url) as session:
            return _or_404(lambda: ContentRepository(session).get_chapter(book_id, chapter_id))

    @app.get("/api/books/{book_id}/articles/{article_id}")
    def get_article(book_id: str, article_id: str):
        with session_scope(resolved_db_url) as session:
            return _or_404(lambda: ContentRepository(session).get_article(book_id, article_id))

    @app.get("/api/maps/period/{period_id}")
    def get_period(period_id: str):
        with session_scope(resolved_db_url) as session:
            return _or_404(lambda: ContentRepository(session).get_period(period_id))

    @app.get("/api/geo/{layer}")
    def get_geo_layer(layer: str):
        if layer not in ALLOWED_GEO_LAYERS:
            raise HTTPException(status_code=404, detail=f"Geo layer not found: {layer}")
        path = resolved_geo_dir / f"{layer}.geojson"
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"Geo layer not found: {layer}")
        return FileResponse(path, media_type="application/geo+json")

    return app


def _or_404(fn):
    try:
        return fn()
    except ContentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


app = create_app()
