# Deployment Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or follow this checklist task-by-task in the current session.

**Goal:** Add deployment readiness checks and static frontend deployment hardening without coupling the backend to one hosting vendor.

**Architecture:** Keep deployment knowledge behind a small backend Module and a CLI command. `app.py`, `start.sh`, Netlify config, and docs consume that Interface instead of duplicating environment rules.

**Tech Stack:** FastAPI, Python stdlib, pytest, Netlify static config, Bash.

---

## File Structure

- Create `backend/api/deployment.py`: pure deployment report/check logic.
- Create `backend/api/deploy_check.py`: CLI wrapper with JSON output and exit codes.
- Create `backend/tests/test_deployment_api.py`: unit/route/CLI tests.
- Modify `backend/api/app.py`: add readiness route.
- Modify `start.sh`: add a deploy check command.
- Modify `netlify.toml`: add static headers and Node version.
- Modify `README.md`: document deployment environment variables and check command.

## Task 1: Backend Readiness Module

- [x] Write failing tests for default-not-ready and production-ready environment reports.
- [x] Implement `deployment_report` and `deployment_is_ready`.
- [x] Run deployment tests; expect PASS.

## Task 2: Route and CLI

- [x] Add failing tests for `/api/deployment/readiness` and `python -m api.deploy_check`.
- [x] Implement readiness route and CLI.
- [x] Run deployment tests; expect PASS.

## Task 3: Frontend/Local Integration

- [x] Add Netlify build environment and static security/cache headers.
- [x] Add `./start.sh check-deploy`.
- [x] Update README with frontend and backend deployment variables.

## Task 4: Verification

- [x] Run backend tests.
- [x] Run frontend tests.
- [x] Run frontend build.
- [x] Run `bash -n ./start.sh`.
- [x] Run `PYTHONPATH=backend backend/.venv/bin/python -m api.deploy_check` and confirm it fails on local dev defaults.
- [x] Run the same check with production-like env and confirm it passes.
- [x] Commit with `feat: add deployment readiness module`.
