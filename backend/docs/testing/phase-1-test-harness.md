# Phase B1: Backend Test Harness

**Goal:** any test can (a) get a clean, migrated Postgres, (b) boot the real Nest app with the
**same middleware as production** (helmet, CORS, CSRF, ValidationPipe, `api/v1` prefix, Prisma
exception filters), (c) authenticate as any tenant user or super-admin, and (d) build realistic
data in one line.

**Depends on:** P0. **Unblocks:** B2–B7, X1.

**Status (2026-10-13): implemented and locally verified; B1 CI verification pending publication.**

---

## Step 1: Install dev dependencies
```bash
cd backend
npm i -D @testcontainers/postgresql@^12 testcontainers@^12 @faker-js/faker@^10 cookie@^1
```
- `cookie` parses `Set-Cookie` headers in the auth helper (§6).
- Do **not** add `jest-mock-extended`. Integration tests use a real DB. Existing unit specs keep
  their hand-written mocks.
- Verified 2026-10-12: testcontainers 12.2.0 requires Node ≥ 22.22 (local is 22.23).

## Step 2: Pre-approved seam: `configureApp` (the only production code change in B1)
Create `src/app.setup.ts` and move code out of `src/main.ts` **verbatim**:

```ts
// src/app.setup.ts
import { HttpAdapterHost } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
// ...move ALL imports main.ts needs for the moved code...
// ...move CSRF_COOKIE_NAME, CSRF_HEADER_NAME, SAFE_METHODS, signCsrfToken, secureCompare, createCsrfToken...

export function configureApp(
  app: NestExpressApplication,
  configService: ConfigService,
): void {
  // Moved verbatim from bootstrap(): everything from `app.disable('x-powered-by')`
  // through the two `app.useGlobalFilters(...)` calls, including setGlobalPrefix
  // and enableShutdownHooks.
}
```
`main.ts#bootstrap` becomes: create the app → `const configService = app.get(ConfigService)` →
`configureApp(app, configService)` → `app.listen` → logs. Use a `const logger = new Logger('Bootstrap')`
inside `configureApp` for the CORS warning that used `logger`.

**Verify there's no behavior change:** `npm run build && npm test` pass, and
`git diff --stat` shows only `main.ts` and the new `app.setup.ts`. Commit:
`refactor(testability): extract configureApp from bootstrap`.

## Step 3: Directory layout
```
backend/test/
  setup/
    global-setup.ts        # starts containers (or uses TEST_DATABASE_URL), migrates, writes .tmp/env.json
    global-teardown.ts     # stops containers
    load-test-env.ts       # setupFiles: copies .tmp/env.json into process.env before any import
    test-env.ts            # the static env values (secrets etc.)
  helpers/
    db.ts                  # getPrisma(), resetDb(), disconnect
    app.ts                 # createTestApp(): Nest app with configureApp + provider overrides
    auth.ts                # tokens + csrf + cookie header builders
    http.ts                # api(app).as(user).post(...) wrapper
    money.ts               # dec(x) => x.toFixed(2) helpers for Decimal assertions
  factories/
    index.ts               # re-exports
    tenant.factory.ts      # plan+permissions, consumer, branch, role, user (createTenant)
    catalog.factory.ts     # unit, category, brand, product, variant
    inventory.factory.ts   # batch (stock), vendor
    customer.factory.ts    # customer, rewards settings
    promotion.factory.ts   # promotion + products/branches
    sale.factory.ts        # builds a valid CreateSaleDto from variants (does NOT insert; tests call the service/API)
    admin.factory.ts       # super-admin role/permissions/user
  integration/             # *.int-spec.ts (service-level, real DB)
  e2e/                     # *.e2e-spec.ts (HTTP-level, real app)
  jest-integration.json
  jest-e2e.json            # REPLACED
  .tmp/                    # gitignored
```
Add `backend/test/.tmp/` to `backend/.gitignore`. Preserve the old scaffold as `test/app.e2e-spec.ts.disabled` (outside active Jest/tsc globs); BE-HARN-003 replaces it reversibly.

