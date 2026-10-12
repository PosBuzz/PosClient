# Phase X1: Cross-Layer Contracts (backend ⇄ consumer ⇄ admin)

**Goal:** wherever two apps must agree, put the agreement in **one file** and have **both sides
test against it**. Then a change on either side fails on the side that drifted. This is the core
of "change in A must fail S and Z" across projects.

**Depends on:** B2 + C2 (for §1–3); B5 + C4 + A2 (for §4–5, so implement those sections when
those phases land; X1 is "done" only when all sections are in).

Folder layout at the repo root:
```
contracts/
  README.md                 # one paragraph: what this is + "never edit generated files by hand"
  fixtures/                 # HAND-WRITTEN shared truth (reviewed like code)
    pricing.json
    sale-totals/*.json
    promotions/*.json
    subdomains.json
  generated/                # WRITTEN BY TESTS in UPDATE_CONTRACTS=1 mode, then committed
    sale-totals-random.json
  routes.json               # from backend B5 §1
  responses/*.json          # from backend B5 §6
  requests/*.json           # from consumer C4 / admin A2
scripts/contracts/
  check-permissions.mjs
```
`CODEOWNERS` (X3): `contracts/` requires review from a backend **and** a frontend owner.

---

## 1. Pricing & sale totals

### 1.1 `contracts/fixtures/pricing.json`
```json
[
  { "id": "X-PRICE-001", "price": 100, "qty": 2, "taxPct": 5, "method": "EXCLUSIVE",
    "expected": { "line_total": 210, "tax_amount": 10, "taxable_amount": 200 } }
]
```
Include every CO-CALC-001…009 case (copy the rows, same expected values).
- **Consumer** (`src/utils/__contracts__/pricing.contract.test.ts`): for each row,
  `calculateTaxAndTotal(...)` equals `expected`.
- **Backend** (`src/consumer/sales/utils/sale-pricing.util.contract.spec.ts`, runs in `npm test`): for each
  row, `calculateTaxAndTotal` from `sale-pricing.util.ts` equals `expected` (`line_total`, `tax_amount`).
  This is **production code** now: the server rejects sales whose lines disagree with it (KI-005 fix),
  so any drift from the POS math would reject real sales.

### 1.2 `contracts/fixtures/sale-totals/*.json` (hand-written, ~10 files)
Each file describes a cart **in consumer terms** and the expected totals:
```json
{
  "id": "X-TOT-001",
  "description": "B4 scenario S1: P1×2 (5% EXCL) + P3×1, cash",
  "variants": [ { "key": "P1", "price": 100, "taxPct": 5, "method": "EXCLUSIVE" },
                { "key": "P3", "price": 40,  "taxPct": 0, "method": "EXCLUSIVE" } ],
  "lines": [ { "variant": "P1", "qty": 2 }, { "variant": "P3", "qty": 1 } ],
  "averageDiscount": { "type": "FLAT", "amount": 0 },
  "specialDiscounts": {},
  "shipping": 0,
  "promotions": [],
  "expected": { "subtotal": "240.00", "tax_amount": "10.00", "discount_amount": "0.00", "total_amount": "250.00" }
}
```
Required files: `cash-simple`, `mixed-tax` (EXCL + INCL + none), `average-flat-remainder` (3 equal
lines, flat 10), `average-percent-inclusive`, `special-discount`, `shipping`,
`promotion-percentage`, `promotion-fixed-per-unit`, `promotion-quantity-cap`,
`promotion-tie-break` (two promos with an equal discount).

- **Consumer** (`sale-totals.contract.test.ts`): build `SaleItem`s via `calculateTaxAndTotal`,
  run `calculateSaleTotals` (with `evaluatePromotionLocally` as `evaluatePromotionFn` and fake time
  `2026-03-14T10:00Z`), and assert the four totals.
- **Backend** (`test/integration/contracts/sale-totals.contract.int-spec.ts`): create the variants
  (and promotions) with factories, build the **same payload the consumer would send**, `POST`
  it through `SalesService.create`, and assert the stored `subtotal/tax_amount/discount_amount/total_amount`.
  The backend doesn't import consumer code, so where does the payload come from? → §1.3.

### 1.3 Randomized round-trip: `contracts/generated/sale-totals-random.json`
The strongest cross-layer check. **The consumer generates; the backend replays.**
1. Consumer test `sale-totals-random.contract.test.ts` uses fast-check with `seed: 20261012`
   to generate **200 carts** (no promotions, so that backend setup stays simple; promotions are
   covered by §1.2 and §2). For each cart, compute `calculateSaleTotals` and write
   `{ cart, payloadItems: discountedItems mapped exactly like pages/pos/index.tsx builds saleData.items,
      shipping, expected: {subtotal, tax_amount, discount_amount, total_amount} }`.
   - `UPDATE_CONTRACTS=1` → write the file. Otherwise → regenerate in memory and deep-compare with
     the committed file. **So a change to consumer math fails the consumer test** until regenerated.
