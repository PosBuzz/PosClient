# Phase C2: Consumer Calculation Logic

**Goal:** every number the POS computes is pinned by example tests **and** guarded by property
tests (invariants that must hold for *any* cart). These functions decide what the backend stores
(`sales.service.ts#create` trusts `line_total`, `tax_amount` and discount amounts). A regression
here corrupts every sale and every report.

**Depends on:** C1. **Location:** next to source, `src/utils/<name>.test.ts`. **Runner:** `npm test`.

Targets (all pure, no React):
| File | Exports |
|---|---|
| `src/utils/sale-item.utils.ts` | `calculateTaxAndTotal`, `getVariantPriceForSale`, `upsertVariantInSaleItems`, `updateSaleItemQuantity`, `removeSaleItem`, `updateSaleItemSpecialDiscount` |
| `src/utils/calculate-totals.utils.ts` | `calculateSaleTotals` (+ private `distributeDiscount`, `getItemBaseAmount`, `round2`, tested through it) |
| `src/utils/promotion-validation.ts` | `evaluatePromotionLocally` (+ private `calculateDiscount`, `calculateEffectiveQuantity`, `calculateBaseWithQuantityLimit`) |
| `src/utils/promotion-helpers.utils.ts` | `getVariantBrandByIdMap`, `evaluatePromotionForItems`, `getPromotionRequiredVariantIds`, `getPromotionCandidateVariants`, `enrichCartForPromotion` |
| `src/utils/formatters.ts` | `formatCurrency`, `discountPercentSuffix`, `formatDate` |
| `src/utils/payment-provider.utils.ts` | all exports |
| `src/utils/product-search.utils.ts` | `getProductVariantSearchLabel` |
| `src/utils/subdomain.ts` | `getSubdomain` (pure part) |

Shared test builders: `src/test/builders.ts` with `item(overrides)`, `variant(overrides)` and
`promotion(overrides)`. They return fully-typed `SaleItem` / `ProductVariantForSale` / `Promotion`
with sane defaults (price 100, qty 1, EXCLUSIVE, 0% tax, active promotion starting 2026-01-01).
**Builders compute `line_total`/`tax_amount` by calling `calculateTaxAndTotal`.** Never hand-type
derived fields, or the fixtures drift from reality.

---

## 1. `calculateTaxAndTotal` (`sale-item.utils.test.ts`)
| ID | price, qty, tax%, method | Expected `{line_total, tax_amount, taxable_amount}` |
|---|---|---|
| CO-CALC-001 | 100, 2, 0, EXCLUSIVE | 200, 0, 200 |
| CO-CALC-002 | 100, 2, 5, EXCLUSIVE | 210, 10, 200 |
| CO-CALC-003 | 115, 1, 15, INCLUSIVE | 115, 15, 100 |
| CO-CALC-004 | 100, 3, 7.5, INCLUSIVE | 300, 20.93, 279.07 (300×7.5/107.5 = 20.930…) |
| CO-CALC-005 | method `"inclusive"`, `" Inc "`, `"INC"` | treated as inclusive (`startsWith("INC")` after trim/upper) |
| CO-CALC-006 | method `""`, `undefined`, `"foo"` | exclusive |
| CO-CALC-007 | tax% `NaN`/`undefined`/`"abc"` | treated as 0 |
| CO-CALC-008 | 0.1, 3, 0, EXCLUSIVE | 0.3 exactly (rounding hides float error) |
| CO-CALC-009 | 33.333, 3, 0 | 100 (2-dp rounding) |
| CO-CALC-P01 | **property:** exclusive → `line_total ≈ taxable + tax` (±0.01) | |
| CO-CALC-P02 | **property:** inclusive → `line_total == round2(price×qty)` and `tax ≤ line_total` | |
| CO-CALC-P03 | **property:** all outputs ≥ 0 for non-negative inputs; all have ≤ 2 decimals | |
| CO-CALC-P04 | **property:** tax monotonic non-decreasing in tax% (same method) | |

## 2. Cart mutation helpers
| ID | Function | Case |
|---|---|---|
| CO-CART-001 | `getVariantPriceForSale` | REGULAR → regular; WHOLESALE → wholesale; WHOLESALE with wholesale 0/null → regular |
| CO-CART-002 | `upsertVariantInSaleItems` | new variant appended with computed tax/total and all display fields copied |
| CO-CART-003 | same | existing variant → quantity summed, **price re-read for the current priceType**, totals recomputed |
| CO-CART-004 | same | does not mutate `sourceItems` (freeze the input with `Object.freeze` deep) |
| CO-CART-005 | `updateSaleItemQuantity` | recomputes with **item's own unit_price** (not variant price); falls back to item.tax_method when variant missing |
| CO-CART-006 | `removeSaleItem` | removes only that variant |
| CO-CART-007 | `updateSaleItemSpecialDiscount` | negative / NaN → 0; doesn't touch other items |
| CO-CART-008 | same | characterization: special discount **larger than the line** is accepted here. Check whether `calculateSaleTotals` or the UI clamps it (CO-TOT-030). If nothing clamps it → `it.fails` with a negative total expectation, plus a KI |

