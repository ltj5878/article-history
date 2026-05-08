# Content Data Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python/Postgres-ready backend for 经史舆图 reading content while preserving the existing React reading experience.

**Architecture:** Add a FastAPI backend under `backend/` with a repository Interface over SQLAlchemy models. Seed the database from the current generated static JSON, then update the frontend data Adapter to call `VITE_API_BASE_URL` with static JSON fallback.

**Tech Stack:** Python 3, FastAPI, SQLAlchemy, pytest, React/Vite, Node test runner.

---

## File Structure

- Create `backend/requirements.txt`: backend runtime and test dependencies.
- Create `backend/api/__init__.py`: package marker.
- Create `backend/api/database.py`: engine/session creation and database initialization.
- Create `backend/api/models.py`: SQLAlchemy tables for content data.
- Create `backend/api/repository.py`: deep content repository Interface returning frontend-compatible JSON.
- Create `backend/api/seed.py`: seed command that reads `app/public/data`.
- Create `backend/api/app.py`: FastAPI routes matching the existing public reading Interface.
- Create `backend/tests/test_content_api.py`: backend Interface tests using SQLite.
- Modify `app/src/api/client.js`: API backend Adapter with static fallback.
- Create `app/src/api/client.test.mjs`: frontend Adapter tests.
- Modify `app/package.json`: add a test script for existing and new Node tests.
- Modify `start.sh`: add Python backend start path while keeping frontend-only mode.
- Modify `README.md`: document the new backend path and transition mode.

## Task 1: Backend Skeleton and Health Interface

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/api/__init__.py`
- Create: `backend/api/database.py`
- Create: `backend/api/models.py`
- Create: `backend/api/repository.py`
- Create: `backend/api/app.py`
- Test: `backend/tests/test_content_api.py`

- [ ] **Step 1: Write the failing health test**

```python
from fastapi.testclient import TestClient

from api.app import create_app
from api.database import init_db, session_scope
from api.repository import ContentRepository


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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_content_api.py::test_health_reports_empty_database -v`

Expected: FAIL because `api.app` does not exist.

- [ ] **Step 3: Add minimal backend skeleton**

Implement:

- `requirements.txt` with `fastapi`, `uvicorn`, `sqlalchemy`, `psycopg[binary]`, `pytest`, `httpx`.
- `database.py` with `make_engine(db_url)`, `init_db(db_url)`, and `session_scope(db_url)`.
- `models.py` with `Book`, `ReadingUnit`, and `Period` tables only for the first health count.
- `repository.py` with `health()`.
- `app.py` with `create_app(db_url=None)` and `GET /api/health`.

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_content_api.py::test_health_reports_empty_database -v`

Expected: PASS.

## Task 2: Persist and Serve Books, Reading Units, and Documents

**Files:**
- Modify: `backend/api/models.py`
- Modify: `backend/api/repository.py`
- Modify: `backend/api/app.py`
- Test: `backend/tests/test_content_api.py`

- [ ] **Step 1: Write failing tests for seeded content endpoints**

Add tests that seed one chapter book and one article book through repository methods, then assert:

- `GET /api/books` returns list metadata.
- `GET /api/books/{book_id}` returns chapter or article summaries.
- `GET /api/books/{book_id}/chapters/{chapter_id}` returns the full chapter document.
- `GET /api/books/{book_id}/articles/{article_id}` returns the full article document.
- Unknown IDs return `404`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_content_api.py -v`

Expected: FAIL because repository seeding and endpoints are not implemented.

- [ ] **Step 3: Implement content storage**

Extend models:

- `ReadingUnit` stores `id`, `book_id`, `kind`, `title`, `subtitle`, `year`, `year_start`, `year_end`, `position`, `document_json`.
- `Book` stores `era_events_json`.

Extend repository:

- `replace_all_content(payload)`.
- `list_books()`.
- `get_book(book_id)`.
- `get_chapter(book_id, chapter_id)`.
- `get_article(book_id, article_id)`.

Extend routes with the public reading Interface.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_content_api.py -v`

Expected: PASS.

## Task 3: Persist and Serve Historical Periods

**Files:**
- Modify: `backend/api/models.py`
- Modify: `backend/api/repository.py`
- Modify: `backend/api/app.py`
- Test: `backend/tests/test_content_api.py`

- [ ] **Step 1: Write failing period endpoint tests**

Add tests for:

- `GET /api/maps/period/{period_id}` returns `label`, `states`, and `cities`.
- Unknown period returns `404`.
- `/api/health` reports seeded period IDs.

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_content_api.py -v`

Expected: FAIL because period storage and route are incomplete.

- [ ] **Step 3: Implement period storage**

Use `Period.data_json` to preserve the current frontend-compatible map shape in this phase.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_content_api.py -v`

Expected: PASS.

## Task 4: Seed from Current Static JSON

**Files:**
- Create: `backend/api/seed.py`
- Test: `backend/tests/test_content_api.py`

- [ ] **Step 1: Write failing seed test**

Add a test that creates a miniature `data/` directory with:

- `books.json`
- `books/zuozhuan.json`
- `books/zuozhuan/changshao.json`
- `periods/spring_autumn_mid.json`

Then call `seed_from_static_data(db_url, data_dir)` and assert the API returns the seeded book, chapter, and period.

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_content_api.py -v`

Expected: FAIL because `api.seed` does not exist.

- [ ] **Step 3: Implement seed command**

Implement:

- `load_static_data(data_dir)` to read static JSON.
- `seed_from_static_data(db_url, data_dir)` to call `ContentRepository.replace_all_content`.
- CLI entrypoint: `python -m api.seed --db-url "$DATABASE_URL" --data-dir app/public/data`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_content_api.py -v`

Expected: PASS.

## Task 5: Frontend Data Adapter

**Files:**
- Modify: `app/src/api/client.js`
- Create: `app/src/api/client.test.mjs`
- Modify: `app/package.json`

- [ ] **Step 1: Write failing Adapter tests**

Tests should mock `globalThis.fetch` and assert:

- Without API base URL, `listBooks()` fetches `/data/books.json`.
- With API base URL, `listBooks()` fetches `<base>/api/books`.
- With API base URL and failed API response, `listBooks()` falls back to `/data/books.json`.
- `geoUrl("china_provinces")` returns API or static URL according to config.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- src/api/client.test.mjs`

Expected: FAIL because the client cannot be configured and has no API fallback.

- [ ] **Step 3: Implement configurable Adapter**

Export `createApiClient({ apiBaseUrl, staticBaseUrl, fetchImpl })` and keep `export const api = createApiClient(...)` for the app.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npm test -- src/api/client.test.mjs`

Expected: PASS.

## Task 6: Local Run Script and Docs

**Files:**
- Modify: `start.sh`
- Modify: `README.md`

- [ ] **Step 1: Add smoke checks**

Run existing shell syntax check before editing:

`bash -n ./start.sh`

- [ ] **Step 2: Update run script**

Add Python backend commands:

- `start-python-backend`
- `stop-python-backend`
- `restart-python-backend`

Keep `start` as frontend-only so the existing workflow remains stable.

- [ ] **Step 3: Update README**

Document:

- React remains the frontend stack.
- Python backend is the new content backend.
- Static JSON fallback remains during transition.
- How to install backend dependencies, seed data, and run backend locally.

- [ ] **Step 4: Verify**

Run:

- `bash -n ./start.sh`
- `cd app && npm test`
- `PYTHONPATH=backend python3 -m pytest backend/tests/test_content_api.py -v`

Expected: all pass.