## Step 4: Jest configs
`test/jest-integration.json`:
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testRegex": "test/integration/.*\\.int-spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "moduleNameMapper": {
    "^src/(.*)$": "<rootDir>/src/$1",
    "^prisma-client-exception/(.*)$": "<rootDir>/prisma-client-exception/$1"
  },
  "testEnvironment": "node",
  "globalSetup": "<rootDir>/test/setup/global-setup.ts",
  "globalTeardown": "<rootDir>/test/setup/global-teardown.ts",
  "setupFiles": ["<rootDir>/test/setup/load-test-env.ts"],
  "maxWorkers": 1,
  "testTimeout": 60000
}
```
`test/jest-e2e.json`: identical, except `"testRegex": "test/e2e/.*\\.e2e-spec\\.ts$"`.

Why `maxWorkers: 1`: all test files share one database, and `resetDb()` truncates it. Parallel
files would wipe each other's data. **If the suite later takes more than 10 minutes:** switch to
one database per worker (create `posbuzz_test_${JEST_WORKER_ID}` from a template DB in
`global-setup`), log it as a DECISION, and only then raise `maxWorkers`.

`package.json` scripts:
```json
"test": "TZ=UTC jest",
"test:int": "TZ=UTC jest --config ./test/jest-integration.json",
"test:e2e": "TZ=UTC jest --config ./test/jest-e2e.json",
"test:all": "npm test && npm run test:int && npm run test:e2e"
```
Also add `"^prisma-client-exception/(.*)$": "<rootDir>/../prisma-client-exception/$1"` to the
**existing** unit `jest.moduleNameMapper` in package.json (its rootDir is `src`). Unit specs that
import anything which imports `main`-level filters would otherwise fail to resolve.

## Step 5: Global setup / env
`test/setup/test-env.ts`:
```ts
export const STATIC_TEST_ENV = {
  NODE_ENV: 'test',
  PORT: '0',
  JWT_SECRET_KEY: 'test-jwt-secret-not-for-prod-0123456789',
  JWT_ALGORITHM: 'HS256',
  JWT_EXPIRATION: '15m',
  JWT_REFRESH_EXPIRATION: '7d',
  CSRF_SECRET_KEY: 'REDACTED_SECRET',
  DB_USERNAME: 'test',
  DB_PASSWORD: 'test',
  DB_NAME: 'posbuzz_test',
  CORS_ORIGINS: 'http://*.localhost:3000,http://localhost:3001',
  // Optional infrastructure stays off in tests, exactly as in a default deployment:
  // no Redis container, RabbitMQService skips connecting, AI descriptions use HTTP (mocked).
  REDIS_ENABLED: 'false',
  RABBITMQ_ENABLED: 'false',
  BUSINESS_TIMEZONE: 'UTC', // the npm scripts also set TZ; B4 runs a Dhaka variant
  FASTAPI_URL: 'http://127.0.0.1:9',  // never reached
};
```

`test/setup/global-setup.ts` logic, in this order:
1. If `process.env.TEST_DATABASE_URL` is set → use it and skip the Postgres container (fallback
   path for environments without Testcontainers). Otherwise start
   `new PostgreSqlContainer('postgres:17-alpine').withDatabase('posbuzz_test').withUsername('test').withPassword('test').start()`
   and build `DATABASE_URL = container.getConnectionUri() + '?schema=public'`.
2. *(No Redis: it's optional and off by default since 2026-10-12, D-008.)*
3. Run migrations: `execSync('npx prisma migrate deploy', { cwd: <backend root>, env: { ...process.env, DATABASE_URL }, stdio: 'inherit' })`.
   **Do not** use `prisma db push`. Tests must run on the real migration chain. (If migrations ever
   fail here, that is a real deploy bug → STOP, KNOWN-ISSUE.)
4. Write `{ ...STATIC_TEST_ENV, DATABASE_URL, DB_HOST, DB_PORT }` to
   `test/.tmp/env.json`.
5. Store the container handle on `globalThis.__PG__` for teardown (same process).

`test/setup/load-test-env.ts`: read `test/.tmp/env.json` synchronously and `Object.assign(process.env, json)`.
This runs before each test file's imports, so `ConfigModule.forRoot` sees the test values.

> Note: `ConfigModule` also loads `backend/.env` (`envFilePath` in `src/config/config.module.ts`).
> `@nestjs/config` gives **existing `process.env` precedence over `.env` files**, so the values above
> win. Each key in `STATIC_TEST_ENV` must be set explicitly; never rely on `.env` for tests.
> BE-HARN-004 asserts this.

`docker-compose.test.yml` (repo root; fallback path and for X2):
```yaml
services:
  postgres-test:
    image: postgres:17-alpine
    environment: { POSTGRES_DB: posbuzz_test, POSTGRES_USER: test, POSTGRES_PASSWORD: test }
    ports: ["55432:5432"]
    tmpfs: [/var/lib/postgresql/data]
