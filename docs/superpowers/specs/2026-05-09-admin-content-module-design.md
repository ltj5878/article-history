# Admin Content Module Design

## Goal

Add an administrator-only content maintenance Module so 经史舆图 can grow beyond hard-coded seed data. This phase lets an administrator create and update book metadata and add basic chapter content through the Python backend and a minimal React admin panel.

## Scope

Included:

- Add admin-protected backend endpoints for book metadata maintenance.
- Add admin-protected backend endpoints for adding basic chapter documents.
- Reuse the existing `require_admin` dependency from the identity Module.
- Keep all writes in the existing SQLAlchemy content tables.
- Add a compact React admin panel visible only to signed-in admin users.
- Let admins create a book and add a simple chapter with original text and optional translation.
- Refresh the public reader data after admin writes so new content appears without restarting.
- Add backend and frontend tests for admin content flows.

Not included:

- Rich entity editing.
- Route editing.
- Historical period editing.
- Article/section editor.
- Draft/publish workflow.
- File import UI.
- Multi-admin audit history.

## Backend Interface

New admin endpoints:

- `GET /api/admin/books`
- `POST /api/admin/books`
- `PATCH /api/admin/books/{book_id}`
- `DELETE /api/admin/books/{book_id}`
- `POST /api/admin/books/{book_id}/chapters`

All endpoints require an active admin token. Regular users receive `403`; missing or invalid tokens receive `401`.

## Data Shape

Book create/update fields:

- `id`
- `title`
- `bookSeries`
- `dynasty`
- `author`
- `description`

Chapter create fields:

- `id`
- `title`
- `subtitle`
- `year`
- `period`
- `original`
- `translation`

The chapter endpoint stores a frontend-compatible document:

```json
{
  "id": "chapter-id",
  "title": "Chapter Title",
  "subtitle": "Subtitle",
  "year": -500,
  "period": "spring_autumn_mid",
  "paragraphs": [
    {
      "id": "p1",
      "original": "original text",
      "translation": "translation text",
      "entities": [],
      "routes": []
    }
  ]
}
```

## Frontend Interface

The existing top navigation gains an admin entry only when `auth.user.role === "admin"`.

The admin panel supports:

- List current books.
- Create a book.
- Edit selected book metadata.
- Delete selected book.
- Add a basic chapter to selected book.

The panel is intentionally compact and modal-like. It does not replace the reader view or introduce a router.

## Testing

Backend tests cover:

- Admin can create/list/update/delete books.
- Regular user cannot access admin content endpoints.
- Admin can add a chapter, and public `/api/books/{id}` and `/api/books/{id}/chapters/{chapter_id}` reflect it.
- Duplicate book IDs are rejected.

Frontend tests cover:

- Admin client sends Bearer token.
- Admin client creates book payloads.
- Admin client surfaces backend errors.

Build verification covers the React panel.

## Follow-Up

After this phase:

1. Add richer editors for paragraph entities and route points.
2. Add historical period editing.
3. Add draft/publish and audit history.
