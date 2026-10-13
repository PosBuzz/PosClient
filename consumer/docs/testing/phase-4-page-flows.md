# Phase C4: Consumer Page Flows (jsdom + MSW + backend contracts)

**Goal:** the critical screens are driven like a cashier would drive them (type, click, scan) against
**backend-generated response contracts** (`contracts/responses/*.json` from B5 §6). The test
asserts what the user sees **and** the exact request body sent. Captured request bodies are saved
as `contracts/requests/*.json`, and the backend replays them (X1 §4). That closes the loop in both
directions:
- the backend changes a response shape → the consumer page tests fail;
- the consumer changes a request payload → the backend replay fails.

**Depends on:** C3, B5 (contracts). **Location:** `src/pages/<page>/__tests__/<name>.flow.test.tsx`.

---

## 1. Ground rules
- **Selectors, in order of preference:** `getByRole(name)` → `getByLabelText` → `getByPlaceholderText`
  (POS uses placeholders: "Select branch", "Walk-in customer", "Select staff", "Method", "Amount",
  "Ref#", "Sale notes...") → `getByText` → `data-testid` (pre-approved seam #3; add only when nothing
  else is stable, named `kebab-case` like `data-testid="pos-total"`).
- antd `Select`: open with `await user.click(getByRole('combobox', ...))`, then
  `await user.click(await screen.findByTitle('<option label>'))` (antd renders options with a
  `title`). If the option isn't found because the list is virtualized, use
  `user.type(combobox, 'label{enter}')` instead. Don't set `virtual={false}` on the component,
  because that is a production change. Put the working approach in a helper
  `selectAntdOption(user, combobox, label)` in `src/test/antd.ts` and log it in `DECISIONS.md`.
- Always `await screen.findBy…` after actions (antd animates). Never use sleeps.
- MSW handlers serve contract fixtures through `src/test/msw/contracts.ts`. Override per test with
  `server.use(...)`.
- Capture request bodies with a helper:
  ```ts
  const captured = captureRequests("post", endpoints.createSale); // returns { calls: Array<{ body, headers }> }
  ```
- Lazy pages: import the page component directly (not through `routes`) and mount it with
  `renderWithProviders(<POSPage/>, { route: "/pos", path: "/pos", permissions: [...] })`.

## 2. Request-contract recording
`src/test/contracts/record.ts`:
```ts
export async function expectRequestContract(name: string, contract: {
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;              // e.g. endpoints.createSale, WITHOUT the /api/v1 prefix
  auth: "client" | "admin";
  body: unknown;             // exactly what MSW captured
  expect?: Record<string, string>; // for sales: { subtotal, tax_amount, discount_amount, total_amount } as 2-dp strings,
                                   // taken from calculateSaleTotals() for the cart in this test
}) {
  // compares against contracts/requests/<name>.json; with UPDATE_CONTRACTS=1 writes it instead
}
```
The file format is defined in `docs/testing/phase-X1-cross-layer-contracts.md` §4. The backend
replays these files.
Implement it with `fs` (tests run in Node) and a path relative to the repo root
(`path.resolve(__dirname, "../../../../contracts/requests")`). Use the same UPDATE_CONTRACTS
convention as the backend. Don't use `toMatchFileSnapshot`, because the backend reads these
files and they must be plain JSON.

## 3. Flows

