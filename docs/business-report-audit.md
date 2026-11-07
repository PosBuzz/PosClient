# Business report audit — 2026-11-07

The report is an invoice and collections report. Net Operating Result is **before product costs and tax payments**, not net profit. It does not compute inventory valuation or cost of goods sold. Net Cash Collections is movement from customer and partner transactions; it is not a reconciled till balance (opening cash, inventory purchases and expense payment methods are not tracked here).

## Corrected calculations

- **Invoice totals:** stored sale total plus all `due_reduction` on its returns. A later return must not rewrite the sales amount, hourly amounts or invoice average in an earlier period.
- **Returned value:** refunds + exchange credit + cancelled due, dated by `return_date`. Due cancellations are shown separately and do not create a refund or cash outflow.
- **Net Sales:** original invoices − shipping charged − full returned value + shipping returned. This agrees with product line sales less returned product line values. Tax remains included, consistent with the existing invoice definition.
- **Shipping margin:** shipping charged − shipping returned − partner charges posted in the period. Shipping returned is reconstructed from returned settlement value less the returned share of original product lines; there is no separately persisted shipping-return amount.
- **Net Operating Result:** original invoices − full returned value − posted partner charges − operational expenses. Exchanges reverse the old goods even when a replacement invoice records another sale.
- **Dues:** balance at period end on invoices issued in the selected period, using only payments and due cancellations up to that date. This is not the total customer receivables balance across older periods. Payment status uses the same calculation.
- **Collections:** cash/digital, reward credit, exchange tender and partner collections remain separate. Only cash/digital and partner payouts received enter real money collected. Only cash/digital refunds and partner payments leave net money collected. Store-credit refunds stay in refund totals but do not leave the drawer or bank.
- **Non-cash collections:** total customer collections less cash collections, rather than invoice totals less cash (which could become negative when old dues were collected).
- **Exchanges:** deduplication uses the actual exchange tender collected on the linked sale in the period. Merely linking an invoice does not hide a return's exchange value.
- **Delivery charges:** ledger postings supply charges and corrections on their posting date, including orders invoiced in earlier periods. Partner balances remain explicitly current balances; settlements and balances appear only in the all-branches view.
- **Expenses:** `incurred_on` is a database calendar date; its range uses calendar dates independently of UTC offsets.

Example: goods 400 + shipping 50, paid 200, due 250. Returning goods worth 300 the next day cancels 250 due and pays out 50. The original day remains invoices 450, Net Sales 400 and due 250. The return day has returned value 300, Net Sales −300 and net money collected −50. Across both days, Net Sales is 100 and net money collected is 150.

## Verification

The regression scenarios in `backend/test/integration/reports/returns-audit.int-spec.ts` use the real Nest services and PostgreSQL, with hand-computed expectations. They cover due-only and mixed returns, shipping-only refunds, exchanges, credit refunds, historical collections and statuses, next-day delivery charges, repeated returns, day/month/all-time reconciliation and branch isolation. The same scenarios run under UTC, Asia/Dhaka and America/New_York. Existing report scenarios continue to check discounts, tax, tender methods, deleted sales, quotations, tenant isolation, product/hourly/status breakdowns and branch reconciliation. Existing return and delivery-partner suites check stock restoration, payouts and voids.

Screen tests check the returned-value breakdown and shared PDF query parameters. PDF tests check that a due-only return prints even without a refund tender. Local browser QA and rendered PDF inspection use reports produced from an isolated test database, not production data.

Historical invoice edits/deletions and partner-payment rewrites are still reflected in reports: the underlying system does not retain immutable period-close snapshots. These changes make later **due-cancelling returns** and subsequent ordinary collections respect period boundaries; they do not introduce a general accounting journal or period locking.
