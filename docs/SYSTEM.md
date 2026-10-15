# PosBuzz: system overview

The one summary document for people and AI agents. Last updated 2026-10-16.
How to operate the server day to day (log in, deploy/rollback, logs, restore, rotate secrets, troubleshooting): [`docs/OPERATIONS.md`](OPERATIONS.md).
File-level detail of the deploy, backup and alert setup: [`deploy/README.md`](../deploy/README.md).
Other references: [`SECURITY-NOTES.md`](SECURITY-NOTES.md), [`contracts/README.md`](../contracts/README.md),
[`PRINTING_SETUP.md`](PRINTING_SETUP.md), [`docs/account-data-imports.md`](account-data-imports.md).

The long test-plan documents (phases P0–X4, the decision log D-001…D-075, the known-issue log KI-001…KI-112)
were removed on 2026-10-16 and summarised here. Full text is in git: `git show 840c2b3:docs/testing/<file>`
(and `…:backend/docs/testing/`, `…:consumer/docs/testing/`, `…:admin/docs/testing/`).

## 1. What it is

A multi-tenant point-of-sale system for shops in Bangladesh (currency BDT; business time zone `Asia/Dhaka`).

| Path | What | Stack |
|---|---|---|
| `backend/` | REST API under `/api/v1` (auth, sales, inventory, reports, billing, product audit, CMS) | NestJS 11, Prisma 6, PostgreSQL 17, Node 22 |
| `consumer/` | The POS app shops use (PWA, works offline for the shell) | React, Vite, vite-plugin-pwa, Vitest |
| `admin/` | Super-admin console | React, Vite, antd, Vitest |
| `portfolio/` | Marketing/SEO site with CMS content from the backend | Next.js |
| `contracts/` | Shared response-type fixtures that backend AND frontends must satisfy | JSON + generator script |
| `e2e/` | Full-stack Playwright journeys J0–J11 against `docker-compose.e2e.yml` | Playwright |
| `PrintingFromWebToPOSPrinter/` | Windows print agent the consumer app calls (not tested here) | C# |
| `ai-service/` | Description generator (FastAPI). **Not deployed.** | Python |
| `deploy/`, `.github/workflows/`, `scripts/` | Deploy files, CI/CD, repo guard scripts | bash, YAML, Node |

Backend modules (`backend/src`): `auth`, `consumer` (shop-facing domain: sales, inventory, returns, payments…),
`admin` (super-admin domain), `portfolio` (CMS), `product-audit`, `rabbitmq`, `ai-services`, `config`, `prisma`, `common`.
Redis and RabbitMQ are **optional and off by default** (`REDIS_ENABLED`, `RABBITMQ_ENABLED`) and are not deployed.
`FASTAPI_URL` is still required by the config schema even though the AI service is not deployed.

## 2. Environments

| | Production | Staging |
|---|---|---|
| Domains | `posbuzz.xyz` (app), `admin.`, `api.`, `portfolio.` | `posbuzz.cloud`, same prefixes |
| Git branch | `main` | `staging` |
| Server dir / Docker project | `/opt/posbuzz`, `posclient` | `/opt/posbuzz-staging`, `posclient-stg` |
| Local ports (127.0.0.1) | 3000 app, 3001 admin, 3002 portfolio, 8000 api | 4000, 4001, 4002, 4800 |
| Database | volume `posclient_postgres_data` (the real data) | `posclient_stg_postgres_data` (copy of production on demand) |

One Hostinger VPS (`195.35.45.101`, Mumbai, Ubuntu 24.04) hosts both. Cloudflare is in front (SSL mode Full, Always Use
HTTPS, one Free rate-limit rule per zone on `POST /api/v1/auth/*`). Host nginx (`deploy/nginx/posbuzz.conf`) routes by
hostname and sets HSTS plus a CSP (enforced low-risk subset, full policy in report-only). `posbuzz.com` has no DNS record yet.
Nothing else is reachable from outside: UFW allows only 22222 (SSH, key only), 80 and 443; fail2ban watches SSH.
Secrets live only on the server (`/opt/posbuzz*/env/`); GitHub holds just the `DEPLOY_*` secrets.

## 3. Branch flow, CI and deploy

1. Branch from `staging`, open a PR **into `staging`**. CI runs on the PR.
2. Merge → CI on `staging` → **Deploy** workflow builds images (GHCR), deploys **staging**, health-checks, smoke-tests.
3. Test on staging (refresh its data from production any time: Actions → *Refresh staging data*; staging's own data is
   snapshotted first, last 3 kept).
4. PR **`staging` → `main`**, merge → CI on `main` → Deploy ships **production** the same way.
Hotfix: PR into `main`, then merge `main` back into `staging`. Branch protection is intentionally **not** used (GitHub plan, D-065),
so "staging first" is a convention. Deploy refuses a commit without a green `All checks` or one not on the matching branch.
Only apps whose files changed since the last deploy of that branch are rebuilt; the rest are re-tagged. A failed health check rolls
the stack back to its last good commit (images only, not migrations); a dump is taken before every deploy (last 5).

CI (`.github/workflows/ci.yml`, `All checks` is the single aggregator): lint+typecheck, production dependency audit for
backend/consumer/admin/portfolio (high+ fails), PR dependency review, builds and Docker builds, backend unit /
integration+e2e / optional-infra, consumer and admin tests, contracts, Playwright e2e, secret scan (gitleaks, new commits
only), tests-required (PRs), coverage ratchets, consumer and backend-unit mutation. `nightly.yml` runs domain mutation.
`cancel-on-close.yml` cancels a PR's CI when the PR closes; pushing again cancels the older run. The Actions budget has run out
once (2026-10-14): do not push repeatedly while CI runs, and keep throwaway branches with temporary triggers short-lived.

