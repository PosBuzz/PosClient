# Known Issues

Defects found while planning and implementing tests. Each one has, or will get, a test that asserts the
**correct** behavior. Owner instruction (2026-10-13): confirmed defects encountered during testing must be fixed immediately, with normal passing regression tests. Do not introduce `it.failing`/`it.fails`/skip markers to postpone a repair; see DECISION-PLAYBOOK §1.

Status values: `SUSPECTED` (found by reading code, test not yet written) → `CONFIRMED` (failing
test exists) → `FIXED` (fix merged; regression test is a normal test) | `WONTFIX` (owner decision, link to D-###).

`FIXED (verified)` below means the fix is on branch `fix/known-issues`, and on 2026-10-12 it was checked over
HTTP against a real backend, Postgres 17, Redis and RabbitMQ (31 ad-hoc checks, all passing). The
permanent regression tests are still to be written in the phases named in the last column. Write
them as **normal** tests, not `it.failing`.

| ID | Sev | Status | Area | Summary | Fix | Test ID |
|---|---|---|---|---|---|---|
| KI-001 | High | FIXED (verified) | Security | `GET /api/v1/test-receipts/*` had no auth guard and rendered sale 16 of consumer 1 (customer PII) to anyone. | Controller kept as a local dev tool behind `DevelopmentOnlyGuard` (404 unless `NODE_ENV=development`); duplicate registration in `SalesModule` removed | BE-SEC-010 |
| KI-002 | High | FIXED (verified) | Security | `@Throttle({limit:5})` on login routes did nothing (no `ThrottlerGuard`). | `LoginThrottlerGuard` on `login-user` / `login-superadmin`, keyed on **IP + login email** so users behind a shared proxy IP don't lock each other out (D-005) | BE-SEC-011 |
| KI-003 | High | FIXED (verified) | Stock | Oversell race: stock checked outside the transaction, unguarded `decrement`. | Atomic conditional updates in `inventory/utils/stock-mutation.util.ts` used by sale create, quotation conversion, restore, delivery completion, exchanges, adjustments and transfer completion. Item writes are sequential. Delete/restore/delivery/transfer/quotation-conversion state changes are claimed with conditional `updateMany` first, so a double click can't apply them twice | BE-SALE-030, BE-SALE-058..062, BE-INV-036 |
| KI-004 | Medium | FIXED (verified) | Sales | Sale/quotation/return number race caused unique-constraint 500s. | Per-tenant `pg_advisory_xact_lock` (`common/utils/document-number-lock.util.ts`); numbers are generated inside the transaction. Returns also re-check, under the lock, that no return was committed for the sale since validation | BE-SALE-031, BE-RET-030, BE-RET-031 |
| KI-005 | Medium | FIXED (verified) | Integrity | Server trusted client-computed prices, totals and promotion discounts. | `sales/utils/sale-pricing.util.ts`: each line's `unit_price` must equal the catalog price (wholesale → regular fallback), tax and pre-discount line total must match `calculateTaxAndTotal` (a mirror of the consumer's), and discounts may not exceed the line. Each promotion's spread discount is capped by the server's own evaluation on the same base the POS uses (D-006) | BE-SALE-040, BE-SALE-042..045 |
| KI-006 | Medium | FIXED (verified) | Rewards/Credit | CREDIT (points) redemption ran after the sale committed, with errors swallowed. Concurrent redemptions could double-spend. | Redemption runs inside the sale transaction; credit refunds run inside the return transaction. `createPointTransaction` locks the customer's points row (`SELECT … FOR UPDATE`). HTTP errors now surface as 400 instead of 500 | BE-SALE-041, BE-RWD-007 |
| KI-007 | Low | FIXED (verified) | Schema | Migration drift: an index name > 63 chars was truncated by Postgres. | Migration `20261012000000_fix_consumer_data_imports_index_name` renames it; `prisma migrate diff` now exits 0 | BE-SCHEMA-002 |
| KI-008 | Medium | FIXED (verified) | Time | Dashboard used UTC days while EOD/stats/sale numbers used server-local time, which was also UTC in containers. For a BDT shop, sales between 00:00 and 06:00 local landed on the previous day. | Process time zone set from `BUSINESS_TIMEZONE` (default `Asia/Dhaka`) in `src/timezone.ts`. Dashboard switched to local days. Trend SQL groups with `AT TIME ZONE`. EOD/daily-target/variant-detail date labels use `toLocalDateString` (D-004) | BE-RPT-020..023 |
| KI-009 | High | FIXED (verified) | Security/Stock | Returns/exchanges accepted any `batch_id`, so a tenant could change **another tenant's** stock. | Return items must match the sold variant. Restock and exchange batches must belong to that variant **and** the tenant (`assertBatchOfVariant`). Exchange stock taken atomically | BE-RET-016..018 |
| KI-010 | Medium | FIXED | Consumer/Integrity | Global React Query `mutations.retry: 1` could resend non-idempotent POSTs. | `retry: 0` in both `consumer/src/Providers.tsx` and `admin/src/Providers.tsx` | CO-API-020/021 |
| KI-011 | Medium | FIXED | Consumer/Reports | POS checkout, pending deliveries and partial payments didn't refresh dashboard/stats caches. | All three call `invalidateSalesReports` | CO-CACHE-002, CO-FLOW-POS-012, CO-FLOW-PAY-003 |
| KI-012 | High | RESOLVED (owner, 2026-10-12) | Secrets | `.env.docker` and `backend/.env.docker` are tracked in git with secret values. | Owner rotated the secrets on the VM, so the values in the repo are no longer live. Kept as-is by owner decision (D-010); X3 secret scan should allowlist these two files with a note pointing to D-010 | X-SEC-001 |
| KI-013 | Medium | FIXED (HTTP verified) | Errors | 14 catch blocks mask readable 4xx errors (e.g. "Insufficient points balance", "Vendor … not found") as 500 "Failed to …". | `isClientError` passthrough at 159 catches, preserving HttpException and mapped Prisma errors (D-011) | X-ERR-001/002, X-ERR-034/035 |
| KI-014 | Medium | FIXED (static verified) | Consumer/Admin UX | Error handlers show a hard-coded "Failed to …" instead of the server's message: consumer ~28 handlers in catch/onError, admin 21 of 28 toasts. | Shared `getErrorMessage(err, fallback)` used by reviewed API handlers; client validation/print-agent and specific return-404 messages retained (D-013) | CO-ERR-010/011, AD-ERR-010/011, CO-ERR-020…032 |
| KI-015 | Low | FIXED (HTTP verified) | Errors | Validation failures return `message: string[]` with field paths ("items.0.quantity must not be less than 1"); the frontends render the array run together. | Readable single-string validation messages (ValidationPipe `exceptionFactory`) + array-safe `getErrorMessage` | X-ERR-038, CO-ERR-022 |
| KI-016 | Medium | FIXED (HTTP verified) | Errors/Security | Prisma exception filters return technical messages ("Unique constraint failed", "Foreign key constraint failed P2025") and put the raw Prisma error text (model/field names) in `error`. | Map P2002/P2003/P2025 to readable messages per model; never send the raw text | X-ERR-022, X-ERR-036/037 |

