# Phase X2: Full-Stack E2E (Playwright)

**Goal:** a small number of **business journeys** run against the real stack (Postgres, built backend, built consumer and admin, real browser). They prove that the pieces work
together and that an action in one screen shows up in the others: a POS sale moves the dashboard,
EOD, stock and the sales list.

Keep this suite **small (≤ 15 tests)**. Everything provable at a lower level belongs in B3–B5/C2–C4.

**Depends on:** B3, C4 (and A2 for J4). **Location:** `e2e/` at the repo root (own `package.json`).

---

## 1. Setup
```bash
mkdir e2e && cd e2e
npm init -y
npm i -D @playwright/test@^1.64 pg@^8 dotenv@^18
npx playwright install --with-deps chromium
```
Chromium only. The POS runs on desktop browsers, so Firefox/WebKit add cost for little signal.
Add them later only if a browser-specific bug shows up.

### 1.1 Environment (`e2e/.env.e2e`, committed, test-only values)
```
DATABASE_URL=postgresql://test:test@localhost:55433/posbuzz_e2e?schema=public
DB_HOST=localhost
DB_PORT=55433
DB_USERNAME=test
DB_PASSWORD=test
DB_NAME=posbuzz_e2e
REDIS_ENABLED=false
RABBITMQ_ENABLED=false
BUSINESS_TIMEZONE=Asia/Dhaka
JWT_SECRET_KEY=e2e-jwt-secret-not-for-prod-0123456789
CSRF_SECRET_KEY=REDACTED_SECRET
JWT_EXPIRATION=30s
JWT_REFRESH_EXPIRATION=1d
NODE_ENV=test
PORT=8000
CORS_ORIGINS=http://*.localhost:3000,http://localhost:3001
FASTAPI_URL=http://127.0.0.1:9
```
`JWT_EXPIRATION=30s` is deliberate. Journeys longer than 30 s exercise the silent refresh path (J5).
`NODE_ENV=test` (not `production`) because `configService.isProduction` enables CSP
`upgrade-insecure-requests`, which breaks plain-http E2E.

### 1.2 Infra: `docker-compose.e2e.yml` (repo root)
`postgres:17-alpine` → 55433 with a `tmpfs` data dir (Redis/RabbitMQ are off by default, same as production; D-008). Distinct ports from `docker-compose.test.yml` so both can run at once.

### 1.3 `e2e/scripts/prepare.sh`
1. `docker compose -f ../docker-compose.e2e.yml up -d --wait`
2. Backend: `cd ../backend && npm ci && npx prisma generate && npx prisma migrate reset --force --skip-seed`
   (env from `.env.e2e`), then `npx tsx prisma/seed.ts`. The seed creates tenant subdomain
   **`consumer1`** with user **`consumer@example.com` / `PosBuzz!234`** and super-admin
   **`superadmin@posbuzz.cloud` / `PosBuzz!234`** (same hash), then `npm run build`.
3. Consumer: `cd ../consumer && npm ci && VITE_API_BASE_URL=http://localhost:8000/api/v1 npm run build`.
   Vite env vars are baked in at build time, so set them on the command line. That overrides `.env` files.
4. Admin: same with its base-URL convention (see admin A1 notes; use the value recorded in DECISIONS.md).

### 1.4 `e2e/playwright.config.ts`
```ts
import { defineConfig, devices } from "@playwright/test";
import "dotenv/config"; // load .env.e2e via DOTENV_CONFIG_PATH=.env.e2e in scripts

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,                       // journeys share one DB; stock assertions need isolation
  retries: process.env.CI ? 1 : 0,  // 1 retry in CI ONLY to collect a trace; a retried pass is reported as "flaky" and must be fixed (see §4)
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    timezoneId: "Asia/Dhaka",
    locale: "en-US",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "npm run start:prod --prefix ../backend", url: "http://localhost:8000/api/v1/health", reuseExistingServer: !process.env.CI, timeout: 120_000, env: { ...process.env } as Record<string,string> },
    { command: "npm run preview --prefix ../consumer", url: "http://localhost:3000", reuseExistingServer: !process.env.CI },
    { command: "npm run preview --prefix ../admin", url: "http://localhost:3001", reuseExistingServer: !process.env.CI },
  ],
});
```
Scripts in `e2e/package.json`: `"prepare:stack": "bash scripts/prepare.sh"`,
`"test": "DOTENV_CONFIG_PATH=.env.e2e playwright test"`.

### 1.5 Cookies and subdomains (read before debugging login)
- Consumer URL: **`http://consumer1.localhost:3000`**. Chromium resolves `*.localhost` to loopback,
  so no `/etc/hosts` edits are needed.
- The API at `http://localhost:8000` sets cookies `Secure; SameSite=None`. Chromium treats
  `localhost` as a secure context, so these cookies are accepted over http.
