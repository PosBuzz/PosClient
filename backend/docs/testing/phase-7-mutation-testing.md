# Phase B7: Backend Mutation Testing (proof that tests catch changes)

**Goal:** show, mechanically, that changing critical backend code makes a test fail. Stryker
applies small edits ("mutants": `<` → `<=`, `+` → `-`, `&&` → `||`, removed calls, `true` → `false`)
and reruns the tests. A mutant that **survives** is a code change no test notices, so it is a
concrete missing assertion.

**Depends on:** B2, B3, B4. **Packages:**
```bash
cd backend
npm i -D @stryker-mutator/core@^10 @stryker-mutator/jest-runner@^10 @stryker-mutator/typescript-checker@^10
```
(Verified 2026-10-12: v10.0.0, Node ≥ 22. If the jest-runner rejects Jest 29, use `^9` for all three
packages and log a FALLBACK.)

---

## 1. Two configurations

### 1.1 `stryker.unit.config.mjs`: fast, runs on PRs
```js
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'npm',
  testRunner: 'jest',
  // no configFile → the jest-runner falls back to the "jest" key in package.json (the unit config)
  jest: { projectType: 'custom', enableFindRelatedTests: true },
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  coverageAnalysis: 'perTest',
  mutate: [
    'src/consumer/promotions/promotion-math.ts',
    'src/consumer/inventory/utils/*.ts',          // includes stock-mutation.util.ts (KI-003 fix; killed by B3 concurrency tests in the domain config)
    'src/consumer/sales/utils/sale-pricing.util.ts', // KI-005 fix: server-side price/total validation
    'src/common/services/subdomain-util.service.ts',
    'src/common/utils/*.ts',
    'prisma-client-exception/*.filter.ts',
    '!**/*.spec.ts',
  ],
  thresholds: { high: 90, low: 85, break: 85 },
  incremental: true,
  incrementalFile: 'reports/stryker/unit-incremental.json',
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/stryker/unit.html' },
};
```

### 1.2 `stryker.domain.config.mjs`: integration-backed, nightly
Targets the money/stock/report logic. Use **line ranges** so that PDF-layout code and logging
are not mutated. Before writing the config, open each file and fill in the current line ranges of
the listed methods (they shift as code changes, so update them whenever this config is touched):

| File | Methods to mutate |
|---|---|
| `src/consumer/sales/services/sales.service.ts` | `create`, `softDelete`, `restore`, `reverseSaleRewardPoints`, `findBySaleNumber` (returnable amounts), `getSalesStats`, `getEODReport`, `generateSaleNumber`, `generateQuotationNumber`, `calculateSummaryStats`, `convertQuotationToSale`, `getVariantSalesStats`, `getUsersSalesStats`, `completePendingDelivery`, `cancelPendingDelivery` |
| `src/consumer/returns/services/return.service.ts` | `create`, `reverseRewardPointsForRefund`, `generateReturnNumber` |
| `src/consumer/inventory/services/inventory-adjustment.service.ts` | whole file |
| `src/consumer/inventory/services/inventory-transfer.service.ts` | `create`, `completeTransfer`, `cancelTransfer` |
| `src/consumer/inventory/services/inventory-batch.service.ts` | `create`, `update`, `remove` |
| `src/consumer/payments/services/payments.service.ts` | `makePayment` |
| `src/consumer/rewards/services/rewards.service.ts` | whole file |
| `src/consumer/promotions/services/promotions.service.ts` | `validatePromotionRules`, `evaluatePromotionForCart`, `assertAndCalculateDiscount`, `closePromotionIfExhausted`, `getPromotionUsage` |
| `src/consumer/dashboard/services/dashboard.service.ts` | whole file |
| `src/auth/guards/*.ts`, `src/auth/*.strategy.ts` | whole files (includes `login-throttler.guard.ts`) |
| `src/common/utils/document-number-lock.util.ts`, `src/common/utils/business-time.util.ts`, `src/common/guards/development-only.guard.ts` | whole files (KI-004/008/001 fixes) |

Syntax: `'src/consumer/sales/services/sales.service.ts:186-630'`.