### 3.1 POS checkout (`pages/pos/__tests__/pos-checkout.flow.test.tsx`), highest priority
Fixtures: `products-for-sale.json` (P1/P2/P3 from the B4 scenario), `promotions-active.json`,
`auth-client.json`, customers list, served-by users.
| ID | Flow | Assert |
|---|---|---|
| CO-FLOW-POS-001 | select branch → add P1 ×2 (search + click), P3 ×1 → CASH full amount → submit | on-screen total equals `calculateSaleTotals` for that cart (formatted via `formatCurrency`); POST body recorded as `contracts/requests/pos-cash-sale.json`; success message shown; cart cleared, branch kept |
| CO-FLOW-POS-002 | barcode scan (simulate `useBarcodeScanner` keystrokes + Enter) adds the matching variant; scanning it again increments qty | |
| CO-FLOW-POS-003 | quantity change, remove line, special discount on a line, average discount 10% | body's per-item discount fields equal `calculateSaleTotals().discountedItems` → recorded `pos-discounts-sale.json` |
| CO-FLOW-POS-004 | split payment CASH + MFS (provider select required: `paymentMethodRequiresProvider`) | body `payments` has 2 entries with `payment_type` on the MFS one; recorded `pos-split-payment.json` |
| CO-FLOW-POS-005 | pay less than total → body `payment_status: "partial"`; pay 0 → `"due"` | matches the backend's own derivation (B3 BE-SALE-009/010) |
| CO-FLOW-POS-006 | auto-apply promotion from fixtures shown in "Available Promotions"; applied discount on the matched line | `applied_promotion_id` in body; recorded `pos-promotion-sale.json` |
| CO-FLOW-POS-007 | member-only promotion blocked without customer: reason text visible | |
| CO-FLOW-POS-008 | wholesale price type switch re-prices lines (`getVariantPriceForSale`) | |
| CO-FLOW-POS-009 | server returns 400 `{message:"Insufficient stock…"}` | message shown; cart **not** cleared; button re-enabled; exactly **one** POST |
| CO-FLOW-POS-010 | double-click the submit button quickly | exactly **one** POST (if two → `it.fails` + KI: double sale) |
| CO-FLOW-POS-011 | `localStorage.autoPrintThermal = "true"` → print agent POST to `http://localhost:8080/...` with receipt data; agent down → sale still succeeds and an error/warning is shown | |
| CO-FLOW-POS-012 | after success: query invalidation includes everything from `invalidateSalesReports` (spy `queryClient.invalidateQueries`). Regression guard for KI-011 |
| CO-FLOW-POS-013 | user without `sales` permission → redirected (covered by CO-ROUTE-003; just reference it) | |

### 3.2 Add sale page (`pages/add-sales`) and quotation (`pages/add-quotation`)
Same cart scenarios as POS-001/003/004. **Assert that the request bodies are identical to the POS
ones for the same cart.** Two screens computing the same sale must send the same payload.
| ID | Flow |
|---|---|
| CO-FLOW-SALE-001 | same cart as POS-001 → body deep-equals `contracts/requests/pos-cash-sale.json` except UI-only fields (list them explicitly, e.g. `notes`) |
| CO-FLOW-SALE-002 | same as POS-003 vs `pos-discounts-sale.json` |
| CO-FLOW-QUO-001 | quotation → `sale_type: "quotation"`, no payments required; recorded `quotation.json` |
| CO-FLOW-QUO-002 | convert quotation (view-quotation page action) → calls the convert endpoint / creates the sale with `quotation_id` |

### 3.3 Returns (`pages/returns/create.tsx`, 1951 lines)
Fixture: `sale-by-number.json` (S4 from the scenario).
| ID | Flow | Assert |
|---|---|---|
| CO-FLOW-RET-001 | look up the sale number → items listed with the remaining returnable qty | |
| CO-FLOW-RET-002 | return 1 unit, CASH refund pre-filled with the prorated value (`line_total × qty / original qty`) | the amount shown equals the backend formula (B3 BE-RET-001); body recorded `return-cash.json` |
| CO-FLOW-RET-003 | refund amount edited to ≠ selected value → client-side validation message (if any) or the server 400 shown | |
| CO-FLOW-RET-004 | exchange: look up a replacement sale from the same branch | body has `exchange_sale_id` + EXCHANGE payment; recorded `return-exchange.json` (current UI, D-048) |
| CO-FLOW-RET-005 | shipping refund > remaining | blocked/400 shown |
| CO-FLOW-RET-006 | success → `invalidateSalesReports` called, navigates to `/returns/view/:id` | |
| CO-FLOW-RET-007 | server 500 → exactly **1** POST (KI-010 regression guard) | |

