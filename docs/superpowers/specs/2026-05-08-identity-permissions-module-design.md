# Identity and Permissions Module Design

## Goal

Add a secure identity and permissions Module for 经史舆图 so the system can support registration, login, current-user lookup, and administrator-only backend Interfaces before the administrator content workflow is built.

## Scope

Included:

- Add user persistence to the Python backend.
- Add registration, login, and current-user endpoints.
- Hash passwords with Argon2id through a maintained password hashing library.
- Issue short-lived JWT access tokens signed with `JWT_SECRET`.
- Add a reusable administrator permission dependency for future admin routes.
- Add a small React login/register entry point that stores the token in `sessionStorage` and sends it as a Bearer token.
- Add tests for registration, duplicate email rejection, login success/failure, authenticated user lookup, and administrator-only access.

Not included:

- Email verification.
- Password reset.
- OAuth or third-party login.
- Refresh tokens.
- Logout token denylist.
- Administrator content maintenance UI.
- Production secret management.

## Security Baseline

The implementation follows these constraints:

- Passwords are never stored in plaintext.
- Passwords are hashed with Argon2id, aligning with OWASP password storage guidance to prefer memory-hard password hashing.
- JWT payloads contain only `sub`, `role`, `iat`, and `exp`.
- Access tokens expire after a short configurable duration; default is 30 minutes.
- The signing key comes from `JWT_SECRET`; the backend refuses non-test token issuance if the secret is missing.
- Tokens are sent as `Authorization: Bearer <token>`.
- The frontend stores the token in `sessionStorage`, not persistent `localStorage`, to reduce long-lived browser exposure in this phase.

## Backend Interface

New public endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Temporary verification endpoint for tests and future admin work:

- `GET /api/admin/ping`

`/api/admin/ping` returns a small success payload only for active users whose role is `admin`. It is deliberately not a product feature; it proves the permission seam works before administrator content routes are added.

## Data Model

Add a `users` table:

- `id`: string UUID primary key.
- `email`: normalized lowercase unique email.
- `password_hash`: Argon2id hash string.
- `role`: `user` or `admin`.
- `is_active`: boolean.
- `created_at`: timestamp.

The first registered account is not automatically admin. Admin promotion remains a database operation for now, which avoids accidentally granting administrator rights through public registration.

## Frontend Interface

Add `app/src/api/authClient.js`:

- `register(email, password)`
- `login(email, password)`
- `me()`
- `logout()`
- `getToken()`

The client stores only the token and current user snapshot in `sessionStorage`. It attaches the Bearer token to auth requests that need it.

Add a compact auth control to the existing top navigation:

- Signed out: shows a single login/register control.
- Signed in: shows email and role, plus logout.

The UI stays intentionally small because full account/profile pages are not part of this phase.

## Errors

Backend error behavior:

- Duplicate registration returns `409`.
- Invalid email/password input returns `422`.
- Bad login returns `401` with a generic message.
- Missing or invalid token returns `401`.
- Inactive user returns `401`.
- Non-admin access to admin Interface returns `403`.

Frontend behavior:

- Show concise inline auth errors in the login/register form.
- Do not expose backend exception details.

## Testing

Backend tests cover the identity Interface:

- Registration creates a user and does not leak `password_hash`.
- Password hashes verify but do not equal the raw password.
- Duplicate email registration is rejected.
- Login returns a bearer token for valid credentials.
- Login rejects wrong passwords with `401`.
- `/api/auth/me` returns the authenticated user.
- `/api/admin/ping` rejects regular users and accepts admin users.

Frontend tests cover the auth client:

- Login stores token and user in `sessionStorage`.
- Authenticated requests include the Bearer token.
- Logout clears session storage.
- Register surfaces backend errors.

## Follow-Up

After this Module is working:

1. Build the administrator content maintenance Module using the admin permission dependency.
2. Add production secret handling and deploy-time checks.
3. Add password reset and email verification if public accounts become important.