- **If login succeeds (200) but the next request is 401** (cookies not stored or not sent), use this
  fallback ladder and log which step worked:
  1. Run Chromium with `launchOptions: { args: ["--disable-features=ThirdPartyStoragePartitioning,TrackingProtection3pcd"] }` (third-party cookie restrictions).
  2. Put a same-site TLS proxy in front: add a `caddy:2-alpine` service to `docker-compose.e2e.yml` with
     `tls internal` serving `https://consumer1.localhost:3443` → consumer preview and
     `https://api.localhost:8443` → backend. Set `ignoreHTTPSErrors: true` and rebuild the frontends
     with `VITE_API_BASE_URL=https://api.localhost:8443/api/v1`, and adjust `CORS_ORIGINS`.
     This mirrors production (separate HTTPS origins) most closely.

### 1.6 Helpers (`e2e/support/`)
- `db.ts`: a `pg` client on `DATABASE_URL` for **read-only** assertions (stock, sale rows). Never write
  through it, because journeys must create data through the UI/API.
- `api.ts`: `request.newContext()` with login (csrf → login) for **fast setup** (creating products,
  stock, customers via API). UI is used only for the step under test.
- `fixtures.ts`: Playwright test fixtures `consumerPage` (logged in as `consumer@example.com` on
  `consumer1`), `adminPage`, `api`.
- Unique names per test: `` `E2E ${testInfo.title} ${Date.now()}` ``.

## 2. Journeys
| ID | Journey | Must observe |
|---|---|---|
| E2E-J0 | Login → dashboard → logout → protected URL redirects to `/login` | cookies set; CSRF flow works end to end |
| E2E-J1 | **The cross-screen journey.** API: create product X (price 100, 5% EXCL) + batch qty 10. Read baseline numbers from the dashboard (today total sale), EOD total, and X's stock. UI (POS): sell X ×2, CASH. Then visit dashboard, EOD, sales list, inventory | dashboard today total **+210.00**; EOD total +210.00; sales list top row 210.00; X stock 8 (UI and DB); DB has a `SALE_OUT` audit row. **Visit the dashboard without a hard reload** (in-app navigation) to catch stale cache (KI-011 regression) |
| E2E-J2 | From J1's sale: return 1×X with CASH refund (UI) | stock 9; dashboard today refunds +105.00, net sale −105.00; sale view shows the return; EOD `total_refund` +105.00 |
| E2E-J3 | Sale paid partially (POS: pay 100 of 210) → partial-payments page → pay 110 | sale status partial → paid; dashboard `today_collected`/EOD `due_collected` reflect it |
| E2E-J4 | **Admin → consumer permission propagation:** admin UI removes `sales` from the seeded plan (and role if required by the model, per BE-ADM-001 findings) → consumer reloads | POS menu hidden; `/pos` redirects; direct API call `GET /consumer/sales` → 403. Restore the permission at the end (in `afterEach`, via API) |
| E2E-J5 | Stay idle 35 s (beyond `JWT_EXPIRATION=30s`) on POS, then add an item and sell | silent refresh: exactly one refresh request (count via `page.on("request")`), sale succeeds, user not bounced to login |
| E2E-J6 | Logged in on `consumer1`, open `http://consumer2.localhost:3000` (create tenant 2 via admin API in setup) | not authenticated as tenant 1 there; API calls return 401 'subdomain does not match' and cookies get cleared |
| E2E-J7 | Admin/consumer creates a 10% promotion on X (consumer promotions UI) → POS sale of X ×1 | promotion shown in "Available Promotions"; discount 10.00 applied; promotion sales report count +1 |
| E2E-J8 | Inventory transfer X ×3 Main → Second, complete | stock per branch updated in UI and DB (`TRANSFER_OUT`/`TRANSFER_IN`) |
| E2E-J9 | Quotation for X ×2 → convert to sale | quotation marked converted; stock −2 only after conversion |
| E2E-J11 | POS checkout after an admin changes a product's price while the POS page is open | checkout gets 400 'Price … has changed. Refresh…' (KI-005 fix); after refresh, sale succeeds at the new price |
| E2E-J10 | Print agent offline: auto-print on, sale completes | sale saved; non-blocking warning shown (stub the agent URL to an unused port) |

## 3. CI
```yaml
  e2e:
    name: Full-stack E2E
    runs-on: ubuntu-latest
    needs: [backend-integration, consumer-tests]
    timeout-minutes: 30
    defaults: { run: { working-directory: e2e } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run prepare:stack
      - run: npm test
        env: { CI: "true" }
      - if: failure()
        uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: e2e/playwright-report, retention-days: 14 }
```

## 4. Flake policy (strict)
- A test that passes only on retry is **flaky**. The CI log marks it. Treat it as a failure to
  investigate within 2 working days (DECISION-PLAYBOOK §4).
- Never use `page.waitForTimeout`. Use web-first assertions, `expect.poll` for DB checks, and
  `page.waitForResponse` for network.
- Each journey sets up its own data via API and asserts **deltas** from baselines it read itself, so
  tests don't depend on run order or leftover data.

## Exit criteria
- [ ] J0–J10 green.
- [ ] Suite < 10 min in CI.
- [ ] Proof: comment out stock decrement in `sales.service.ts#create` locally → J1 fails (plus B3). Revert.