### 3.4 Partial payments (`pages/partial-payments/make-payment.tsx`)
| ID | Flow |
|---|---|
| CO-FLOW-PAY-001 | due sale from `partial-payments.json` → pay remaining → body recorded `make-payment.json`; success |
| CO-FLOW-PAY-002 | overpay → blocked or 400 shown |
| CO-FLOW-PAY-003 | after success, `invalidateSalesReports` called (KI-011 regression guard) |

### 3.5 Sales list / view sale (`pages/sales`, `pages/view-sale`)
| ID | Flow |
|---|---|
| CO-FLOW-SL-001 | list renders the `sales-list.json` rows; summary tiles show `total_amount`, `total_due`, `total_refund`, `net_amount` from the summary block |
| CO-FLOW-SL-002 | delete with reason → DELETE/POST body; server 400 "has return(s)" message shown verbatim |
| CO-FLOW-SL-003 | restore deleted sale |
| CO-FLOW-VS-001 | view sale renders items, discounts breakdown, payments, returns from `sale-detail.json`; displayed per-line net equals `line_total`, which already includes discounts (KI-047, D-049) |

### 3.6 Reports (`pages/dashboard`, `pages/eod`, stats pages)
| ID | Flow |
|---|---|
| CO-FLOW-DASH-001 | dashboard renders all nine daily `summary` fields used by the page from `dashboard.json`; weekly fields are not displayed (D-049). Assert by label → value using each control's currency/count formatting. **A renamed backend field shows as "N/A"/0 and fails here** |
| CO-FLOW-DASH-002 | period switches (daily/weekly/monthly) send the right query params (`payment_period`, `return_payment_period`, `top_products_period`) |
| CO-FLOW-EOD-001 | EOD renders every field of `eod.json` used by the page; the business report PDF button calls `endpoints.businessReportPdf` with the same params |
| CO-FLOW-STATS-001 | user-sales-stats and variant-sales-stats pages render their contract files |

### 3.7 Inventory
| ID | Flow |
|---|---|
| CO-FLOW-INV-001 | add batch (`add-or-edit-inventory`) → body recorded `inventory-batch-create.json` |
| CO-FLOW-INV-002 | create transfer → body recorded `inventory-transfer-create.json`; complete/cancel actions |
| CO-FLOW-INV-003 | add adjustment negative beyond available → server 400 message shown |
| CO-FLOW-INV-004 | low-stock / expiring pages render contract data |

### 3.8 Auth & tenancy UX
| ID | Flow |
|---|---|
| CO-FLOW-AUTH-001 | login page: CSRF fetched → POST login → `checkAuth` → redirect to `state.from` |
| CO-FLOW-AUTH-002 | wrong credentials message |
| CO-FLOW-AUTH-003 | subdomain invalid/inactive → `SubscriptionInactive`/message per `validateSubdomain` branch |

### 3.9 Remaining pages: smoke level
For **every other page** in `src/pages/*` (customers, vendors, brands, categories, tags, units,
users, roles, branches, promotions, products, view-product, view-customer, view-vendor,
rewards-settings, customer-rewards, operational-costs, support, receipt-settings,
pos-layout-settings, barcode-printing, product-audit, online-orders, pending-deliveries,
purchase-payments, daily-target, profile, account-security, inventory-* not above): one smoke test
`CO-SMOKE-<page>`: it renders with an empty-list fixture and a 1-row fixture without errors
(`console.error` spy), and its primary create/save action sends a request to the right endpoint.
`src/test/smoke-coverage.test.ts` asserts that **every directory in `src/pages`** has at least one
`*.test.tsx`. A new page without a test fails CI.

## 4. Coverage gate
Add to thresholds: `src/pages/pos/**`, `src/pages/returns/**`, `src/pages/add-sales/**`,
`src/pages/partial-payments/**` ≥ 70% lines. Global ≥ 50% lines (ratchet upward in X3).

## Exit criteria
- [ ] All flow IDs green or `fails` + KI.
- [ ] `contracts/requests/*.json` committed: `pos-cash-sale`, `pos-discounts-sale`, `pos-split-payment`, `pos-promotion-sale`, `quotation`, `return-cash`, `return-exchange`, `make-payment`, `inventory-batch-create`, `inventory-transfer-create`.
- [ ] Every `src/pages/*` directory has a test.
