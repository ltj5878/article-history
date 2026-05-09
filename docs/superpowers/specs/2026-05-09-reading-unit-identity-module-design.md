# Reading Unit Identity Module Design

## Goal

Deepen the reading unit identity Module so public chapter/article IDs are scoped by book instead of globally unique across the whole database.

## Problem

`ReadingUnit.id` currently serves two jobs:

- public content ID used by frontend routes: `/api/books/{book_id}/chapters/{chapter_id}`
- database primary key

That makes the Module shallow. Callers have to know a database constraint that does not belong in the public Interface: two different books cannot both have a natural chapter ID like `intro` or `preface`.

## Scope

- Change `reading_units` to use a surrogate database primary key.
- Preserve the public Interface: book ID + reading unit ID.
- Add a unique constraint on `(book_id, id)`.
- Update repository/admin/import logic to query by `(book_id, id, kind)`.
- Add a lightweight schema migration Module for existing local SQLite databases.
- Update docs and tests.

## Out Of Scope

- Full Alembic migration history.
- Normalizing paragraphs/entities/routes into separate tables.
- Postgres production migration automation for an already-populated remote database. Fresh Postgres deployments get the new schema through `create_all`; remote migration automation belongs to the next schema-management cut if needed.

## Interface

The application Interface remains:

- `GET /api/books/{book_id}/chapters/{chapter_id}`
- `GET /api/books/{book_id}/articles/{article_id}`
- content package import with book-scoped reading unit IDs
- admin add chapter with book-scoped reading unit IDs

The database Implementation changes:

- `reading_units.pk` is the primary key.
- `reading_units.id` is the public reading unit ID.
- `UNIQUE(reading_units.book_id, reading_units.id)` enforces book-local uniqueness.

## Local Migration

`init_db()` calls a schema migration Module after `create_all()`.

For SQLite databases with legacy `reading_units(id PRIMARY KEY, book_id, ...)`, the migration rebuilds the table into the new shape and preserves existing rows.

## Tests

- Fresh schema has `pk` and unique `(book_id, id)`.
- Legacy SQLite table is migrated without losing rows.
- Two different books can use the same chapter ID.
- The same book cannot reuse a chapter ID.
- Content import can import two books with the same reading unit ID.
