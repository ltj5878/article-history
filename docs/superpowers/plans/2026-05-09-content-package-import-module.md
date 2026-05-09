# Content Package Import Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or follow this checklist task-by-task in the current session.

**Goal:** Add an admin-only JSON content package import path that can upsert books and replace their reading units without clearing the whole database.

**Architecture:** Add a dedicated import Module behind a small backend Interface. Keep package validation and database mutation in one place, expose one admin endpoint, then add a frontend Adapter method and admin-panel form.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy, React/Vite, Node test runner.

---

## File Structure

- Create `backend/api/content_import.py`: package schema, validation, and importer repository.
- Modify `backend/api/app.py`: add `POST /api/admin/import`.
- Create `backend/tests/test_content_import_api.py`: import endpoint tests.
- Modify `app/src/api/adminClient.js`: add `importPackage`.
- Modify `app/src/api/adminClient.test.mjs`: cover import payload and errors.
- Modify `app/src/components/AdminPanel.jsx`: add package import form.
- Modify `app/src/App.css`: import form styles as needed.
- Modify `README.md`: document content package shape.

## Task 1: Backend Import Interface

- [ ] Write failing tests for admin import, re-import replace behavior, cross-book unit ID collision, and regular-user rejection.
- [ ] Implement content package Pydantic models.
- [ ] Implement importer repository that upserts books and replaces only imported books' reading units.
- [ ] Add `POST /api/admin/import`.
- [ ] Run backend import, admin, auth, and content tests; expect PASS.

## Task 2: Frontend Adapter

- [ ] Add failing admin client test for `importPackage`.
- [ ] Implement `adminClient.importPackage`.
- [ ] Run frontend API tests; expect PASS.

## Task 3: Admin UI

- [ ] Add JSON textarea import form to `AdminPanel`.
- [ ] Parse JSON locally and surface parse errors before calling the backend.
- [ ] Refresh admin/public content after successful import.
- [ ] Run frontend tests and production build; expect PASS.

## Task 4: Docs and Verification

- [ ] Update README with package example and current import limits.
- [ ] Run backend tests.
- [ ] Run frontend tests.
- [ ] Run frontend build.
- [ ] Run `bash -n ./start.sh`.
- [ ] Use Playwright snapshot to check the admin import form.
- [ ] Commit with `feat: add content package import`.
