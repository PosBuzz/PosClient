# Phase B4: Report Reconciliation

**Goal:** PosBuzz shows the same business facts on several screens, computed by **independent code**:

| Report | Code | Consumer screen |
|---|---|---|
| Dashboard analytics | `consumer/dashboard/services/dashboard.service.ts#getAnalytics` (UTC day/week/month; week = Sat–Fri) | `pages/dashboard` |
| Sales stats tiles | `sales.service.ts#getSalesStats` (**server-local** day/week) | `pages/sales` |
| Sales/quotation list summary | `sales.service.ts#calculateSummaryStats` (refunds attributed to the **original sale**) | `pages/sales` |
| EOD report | `sales.service.ts#getEODReport` (**server-local** date) | `pages/eod` |
| Business report PDF | `business-report-pdf.service.ts#generate` (renders the EOD response) | EOD → PDF |
| Variant sales stats | `sales.service.ts#getVariantSalesStats` (**raw SQL**) / `getVariantSalesDetail` | `pages/product-variant-sales-stats` |
| User sales stats | `sales.service.ts#getUsersSalesStats` / `getUserSalesDetail` | `pages/user-sales-stats` |
| Inventory summary / low stock / expiring | `inventory.service.ts` (also embedded in dashboard) | `pages/inventory*`, dashboard |
| Promotion sales | `promotions.service.ts#getPromotionSales` | `pages/promotions` |

When someone changes one of these (or changes how a sale/return is stored), the others must still
agree, or the difference must be **intentional and pinned by a test**. This phase builds one
scripted "business day" and asserts every report against it and against the others.

**Depends on:** B3 (factories + invariant net). **Location:** `test/integration/reports/*.int-spec.ts`.

---

## 1. The canonical scenario (`test/integration/reports/scenario.ts`)

A function `buildBusinessDay(prisma, services, { day: '2026-03-14' })` that uses the **services**
(not raw inserts), so stored data is exactly what production writes. All timestamps are controlled
by faking `Date` only (see DECISION-PLAYBOOK §2.3) before each service call. Use `10:00Z`–`16:00Z`
so local-vs-UTC differences cannot matter in the base scenario (both zones run in §4).

Tenant T with 2 branches (Main, Second). Products:
- P1 price 100, EXCLUSIVE 5% tax; P2 price 250, INCLUSIVE 15% tax; P3 price 40, no tax.

Events (record every created id in the returned object):
| # | Time (UTC) | Event |
|---|---|---|
| E1 | 10:00 | Main: sale S1 = P1×2 + P3×1, CASH full |
| E2 | 10:30 | Main: sale S2 = P2×1, special discount 20 on P2, MFS(BKASH) full, customer C1 (rewards enabled) |
| E3 | 11:00 | Second: sale S3 = P1×1, partial CASH 50 |
| E4 | 11:30 | Main: sale S4 = P3×5, average discount 10%, shipping 60, CARD full |
| E5 | 12:00 | Main: quotation Q1 = P1×3 (must not count anywhere as a sale) |
| E6 | 12:30 | Main: S5 = P1×1 CASH, then soft-deleted at 12:45 (must not count anywhere) |
| E7 | 13:00 | Main: return R1 against S1: 1×P3, CASH refund |
| E8 | 13:30 | Main: return R2 against S4: 2×P3 as EXCHANGE for P1×1 |
| E9 | 14:00 | Second: payment on S3 of the remaining amount |
| E10 | 14:30 | Main: operational cost 300 |
| E11 | 15:00 | Main: delivery-later sale S6 = P2×1 CASH (reserved) |

Plus a **previous-day** sale S0 (2026-03-13 15:00Z) with a return R0 on 2026-03-14 11:15Z, to
exercise period attribution.

The scenario file also exports `expected`: **hand-computed** numbers written as literals with a
comment showing the arithmetic. Do not compute them with production helpers. Example:
```ts
// S1: P1 2×100=200 +5% tax 10 → 210 ; P3 1×40 → 40 ; total 250
S1_total: '250.00',
```

## 2. Absolute assertions (each report vs. hand-computed truth)
| ID | Report | Assert |
|---|---|---|
| BE-RPT-001 | EOD (date 2026-03-14, all branches) | `total_sales` (count), `total_amount`, `gross_subtotal`, `total_discount`, `total_tax`, `total_shipping`, `total_collected`, `due_collected` (S3 rest), `total_due`, `cash_sales`, `digital_sales`, `total_refund`, `total_items_returned`, `exchange_sales`, `operational_costs`, `net_sale_amount`, `net_operating_result`, `payment_method_breakdown`, `return_payment_breakdown`. **Before asserting each field, read how it is computed and write in a comment which events contribute.** If a field's definition is unclear → characterization + QUESTION |
| BE-RPT-002 | EOD for branch Second only | only S3 and its payment |
| BE-RPT-003 | Dashboard `summary.today_*` with `Date` faked to 2026-03-14T16:00Z | `today_total_sale`, `today_transactions`, `today_returns_total`, `today_refunds_total`, `today_exchanges_total`, `today_returns_count`, `today_net_sale` (R0 counts **today**: "returns are counted in the period they were refunded in") |
| BE-RPT-004 | Dashboard `payment_method_breakdown` / `return_payment_breakdown` (daily) | per method |
| BE-RPT-005 | Dashboard `top_products` (daily) | order and quantities |
| BE-RPT-006 | Dashboard `weekly_sales_trend` | 2026-03-14 is a **Saturday**, so the week starts that day. The S0 day (Fri 03-13) is in the **previous** week. Assert that boundary explicitly |
| BE-RPT-007 | `calculateSummaryStats` via `findAll` for the day | `total_sales`, `total_amount`, `total_received`, `total_due`, `total_refund` (R0 is **not** included here because its original sale S0 is outside the filter) |
| BE-RPT-008 | `getVariantSalesStats` 2026-03-14 | per variant `total_qty`, `total_amount`, `returned_qty`, `returned_amount` |
| BE-RPT-009 | `getUsersSalesStats` | per cashier counts/amounts (create S2 with a second user to make it meaningful) |
| BE-RPT-010 | Inventory after the day | per-batch quantities; `reserved_quantity` = S6 qty; low-stock list given thresholds |
| BE-RPT-011 | `getPromotionSales` (add a promotion on P1 used by S3) | count and discount sum |
| BE-RPT-012 | Business report PDF `generate()` with the EOD response | returns a Buffer starting with `%PDF`; no throw. (The PDF renders the EOD object, so its numbers come from BE-RPT-001) |

