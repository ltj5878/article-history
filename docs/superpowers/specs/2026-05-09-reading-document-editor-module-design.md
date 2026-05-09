# Reading Document Editor Module Design

## Goal

Add an administrator-only reading document editor Module so existing chapters and articles can be inspected and updated after import.

## Problem

The admin Module can create book metadata, add a basic chapter, and import a JSON package. It cannot edit an existing reading document. That makes the admin workflow shallow: correcting a paragraph, entity, route, or article section requires re-importing an entire package.

## Scope

- Add admin endpoints for listing reading units under a book.
- Add admin endpoints for reading and replacing a single reading document.
- Keep the public reader Interface unchanged.
- Validate that edited documents keep the same `id` as the reading unit being edited.
- Update reading unit summary fields from the edited document.
- Add a compact JSON editor in the admin panel.

## Out Of Scope

- WYSIWYG paragraph editing.
- Visual entity tagging.
- Visual route drawing.
- Draft/publish workflow.
- Audit history.

## Backend Interface

New admin endpoints:

- `GET /api/admin/books/{book_id}/units`
- `GET /api/admin/books/{book_id}/units/{kind}/{unit_id}`
- `PUT /api/admin/books/{book_id}/units/{kind}/{unit_id}`

`kind` is `chapter` or `article`.

Update payload:

```json
{
  "document": {
    "id": "intro",
    "title": "导读",
    "paragraphs": []
  }
}
```

The Module rejects payloads where `document.id` does not match `{unit_id}`.

## Frontend Interface

The admin panel shows a reading document editor for the selected book:

- unit selector
- load document JSON
- JSON textarea
- save action

Successful save refreshes public reader data.

## Tests

- Admin can list units for a book.
- Admin can get and update a chapter document.
- Public reader endpoints reflect the update.
- Mismatched document IDs are rejected.
- Regular users cannot use editor endpoints.
- Frontend admin client covers list/get/update document calls.