## 3. `calculateSaleTotals` (`calculate-totals.utils.test.ts`)
Use `evaluatePromotionFn: () => ({ is_eligible: false })` unless a test is about promotions.

### 3.1 Examples
| ID | Cart | Assert |
|---|---|---|
| CO-TOT-001 | empty | all zeros, `discountedItems: []` |
| CO-TOT-002 | 1 item 100×2, 5% EXCL | subtotal 200, tax 10, total 210 |
| CO-TOT-003 | INCLUSIVE 115 (15%) | subtotal 100 (line − tax), tax 15, total 115 |
| CO-TOT-004 | mixed EXCL + INCL + no-tax (same three products as B4 scenario P1/P2/P3) | subtotal/tax/total exact values, written with arithmetic comments |
| CO-TOT-005 | average discount FLAT 30 over items with bases 100 and 200 | shares 10 / 20 (proportional to `unit_price × qty`), total discount 30 |
| CO-TOT-006 | average discount FLAT 10 over 3 equal items | shares 3.33, 3.33, **3.34** (remainder on the last item); Σ == 10 exactly |
| CO-TOT-007 | average discount PERCENTAGE 10% | base is `Σ unit_price × qty` (pre-tax, also for INCLUSIVE items), **not** subtotal. Pin with an INCLUSIVE item where the two differ |
| CO-TOT-008 | special discount 20 on item A | A's `special_discount_amount` 20, B's 0; `specialDiscount` 20 |
| CO-TOT-009 | shipping 60 | total += 60; `shippingCost` rounded to 2 dp |
| CO-TOT-010 | `discountedItems[i].line_total` == original `line_total − (avg + special + promo share)`; `sold_unit_price == round2(net / qty)` | |
| CO-TOT-011 | `discountBreakdownByVariant` keys equal the variant ids; each `total == average + special + promotion` | |
| CO-TOT-012 | tax is **not** reduced by discounts (tax computed on the pre-discount price) | characterization: pin it and log a QUESTION (is tax-before-discount the intended rule?) |

### 3.2 Promotion selection (5-tier tie-break in `calculateSaleTotals`)
Provide an `evaluatePromotionFn` stub returning chosen `{ is_eligible, discount_amount, matched_variant_ids }` per promotion id.
| ID | Case | Winner |
|---|---|---|
| CO-TOT-020 | P1 gives 10 on A, P2 gives 15 on A | P2 (bigger discount) |
| CO-TOT-021 | equal discount; P1 matches 2 variants, P2 matches 1 | P1 (more matched variants) |
| CO-TOT-022 | equal discount and variant count; P1 matched total qty 5 vs P2 3 | P1 |
| CO-TOT-023 | … equal matched total qty; matched item qty differs | larger item qty |
| CO-TOT-024 | everything equal | **lower promotion id** |
| CO-TOT-025 | ineligible promotion is ignored even with a large discount | |
| CO-TOT-026 | one promotion across 2 variants: distribution proportional to each base; Σ == promo discount | |
| CO-TOT-027 | different variants each get their own best promotion; `promotionDiscount` == Σ chosen | |
| CO-TOT-028 | input order of `appliedPromotions` doesn't change the result (shuffle with a fixed seed) | |

### 3.3 Properties (fast-check, `{ seed: 424242, numRuns: 500 }`)
Arbitrary cart: 1–8 items, price 0.01–100000 (2 dp), qty 1–50, tax% 0–25 (2 dp), method EXCL/INCL,
special discount 0–(line base), average discount FLAT 0–(Σ base) or PERCENTAGE 0–100, shipping 0–1000.
| ID | Invariant |
|---|---|
| CO-TOT-P01 | `total == round2(subtotal − finalDiscount + totalTax + shipping)` |
| CO-TOT-P02 | `finalDiscount == round2(promotionDiscount + averageDiscount + specialDiscount)` |
| CO-TOT-P03 | Σ `discountedItems.average_discount_amount` == `averageDiscount` (exact to 2 dp, because the remainder goes to the last item) whenever some item has base > 0 |
| CO-TOT-P04 | every output money field has ≤ 2 decimals |
| CO-TOT-P05 | **Backend-reconstruction property:** recompute what `sales.service.ts#create` will store from `discountedItems` (copy that formula into the test as `backendTotalsFrom(items, shipping)`, with a comment pointing to the backend lines). It must equal `{subtotal, tax, discount, total}` from `calculateSaleTotals` (±0.01). **This is the cross-layer guard in pure form**. X1 makes it real |
| CO-TOT-P06 | with no discounts and no shipping, `total == Σ original line_total` |
| CO-TOT-P07 | adding an item never decreases `subtotal`; increasing qty never decreases `totalTax` |
| CO-TOT-030 | **property expected to fail?** `total ≥ 0`: generate special discounts up to 2× base. If it fails → `it.fails` + KI (no clamping) |