## Side fixes made while fixing the above
- `inventory-adjustment.service.ts#create`, `sales.service.ts#softDelete` and `#restore` used to turn
  every error thrown inside their transaction (including "insufficient quantity" and "not found")
  into a generic 500. They now pass HTTP errors through (400/404).
- Quotation conversion (`convertQuotationToSale`) now also sets `converted_at`, as `create` does.
- Sale restore now refuses to consume units reserved for pending deliveries (it previously checked
  `quantity`, not `quantity − reserved_quantity`).

## Fixed after the first round (2026-10-12)
- **Login user enumeration:** tenant and super-admin login returned 404 "User not found" for unknown
  emails, 403 "Password doesn't match" for wrong passwords, and checked the tenant's subscription
  **before** the password. Now both bad cases return **401 "Invalid email or password"**. bcrypt runs
  against a dummy hash for unknown emails, so timing matches too. The subscription check (403 "Your
  subscription is not active. Please renew it or contact support to continue.") runs only after a
  correct password. Both axios interceptors no longer treat a failed login's 401 as an expired session,
  so the login form shows the real message instead of attempting a token refresh. Verified over HTTP
  (10 checks). Tests: BE-SEC-002, X-ERR-030/031, CO-ERR-029/030, E2E-J12.

## How to add an entry
1. Next free `KI-###`. Never reuse.
2. Severity: **High** = money/stock loss, data leak, auth bypass. **Medium** = wrong numbers or 5xx
   under realistic conditions. **Low** = cosmetic or tooling.
3. Link the test ID. Update the status in the same PR as the test.


## Error-message verification (2026-10-13, Asia/Dhaka)
Disposable Postgres 17; all 22 migrations applied and seed completed; backend built and booted with Redis/RabbitMQ disabled. Authenticated HTTP with manually forwarded auth/CSRF cookies:

| Scenario | Result |
|---|---|
| Duplicate product name (valid variant payload) | 409 `A product with this name already exists.` |
| Delete unit referenced by variant | 409 `This unit is still used by other records, so it can't be changed or deleted. Remove or reassign those first.` |
| Redeem 100 points from zero balance, rewards enabled | 400 `Insufficient points balance` |
| Unknown vendor | 404 `Vendor with ID 2147483647 not found` |
| Sale item quantity 0 | 400 `Item 1: quantity must not be less than 1.` plus `errors` array |
| Unknown return PDF | 404 `Return not found` |

All six checked error bodies contained no Prisma text, constraint text or database table names. This is a scenario check, not an exhaustive route sweep. Backend unit tests: **8 suites / 35 tests passed**. KI-014 frontend fixes were statically verified; toast rendering and permanent X4 regression tests remain planned. The temporary backend and database were stopped after verification. Changes remain uncommitted on `fix/known-issues`.


## Phase P0 findings (2026-10-13)
| ID | Severity | Status | Cause and resolution | Verification |
|---|---|---|---|---|
| KI-017 | Medium | FIXED (container verified) | Backend Docker default command was dist/main instead of emitted dist/src/main. Corrected immediately; added backend dockerignore so host native dependencies and local env/data do not enter the image. | Node 22 image builds and starts with default command; six authenticated HTTP checks pass. |
| KI-018 | High | OPEN (development dependencies) | Backend full audit reports 29 high and 5 moderate package entries after compatible npm audit fix; production audit is zero. These are unchanged from the prior PR baseline and trace to braces GHSA-vfj7-8cjw-p6xm and sprintf-js GHSA-hp3w-g68c-fv3c; neither has a patched leaf release listed as of 2026-10-13. Scoped graph replacement/migration is required beyond compatible updates. | PR dependency-delta gate includes dev dependencies and passes for unchanged versions; any newly introduced high/critical finding is blocked. This is a recorded audit baseline, not a suppressed failing test. |
| KI-019 | Critical | FIXED (build/HTTP verified) | Current portfolio audit found Next 15.5.23, Sharp 0.35.3 and source-map-js 1.2.1 vulnerable; the old zero-audit/Next-16-only claim was stale. Owner authorized patching to 15.5.27/0.35.5/1.2.2, preserving the PostCSS override. | Full audit 0; production build passed; home/pricing/health HTTP 200; Sharp image-processing check passed. |


## Phase B1 defects (2026-10-13)
| ID | Severity | Status | Cause and fix | Verification |
|---|---|---|---|---|
| KI-020 | Medium | FIXED (real queue verified) | RabbitMQ intentional close fired its reconnect handler and left recurring timers after app shutdown. Track/cancel retry timers and suppress retries while closing. | BE-HARN-014 publishes/receives the real message, closes the app, asserts no 5-second retry scheduling, and exits normally across three runs. |
| KI-021 | Medium | FIXED (HTTP verified) | Bare IPv4 API host 127.0.0.1 was parsed as tenant subdomain 127, causing valid-cookie requests to return 401. Recognize IP hosts before splitting domain labels. | BE-HARN-018 failed with 401 before the fix and passes with 200 after; explicit cross-tenant Origin remains rejected by BE-HARN-015. |
