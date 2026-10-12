# Phase B3: Domain Integration Tests (real Postgres)

**Goal:** every flow that moves **money or stock** is exercised against a real migrated database
through the real Nest services. After **every** test, a set of global invariants is checked. A
change in any flow that breaks stock, money or tenant isolation **anywhere** fails the run, even
when the test that triggered it was about something else.

**Depends on:** B1. **Location:** `backend/test/integration/<area>.int-spec.ts`. **Runner:** `npm run test:int`.

**Level choice:** call services obtained from `createTestApp().moduleRef.get(XService)` (real DI,
real Prisma). Don't go through HTTP here. HTTP concerns belong to B5. Exception: when a flow lives
only in a controller, use HTTP.

---

## 1. The invariant net (`test/helpers/invariants.ts`), written first

`assertInvariants(prisma, ctx)` runs these checks and throws a readable diff on failure. Call it in
`afterEach` of **every** B3 and B4 test file.

| ID | Invariant | Query sketch |
|---|---|---|
| INV-01 | **Stock conservation:** for every `inventory_batches` row, `quantity == SUM(inventory_audit_logs.quantity_delta WHERE batch_id = batch.id)` | one SQL `GROUP BY batch_id` joined to batches, return mismatches |
| INV-02 | `quantity >= 0` for every batch | — |
| INV-03 | `0 <= reserved_quantity <= quantity` for every batch | — |
| INV-04 | Audit row `quantity_after` of each batch's **latest** audit row (by id) equals current `quantity` | — |
| INV-05 | **Sale arithmetic** for every non-quotation sale: `total_amount == subtotal - discount_amount + tax_amount + shipping_cost` (±0.01) | — |
| INV-06 | `discount_amount == SUM(items.average + special + promotion discount)` (±0.01) **for sales created after the per-item discount model** (all test sales) | — |
| INV-07 | `received_amount == SUM(sale_payments.amount)` (±0.01) | characterization: confirm against `payments.service.ts#makePayment` (does it update `received_amount`? read it). If partial payments are tracked differently, adjust INV-07 to the real model and log it |
| INV-08 | `payment_status` agrees with amounts: `received == 0 → 'due'`, `0 < received < total → 'partial'`, `received >= total → 'paid'`. Skip `cancelled` | — |
| INV-09 | Per sale: `SUM(returns.total_refund + total_exchange) <= total_amount` (±0.01) | — |
| INV-10 | Per sale item: `SUM(return_items.quantity) <= sale_items.quantity` | — |
| INV-11 | **Rewards ledger:** for every `CustomerRewardsPoints`, `total_points == last RewardsPointTransaction.balance_after` for that customer, and every transaction has `balance_after == balance_before ± points` (check the sign convention per `type` in `rewards.service.ts#createPointTransaction`) | — |
| INV-12 | **Tenant consistency:** every `sale_items.variant → product.consumer_id == sale.consumer_id`; every `inventory_audit_logs.consumer_id == batch.variant.product.consumer_id`; every `return_items.batch` belongs to the return's consumer | joins |
| INV-13 | **Bystander tenant untouched:** a second tenant ("bystander") created in `beforeEach` with stock and one sale. Its rows hash identically before and after the test | `md5(string_agg(row_to_json(t)::text, ...))` per table filtered by its consumer_id |

Write the invariants as SQL in `$queryRaw`. **Never** reuse service code. The net must be
independent of the code it checks.

Self-test the net (`test/integration/invariants.int-spec.ts`):
| ID | Case |
|---|---|
| BE-NET-001 | Clean scenario → no violations |
| BE-NET-002 | Manually `UPDATE inventory_batches SET quantity = quantity + 1` → INV-01 reports that batch |
| BE-NET-003 | Manually break a sale's `total_amount` → INV-05 reports it |
| BE-NET-004 | Modify the bystander tenant → INV-13 reports it |

