# PosBuzz Test & Safety-Net Master Plan

**Goal:** a change anywhere in PosBuzz that breaks behavior somewhere else makes a check fail
**before merge**. If someone edits module A and that silently changes the numbers in S (a report)
and Z (another screen), CI must go red.

**Scope:** `backend/` (NestJS + Prisma + Postgres), `consumer/` (React POS app), `admin/` (React
super-admin app), and the contracts between them.
**Out of scope:** `ai-service/`, `portfolio/`, `PrintingFromWebToPOSPrinter/` (Windows C# app).
The consumer's *calls* to the print agent are covered by consumer tests with a mocked agent, but the
agent itself is not tested.

This folder holds the cross-project plan. Each app keeps its own phases in its own folder:

| Location | Contents |
|---|---|
| `docs/testing/README.md` | This file: execution order, conventions, impact map, Definition of Done |
| `docs/testing/DECISION-PLAYBOOK.md` | **Read before starting.** What to do when anything goes wrong or is unclear |
| `docs/testing/KNOWN-ISSUES.md` | Confirmed defects and immediate repairs with normal passing regression tests |
| `docs/testing/DECISIONS.md` | Log of decisions made during implementation (append-only) |
| `docs/testing/phase-00-baseline-guardrails.md` | Repo-wide first phase: green lint, CI skeleton |
| `docs/testing/phase-X1-cross-layer-contracts.md` | Shared fixtures that backend AND consumer must both satisfy |
| `docs/testing/phase-X2-full-stack-e2e.md` | Playwright journeys against the real stack |
| `docs/testing/phase-X3-ci-enforcement.md` | Branch protection, deploy gating, nightly jobs, ratchets |
| `docs/testing/phase-X4-error-messages.md` | Readable errors from backend to screen |
| `backend/docs/testing/` | Backend phases B1–B8 |
| `consumer/docs/testing/` | Consumer phases C1–C5 |
| `admin/docs/testing/` | Admin phases A1–A2 |

---

## 1. Execution order (do these in sequence)

Each step lists a hard dependency. Steps with no dependency between them **may** run in parallel
on separate branches, but merge them in this order.

| # | Phase | Doc | Depends on | Est. effort |
|---|---|---|---|---|
| 1 | P0 Baseline & guardrails | `docs/testing/phase-00-baseline-guardrails.md` | none | 0.5 day |
| 2 | B1 Backend test harness | `backend/docs/testing/phase-1-test-harness.md` | 1 | 1.5 days |
| 3 | B2 Backend pure-logic unit tests | `backend/docs/testing/phase-2-unit-pure-logic.md` | 2 | 2 days |
| 4 | C1 Consumer test harness | `consumer/docs/testing/phase-1-test-harness.md` | 1 | 0.5 day |
| 5 | C2 Consumer calculation tests | `consumer/docs/testing/phase-2-calculation-logic.md` | 4 | 2 days |
| 6 | X1 Cross-layer contracts | `docs/testing/phase-X1-cross-layer-contracts.md` | 3, 5 | 2 days |
| 7 | B3 Domain integration invariants | `backend/docs/testing/phase-3-domain-integration.md` | 2 | 4 days |
| 8 | B4 Report reconciliation | `backend/docs/testing/phase-4-report-reconciliation.md` | 7 | 2 days |
| 9 | B5 API security, tenancy, route manifest | `backend/docs/testing/phase-5-api-security-tenancy.md` | 2 | 3 days |
| 10 | B6 Schema & migration safety | `backend/docs/testing/phase-6-schema-migrations.md` | 2 | 0.5 day |
| 11 | C3 Consumer API layer, stores, hooks | `consumer/docs/testing/phase-3-api-stores-hooks.md` | 4 | 1.5 days |
| 12 | C4 Consumer page flows | `consumer/docs/testing/phase-4-page-flows.md` | 11, 9 | 4 days |
| 13 | A1 Admin harness + A2 admin tests | `admin/docs/testing/phase-1-*.md`, `phase-2-*.md` | 1, 9 | 2 days |
| 14 | X2 Full-stack E2E (Playwright) | `docs/testing/phase-X2-full-stack-e2e.md` | 7, 12 | 3 days |
| 15 | B7 + C5 Mutation testing | `backend/docs/testing/phase-7-mutation-testing.md`, `consumer/docs/testing/phase-5-mutation-testing.md` | 8, 5 | 2 days |
| 16 | X4 Error messages end-to-end | `docs/testing/phase-X4-error-messages.md` | 9, 12, 13 | 2.5 days |
| 17 | B8 Every service method tested | `backend/docs/testing/phase-8-service-coverage-guarantee.md` | 3–10, 15 | 4 days (mostly tagging B2–B5 tests, then filling gaps) |
| 18 | X3 CI enforcement & maintenance | `docs/testing/phase-X3-ci-enforcement.md` | all | 0.5 day |

**CI grows with the work.** Phase P0 creates `.github/workflows/ci.yml`. Every later phase ends by
adding its own job to that file, as its exit criteria spell out. Never merge a phase whose tests
are not running in CI.

---

## 2. Why the layers are shaped this way (the PosBuzz risk map)

These facts about the codebase drive the plan. They were checked against the code on 2026-10-12.

1. **The money math runs in the browser.** `consumer/src/utils/calculate-totals.utils.ts`,
   `sale-item.utils.ts` and `promotion-validation.ts` compute line totals, tax, discount
   distribution and promotion selection. `backend/src/consumer/sales/services/sales.service.ts`
   `create()` **trusts** `line_total`, `tax_amount` and the per-item discount amounts sent by the
   client and stores derived totals. A change to the frontend math changes stored sales, which
   changes every report. → Phase C2 (exhaustive + property tests), Phase X1 (shared golden fixtures
   asserted on both sides).
2. **Promotion math exists twice.** `promotion-validation.ts` (consumer) mirrors
   `promotions.service.ts` (backend: `calculateDiscount`, `calculateEffectiveQuantity`,
   `calculateBaseWithQuantityLimit`, `evaluatePromotionForCart`). They can drift silently. → X1.
3. **Stock is mutated from 6 places.** Sale create, sale soft-delete/restore, returns (RETURN_IN),
   exchanges (EXCHANGE_OUT), transfers (TRANSFER_OUT/IN), adjustments, batch create. Every mutation
   should write an `InventoryAuditLog` row. → B3 conservation invariant: *sum of audit deltas ==
   current stock* for every batch, after every scenario.
4. **Reports re-derive from stored rows independently.** Dashboard (`dashboard.service.ts`), EOD
   (`sales.service.ts#getEODReport`), list summaries (`calculateSummaryStats`), variant stats (raw
   SQL), user stats, business report PDF. → B4 reconciliation: the same scenario must produce
   agreeing numbers across all reports, with any intentional difference documented in a test.
5. **Multi-tenancy is enforced by hand in every query** (`consumer_id` in each `where`). One missing
   filter leaks data across tenants. → B5 two-tenant matrix over every route.
6. **About 269 HTTP routes in 40 controllers.** Guards are applied per controller. → B5 route manifest:
   a test fails when a route has no declared security policy.
7. **Rewards, credit payments and promotions run *after* the sale transaction commits**, and their
   errors are swallowed with `console.error`. → B3 asserts their side effects explicitly.

**Defects found so far: 16, plus the login-enumeration issue.** KI-001…011 and login enumeration are **fixed**
on branch `fix/known-issues`, verified over HTTP against a real stack; their phase tests are normal regression
tests. KI-012 (committed secrets) is resolved by the owner (secrets rotated, D-010). KI-013…016 (error-message
quality) are fixed: backend scenarios HTTP-verified and frontend handlers statically verified on 2026-10-13; permanent X4 tests remain planned. See `KNOWN-ISSUES.md`.

### Impact map: "if you change X, these must fail"

| Change in… | Tests that must catch it |
|---|---|
| `consumer/src/utils/calculate-totals.utils.ts` | C2 unit + property, X1 sale-totals fixtures (consumer side), C4 POS flow, X2 journey J1 |
| `consumer/src/utils/promotion-validation.ts` | C2, X1 promotion fixtures (consumer side) |
| `backend/.../promotions.service.ts` | B2, X1 promotion fixtures (backend side), B3 promotion scenarios |
| `backend/.../sales.service.ts#create` | B3 SALE-*, B4 all reconciliations, X1 sale-totals (backend side), B7 mutants |
| `backend/.../return.service.ts` | B3 RET-*, B4 refund attribution, conservation invariant |
| any inventory service | B3 conservation invariant, INV-* |
| `dashboard.service.ts` / EOD / summaries | B4 reconciliation, response contract snapshots (B5), C4 dashboard page |
| any controller route path / guard | B5 route manifest + policy table, X1 endpoint parity (consumer) |
| any response shape | B5 contract snapshot → consumer MSW fixtures (C4) fail |
| `ConsumerPermission` enum or `consumer/src/constants/permissions.ts` | X1 permission parity |
| `prisma/schema.prisma` | B6 drift check, B3 (runs on migrated DB) |
| `consumer/src/api/axiosInstance.ts` (CSRF/refresh) | C3 interceptor tests, X2 J0 login, CO-ERR-029 (failed login must not refresh) |
| any `throw new …Exception` / catch block / Prisma filter | X4 X-ERR-001 (masked 4xx scanner), X-ERR-010…012 (readable messages), X-ERR-020…023 (contract over every route) |
| any frontend error handler | X4 CO-ERR-010 (must use `getErrorMessage`), CO-ERR-020…032 (message actually shown) |
| app dependencies / lockfiles / workflow actions | P0 production audit with scoped SECURITY-NOTES exceptions, X3 PR dependency review (vulnerabilities/licenses), immutable npm-ci lockfiles, weekly Dependabot |
| a new public service method | B8 BE-COV-001/010 (inventory changes and must be claimed by a test) |

---

## 3. Global conventions (apply in every phase)

### 3.1 Test IDs
Every test title starts with a stable ID: `[BE-SALE-004]`, `[CO-CALC-012]`, `[AD-AUTH-002]`,
`[X-PROMO-003]`, `[E2E-J1]`. The phase docs list the IDs. Purposes:
- `grep -r "\[BE-SALE-004\]"` proves a planned test exists.
- A failing CI run names the business rule, not just a file.
- IDs are **never reused**. If a test is deleted, its ID is retired; note it in `DECISIONS.md`.

Prefixes: `BE` backend, `CO` consumer, `AD` admin, `X` cross-layer, `E2E` Playwright.

### 3.2 File naming & location
| Kind | Backend | Consumer / Admin |
|---|---|---|
| Unit (no I/O) | `src/**/<name>.spec.ts` next to the source (existing convention) | `src/**/<name>.test.ts(x)` next to source |
| Integration (real Postgres) | `test/integration/**/<area>.int-spec.ts` | n/a |
| HTTP e2e (real app + Postgres) | `test/e2e/**/<area>.e2e-spec.ts` | n/a |
| Page/flow (jsdom + MSW) | n/a | `src/**/__tests__/<page>.flow.test.tsx` |
| Full-stack | `e2e/` at repo root (Playwright) | same |

### 3.3 Production code changes
Keep testing changes focused. Confirmed defects are fixed immediately under §3.4; unrelated runtime changes stay out of scope. The **pre-approved testability seams** below may be added. Each goes in its own commit titled `refactor(testability): …`, and the existing tests must
pass before and after:
1. `backend/src/main.ts`: extract the body of `bootstrap()` (from `app.disable('x-powered-by')`
   to just before `app.listen`) into an exported `configureApp(app, configService)` in
   `backend/src/app.setup.ts`. `bootstrap()` then calls it. (B1)
2. Exporting an existing **pure** helper that is currently module-private, without changing it.
3. Adding `data-testid` attributes in the consumer/admin JSX. (C4, X2)

Anything else that seems necessary → `DECISION-PLAYBOOK.md` §2.

### 3.4 Failures found while testing
Owner instruction (2026-10-13): investigate and fix any failure immediately, then rerun the failing check and relevant related checks. Confirmed runtime defects may be repaired during phased testing; keep a normal passing regression test and record the cause/fix/verification in KNOWN-ISSUES and DECISIONS. Never weaken assertions or use failing/skip markers to hide defects. Document real environment blockers and continue unaffected work. This supersedes older phase text that requires deferring fixes to a separate PR or using `it.failing`/`it.fails`.

### 3.5 Determinism rules
- Backend and consumer test scripts set `TZ=UTC`. Timezone-specific tests set their zone
  explicitly (B4 runs one suite with `TZ=Asia/Dhaka`, the business timezone, since currency is BDT).
- Never call `new Date()` for an expected value. Use fixed instants such as `2026-03-15T10:00:00.000Z`.
- Never use random data without a seed. With `@faker-js/faker`, call `faker.seed(12345)` in
  the factory module. With `fast-check`, a failure prints the seed: paste it into `DECISIONS.md` and
  add it as an explicit regression example.
- Money assertions: compare with `toBeCloseTo(x, 2)` only when the code under test uses floats.
  Values read from Prisma `Decimal` columns are compared as strings via `.toFixed(2)`.

### 3.6 Coverage is a floor, not the goal
Coverage thresholds stop backsliding. The real proof that tests catch changes is **mutation
testing** (B7/C5): Stryker edits the code (`>` → `>=`, `+` → `-`, deletes a line) and checks a test
fails. The target for critical modules is a mutation score of at least 80%.

---

## 4. Definition of Done (per phase)
A phase is done only when **all** of the following are true:
- [ ] Every applicable phase test ID exists and passes normally; retired DOC-DRIFT IDs are recorded.
- [ ] The phase's CI job is in `.github/workflows/ci.yml` and green on the PR.
- [ ] The run is deterministic: `npm run <script>` passes 3 times in a row locally (`for i in 1 2 3; do … || break; done`).
- [ ] Production changes are limited to §3.3 seams and confirmed defects repaired under §3.4, with passing regression evidence.
- [ ] `DECISIONS.md` updated for every judgement call made.
- [ ] The phase's checkbox in §5 below is ticked in the same PR.

## 5. Progress tracker
- [x] P0 Baseline & guardrails — local checks and all 17 CI jobs passed 2026-10-13 on [draft PR #40](https://github.com/PosBuzz/PosClient/pull/40)
- [x] B1 Backend harness — verified 2026-10-13; all 19 jobs passed in [CI run 38297463078](https://github.com/PosBuzz/PosClient/actions/runs/38297463078)
- [x] B2 Backend unit — verified 2026-10-13; all 19 jobs passed in [CI run 38299671151](https://github.com/PosBuzz/PosClient/actions/runs/38299671151)
- [x] C1 Consumer harness — verified 2026-10-13; all 20 jobs passed in [CI run 38301291165](https://github.com/PosBuzz/PosClient/actions/runs/38301291165)
- [x] C2 Consumer calculations — verified 2026-10-13; all 20 jobs passed in [CI run 38303007404](https://github.com/PosBuzz/PosClient/actions/runs/38303007404)
- [ ] X1 Cross-layer contracts — sections 1-3 implemented 2026-10-13 (pricing, subdomains, promotions, sale totals, permissions, inline paths); endpoint/request/type contracts wait for B5/C4/A2
- [x] B3 Domain integration — verified 2026-10-13; all jobs passed in [CI run 38308437854](https://github.com/PosBuzz/PosClient/actions/runs/38308437854)
- [x] B4 Report reconciliation — verified 2026-10-13; all jobs passed in [CI run 38309445550](https://github.com/PosBuzz/PosClient/actions/runs/38309445550)
- [ ] B5 API security & tenancy — implemented and verified locally 2026-10-13 (manifest, auth/CSRF/CORS, 712-case permission matrix, tenancy and robustness sweeps, 18 response contracts); awaiting CI
- [ ] B6 Schema & migrations
- [ ] C3 Consumer API/stores/hooks
- [ ] C4 Consumer page flows
- [ ] A1/A2 Admin
- [ ] X2 Full-stack E2E
- [ ] B7/C5 Mutation testing
- [ ] X4 Error messages end-to-end
- [ ] B8 Every service method tested
- [ ] X3 CI enforcement
