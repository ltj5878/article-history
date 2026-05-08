# Content Data Module Design

## Goal

Move the reading content for 经史舆图 from hard-coded frontend build data into a database-backed Python backend, while keeping the existing React frontend and preserving the current reading, map, and timeline behavior.

## Scope

This first phase builds the 经史内容数据 Module only.

Included:

- Add a Python backend that exposes the existing public reading Interface.
- Add a Postgres-compatible schema for books, reading units, sections, paragraphs, entities, routes, historical periods, and geo layer metadata.
- Seed the database from the existing `server/data/*.js` modules through the current static JSON build output, so current content is preserved.
- Update the React frontend data Adapter so it can read from the Python backend and still fall back to static JSON during transition.
- Add tests around the content Interface and frontend Adapter behavior.

Not included in this phase:

- Login and registration.
- Administrator UI.
- Content editing workflows.
- Production deployment to Supabase or any hosting platform.
- Rewriting the frontend from React to Vue.

## Architecture

The new backend is a Python FastAPI app under `backend/`. The external seam is the public reading Interface already used by the frontend:

- `GET /api/health`
- `GET /api/books`
- `GET /api/books/{book_id}`
- `GET /api/books/{book_id}/chapters/{chapter_id}`
- `GET /api/books/{book_id}/articles/{article_id}`
- `GET /api/maps/period/{period_id}`
- `GET /api/geo/{layer}`

The implementation behind that Interface changes from JS modules and generated static JSON to a content repository backed by Postgres. During local development and tests, the backend can use SQLite through the same repository shape so the Interface can be tested without requiring a running Postgres server.

The current Node `server/` remains as source data for the initial seed path only. It is not the long-term backend.

## Data Model

The database represents the domain concepts directly:

- `books`: one classical text collection, such as `shiji` or `zuozhuan`.
- `reading_units`: a public selectable item under a book. Its `kind` is `article` or `chapter`.
- `sections`: ordered subdivisions within an article, or a single implicit section for a chapter.
- `paragraphs`: ordered original text and translation blocks.
- `entities`: people, places, and events attached to paragraphs. Place entities carry coordinates and point-of-interest type.
- `routes`: named map routes attached to paragraphs.
- `route_points`: ordered points inside a route.
- `periods`: historical map periods.
- `period_states`: simplified historical territory polygons.
- `period_cities`: contextual cities shown on the map.
- `geo_layers`: allowed static GeoJSON layer names and source paths.

The repository returns JSON in the same shape that the current frontend already understands. This keeps the first phase focused: the data storage changes, but the reading UI should not have to learn a new content shape yet.

## Seed Strategy

The initial seed uses the existing static data pipeline:

1. Run the current `app/scripts/build-data.mjs` to generate `app/public/data`.
2. The Python seed command reads `books.json`, `books/*.json`, `books/*/*.json`, and `periods/*.json`.
3. The seed command upserts rows into the database with deterministic IDs based on the existing content IDs.

This avoids parsing the JS modules from Python and keeps the migration reversible while the schema settles.

## Frontend Data Flow

`app/src/api/client.js` becomes a small Adapter:

- If `VITE_API_BASE_URL` is set, it calls the Python backend.
- If the backend request fails because the backend is unavailable, it falls back to the existing static JSON paths.
- If `VITE_API_BASE_URL` is not set, it preserves the current static-only behavior.

This lets Netlify continue to serve the current static frontend while the backend is developed and deployed separately.

## Errors

The backend returns structured JSON errors:

- `404` for unknown books, articles, chapters, periods, and geo layers.
- `500` for unexpected repository failures.
- `/api/health` returns database connectivity and content counts.

The frontend keeps the current user-facing loading error behavior for this phase.

## Testing

Backend tests cover the Interface, not implementation details:

- health endpoint returns content counts.
- book listing matches seeded content.
- article and chapter detail endpoints preserve current shape.
- period endpoint returns states and cities.
- unknown IDs return `404`.

Frontend tests cover the Adapter:

- static mode reads `/data/...` paths.
- API mode reads `/api/...` paths.
- API mode falls back to static JSON when the backend is unavailable.

## Follow-Up Phases

After this phase is working:

1. Identity and permissions Module: registration, login, password hashing, sessions/JWT, administrator role checks.
2. Administrator content maintenance Module: draft/publish workflow for books, reading units, paragraphs, entities, routes, and periods.
3. Deployment Module: Netlify frontend, Python backend hosting, Supabase Postgres, migrations, seed data, and environment checks.