```

## Step 6: Helpers
### `helpers/db.ts`
- `getPrisma()`: lazily creates **one** `PrismaClient` per test file (`new PrismaClient()`). The
  app under test has its own `PrismaService`. That is fine because both hit the same DB.
- `resetDb()`: one statement truncating every table except `_prisma_migrations`:
  ```ts
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${rows.map(r => `"public"."${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  ```
  Call it in `beforeEach` of every integration/e2e file (put it in each file explicitly so it's
  readable; no hidden global hook).

### `helpers/app.ts`
```ts
export async function createTestApp(opts?: { overrides?: Array<[any, any]> }) {
  // RabbitMQ/Redis are off via STATIC_TEST_ENV, so no stubs are needed. AI description tests
  // mock HttpService (`overrides: [[HttpService, { post: jest.fn() }]]`).
  const builder = Test.createTestingModule({ imports: [AppModule] });
  for (const [token, value] of opts?.overrides ?? []) builder.overrideProvider(token).useValue(value);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  configureApp(app, app.get(ConfigService));
  await app.init();
  return { app, moduleRef, prisma: app.get(PrismaService) };
}
```
Integration tests that need only services (not HTTP) use the same function and call
`moduleRef.get(SalesService)`. That way services get real DI wiring.

**Optional-infrastructure suite** (`test/integration/optional-infra.int-spec.ts`, IDs BE-HARN-011…014):
- BE-HARN-011: with defaults, the app boots with **no** Redis/RabbitMQ reachable; `GET /health` →
  `status: 'ok'`, `services.redis.status === 'disabled'`.
- BE-HARN-012: `RabbitMQService.sendMessage` throws "RabbitMQ is disabled" and `DescriptionService.generateDescription`
  calls `HttpService.post(<FASTAPI_URL>/generate-description)` directly (assert it is called once, with no queue attempt).
- BE-HARN-013: with `REDIS_ENABLED=true` and a Testcontainers `redis:7-alpine` started **only in this file**,
  health reports redis `healthy`. Proves the switch still works when you turn Redis back on.
- BE-HARN-014: with `RABBITMQ_ENABLED=true` and a Testcontainers `rabbitmq:3.13-alpine` (this file only), the service connects
  and `sendMessage` without waiting for a response publishes successfully. Keep it in the separate `test:infra` suite. B1 adds a PR CI job for real opt-in verification; X3 can also schedule it nightly.

### `helpers/auth.ts`
The cookies are `Secure; SameSite=None` (`AUTH_COOKIE_OPTIONS` in `auth.controller.ts`), so
supertest's cookie jar **will not resend them over http**. Never use `request.agent()` for auth.
Build the `Cookie` header manually:
- `clientToken(user: {id, email, consumer_id}, consumer: {subdomain})` → signs with `jsonwebtoken`
  (already a transitive dep through `@nestjs/jwt`; import from `@nestjs/jwt`'s `JwtService` with
  `secret: process.env.JWT_SECRET_KEY`) the payload
  `{ sub: user.id, email: user.email, consumer_id, consumer_subdomain }`, matching
  `auth.service.ts#loginUser`.
- `adminToken(superAdmin)` → payload as in `auth.service.ts#loginSuperAdmin` (read it; copy the field set exactly).
- `getCsrf(app)` → `GET /api/v1/auth/csrf-token`, read `body.csrfToken` and the `csrf_signature`
  cookie value from `set-cookie` (parse with `cookie.parse`). Returns `{ token, signature }`.
- `authHeaders({ client?, admin?, csrf })` → `{ Cookie: 'client_access_token=…; csrf_signature=…', 'x-csrf-token': token }`.

### `helpers/http.ts`
```ts
api(app).as(tenantUser).get('/consumer/sales')            // prefixes /api/v1, adds cookies+csrf
api(app).as(tenantUser, { origin: 'http://acme.localhost:3000' }).post(...)
api(app).anonymous().get(...)
api(app).asAdmin(superAdmin).post(...)
```
The default sets no Origin and uses `Host: localhost`; B5 passes tenant origins explicitly. BE-HARN-018 also verifies bare IPv4 host requests: a confirmed parser bug treated 127.0.0.1 as subdomain 127, and has been fixed immediately to recognize IP addresses.

### `helpers/money.ts`
`dec(v: Prisma.Decimal | number | string) => Number(v).toFixed(2)`. Assert money as
`expect(dec(sale.total_amount)).toBe('105.00')`.

## Step 7: Factories
Rules (from DECISION-PLAYBOOK §7):
- Signature `createX(prisma, overrides?: Partial<Prisma.XUncheckedCreateInput>)`. TypeScript's Prisma
  input types are the **source of truth for required fields**. If you omit a required field,
  `tsc` fails. Don't guess field names; let the compiler tell you.
- Use `prisma/seed.ts` (lines ~319–505) as the reference for a valid plan → permissions →
  consumer → branch → role → rolePermissions → user → userBranch chain.
- Unique fields (`subdomain`, `email`, `sku`, `barcode`, `batch_number`) get a per-call counter
  suffix: `` `t${seq()}` ``. Never randomize without a seed.

`createTenant(prisma, opts?: { permissions?: ConsumerPermission[]; subdomain?: string; branches?: number })`
returns `{ plan, consumer, branches: [main, ...], adminRole, adminUser, user(permissions) }`:
- Permission rows are upserted by `action` (they're global, `@unique action`).
- Plan gets **all** `ConsumerPermission` values unless `opts.permissions` limits them.
- `adminUser` role has all plan permissions; `createUserWithPermissions(prisma, tenant, [..])` creates a
  restricted role+user for permission tests.

`createStockedVariant(prisma, tenant, { price, taxPercent?, taxMethod?, batches: [{ qty, cost, createdAt? }] })`
creates product → variant → N `InventoryBatch` rows in the tenant's main branch **and** a
`PURCHASE_IN` `InventoryAuditLog` row per batch (`quantity_delta = qty`, `quantity_after = qty`).
This matters because the B3 conservation invariant needs every batch's history to start with an
audit row, exactly as `inventory-batch.service.ts#create` does in prod. **Before writing this
factory, read `inventory-batch.service.ts#create` and copy the audit row fields it writes.** Also
check the `ProductVariant` model for how tax percent/method are stored, and use those exact fields.

`buildSaleDto(tenant, lines: Array<{ variant, qty, specialDiscount?, averageDiscount?, promotionDiscount? }>, extra?)`
returns a `CreateSaleDto` whose `unit_price`, `tax_amount` and `line_total` are computed **the same
way the consumer does**, by importing `calculateTaxAndTotal` from
`src/consumer/sales/utils/sale-pricing.util.ts`. That file is the server's mirror of the consumer's
function; since the KI-005 fix, the server rejects any line that doesn't match it. X1 keeps the two identical.
**The DTO must carry the variant's real catalog price and the product's tax**, or `create` returns 400.

## Step 8: Harness self-tests (these IDs are this phase's deliverable)
`test/integration/harness.int-spec.ts`:
| ID | Assertion |
|---|---|
| BE-HARN-001 | `resetDb()` empties every table: create a tenant, reset, `count()` of consumer/user/branch = 0 |
| BE-HARN-002 | After reset, autoincrement restarts (a new consumer gets `id = 1`). This proves `RESTART IDENTITY` works. **Tests must still never hardcode ids.** |
| BE-HARN-004 | `process.env.JWT_SECRET_KEY === STATIC_TEST_ENV.JWT_SECRET_KEY` after `createTestApp()`, i.e. `.env` did not override |
| BE-HARN-005 | `createStockedVariant` with batches [5, 3] → variant total stock 8, and 2 `PURCHASE_IN` audit rows |
| BE-HARN-006 | Migrations table has 21+ applied rows (`SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL`) |

`test/e2e/harness.e2e-spec.ts`:
| ID | Assertion |
|---|---|
| BE-HARN-003 | `GET /api/v1` → 200 `"Hello World!"` (prefix + boot work) |
| BE-HARN-007 | `GET /api/v1/auth/client` with a valid client token → 200 and `body.user.consumer_id` equals the tenant's |
| BE-HARN-008 | `POST /api/v1/consumer/branches` **without** `x-csrf-token` → 403 `{ message: 'invalid csrf token' }` (CSRF middleware is active in tests) |
| BE-HARN-009 | A response has helmet's `x-content-type-options: nosniff` and no `x-powered-by` |
| BE-HARN-010 | `GET /api/v1/health` → `services.database.status === 'healthy'` and `services.redis.status === 'disabled'` (Redis off by default; see BE-HARN-011…013) (read `app.service.ts#getHealth` for the exact redis status string) |

## Step 9: CI job
Add to `.github/workflows/ci.yml` (GitHub's `ubuntu-latest` has Docker, so Testcontainers works):
```yaml
  backend-integration:
    name: Backend integration + e2e
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: backend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm, cache-dependency-path: backend/package-lock.json }
      - run: npm ci
      - run: npx prisma generate
      - run: npm run test:int -- --ci
      - run: npm run test:e2e -- --ci
```
If Testcontainers fails on the runner (Docker socket errors), switch the job to `services:` for
Postgres and set `TEST_DATABASE_URL`. The harness
already supports that path (Step 5). Log it as a FALLBACK.

## Exit criteria
- [ ] BE-HARN-001…010 pass locally 3× in a row and in CI.
- [x] `npm test` still shows the original 8 suites/35 tests passing.
- [x] Middleware extraction is limited to `main.ts`/`app.setup.ts`; confirmed RabbitMQ shutdown and IP-subdomain bugs are repaired immediately under owner policy D-018 and documented in D-026. No unrelated production changes.
- [x] A fresh source copy with a clean `npm ci` and only Docker running executes `npm run test:all`. No manual DB setup needed.


## Implementation details and local results (2026-10-13)
- `configureApp` shares Helmet/CORS/CSRF/validation/prefix/shutdown/Prisma-filter setup with production; the existing setup body was moved without changing its behavior.
- The harness auto-starts migrated Postgres 17 or uses `TEST_DATABASE_URL`. Helpers refuse non-test-qualified database names and non-public schemas before truncation. Migrations remain intact; resets truncate all application tables and restart identities.
- Fixtures use deterministic sequence suffixes, schema-derived types, fixed billing/promotion periods, catalog-derived sale DTO pricing, and matching purchase audit rows/timestamps. Faker is installed for later factory expansion; no unseeded randomness is used now.
- Manual secure-cookie/CSRF forwarding supports client/admin requests, tenant origins, anonymous requests, valid and tampered CSRF, and direct IP hosts.
- Test IDs BE-HARN-001…018 exist and pass: **9 integration/default-infrastructure + 7 HTTP + 2 real optional-infrastructure tests**, three consecutive runs. Extras 015/016/017/018 cover admin/tenant origins, destructive-reset safety, related fixtures, and direct-IP auth respectively.
- RabbitMQ testing awaits actual delivery rather than polling too early. Intentional shutdown no longer schedules/repeats reconnects; tests exit without force-exit or skipped failures.
- All three apps' lint/typechecks remain 0 errors/0 warnings; backend build and original unit specs pass. New dependencies introduce no additional audit findings; the PR delta gate passes against the prior lockfile.
- `npm run test:all --prefix backend` runs unit/integration/e2e; `test:infra` explicitly runs Redis/RabbitMQ. CI gains `backend-integration` and `backend-optional-infra`, each with immutable-lockfile checks after npm ci. The old scaffold is kept disabled, not deleted.
- A clean source copy with fresh `npm ci` passes all 35 unit + 9 integration + 7 HTTP tests using automatic Postgres provisioning. The same tests pass through the Compose `TEST_DATABASE_URL` fallback; Compose resources were removed afterward.
- Formal B1 completion still requires CI green on the published checkpoint. The owner authorized committing and pushing B1 to draft PR #40.