2. Backend test `sale-totals-random.contract.int-spec.ts` replays every entry: create variants
   with the cart's prices/taxes, send `payloadItems` + shipping + a CASH payment of `expected.total_amount`
   to `SalesService.create`, then assert the stored totals equal `expected` (2-dp strings) and
   `payment_status === 'paid'`. **So a change to the backend's derivation fails the backend test.**
3. After regeneration, the backend replay must still pass. A consumer change that alters what
   the backend stores therefore shows up as a failing backend test in the same PR.

| ID | Side | Assert |
|---|---|---|
| X-TOT-R01 | consumer | regenerated file deep-equals committed file |
| X-TOT-R02 | backend | all 200 replays store the expected totals |
| X-TOT-R03 | backend | INV-01…13 hold after the replay |

Keep the generator's mapping from `discountedItems` to payload items in **one** consumer function
(seam: extract `toSalePayloadItems(discountedItems)` from `pages/pos/index.tsx` into
`src/utils/sale-payload.utils.ts`, a pure move, and use it in pos, add-sales and add-quotation).
If extraction touches 3 pages and feels risky, use it only in the generator first, and add
CO-FLOW-SALE-001 (C4) as the guard that the pages send the same shape. Log the choice.

## 2. Promotion evaluation parity: `contracts/fixtures/promotions/*.json`
```json
{
  "id": "X-PROMO-001",
  "now": "2026-03-14T10:00:00.000Z",
  "promotion": { "scope": "SINGLE_PRODUCT", "discount_type": "PERCENTAGE", "discount_value": 10,
                 "products": ["P1"], "min_quantity": 1, "cap_quantity": null, "...": "all Promotion fields used by either side" },
  "branch": "main", "customer": null,
  "cart": [ { "variant": "P1", "qty": 3, "price": 100 } ],
  "expected": { "eligible": true, "discount_amount": "30.00", "matched": ["P1"] }
}
```
One fixture per eligibility rule and per discount path: at least every CO-PROMO-* case plus
every `BE-PROMO-*` example. For ineligible cases: `"expected": { "eligible": false, "reason_code": "EXPIRED" }`.
Reasons are matched by code, because the two sides word their messages differently. Each side's
test keeps a small `reasonCode(messageOrError)` map. **If one side has a rule the other lacks**
(e.g. the backend enforces `customer_usage_limit` and the frontend doesn't check it),
the fixture says `"expected_frontend": {...}, "expected_backend": {...}` **and** the test logs it
to `DECISIONS.md` as a known asymmetry. Asymmetries are allowed only when written down.

- **Consumer:** `evaluatePromotionLocally` with the fixture mapped to `Promotion`/`SaleItem` types.
- **Backend:** integration test: factories create the promotion (+ products, branches, usage
  history if `promotion.sales_count` is set: create that many prior sales), then call
  `PromotionsService.assertAndCalculateDiscount(...)` (or `evaluatePromotionForCart` through it) and map
  the result or exception to the same shape.

| ID | Assert |
|---|---|
| X-PROMO-001…0nn | both sides produce the fixture's `expected` (or their side-specific one) |

## 3. Static parity checks (`scripts/contracts/*.mjs`, run in the `contracts` CI job)
| ID | Check | How |
|---|---|---|
| X-PERM-001 | Consumer permission values == backend `ConsumerPermission` values == `prisma/seed.ts` `consumerPermissions` list | `check-permissions.mjs`: regex-extract string literals from `consumer/src/constants/permissions.ts` (object values), `backend/src/auth/enums/consumerPermissions.enum.ts` (enum values), and the `consumerPermissions = [...]` array in `backend/prisma/seed.ts`. Compare as sets; print the diff. Known today: all three have 19 values; confirm on first run |
| X-PERM-002 | Same for `AdminPermission` enum vs the seed's super-admin permission list |
| X-SUBD-001 | `contracts/fixtures/subdomains.json` (host → expected subdomain): consumer `getSubdomain` test **and** backend `extractSubdomainFromHost` test both iterate it. If the frontend intentionally differs (e.g. special-cases the marketing domain), use `expected_frontend`/`expected_backend` and log it |
| X-ENDP-001 | **Consumer endpoint parity** (consumer test `src/api/__contracts__/endpoints.contract.test.ts`): for every value in `endpoints` (call functions with `1`), strip any query string, prefix `/api/v1`, and require a matching route in `contracts/routes.json` (convert `:param` to `[^/]+`). The HTTP method isn't known from `endpoints.ts`, so match path only here; methods are covered by CO-APIM-* + the request contracts |
| X-ENDP-002 | Same for admin `endpoints.ts` (absolute URLs: strip `baseUrlWithPrefix`) |
| X-ENDP-003 | **No hardcoded API paths outside `endpoints.ts`:** scan `consumer/src/**` and `admin/src/**` (excluding tests and `endpoints.ts`) for string/template literals starting with `/consumer/`, `/admin/`, `/auth/`, `/public/`, `/receipt-settings`, `/ai/`. Each hit must be moved to `endpoints.ts` (that's a refactor, so a separate PR) or listed in `scripts/contracts/allowed-inline-paths.json` with a reason. This makes X-ENDP-001 complete |
| X-ENDP-004 | **Reverse direction:** every client-guarded route in `routes.json` is referenced by the consumer (via `endpoints`) **or** listed in `contracts/unused-routes.json` with a reason. New backend routes then need an explicit "who calls this" answer |

## 4. Request contracts replay (backend side of C4/A2)
File format (`contracts/requests/<name>.json`, written by C4/A2):
```json
{ "method": "POST", "path": "/consumer/sales", "auth": "client",
  "body": { ... },
  "expect": { "subtotal": "240.00", "tax_amount": "10.00", "discount_amount": "0.00", "total_amount": "250.00" } }
```
Backend `test/e2e/contracts/request-replay.e2e-spec.ts`:
1. `resetDb()`, build B4's `buildBusinessDay` scenario. It is the same data the consumer's MSW
   fixtures came from (B5 §6), so every id in the bodies exists (BE-CONTRACT-000 guarantees
   determinism).
2. For each request file: send it over HTTP as the scenario's tenant admin (or super-admin for
   `auth: "admin"`) with CSRF.
3. Assert status 2xx. If `expect` is present, read the created row and compare.
4. `resetDb()` + rebuild between files (they may conflict, e.g. two sales of the last unit).

| ID | Assert |
|---|---|
| X-REQ-<name> | replay succeeds with expected postconditions |
| X-REQ-000 | every file in `contracts/requests/` has a matching test case (no silently skipped files) |

**Order of operations when a request contract changes:** the consumer PR regenerates the file →
the backend replay runs in the same PR's CI → if the backend rejects the new payload, the PR is red.
That is the guarantee.

## 5. Type-level response contracts (consumer `tsc`)
`consumer/src/test/contract-types.ts` (included by `tsconfig.test.json`, so `tsc -b` checks it):
```ts
import saleDetail from "../../../contracts/responses/sale-detail.json";
import type { Sale } from "../types/sale.types";
export const _saleDetail: Sale = saleDetail; // fails typecheck if the backend shape no longer fits the type
```
One line per contract file ↔ consumer type (`sale.types.ts`, `return.types.ts`, `rewards.types.ts`,
`promotion.types.ts`, `customer.types.ts`, `payment.types.ts`, `product.types.ts`). Requires
`"resolveJsonModule": true` in `tsconfig.test.json` compilerOptions.
**Expect mismatches on first run** (e.g. a type says `total_amount: number` while Prisma Decimals
serialize as strings). For each mismatch, decide with DECISION-PLAYBOOK §1:
- If the UI already wraps the field in `Number(...)` everywhere → the **type** is wrong. Fix the
  type in a separate small PR (types only, no runtime change) and log it.
- Otherwise → KI (the UI may be doing string math, e.g. `"10.00" + 5`).
Until resolved, use `// @ts-expect-error KI-0xx` on that line so the check stays active for everything else.

| ID | Assert |
|---|---|
| X-TYPE-001 | `npm run typecheck` in consumer passes with the contract-type file present |
| X-TYPE-002 | Same in admin for `auth-admin.json`, `admin-consumers.json`, `admin-plans.json` against admin types (if the admin app has no types for them, skip and log) |

## 6. CI
```yaml
  contracts:
    name: Cross-layer contracts (static)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc }
      - run: node scripts/contracts/check-permissions.mjs
      - run: node scripts/contracts/check-inline-paths.mjs
```
The fixture-based tests (§1, §2, §4, §5) run inside the existing `backend-unit`,
`backend-integration`, `consumer-tests` and `admin-tests` jobs. No extra job is needed.

## Exit criteria
- [ ] `contracts/` exists with fixtures, generated files, routes, responses, requests.
- [ ] X-PRICE-*, X-TOT-*, X-TOT-R01…03, X-PROMO-*, X-PERM-*, X-SUBD-*, X-ENDP-*, X-REQ-*, X-TYPE-* green or `failing` + KI.
- [ ] **Proof run** (record it in the PR description, then revert both edits):
      (a) in `consumer/src/utils/calculate-totals.utils.ts`, drop the remainder logic in
      `distributeDiscount` (give the last item `share` like the others) → X-TOT-R01 and the
      `average-flat-remainder` fixture fail on the consumer side.
      (b) in `backend/src/consumer/sales/services/sales.service.ts#create`, remove `+ shippingCost`
      from `totalAmount` → X-TOT-R02 (carts with shipping), the `shipping` fixture, and B4 reconciliation fail on the backend side.
