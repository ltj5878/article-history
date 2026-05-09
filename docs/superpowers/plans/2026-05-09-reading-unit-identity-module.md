# Reading Unit Identity Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or follow this checklist task-by-task in the current session.

**Goal:** Change reading unit database identity from globally unique public IDs to surrogate database IDs plus book-scoped public IDs.

**Architecture:** Keep the public content Interface unchanged. Concentrate database compatibility in a small migration Module and repository query helpers so callers never depend on `ReadingUnit.id` being globally unique.

**Tech Stack:** SQLAlchemy, SQLite-compatible migration SQL, FastAPI tests.

---

## File Structure

- Modify `backend/api/models.py`: add `ReadingUnit.pk` and unique `(book_id, id)`.
- Create `backend/api/schema.py`: lightweight schema migration helpers.
- Modify `backend/api/database.py`: run schema migration from `init_db`.
- Modify `backend/api/admin_content.py`: duplicate checks scoped by book.
- Modify `backend/api/content_import.py`: allow same unit ID across different imported books.
- Modify tests:
  - `backend/tests/test_schema_migration.py`
  - `backend/tests/test_admin_content_api.py`
  - `backend/tests/test_content_import_api.py`
- Modify `README.md`: remove global reading unit ID warning.

## Task 1: Schema Model and Migration

- [x] Write failing tests for fresh schema and legacy SQLite migration.
- [x] Add `ReadingUnit.pk` and unique `(book_id, id)`.
- [x] Implement SQLite migration for legacy `reading_units`.
- [x] Run schema tests; expect PASS.

## Task 2: Repository Semantics

- [x] Add failing admin test: two books can each add chapter ID `intro`.
- [x] Update admin duplicate check to be book-scoped.
- [x] Run admin/content tests; expect PASS.

## Task 3: Import Semantics

- [x] Change import collision test to allow same unit ID across different books.
- [x] Keep duplicate unit IDs within the same book rejected.
- [x] Update importer validation.
- [x] Run import tests; expect PASS.

## Task 4: Docs and Verification

- [x] Update README with book-scoped reading unit IDs.
- [x] Run backend tests.
- [x] Run frontend tests.
- [x] Run frontend build.
- [x] Run `bash -n ./start.sh`.
- [x] Commit with `feat: scope reading unit identity by book`.