Without these, a broken invariant helper would silently pass everything.

---

## 2. Sales (`test/integration/sales.int-spec.ts`), `SalesService.create`
Use `buildSaleDto` (B1) so payloads match what the consumer sends.

| ID | Scenario | Assert |
|---|---|---|
| BE-SALE-001 | 1 item, cash paid in full | sale `paid`; `received_amount == total`; 1 `SALE_OUT` audit row with `quantity_delta = -qty`, `reference_type 'sale_items'` |
| BE-SALE-002 | **FIFO:** batches created at t1 (qty 2) and t2 (qty 5), sell 2, no `batch_id` | the t1 batch decremented. Use explicit `created_at` in the factory |
| BE-SALE-003 | FIFO skips batches where `quantity - reserved_quantity == 0` | next batch used |
| BE-SALE-004 | Explicit `batch_id` | that batch used even if not oldest |
| BE-SALE-005 | Requested qty > available in **the selected single batch** while total across batches is enough | `BadRequest 'Insufficient stock…'` (characterization: the current code never splits across batches. Pin it and log a QUESTION) |
| BE-SALE-006 | Variant of another tenant | `BadRequest 'Product variant … not found'`, no rows written |
| BE-SALE-007 | Branch of another tenant | `BadRequest 'Branch not found or not accessible'` |
| BE-SALE-008 | Customer / served_by of another tenant | BadRequest each |
| BE-SALE-009 | No payments | `payment_status 'due'`, received 0 |
| BE-SALE-010 | Partial payment | `'partial'` |
| BE-SALE-011 | Split payment CASH + MFS(payment_type) | 2 `sale_payments` rows, `received == sum` |
| BE-SALE-012 | Totals: 2 items with tax EXCLUSIVE 5% and INCLUSIVE 15%, special discount on one, average discount spread, shipping 60 | stored `subtotal`, `discount_amount`, `tax_amount`, `total_amount` equal the values the consumer's `calculateSaleTotals` gives for the same cart (take expected values from X1 fixture `sale-totals/mixed-tax.json` once X1 exists; until then compute by hand in the test with comments) |
| BE-SALE-013 | Quotation (`sale_type: 'quotation'`) | number prefix from `generateQuotationNumber`; **no** stock change; **no** audit rows; ignores stock availability |
| BE-SALE-014 | Convert quotation → sale (`quotation_id`) | quotation gets `converted_to_sale_id` + `converted_at`; converting again → BadRequest 'already been converted' |
| BE-SALE-015 | `convertQuotationToSale` service method (separate path!) | same postconditions as 014; stock decremented; invariants hold |
| BE-SALE-016 | `is_delivery_later: true` | `reserved_quantity += qty`, `quantity` unchanged, **no** audit row, `delivery_status 'PENDING'` |
| BE-SALE-017 | `completePendingDelivery` | `quantity -= qty`, `reserved -= qty`, one `SALE_OUT` audit row, `delivery_status 'DELIVERED'`, `delivered_at` set |
| BE-SALE-018 | `cancelPendingDelivery` | reserved released; read the method for its stock postconditions and assert them |
| BE-SALE-019 | Online order (`is_online_order`) | `online_order_status 'PENDING'` default; `updateOnlineOrderStatus` (existing unit spec) also works against the real DB |
| BE-SALE-020 | Sale numbers sequential per tenant per day: 3 sales → `…-0001`, `-0002`, `-0003`; another tenant same day → starts at `-0001` | — |
| BE-SALE-021 | Sale with customer + rewards enabled + fully paid | `earnPoints` called: points transaction EARN with `sale_id`; INV-11 holds |
| BE-SALE-022 | `items: []` (if DTO allows it, see BE-DTO-005) | expected: rejected. If it creates an empty sale → `it.failing` + KI |
| BE-SALE-023 | Promotion applied (`applied_promotion_id`), promotion within dates/branch | `promotion_id` stored; `promotion_discount` stored; after `usage_limit` reached → `closePromotionIfExhausted` deactivates it |
| BE-SALE-024 | Promotion expired / inactive / other branch / member_only without customer | `assertAndCalculateDiscount` throws, no sale written |
| BE-SALE-030 | **KI-003 (fixed) oversell race:** stock 1, fire 2 `create` calls with `Promise.all` | exactly 1 succeeds (201), the other gets 400 'Insufficient stock…'; stock is 0, never negative. Repeat 5× in a loop inside the test to make the race likely |
| BE-SALE-031 | **KI-004 (fixed) sale-number race:** 10 concurrent creates, same tenant | all succeed with 10 distinct numbers. Same for 10 concurrent quotations |
| BE-SALE-040 | **KI-005 (fixed):** client sends `line_total` lower than `unit_price × qty` with no discount | 400 'Line total or tax … does not match its catalog price and tax'; nothing written |
| BE-SALE-042 | `unit_price` ≠ variant `regular_price` (REGULAR) / ≠ `wholesale_price` (WHOLESALE; falls back to regular when wholesale is null/0) | 400 'Price of variant … has changed'. Exact catalog price → 201 |
| BE-SALE-043 | `tax_amount` off by > 0.02, or discounts sum > catalog line total | 400. Off by ≤ 0.02 (rounding) → accepted |
| BE-SALE-044 | `promotion_discount_amount > 0` with no item- or sale-level `applied_promotion_id` | 400 'has no promotion' |
| BE-SALE-045 | Item promotion discounts for promotion P exceed the server evaluation of P on the cart (base = `unit_price × qty`) by > 0.02 | 400 'exceeds what the promotion allows'. Exactly the evaluation → 201. Use X1 promotion fixtures for amounts |
| BE-SALE-041 | **KI-006 (fixed):** CREDIT payment the customer can't cover (balance below required points) | 400 with the rewards message; **no** sale row, no stock change, no REDEEM transaction (redemption runs inside the sale transaction) |
| BE-SALE-046 | CREDIT payment that succeeds | exactly one REDEEM transaction with `sale_id` = the sale; balance reduced; INV-11 |