```js
export default {
  packageManager: 'npm',
  testRunner: 'jest',
  jest: { projectType: 'custom', configFile: 'test/jest-stryker-domain.json', enableFindRelatedTests: false },
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  coverageAnalysis: 'perTest',
  concurrency: 4,
  timeoutMS: 120000,
  mutate: [ /* ranges from the table */ ],
  ignoreStatic: true,
  thresholds: { high: 80, low: 70, break: 70 },
  incremental: true,
  incrementalFile: 'reports/stryker/domain-incremental.json',
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/stryker/domain.html' },
};
```
`test/jest-stryker-domain.json` = `jest-integration.json` + `e2e` regex combined:
`"testRegex": "test/(integration|e2e)/.*\\.(int|e2e)-spec\\.ts$"`, **without** `globalSetup`/`globalTeardown`
(see §2).

## 2. Parallel workers need separate databases
Stryker runs `concurrency` Jest processes simultaneously. They must not share a database.
1. Pre-step script `test/setup/stryker-db.mjs` (run before Stryker): start the
   `docker-compose.test.yml` Postgres, create database `posbuzz_template`, run
   `prisma migrate deploy` on it, then for `n` in `1..concurrency+1`:
   `CREATE DATABASE posbuzz_test_w${n} TEMPLATE posbuzz_template`. Stryker may restart workers with
   new numbers, so create a few spares (concurrency + 4).
2. `test/setup/load-test-env.ts` gains a branch: if `process.env.STRYKER_MUTATOR_WORKER` is set
   (Stryker sets this per worker process), set
   `DATABASE_URL=postgresql://test:test@localhost:55432/posbuzz_test_w${STRYKER_MUTATOR_WORKER}?schema=public`,
   and skip reading `.tmp/env.json` for that key.
3. If the worker number exceeds the created DBs, create the DB on the fly from the template (from
   `load-test-env` that would be async; instead fail with a clear message telling the operator to
   raise the spare count).

**Fallback** if `STRYKER_MUTATOR_WORKER` is not set in the installed Stryker version (check with a
`console.log` in a dry run): set `concurrency: 1`, which is slow but correct. Log it.

## 3. Scripts
```json
"test:mutation:unit": "stryker run stryker.unit.config.mjs",
"test:mutation:domain": "node test/setup/stryker-db.mjs && stryker run stryker.domain.config.mjs"
```
Add `reports/` to `backend/.gitignore`.

## 4. Working the survivors (this is the actual work of this phase)
Run once fully. For each surviving mutant, in the HTML report:
1. **Real gap** → add or strengthen an assertion in the matching B2/B3/B4 test. Use a new ID
   (e.g. `BE-SALE-060`). Most survivors in this codebase will likely be:
   - `payment_status` boundaries (`<` vs `<=`) → BE-SALE-009/010 need **exact-boundary** cases (paid == total).
   - FIFO sort direction → BE-SALE-002 must have batches whose creation order differs from id order.
   - Report date windows (`gte`/`lte` → `gt`/`lt`) → B4 needs events **exactly at** 00:00:00.000 and 23:59:59.999.
   - `deleted_at: null` filters removed → B4 BE-RPT-108 catches these if S5 is in the scenario.
2. **Equivalent mutant** (no observable difference possible) → `// Stryker disable next-line <Mutator>: equivalent because …`.
3. **Logging/error-message text** → disable `StringLiteral` on that line with reason "log text".
   Error messages that the **frontend shows** are not log text. Assert them instead.
4. Record final scores per file in `DECISIONS.md`.

## 5. CI
- PR: add a job `backend-mutation-unit` running `npm run test:mutation:unit` **only if** files in its
  `mutate` list changed (use `dorny/paths-filter@v3`). Cache `reports/stryker/unit-incremental.json`
  with `actions/cache@v4` keyed on the branch, with restore-key `main`.
- Nightly: `test:mutation:domain` in `.github/workflows/nightly.yml` (created in X3), uploading the
  HTML report as an artifact. A nightly failure (score < break) opens an issue (see X3).

## Exit criteria
- [ ] Unit config: score ≥ 85 (break threshold) on the PR job.
- [ ] Domain config: score ≥ 70 overall, and ≥ 80 for `promotion-math.ts`, `payments.service.ts#makePayment`, `return.service.ts#create`, `inventory-adjustment.service.ts`.
- [ ] Every disabled mutant has a reason comment.
