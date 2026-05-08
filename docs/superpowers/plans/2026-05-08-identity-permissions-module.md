# Identity and Permissions Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure registration, login, current-user lookup, and reusable administrator permission checks.

**Architecture:** Extend the FastAPI backend with a dedicated auth Module over the existing SQLAlchemy database seam. Add a small React auth client and top-nav auth control that stores short-lived access tokens in sessionStorage.

**Tech Stack:** Python 3, FastAPI, SQLAlchemy, pwdlib Argon2id, PyJWT, pytest, React/Vite, Node test runner.

---

## File Structure

- Modify `backend/requirements.txt`: add `pwdlib[argon2]`, `PyJWT`, and `email-validator`.
- Modify `backend/api/models.py`: add `User`.
- Create `backend/api/auth.py`: password hashing, JWT issuing/verification, auth repository, FastAPI dependencies.
- Modify `backend/api/app.py`: add auth routes and admin ping route.
- Create `backend/tests/test_auth_api.py`: backend auth Interface tests.
- Create `app/src/api/authClient.js`: frontend auth Adapter.
- Create `app/src/api/authClient.test.mjs`: auth client tests.
- Modify `app/package.json`: include auth client test in `npm test`.
- Create `app/src/components/AuthControl.jsx`: compact login/register/logout control.
- Modify `app/src/components/TopNav.jsx`: render auth control.
- Modify `app/src/App.jsx`: load auth state and pass auth client state to `TopNav`.
- Modify `app/src/App.css` or `app/src/index.css`: minimal auth control styles.
- Modify `README.md`: document identity endpoints and `JWT_SECRET`.

## Task 1: Backend Auth Dependencies and User Model

- [ ] Write a failing test in `backend/tests/test_auth_api.py` that imports `User` and initializes the DB with the new table.
- [ ] Run `PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/test_auth_api.py -v`; expect import/table failure.
- [ ] Add dependencies and `User` model fields: `id`, `email`, `password_hash`, `role`, `is_active`, `created_at`.
- [ ] Install backend dependencies with `backend/.venv/bin/python -m pip install -r backend/requirements.txt`.
- [ ] Run the test again; expect PASS.

## Task 2: Registration and Login

- [ ] Add failing tests for `POST /api/auth/register`, duplicate registration, valid login, and bad password login.
- [ ] Run the tests; expect auth routes missing.
- [ ] Implement `backend/api/auth.py` with Argon2id password hashing, email normalization, user creation, credential verification, and JWT issuing.
- [ ] Add `/api/auth/register` and `/api/auth/login` in `backend/api/app.py`.
- [ ] Run backend auth tests; expect PASS.

## Task 3: Current User and Admin Permission

- [ ] Add failing tests for `/api/auth/me`, regular-user `/api/admin/ping` rejection, and admin `/api/admin/ping` success.
- [ ] Run tests; expect missing auth dependency behavior.
- [ ] Implement Bearer token extraction, JWT verification, current-user dependency, and admin dependency.
- [ ] Add `/api/auth/me` and `/api/admin/ping`.
- [ ] Run backend auth tests and content tests; expect PASS.

## Task 4: Frontend Auth Client

- [ ] Add failing `app/src/api/authClient.test.mjs` tests for login storage, Bearer header, logout clearing storage, and register error surfacing.
- [ ] Run `cd app && npm test`; expect missing auth client.
- [ ] Implement `createAuthClient` in `app/src/api/authClient.js`.
- [ ] Add test file to `app/package.json`.
- [ ] Run `cd app && npm test`; expect PASS.

## Task 5: Minimal React Auth UI

- [ ] Add `AuthControl.jsx` with a compact signed-out/signed-in control.
- [ ] Wire auth state in `App.jsx` and pass it to `TopNav`.
- [ ] Render `AuthControl` in `TopNav`.
- [ ] Add focused CSS for the auth panel and buttons.
- [ ] Run `cd app && npm test` and `cd app && npm run build`; expect PASS.

## Task 6: Docs and Verification

- [ ] Update README with auth endpoints, `JWT_SECRET`, and development defaults.
- [ ] Run `PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/test_content_api.py backend/tests/test_auth_api.py -v`.
- [ ] Run `cd app && npm test`.
- [ ] Run `cd app && npm run build`.
- [ ] Run `bash -n ./start.sh`.
- [ ] Commit with `feat: add identity permissions module`.
