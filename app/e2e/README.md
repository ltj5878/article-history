# e2e (Playwright)

Opt-in smoke tests. Not wired into the default `npm test`.

## Setup

```bash
npm i -D @playwright/test
npx playwright install chromium
```

## Run

```bash
npm run test:e2e
```

The Playwright config starts the Vite dev server automatically (port 5173).
