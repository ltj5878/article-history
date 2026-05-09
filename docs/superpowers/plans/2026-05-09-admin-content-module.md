# Admin Content Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add an administrator-only content maintenance path for creating books and basic chapters.

**Architecture:** Reuse the existing `require_admin` backend dependency and existing content tables. Add a small admin repository surface over `Book` and `ReadingUnit`, then expose it through FastAPI and a compact React admin panel.

**Tech Stack:** FastAPI, SQLAlchemy, PyJWT auth dependency, React/Vite, Node test runner.

---

## File Structure

- Create `backend/api/admin_content.py`: admin payload models and repository.
- Modify `backend/api/app.py`: add admin content routes.
- Create `backend/tests/test_admin_content_api.py`: admin content endpoint tests.
- Create `app/src/api/adminClient.js`: frontend admin Adapter.
- Create `app/src/api/adminClient.test.mjs`: admin client tests.
- Create `app/src/components/AdminPanel.jsx`: compact admin panel.
- Modify `app/src/App.jsx`: admin panel state and data refresh.
- Modify `app/src/components/AuthControl.jsx`: admin entry button.
- Modify `app/src/App.css`: admin panel styles.
- Modify `app/package.json`: include admin client test.
- Modify `README.md`: document admin endpoints and current editor limits.

## Task 1: Backend Admin Book Endpoints

- [x] Write failing backend tests for admin create/list/update/delete book and regular-user rejection.
- [x] Run `PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/test_admin_content_api.py -v`; expect missing module/routes.
- [x] Implement `AdminContentRepository` methods for create, list, update, delete book.
- [x] Add FastAPI routes under `/api/admin/books`.
- [x] Run admin tests; expect PASS.

## Task 2: Backend Admin Chapter Endpoint

- [x] Write failing backend test that admin adds a chapter and public book/chapter endpoints reflect it.
- [x] Run admin tests; expect missing route/behavior.
- [x] Implement `add_chapter(book_id, payload)` storing a frontend-compatible chapter document.
- [x] Add `POST /api/admin/books/{book_id}/chapters`.
- [x] Run admin, auth, and content tests; expect PASS.

## Task 3: Frontend Admin Client

- [x] Write failing Node tests for Bearer header, create book payload, add chapter payload, and error surfacing.
- [x] Run `cd app && npm test`; expect missing admin client.
- [x] Implement `createAdminClient` in `app/src/api/adminClient.js`.
- [x] Add test file to `app/package.json`.
- [x] Run frontend tests; expect PASS.

## Task 4: React Admin Panel

- [x] Create `AdminPanel.jsx` with book list, create/update/delete book form, and add chapter form.
- [x] Wire panel open/close in `App.jsx`; show entry only for admin users through `AuthControl`.
- [x] Refresh public data by reloading book list and selected book after admin writes.
- [x] Add scoped CSS.
- [x] Run `cd app && npm test` and `cd app && npm run build`; expect PASS.

## Task 5: Docs and Verification

- [x] Update README with admin endpoints and limitations.
- [x] Run `PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/test_content_api.py backend/tests/test_auth_api.py backend/tests/test_admin_content_api.py -v`.
- [x] Run `cd app && npm test`.
- [x] Run `cd app && npm run build`.
- [x] Run `bash -n ./start.sh`.
- [x] Use Playwright snapshot to check admin entry/panel layout.
- [x] Commit with `feat: add admin content module`.