## 4. Testing: how it is built

Goal: a change in one place that breaks behavior elsewhere (a report, another screen) makes CI go red before merge.

| Layer | Where | Command |
|---|---|---|
| Backend unit (no I/O) | `backend/src/**/*.spec.ts` | `npm test` (928 tests, 75 suites) |
| Backend integration (real Postgres) | `backend/test/integration/**/*.int-spec.ts` | `npm run test:int` (needs `docker compose -f docker-compose.test.yml up -d --wait`) |
| Backend HTTP e2e | `backend/test/e2e/**/*.e2e-spec.ts` | `npm run test:e2e` |
| Consumer / admin unit + page flows (jsdom + MSW) | `src/**/*.test.ts(x)`, `__tests__/*.flow.test.tsx` | `npm test` (consumer: 627 tests), `npm run typecheck`, `npm run lint:check` |
| Cross-layer contracts | `contracts/` | regenerate with `UPDATE_CONTRACTS=1`, review the diff |
| Full stack | `e2e/` (Playwright) | login is throttled to 5/min; the budget persists in `e2e/.cache`; never change the production throttle |
| Mutation | consumer: `npm run test:mutation -- <src file>` (one target per run); backend unit: `npm run test:mutation:unit`; domain: nightly only | |

Conventions: every test title starts with a stable ID (`[BE-SALE-004]`, `[CO-CALC-012]`, `[AD-AUTH-002]`, `[X-ERR-010]`, `[E2E-J1]`),
never reused. Tests must set `TZ` explicitly (the process time zone comes from `BUSINESS_TIMEZONE`, D-004); a timezone check runs
the report and product-audit suites in Dhaka and New York. Every backend service method must have tagged tests (service-coverage
guarantee, `backend/test/service-coverage/`). The integration suite checks 13 SQL invariants (INV-01…13) after every test.
Prisma schema and migrations are checked for an empty `migrate diff`, and a destructive-migration guard compares migrations with `origin/main`.

**Rules (do not break):**
- Never lower an assertion, coverage floor or mutation threshold to make something pass: fix the code or add tests.
- A confirmed defect found while testing is fixed now with a normal passing regression test. No `it.failing`, `skip` or similar markers.
- Domain mutation is nightly-only: a seventh of the files per night (`STRYKER_ROTATION=d/7`) plus recently changed files, split into shards,
  judged by the ratchet `scripts/mutation-tier-gate.mjs --baseline backend/test/service-coverage/mutation-baseline.json`.
- Mutation and e2e jobs are expensive. Keep CI runs few.

**Error contract** (every non-2xx JSON from `/api/v1/**`): `{ statusCode, message, error }` with `message` a readable string
(capital letter, ≤200 chars, no field paths, enum names, Prisma/SQL text or stack frames), status matching the cause (400/401/403/404/409),
generic 500 bodies, stable wording for messages the UI depends on. Validation adds `errors: [{ field, message }]`. On the client,
`getErrorMessage(error, fallback)` (`consumer|admin/src/utils/api-error.ts`) is the only place errors become text; a `catch` that
returns 500 must first pass client errors through `isClientError`. Enforced by `scripts/check-masked-errors.mjs` and the X-ERR tests.

## 5. Standing decisions (condensed from the old log)

- **Time:** business days use `BUSINESS_TIMEZONE` (default `Asia/Dhaka`, D-004); the product-audit period uses UTC days (D-073).
- **Policy:** no license restrictions (D-017); vulnerability gate is high/critical on production dependencies. As of 2026-10-15 every app audits at 0 findings
  (Jest 30; overrides for `qs` under Stryker and `js-yaml` under the Jest coverage tooling, see `deploy/README.md`).
- **Characterizations kept** (confirm intent before changing): sales never split a line across batches; settling a due sale later earns no reward
  points; a return item without a batch does not restock; a batch created without payments counts as fully paid (D-040).
- **Branch protection not used** (D-065). Tracked deployment credentials were removed from git and history on 2026-10-15 (D-067 superseded).
- **Delivery:** CD to the VPS from GHCR images, staging then production by branch (D-074, D-075).

## 6. Known issues and owner actions

112 defects were logged during the test work: 107 fixed, 1 resolved, 4 accepted by the owner (KI-018 dev dependencies in the PR delta audit,
KI-088 old secrets in history, KI-106 and KI-109 mutation-score items). The old GitHub token, the broad Cloudflare token and the shared admin
password were rotated or revoked on 2026-10-16, and Cloudflare SSL is on Full (strict). Still worth doing when convenient:
- Promote the report-only CSP to enforcing after a staging click-through with the browser console open (HSTS is already 1 year on the frontends).
- Add Telegram to the Healthchecks and UptimeRobot alerts.
- Rotate the GCP API key in `ai-service/.env.example` history and the secrets from the old `k8s/base/secrets.yaml` (KI-088).

Coverage ratchet: CI runs `scripts/coverage-ratchet.mjs` for backend, consumer and admin against `scripts/coverage-baseline.json`. The owner set the floors on
2026-10-16: backend 80, consumer 50, admin 50 (admin branches 45, because they measure 48.6% today). Today's real numbers are higher (backend 100% of the files it
measures, consumer 64.7% lines, admin 62.3%), so a drop of more than 0.5 points below a floor fails CI, and "above the baseline" lines in the CI log are only reminders.
To tighten a floor: run the coverage, then `node scripts/coverage-ratchet.mjs --update`, review, commit. Never lower a floor to make CI pass.

New decisions and defects: record them in the PR description (what, why, how verified) and, if they change how the system works, edit this file.