### Soft delete / restore
| ID | Scenario | Assert |
|---|---|---|
| BE-SALE-050 | `softDelete` normal sale | `deleted_at` set; stock restored to original batch; `SALE_DELETE_IN` audit row per item; reward points reversed (EARN reversed by a transaction; INV-11) |
| BE-SALE-051 | `softDelete` a delivery-later (pending) sale | `reserved_quantity` released instead of quantity |
| BE-SALE-052 | `softDelete` sale with a return | BadRequest '… return(s) against it' |
| BE-SALE-053 | `softDelete` sale created as an exchange | BadRequest |
| BE-SALE-054 | `softDelete` sale with later partial payments | BadRequest 'Reverse those payments…' |
| BE-SALE-055 | `restore` | stock re-deducted (`SALE_RESTORE_OUT`), points re-earned, `deleted_at` null |
| BE-SALE-056 | `restore` when the batch no longer has the stock | BadRequest 'Cannot restore this sale…', no partial writes |
| BE-SALE-057 | Deleted sale excluded from `findAll` by default, and from `findBySaleNumber` (returns lookup) | — |
| BE-SALE-058 | Two concurrent `softDelete` of the same sale | exactly one succeeds; the other gets 400 'already been deleted'; stock restored **once** (one `SALE_DELETE_IN` row per item) |
| BE-SALE-059 | Two concurrent `restore` | exactly one succeeds (other 400); stock deducted once |
| BE-SALE-060 | `restore` when the original batch's free stock (`quantity − reserved_quantity`) is short, even though `quantity` alone would suffice | 400; reserved units for pending deliveries are never consumed |
| BE-SALE-061 | Two concurrent `completePendingDelivery` (and complete vs cancel) | exactly one succeeds (other 400 'no longer pending'); stock and reservation moved once |
| BE-SALE-062 | Two concurrent conversions of one quotation (`convertQuotationToSale` and `create` with `quotation_id`) | exactly one sale created; quotation has `converted_to_sale_id` and `converted_at` |