## 3. Cross-report reconciliation (the "A changed, S and Z must fail" net)
These assertions compare reports **with each other**. Each documents an intentional difference.

| ID | Rule |
|---|---|
| BE-RPT-100 | EOD `total_amount` == Dashboard `today_total_sale` == `calculateSummaryStats.total_amount` (same day, all branches) |
| BE-RPT-101 | EOD `total_sales` == Dashboard `today_transactions` == summary `total_sales` |
| BE-RPT-102 | Σ over `getVariantSalesStats.total_amount` == EOD `total_amount` − `total_shipping` ± (record the exact relationship after reading the raw SQL; e.g. whether it is net of item discounts) |
| BE-RPT-103 | Σ `getUsersSalesStats` amounts == EOD `total_amount` |
| BE-RPT-104 | Σ EOD `payment_method_breakdown` == EOD `total_collected` |
| BE-RPT-105 | Dashboard `today_refunds_total` + `today_exchanges_total` == `today_returns_total` |
| BE-RPT-106 | **Intentional difference, pinned:** Dashboard today refunds include R0 (refund-date attribution). Summary `total_refund` for the day excludes R0 (original-sale attribution). The test asserts the difference equals exactly R0's refund |
| BE-RPT-107 | Branch split: report(Main) + report(Second) == report(all) for every additive EOD field |
| BE-RPT-108 | Quotation Q1 and deleted S5 change **no** number in any report: rerun all reports with Q1/S5 removed from the scenario and compare outputs deep-equal (after stripping ids/timestamps) |
| BE-RPT-109 | Inventory: Σ batch quantities per variant == `getVariantStock` == dashboard low-stock input |
| BE-RPT-110 | Rewards: C1 points == points_per_currency × eligible amount of S2 (per settings) |

If any of BE-RPT-100…105/107…110 fails on the **unchanged** code, it is a real inconsistency in
the reports. Follow DECISION-PLAYBOOK §1 → `it.failing` + KI, with the two numbers in the KI row.

## 4. Timezone matrix (KI-008, fixed per D-004)
Business days now follow `BUSINESS_TIMEZONE` (default `Asia/Dhaka`). In production `src/timezone.ts`
sets the process zone; **tests don't load `main.ts`**, so the npm script sets `TZ` directly. Run the reconciliation suite twice. Add an npm script:
```json
"test:int:tz": "TZ=Asia/Dhaka jest --config ./test/jest-integration.json test/integration/reports"
```
and a scenario variant `buildBusinessDay(..., { lateNight: true })` that adds sale S7 at
**2026-03-14T19:30Z** (= 2026-03-15 01:30 Dhaka).

| ID | Assert under TZ=Asia/Dhaka |
|---|---|
| BE-RPT-020 | S7's `sale_number` prefix is `SAL-20260315` (Dhaka date) |
| BE-RPT-021 | Faked now = 2026-03-15T02:00 Dhaka (= 2026-03-14T20:00Z): Dashboard `today_*` and EOD for `date=2026-03-15` **agree**. Both include S7 and both exclude the 03-14 daytime sales (`expect(dash.today_total_sale).toBe(eod.total_amount)`) |
| BE-RPT-022 | Dashboard `weekly_sales_trend` puts S7 under date `2026-03-15`, not `2026-03-14` (SQL `AT TIME ZONE` grouping) |
| BE-RPT-023 | EOD `date`/`period_start`/`period_end` labels equal the requested local date (they used to come from `toISOString()` and could be a day early) |
| BE-RPT-024 | Under TZ=UTC, BE-RPT-100 holds (sanity) |

CI: add `npm run test:int:tz` as a step after `test:int` in the `backend-integration` job.

## 5. Response-shape snapshots for consumers (feeds C4)
For each report endpoint, the **HTTP** response for the canonical scenario is stored as a
contract file (see B5 §6). Fields: dashboard, EOD, sales list (page 1), variant stats, user stats,
inventory summary. That lets consumer page tests render real shapes.

## Exit criteria
- [ ] Scenario builds through services only; `expected` values are literals with arithmetic comments.
- [ ] BE-RPT-001…012, 100…110, 020…022 exist; mismatches are `failing` + KI with numbers.
- [ ] INV net (B3) passes after the scenario.
- [ ] Both `test:int` and `test:int:tz` run in CI.
