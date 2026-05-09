# Reading Document Editor Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or follow this checklist task-by-task in the current session.

**Goal:** Add admin read/update endpoints and UI for existing chapter/article document JSON.

**Architecture:** Extend the existing admin content Module with a deeper reading document Interface. Keep document validation and summary-field synchronization in the backend repository so frontend callers only send one document payload.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, React/Vite, Node test runner.

---

## File Structure

- Modify `backend/api/admin_content.py`: reading unit list/get/update models and methods.
- Modify `backend/api/app.py`: add admin unit routes.
- Modify `backend/tests/test_admin_content_api.py`: editor endpoint tests.
- Modify `app/src/api/adminClient.js`: add list/get/update document methods.
- Modify `app/src/api/adminClient.test.mjs`: client tests.
- Modify `app/src/components/AdminPanel.jsx`: add document JSON editor.
- Modify `app/src/App.css`: document editor textarea styles.
- Modify `README.md`: document editor endpoints and limits.

## Task 1: Backend Editor Interface

- [x] Write failing tests for list/get/update reading units, ID mismatch rejection, and regular user rejection.
- [x] Implement admin repository methods.
- [x] Add FastAPI routes.
- [x] Run backend admin tests; expect PASS.

## Task 2: Frontend Adapter

- [x] Add failing admin client tests for list/get/update document calls.
- [x] Implement client methods.
- [x] Run frontend tests; expect PASS.

## Task 3: Admin UI

- [x] Add reading unit selector and JSON textarea to `AdminPanel`.
- [x] Parse JSON locally and surface parse errors before calling backend.
- [x] Refresh public data after save.
- [x] Run build; expect PASS.

## Task 4: Docs and Verification

- [x] Update README with editor endpoints.
- [x] Run backend tests.
- [x] Run frontend tests.
- [x] Run frontend build.
- [x] Run `bash -n ./start.sh`.
- [x] Use Playwright snapshot to check the editor form.
- [x] Commit with `feat: add reading document editor`.
