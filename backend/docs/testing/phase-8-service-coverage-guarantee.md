# Phase B8: Every Service Method Is Tested (and stays tested)

**Question this phase answers:** "Will every service's logic be tested for correctness?"
Without this phase, **no**. B3 covers the money/stock services in depth, and B3 §7 asks for "every
`throw`" in CRUD services, but nothing *enforces* it. A new method, or one forgotten in a big file,
silently has no test. This phase makes coverage of every public service method **mechanically
enforced**, and makes each test assert **outcomes**, not just "it ran".

**Scope (measured 2026-10-12):** 59 `*.service.ts` files, **310 public methods** under `backend/src`
(the AI description service is included even while the ai-service is off; its HTTP call is mocked).

**Depends on:** B1–B5. Run it after B7. Mutation scores feed §4.

---

## 1. The inventory (`backend/test/coverage/service-inventory.ts`)
A script, not a hand list:
1. Boot a Nest testing module of `AppModule` + `DiscoveryModule`. For every provider whose class name ends in
   `Service`, list the prototype's own methods (`Object.getOwnPropertyNames(proto)`) minus the
   `constructor`, lifecycle hooks (`onModuleInit`, `onModuleDestroy`), getters, and methods whose
   source starts with `private` (read once via `fs` + regex; TypeScript privacy is erased at runtime).
2. Write `test/coverage/service-methods.json`: `[{ service: 'SalesService', method: 'create', file, line }]`
   (UPDATE_CONTRACTS-style regeneration, committed and reviewed).

| ID | Assert |
|---|---|
| BE-COV-001 | Live inventory == committed `service-methods.json`. A new or removed method shows up in review |

## 2. Every method must be claimed by tests
Each test that exercises a service method **declares it** in its title tag:
```ts
it('[BE-SALE-001] {SalesService.create} cash sale decrements FIFO batch', ...)
```
`test/coverage/service-coverage.spec.ts` (runs in `npm test`, plain file scan, no DB):
| ID | Assert |
|---|---|
| BE-COV-010 | Every `{Service.method}` in `service-methods.json` appears in at least one test title under `src/**/*.spec.ts` or `test/**/*.(int|e2e)-spec.ts` |
| BE-COV-011 | Every `{Service.method}` tag used in a test exists in the inventory (no typos, no stale tags after renames) |
| BE-COV-012 | **Depth by risk tier** (tiers below): Tier A methods need ≥ 1 happy-path test **plus** one test per `throw new …Exception` in the method body (counted by regex over the method's source), Tier B ≥ 1 happy-path + ≥ 1 failure test, Tier C ≥ 1 test. A per-method shortfall prints `SalesService.restore: 3 throws, 1 failure test` |
| BE-COV-013 | `test/coverage/exemptions.json` (method → reason, e.g. "pg_dump wrapper, covered by manual checklist X3 §9") must stay ≤ 10 entries; each must still exist in the inventory |

### Risk tiers (`test/coverage/tiers.json`, reviewed)
| Tier | Services | Rule of thumb |
|---|---|---|
| **A** money, stock, auth, tenancy | Sales, Return, Payments, PurchasePayments, InventoryBatch, InventoryTransfer, InventoryAdjustment, Inventory, Rewards, Promotions, Dashboard, BusinessReportPdf (numbers only), Auth, Users (consumer + admin, permissions), Plan, Consumer (admin), ConsumerDataImport, ConsumerPurge, BillingInvoices/BillingHistory, ProductImport, InventoryImport | changes money, stock, who can do what, or tenant data |
| **B** catalog and CRM | Product, ProductVariant, Customer, Vendor, Branch, Category, Brand, Unit, Tag, OperationalCosts, Support (both), ReceiptPdfSetting, ProductAudit | business data, no money movement |
| **C** presentation and plumbing | ReceiptPdf, SalesPdf, QuotationPdf, ReturnPdf, ProductAuditPdf, Portfolio*, SubdomainUtil/Validation, Description (AI), App, Prisma | output formatting, health, CMS |

New services default to **Tier A** until someone reviews `tiers.json`. Wrong tiering errs toward more tests.

## 3. What "tested for correctness" means: required assertions per test
A test that only checks `resolves.toBeDefined()` gives false confidence. The checker can't judge
semantics, so this is enforced by review plus mutation testing (§4). Every service test must:
1. **Assert the returned value's meaningful fields** (amounts as 2-dp strings, statuses, counts), not just existence.
2. **Assert database side effects** through a separate Prisma read: rows created/updated/deleted,
   stock and audit rows, points ledger. B3 INV-01…13 run after every test automatically.
3. **For failures, assert status + message** (`toThrow(BadRequestException)` **and** the message text,
   which ties into X4), and assert **nothing was written** (row counts unchanged).
4. **Tenant check** for every method that takes `consumerId`: one test calls it with another tenant's
   id → not found / rejected, and the other tenant is untouched. BE-COV-014 enforces this:

| ID | Assert |
|---|---|
| BE-COV-014 | For every inventory method whose signature has a `consumerId` parameter, at least one test titled with its tag also contains the marker `(cross-tenant)` |

PR review checklist line (add to the X3 PR template): "New service tests assert values, DB side effects, and messages."

## 4. Mutation score gate for every service (closes the "tests that don't really test" gap)
B7 already mutates the Tier A money/stock methods. Extend `stryker.domain.config.mjs` nightly:
| Tier | Mutate | Break threshold |
|---|---|---|
| A | all methods (B7 ranges + the remaining Tier A services) | 75 (raise to 80 once reached) |
| B | whole files | 60 |
| C | not mutated (output formatting yields mostly equivalent mutants) | — |

| ID | Assert |
|---|---|
| BE-COV-020 | Nightly Stryker per-file scores ≥ the tier threshold; the HTML report is attached to the nightly issue on failure (X3 §6) |

A method that BE-COV-010 says is "covered" but whose mutants all survive is a test that runs code
without checking it. Strengthen its assertions (DECISION-PLAYBOOK §5).

## 5. Order of work
1. Write the inventory + `service-coverage.spec.ts` with **all current gaps listed** in
   `test/coverage/known-gaps.json` (method → owner phase). The check fails only for methods **not** in
   known-gaps, so new code can't add untested methods from day one.
2. Burn down `known-gaps.json` by tier (A, then B, then C), mostly by tagging the B2–B5 tests as they
   get written. Untested leftovers get new tests here, IDs `BE-<MODULE>-1xx`.
3. Remove `known-gaps.json` when empty. The exit criterion is that the file doesn't exist.

## Exit criteria
- [ ] `service-methods.json` committed; BE-COV-001/010/011/012/013/014 green with `known-gaps.json` deleted.
- [ ] Nightly BE-COV-020 green for Tier A and B.
- [x] Proof: adding a dummy public method to `VendorService` makes BE-COV-001 and BE-COV-010 fail (run 2026-10-14, reverted; all five service-coverage tests pass again).
