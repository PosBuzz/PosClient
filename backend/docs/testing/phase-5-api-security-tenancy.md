# Phase B5: API Security, Tenant Isolation, Route Manifest & Response Contracts

**Goal:**
1. Every one of the ~269 routes has a **declared** security policy, and a new route without one fails CI.
2. Auth, permission, CSRF, CORS and subdomain binding are proven at the HTTP level.
3. **Tenant isolation is swept automatically** across every route, not sampled.
4. No route returns 5xx on bad input, and none leaks secrets.
5. Route paths and response shapes are exported as **contracts** that the consumer/admin test
   suites consume (X1, C4, A2). A backend change that breaks the frontend fails the frontend's tests.

**Depends on:** B1 (B4's scenario is reused for §6). **Location:** `backend/test/e2e/`. **Runner:** `npm run test:e2e`.

---

## 1. Route manifest (`test/e2e/route-manifest.e2e-spec.ts`)

### 1.1 Extract metadata (no HTTP)
Build a testing module importing `AppModule` **and** `DiscoveryModule` (from `@nestjs/core`).
Use `DiscoveryService.getControllers()`, `MetadataScanner.getAllMethodNames(prototype)` and
`Reflector` with the constants from `@nestjs/common/constants`: `PATH_METADATA`,
`METHOD_METADATA`, `GUARDS_METADATA`. For each handler, produce:
```ts
type RouteEntry = {
  method: 'GET'|'POST'|'PATCH'|'PUT'|'DELETE';
  path: string;                 // '/api/v1/' + controllerPath + '/' + methodPath, normalized: no double slashes, params as ':id'
  controller: string;           // class name
  handler: string;              // method name
  guards: string[];             // class guards + method guards, by .name, deduped, in order
  permissions: string[];        // from 'permissions' metadata (handler overrides class, matching PermissionsGuard logic)
  throttled: boolean;           // presence of THROTTLER metadata (see KI-002)
};
```
`RequestMethod` metadata is a numeric enum. Map it with `RequestMethod[value]`. Sort entries by
`path` then `method`.

Sanity checks in the same file:
| ID | Assert |
|---|---|
| BE-ROUTE-001 | Number of entries ≥ 260 (guards against the extractor silently missing controllers). Record the exact count in the manifest |
| BE-ROUTE-002 | No duplicate `method + path` (two handlers on the same route) |

### 1.2 Snapshot as a contract file
Write the entries to **`contracts/routes.json` at the repo root**, not inside backend. The consumer
and admin read it.
- `UPDATE_CONTRACTS=1 npm run test:e2e` → (re)writes the file.
- Otherwise → deep-compare and fail with:
  `Route manifest changed. Review, then run UPDATE_CONTRACTS=1 npm run test:e2e and commit contracts/routes.json`.
- Add `contracts/` to `CODEOWNERS` (X3) so manifest changes need explicit review.

| ID | Assert |
|---|---|
| BE-ROUTE-003 | Live manifest deep-equals `contracts/routes.json` |

### 1.3 Policy rules over the manifest (`test/e2e/security/route-policy.e2e-spec.ts`)
Create `test/e2e/security/public-routes.ts`:
```ts
// Every route reachable without authentication. Adding to this list requires a reason.
export const PUBLIC_ROUTES: Record<string, string> = {
  'GET /api/v1': 'root hello',
  'GET /api/v1/health': 'load balancer health check',
  'GET /api/v1/metrics': 'TODO-QUESTION: exposes DB pool metrics publicly; confirm',
  'GET /api/v1/auth/csrf-token': 'bootstrap CSRF',
  'POST /api/v1/auth/login-user': 'login',
  'POST /api/v1/auth/login-superadmin': 'login',
  'POST /api/v1/auth/client-refresh-token': 'refresh (validated by refresh cookie)',
  'POST /api/v1/auth/admin-refresh-token': 'refresh',
  'POST /api/v1/auth/client-logout': 'logout',
  'POST /api/v1/auth/admin-logout': 'logout',
  // public/subdomain/*, public/portfolio/*: list each one from the manifest with a reason
};
export const AUTH_ONLY_ROUTES: Record<string, string> = {
  // client/admin-guarded routes that intentionally require no specific permission
  'GET /api/v1/auth/client': 'current user',
  'GET /api/v1/auth/admin': 'current admin',
};
```
**Do not** put `test-receipts` routes in `PUBLIC_ROUTES`. They are guarded by `DevelopmentOnlyGuard`
(KI-001 fix). Treat a route whose guards include `DevelopmentOnlyGuard` as a valid policy of its own
("dev-only"), and assert in BE-ROUTE-017 that **only** `test-receipts` routes use it.

| ID | Rule |
|---|---|
| BE-ROUTE-010 | Every route either has `ClientAuthGuard` or `AdminAuthGuard` in `guards`, or is in `PUBLIC_ROUTES` |
| BE-ROUTE-011 | Every route with `PermissionsGuard` has non-empty `permissions`, or is in `AUTH_ONLY_ROUTES` |
| BE-ROUTE-012 | Routes under `/api/v1/admin/` use `AdminAuthGuard`, never `ClientAuthGuard` |
| BE-ROUTE-013 | Routes under `/api/v1/consumer/` and `/api/v1/receipt-settings` use `ClientAuthGuard` |
| BE-ROUTE-014 | Every `PUBLIC_ROUTES` key exists in the manifest (no stale allowlist entries) |
| BE-ROUTE-015 | Each `ConsumerPermission` enum value is used by at least one route, and every `permissions` value used is a valid enum member (same for `AdminPermission`) |

If BE-ROUTE-010 finds a real violation in the future, don't weaken the rule. Add it to
`KNOWN_VIOLATIONS = { '<METHOD> <path>': 'KI-0xx' }` (which the rule skips) together with a KI row, and remove it
when fixed. BE-ROUTE-016 enforces the cleanup (the list starts empty; KI-001 is fixed):

| ID | Rule |
|---|---|
| BE-ROUTE-016 | Every `KNOWN_VIOLATIONS` key still exists in the manifest **and** still violates. Fails if a violation was fixed but the allowlist was not cleaned up |

## 2. Auth & session behavior (`test/e2e/security/auth.e2e-spec.ts`)
| ID | Case | Expected |
|---|---|---|
| BE-SEC-001 | Real login `POST /auth/login-user` with `Origin: http://<subdomain>.localhost:3000`, correct password (factory user with bcrypt hash of `Passw0rd!`) | 2xx; `Set-Cookie` has `client_access_token` and `client_refresh_token`, both `HttpOnly; Secure; SameSite=None` |
| BE-SEC-002 | Wrong password / unknown email / user of **another tenant's** subdomain (tenant and super-admin login) | 401 `"Invalid email or password"` for all, identical bodies (fixed 2026-10-12, D-009). Response times within 150 ms of each other (bcrypt dummy compare). Expired-subscription tenant: wrong password → 401, correct password → 403 subscription message |
| BE-SEC-003 | Login without Origin/Referer | 400 'Unable to determine subdomain' |
| BE-SEC-004 | Login with soft-deleted consumer | rejected |
| BE-SEC-005 | Token of tenant A + `Origin: http://<B>.localhost:3000` on a client route | 401 'subdomain does not match'; response clears both client cookies |
| BE-SEC-006 | Expired access token (sign with `expiresIn: -10`) | 401 |
| BE-SEC-007 | Token signed with a different secret / `alg: none` | 401 |
| BE-SEC-008 | Refresh: valid refresh cookie → new access cookie; after `client-logout`, the old refresh token → 401 (it was invalidated in DB, see `invalidateClientRefreshToken`) |
| BE-SEC-009 | Refresh token reuse after rotation (if rotation is implemented; read `clientRefreshToken`) → pin behavior |
| BE-SEC-010 | **KI-001 (fixed):** `GET /api/v1/test-receipts` and `/test-receipts/0` with `NODE_ENV=test` → 404, even with a valid client token. With `NODE_ENV=development` → 200 (set via a separate `createTestApp` env override) |
| BE-SEC-011 | **KI-002 (fixed):** 6 wrong logins for the same email within 60 s → 6th returns 429; a login for a **different** email from the same IP still succeeds (tracker is IP + email, D-005). Same for `login-superadmin` |
| BE-SEC-012 | Client token on an `/admin/*` route → 401; admin token on `/consumer/*` → 401 |
| BE-SEC-013 | User deleted after token issuance → 401 (strategy re-reads the DB) |
| BE-SEC-014 | Role permissions changed after token issuance → the next request reflects the new permissions (strategy re-reads per request) |

CSRF (`test/e2e/security/csrf.e2e-spec.ts`):
| ID | Case | Expected |
|---|---|---|
| BE-CSRF-001 | POST with valid token + signature | passes CSRF (reaches guard) |
| BE-CSRF-002 | Missing header / missing cookie / token from another session (signature mismatch) | 403 `invalid csrf token` |
| BE-CSRF-003 | GET/HEAD/OPTIONS without CSRF | allowed |
| BE-CSRF-004 | `/api/v1/public/*` POST without CSRF | allowed |
| BE-CSRF-005 | `csrf_signature` cookie is `HttpOnly; Secure; SameSite=None` |

CORS (`test/e2e/security/cors.e2e-spec.ts`), using the test `CORS_ORIGINS` `http://*.localhost:3000,http://localhost:3001`:
| ID | Origin | Expected |
|---|---|---|
| BE-CORS-001 | `http://acme.localhost:3000` | `access-control-allow-origin` echoes it, `allow-credentials: true` |
| BE-CORS-002 | `http://evil.com` | request fails (current code calls back with an Error, which yields 500). Pin the status; **it must not echo the origin** |
| BE-CORS-003 | `http://a.b.localhost:3000` (wildcard `[a-zA-Z0-9-]+` matches one label only) | not allowed |
| BE-CORS-004 | `http://acme.localhost:3000.evil.com` | not allowed (regex is anchored) |

## 3. Permission matrix (generated from the manifest)
`test/e2e/security/permissions.e2e-spec.ts`. For each manifest entry with `ClientAuthGuard` +
non-empty permissions, generate (`describe.each`):
| ID pattern | Case | Expected |
|---|---|---|
| BE-PERM-<METHOD> <path>-a | anonymous with valid CSRF | 401 |
| BE-PERM-…-b | tenant user with **all permissions except** the required ones | 403 |
| BE-PERM-…-c | tenant user with exactly the required permissions | **not** 401/403 (any other status is fine; params may be fake) |

Same for `AdminAuthGuard` routes with `AdminPermission` (create super-admin role factories).
For path params use `1`. The point is the guard verdict, not the handler. Expect ~400 generated
cases. Keep them in one file with a shared app instance (`beforeAll`), and reset the DB only in
`beforeAll`.

## 4. Tenant isolation sweep (`test/e2e/tenancy/`)
Two tenants: **A** (actor) and **B** (victim). B is seeded through services with every resource
type (branch, product+variant+batch, vendor, customer, promotion, sale, return, transfer,
adjustment, operational cost, support ticket, user, role, tag, brand, category, unit, receipt
setting), and every string field B controls contains the marker **`ZZLEAKB`** (names, notes,
emails `zzleakb+n@x.test`, phone `0170ZZLEAKB`→ use digits if validation requires: `01700999999`
plus name marker).

### 4.1 Leak sweep over every GET
| ID | Rule |
|---|---|
| BE-TEN-001 | For **every** client-guarded GET route in the manifest, request as A's admin (all permissions), path params filled from A's own resources (`test/e2e/tenancy/param-resolver.ts`) and required query params from `test/e2e/tenancy/query-defaults.ts` (e.g. `branch_id` = A's main branch; date ranges covering today). If the response is JSON, `JSON.stringify(body)` must **not** contain `ZZLEAKB`. Binary (PDF/XLSX) responses: convert the buffer to latin1 and search too (PDF text may be compressed; that is acceptable, best effort) |
| BE-TEN-002 | The sweep visited ≥ 95% of client GET routes; each skipped route is in `SKIPPED` with a reason |

### 4.2 Direct object reference with B's ids
| ID | Rule |
|---|---|
| BE-TEN-010 | For **every** route containing `:id` (or another param), substitute **B's** id of the matching resource type, request as A → status ∈ {400, 403, 404}, body has no `ZZLEAKB`, and **B's rows are unchanged** (INV-13 hash from B3, reused). Mapping param → resource type lives in `param-resolver.ts`. A route whose param has no mapping fails BE-TEN-011 |
| BE-TEN-011 | Every parameterized client route has a resolver entry or an explicit skip reason |
| BE-TEN-012 | Body-referenced ids: for POST routes that accept foreign ids in the body (`branch_id`, `variant_id`, `batch_id`, `customer_id`, `vendor_id`, `served_by_id`, `promotion_id`, `original_sale_id`, `sale_item_id`, transfer `from/to_branch_id`), send a valid A payload with **one** id swapped to B's → never 2xx, and B unchanged. List the routes/fields in `body-foreign-ids.ts`. This includes `POST /consumer/returns` with B's `batch_id` (KI-009, fixed), which must now be rejected |

## 5. Robustness sweeps
| ID | Rule |
|---|---|
| BE-ROB-001 | For every client/admin **non-GET** route: authorized, valid CSRF, body `{}` → status < 500. A 5xx is a bug → KI per route, `it.failing` per case |
| BE-ROB-002 | Same with type-garbage bodies: `{ "id": "x", "quantity": "abc", "items": "nope" }` → < 500 |
| BE-ROB-003 | Every GET with params set to `abc` / `-1` / `99999999999` → < 500 |
| BE-ROB-004 | **Secret leak sweep:** across all responses collected in §4 and §5, no key named `password` or `refresh_token` (the `User` and `SuperAdmin` column names), and no value matching `/^\$2[aby]\$\d{2}\$/` (bcrypt) |
| BE-ROB-005 | Unknown extra properties in bodies (no `whitelist` in ValidationPipe): send `{ ...validSale, consumer_id: <B.id> }` → the stored sale's `consumer_id` is A's. **Mass-assignment check.** Do the same for customer/product/user create |

## 6. Response-shape contracts (`test/e2e/contracts/responses.e2e-spec.ts`)
Using B4's `buildBusinessDay` scenario, call these endpoints over HTTP and store **normalized**
bodies in `contracts/responses/<name>.json` (same UPDATE_CONTRACTS mechanism as §1.2):

| Contract file | Request |
|---|---|
| `auth-client.json` | `GET /auth/client` |
| `sales-list.json` | `GET /consumer/sales?page=1&limit=10` (check the DTO for real param names) |
| `sale-detail.json` | `GET /consumer/sales/:id` for S2 |
| `sale-by-number.json` | the returns lookup endpoint (`findBySaleNumber`) for S4 |
| `products-for-sale.json` | `GET /consumer/sales/products?branch_id=…` |
| `dashboard.json` | `GET /consumer/dashboard…` (check the controller path) |
| `eod.json` | EOD endpoint for 2026-03-14 |
| `returns-list.json`, `return-detail.json` | returns endpoints |
| `inventory-summary.json`, `low-stock.json` | inventory endpoints |
| `promotions-active.json` | `findActive` endpoint |
| `customer-points.json` | rewards customer points |
| `partial-payments.json` | payments list |
| `auth-admin.json` | `GET /auth/admin` (admin app's current user) |
| `admin-consumers.json`, `admin-plans.json` | admin endpoints (admin app) |
| `plan-permissions.json` | the endpoint the admin plan form and `consumer/users/plan-permissions` use to list permissions |

Normalization (`test/e2e/contracts/normalize.ts`) must **keep every key and every value type**,
because the consumer renders these files as real API data (C4) and replays requests built from them (X1):
- **ids stay real numbers.** After `resetDb()` (`RESTART IDENTITY`), a scenario built sequentially
  produces the same ids every run. BE-CONTRACT-000 proves it.
- Any string matching a full ISO datetime (`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/`) →
  `"2026-03-14T12:00:00.000Z"`. Prisma's `@default(now())`/`@updatedAt` are set by the query
  engine, so faking JS `Date` does not control them. Date-only strings (`YYYY-MM-DD`) stay as they are.
- Arrays of rows whose order is not guaranteed by an `orderBy` (e.g. `items` of a sale) → sort by
  `id` before writing and before comparing.
- Decimal values stay as Prisma serializes them (strings). This captures what the frontend's
  `Number(...)` calls depend on.

| ID | Assert |
|---|---|
| BE-CONTRACT-000 | Build the scenario, collect all bodies, `resetDb()`, build again, collect again → deep-equal. If this fails, ids are not deterministic: find the cause (usually `Promise.all` inserts in `sales.service.ts#create`; sale-item ids may interleave). Then renumber **only the unstable id fields** by sorted order, keeping them numeric, and log it |
| BE-CONTRACT-001…0nn | each live normalized body deep-equals its contract file |

## 7. CI
Covered by the `backend-integration` job (`npm run test:e2e`). Also add a job step that fails
if `git diff --exit-code contracts/` is dirty after the tests run in compare mode (it should never
be, but this guards against a test that writes in compare mode).

## Exit criteria
- [ ] `contracts/routes.json` and `contracts/responses/*.json` committed.
- [ ] BE-ROUTE-*, BE-SEC-*, BE-CSRF-*, BE-CORS-*, BE-PERM-*, BE-TEN-*, BE-ROB-*, BE-CONTRACT-* pass or are `failing` with a KI.
- [ ] Adding a dummy unguarded controller locally makes BE-ROUTE-010 fail (manual proof, note it in the PR description).
