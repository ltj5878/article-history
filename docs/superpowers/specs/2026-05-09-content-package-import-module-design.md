# Content Package Import Module Design

## Goal

Add an administrator-only content package import Module so 经史舆图 can grow by importing structured book data into the database without editing frontend source files or replacing the entire content database.

## Scope

- Add a validated JSON package shape for importing one or more books.
- Support book-level upsert: importing a book creates or updates its metadata and replaces that book's reading units.
- Preserve all other books, users, periods, and geo data.
- Reuse the existing administrator permission Module.
- Expose a compact admin backend Interface and frontend Adapter.
- Add a small admin UI path for pasting/importing a package.
- Document the package shape.

## Out Of Scope

- Rich WYSIWYG content editing.
- Entity and route visual editors.
- File uploads and attachment storage.
- Automatic OCR, NLP annotation, or translation.
- Database migrations for changing `ReadingUnit.id` away from a global primary key. This was handled later by the Reading Unit Identity Module.

## Backend Interface

New endpoint:

- `POST /api/admin/import`

The endpoint requires an active admin token. It accepts:

```json
{
  "books": [
    {
      "id": "guoyu",
      "title": "国语",
      "bookSeries": "国别体",
      "dynasty": "春秋",
      "author": "左丘明",
      "description": "春秋国别史料汇编",
      "eraEvents": [],
      "chapters": [
        {
          "id": "guoyu-zhouyu",
          "title": "周语",
          "subtitle": "敬王问治",
          "year": -520,
          "period": "spring_autumn_late",
          "paragraphs": [
            {
              "id": "p1",
              "original": "敬王问于史伯。",
              "translation": "周敬王向史伯询问政事。",
              "entities": [],
              "routes": []
            }
          ]
        }
      ]
    }
  ]
}
```

The importer returns counts:

```json
{
  "booksImported": 1,
  "readingUnitsImported": 1
}
```

## Module Invariants

- A package must contain at least one book.
- A book can contain chapters, articles, or both.
- Reading unit IDs must be unique within each book. Different books can reuse the same reading unit ID.
- Re-importing the same book replaces that book's previous reading units atomically.
- Imported documents keep the frontend-compatible shape already returned by public reader endpoints.

## Frontend Interface

The existing admin panel gains an import form with a JSON textarea and an "导入内容包" action. The frontend Adapter sends the package to `/api/admin/import`, then refreshes the admin list and public reader data after a successful import.

## Tests

- Admin can import a new book package and public reader endpoints can fetch it.
- Re-importing the same book replaces stale reading units.
- Import rejects reading-unit ID collisions across different books.
- Regular users cannot import.
- Frontend admin client sends import payloads and surfaces errors.