## 3. Returns & exchanges (`test/integration/returns.int-spec.ts`), `ReturnService.create`
Each test starts from a committed sale (2 items, qty 3 and 2, shipping 50).

| ID | Scenario | Assert |
|---|---|---|
| BE-RET-001 | Return 1 unit of item A, CASH refund = exact prorated value (`line_total × 1/3`) | return created; `total_refund` = value; batch +1; `RETURN_IN` audit; `inventory_adjustments` row `return_in` |
| BE-RET-002 | Refund amount ≠ selected value | BadRequest 'must exactly match' |
| BE-RET-003 | Return qty > remaining (after an earlier partial return) | BadRequest 'exceeds available quantity' |
| BE-RET-004 | Shipping-only refund ≤ 50 | allowed; no stock change |
| BE-RET-005 | Shipping refund > remaining refundable shipping (after a prior shipping refund) | BadRequest |
| BE-RET-006 | No items and no shipping | BadRequest 'Select at least one…' |
| BE-RET-007 | No payments | BadRequest 'At least one payment method…' |
| BE-RET-008 | Payment amount 0 | BadRequest |
| BE-RET-009 | Return against a soft-deleted sale | NotFound |
| BE-RET-010 | Return item not from that sale | BadRequest 'do not belong' |
| BE-RET-011 | **Exchange:** return item A, EXCHANGE payment, exchange variant C from batch with stock | `total_exchange` set; C batch decremented; `EXCHANGE_OUT` audit; INV-01 holds for both batches |
| BE-RET-012 | Exchange with insufficient batch stock | BadRequest 'Insufficient stock for exchange…', **nothing** written (transaction rollback: check return count unchanged) |
| BE-RET-013 | Exchange variant of another tenant | NotFound |
| BE-RET-014 | Refund of a sale paid with rewards/credit | read `reverseRewardPointsForRefund` + `processCreditRefund`; assert points/credit restored proportionally; INV-11 |
| BE-RET-015 | Return number format and per-tenant sequence (`@@unique([return_number, consumer_id])`) | — |
| BE-RET-016 | **KI-009 (fixed):** return with `batch_id` of **another tenant's** batch | 400 'is not a batch of variant'; the other tenant's batch unchanged (INV-12/INV-13 hold) |
| BE-RET-017 | **KI-009 (fixed):** return with a same-tenant `batch_id` of a **different variant**, or `variant_id` ≠ the sold item's variant | 400 |
| BE-RET-018 | **KI-009 (fixed):** exchange with `batch_id` belonging to a different variant/tenant | 400, nothing written |
| BE-RET-019 | Return item without `batch_id` | characterization: currently no restock happens (`if (itemDto.batch_id)`). Pin it, log a QUESTION (should it restock to the sale item's batch?) |
| BE-RET-030 | **KI-004 (fixed):** 5 concurrent returns on different sales, same tenant | all succeed with unique numbers |
| BE-RET-031 | Two concurrent returns against the **same** sale whose combined value exceeds what's refundable | at most the valid amount is refunded; the later request gets 400 'Another return was recorded for this sale…'; INV-09/INV-10 hold |
| BE-RET-032 | Exchange whose batch has stock only in `reserved_quantity` | 400 (reserved units are not available) |

## 4. Inventory (`test/integration/inventory.int-spec.ts`)
| ID | Scenario | Assert |
|---|---|---|
| BE-INV-010 | `InventoryBatchService.create` | batch + `PURCHASE_IN` audit; purchase payment status fields (`payment_status`, `paid_amount`) per DTO |
| BE-INV-011 | `InventoryBatchService.update` changing `quantity` | **must** write an audit row (else INV-01 breaks). If it doesn't → `it.failing` + KI |
| BE-INV-012 | `InventoryBatchService.remove` with sales referencing it | read behavior; pin it |
| BE-INV-020 | Adjustment −2 with available 5 | batch −2; `ADJUSTMENT` audit with delta −2 |
| BE-INV-021 | Adjustment − more than (quantity − reserved) | **400** 'Insufficient available quantity' (this was a 500 before the KI fixes; the status matters) |
| BE-INV-022 | Adjustment +3 | +3 and audit |
| BE-INV-023 | Adjustment for another tenant's variant/branch | NotFound |
| BE-INV-030 | Transfer create (pending) | **no** stock movement yet (read `create`; if it reserves, assert reservation) |
| BE-INV-031 | `completeTransfer` | source −qty `TRANSFER_OUT`; destination +qty `TRANSFER_IN` (new or merged batch, read lines ~380–440 and assert whichever path applies; test **both**: destination batch exists vs not) |
| BE-INV-032 | Complete an already-completed transfer | BadRequest 'not in pending status' |
| BE-INV-033 | `cancelTransfer` | status cancelled, no stock change; then complete → BadRequest |
| BE-INV-034 | Transfer to the same branch / other tenant branch | BadRequest/NotFound per code |
| BE-INV-035 | Transfer qty > available | BadRequest |
| BE-INV-036 | Create transfer of 6, sell the source down to 3, then `completeTransfer` | 400 'Insufficient stock in source batch…'; source stock unchanged; transfer still `pending` |
| BE-INV-037 | Two concurrent `completeTransfer` (and complete vs cancel) | exactly one succeeds; stock moved once |
| BE-INV-040 | `getInventorySummary`, `getVariantStock`, `getLowStockItems`, `getExpiringBatches` after a scripted scenario | totals equal `SUM(quantity)` / thresholds from the raw table. These feed the dashboard (B4) |

## 5. Payments
`test/integration/payments.int-spec.ts`, `PaymentsService.makePayment`:
| ID | Scenario | Assert |
|---|---|---|
| BE-PAY-001 | Due sale, pay half | `'partial'`, payments row, `received_amount` updated (see INV-07) |
| BE-PAY-002 | Pay the rest | `'paid'`; if customer + rewards → points earned at this moment (read code; assert whichever is implemented, and log it if it is skipped) |
| BE-PAY-003 | Overpay | BadRequest 'exceeds remaining amount' |
| BE-PAY-004 | Pay a paid sale | BadRequest 'already fully paid' |
| BE-PAY-005 | Pay another tenant's sale | NotFound |
| BE-PAY-006 | `getPartiallyPaidSales` lists exactly the due/partial ones, excluding deleted sales |

`test/integration/purchase-payments.int-spec.ts`: read `purchase-payments.service.ts` (an existing
unit spec covers parts). For each public method: one happy path, one per `throw`, and the batch's
`paid_amount`/`payment_status` postconditions. IDs `BE-PPAY-001…`.

## 6. Rewards
`test/integration/rewards.int-spec.ts`:
| ID | Scenario |
|---|---|
| BE-RWD-001 | `earnPoints` respects `points_per_currency`, `minimum_purchase_amount`, `maximum_points_per_sale`, `is_enabled=false` (one test each) |
| BE-RWD-002 | `redeemPoints`: insufficient balance, below `minimum_redemption`, above `maximum_redemption`, disabled. Each throws its specific message |
| BE-RWD-003 | `calculateRedemptionValue` = points × `redemption_value` |
| BE-RWD-004 | `expirePoints` with fake `Date` past `points_expire_days` → EXPIRE transaction, balance reduced; INV-11 |
| BE-RWD-005 | `validateCreditPayment` / `processCreditPayment` / `processCreditRefund` round-trip: balance returns to start |
| BE-RWD-006 | `adjustPoints` negative beyond balance → 400 'Insufficient points balance' |
| BE-RWD-007 | **KI-006 (fixed):** two concurrent sales redeeming 8000 of a 10000-point balance | exactly one succeeds; balance never negative; exactly one REDEEM row (row lock in `createPointTransaction`) |

## 7. Customers, products, promotions CRUD (lighter)
For `customer`, `product` (+ `product-variant`), `promotions`, `vendor`, `branch`, `category`,
`brand`, `unit`, `tag`, `operational-costs`, `support`, `import`: **one file per module**
(`<module>.int-spec.ts`). For every public service method:
1. Happy path with postcondition on DB rows.
2. Each `throw new …Exception` branch, one test (grep `throw new` in the service to enumerate).
3. Cross-tenant id → NotFound/BadRequest (never success).
IDs `BE-<MODULE>-001…` with module codes `CUST, PROD, VAR, PRM, VEND, BRCH, CAT, BRND, UNIT, TAG, OPC, SUP, IMP`.

Rules specific to these:
- `product.service.ts`: plan product cap (`add_sale_soft_delete_and_plan_product_cap` migration),
  so creating beyond the plan cap is rejected. Test it explicitly (`BE-PROD-0xx`).
- `branch.service.ts`: `Consumer.max_branch` limit, and only one `is_main`.
- `import/*`: product and inventory import with a tiny generated XLSX (build it with `exceljs`,
  already a dependency). Assert stock + audit rows (INV-01 must hold after import).
- `admin/consumer/consumer-data-import.service.ts`: has a unit spec. Add one integration test that
  imports from tenant A into tenant B and that INV-12/INV-13 hold.

## 8. Admin flows (`test/integration/admin.int-spec.ts`)
| ID | Scenario |
|---|---|
| BE-ADM-001 | Plan create/update changes plan permissions → a tenant user's effective permissions (via `JwtClientStrategy.validate`) reflect the **plan ∩ role**. Read `users.service.ts` / plan service to find where plan limits role permissions, and assert that rule |
| BE-ADM-002 | Consumer create → default branch/role/user/receipt settings created (compare with `prisma/seed.ts` chain) |
| BE-ADM-003 | Consumer soft delete → its users can no longer authenticate (`validate` throws); subdomain stays reserved |
| BE-ADM-004 | Consumer purge removes **every** row with that `consumer_id` across all tables, and the bystander tenant is untouched (INV-13) |
| BE-ADM-005 | Billing history / billing periods: read `billing-invoices.service.ts`; one test per `throw` + period calculation boundaries (month end, leap year Feb 29) |
| BE-ADM-006 | Backup/restore: **skip** (needs `pg_dump` binaries). Covered by a manual checklist in X3 |

## 9. CI
Already covered by the `backend-integration` job from B1. Watch runtime. If `test:int` exceeds
8 minutes, shard by area with Jest's `--shard=1/2` and `--shard=2/2` (Jest 29 supports `--shard`),
using two matrix entries. Log it.

## Exit criteria
- [ ] INV-01…13 implemented, BE-NET-001…004 prove the net works.
- [ ] Every ID in §§2–6 and §8 exists; §7 modules each have a file covering every `throw`.
- [ ] Every KI-tagged test is `it.failing` with its KI row status set to `CONFIRMED` (or `FIXED` if it passes, meaning the suspicion was wrong; then remove the KI and log it).
- [ ] `npm run test:int` green 3× in a row.

## Status (2026-10-13)
Implemented and verified locally; see D-040 in `docs/testing/DECISIONS.md`. Files: `test/helpers/invariants.ts`, `test/helpers/domain.ts`, and `test/integration/{invariants,sales,sales-lifecycle,returns,inventory,payments,purchase-payments,rewards,catalog-lookups,master-data,products,promotions,imports,admin}.int-spec.ts`.