## 4. `evaluatePromotionLocally` (`promotion-validation.test.ts`)
Freeze time: `vi.useFakeTimers(); vi.setSystemTime(new Date("2026-03-14T10:00:00Z"))`. These are
pure functions with no timers to worry about.

Each ineligibility branch, in code order, with the exact `reason` string:
| ID | Case | reason |
|---|---|---|
| CO-PROMO-001 | no branchId | "Please select a branch before applying a promotion" |
| CO-PROMO-002 | `is_active: false` | "Promotion is inactive" |
| CO-PROMO-003 | start in future | "Promotion has not started yet" |
| CO-PROMO-004 | end in past | "Promotion has already expired" |
| CO-PROMO-005 | invalid date strings | **ignored** (NaN check). Pin it |
| CO-PROMO-006 | branch_specific, branch not in list / empty list | "Promotion is not available for selected branch" |
| CO-PROMO-007 | `sales_count >= usage_limit` (limit > 0) | "Promotion usage limit reached and promo closed" |
| CO-PROMO-008 | `total_discount_given >= max_discount_amount` | "Promotion max discount reached and promo closed" |
| CO-PROMO-009 | member_only without customer | "This promotion is for registered customers only" |
| CO-PROMO-010 | limit_per_customer without customer | "Select a registered customer to apply this promotion" |
| CO-PROMO-011 | all items qty ≤ 0 | "Cart is empty" |
| CO-PROMO-012 | below min_purchase | "Minimum purchase amount condition not met" |
| CO-PROMO-013…0nn | **every remaining branch** after line 260 of the file (scope SINGLE_PRODUCT / multi / brand, min_quantity, cap_quantity, cap_discount_amount, remaining max discount). Read the rest of the function and add one test per `return ineligible(...)` and per discount path. Number them sequentially |
| CO-PROMO-050 | duplicate variant lines in `items` are aggregated (qty and subtotal summed) | |
| CO-PROMO-051 | subtotal uses `unit_price × qty`, falling back to `line_total` when that is 0 | |
| CO-PROMO-052 | boundary: `start_date == now` → eligible; `end_date == now` → eligible (strict `>`/`<`) | |

Private math helpers (`calculateDiscount`, etc.): test through `evaluatePromotionLocally` with
carts designed to hit each branch. **Do not export them just for testing**: X1 compares them
with the backend through fixtures.

## 5. `promotion-helpers.utils.ts`, `formatters.ts`, others
- One test per exported function per branch. IDs `CO-PH-0nn`, `CO-FMT-0nn`, `CO-PAYP-0nn`, `CO-SRCH-0nn`, `CO-SUBD-0nn`.
- `formatCurrency`: `null`/`undefined` → `"N/A"`; `0` → `"BDT 0.00"`; `1234.5` → `"BDT 1234.50"`; `-5` → `"BDT -5.00"`.
- `discountPercentSuffix`: read the doc comment ("empty when there is no base"); test base 0, normal, rounding.
- `getSubdomain` (`src/utils/subdomain.ts`): set `window.location` via `vi.stubGlobal` or
  `history.replaceState` with host variants: `acme.localhost`, `localhost`, `acme.posbuzz.com`,
  `www.posbuzz.com`. The parsing must agree with the backend's `extractSubdomainFromHost`
  (B2 BE-SUB-*). Use the **same input table** and copy it into both tests with a comment linking
  them. X1 turns it into a shared fixture.

## 6. Coverage gate
In `vitest.config.ts` `coverage.thresholds`:
```ts
thresholds: {
  "src/utils/calculate-totals.utils.ts": { lines: 100, branches: 100, functions: 100, statements: 100 },
  "src/utils/sale-item.utils.ts": { lines: 100, branches: 100, functions: 100, statements: 100 },
  "src/utils/promotion-validation.ts": { lines: 100, branches: 95, functions: 100, statements: 100 },
  "src/utils/promotion-helpers.utils.ts": { lines: 95, branches: 90 },
  "src/utils/formatters.ts": { lines: 100, branches: 100 },
}
```
(Vitest supports per-file glob thresholds in the `thresholds` object.)

## Exit criteria
- [ ] All IDs present; properties run with fixed seeds; any failing property is either a real bug (`it.fails` + KI with the counterexample) or a test bug (fixed).
- [ ] Coverage thresholds met.
