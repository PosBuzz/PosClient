# Phase C5: Consumer Mutation Testing

**Goal:** prove the C2 calculation tests and the C3 plumbing tests catch real code changes.

**Depends on:** C2, C3.
```bash
cd consumer
npm i -D @stryker-mutator/core@^10 @stryker-mutator/vitest-runner@^10 @stryker-mutator/typescript-checker@^10
```
(vitest-runner 10 peer: `vitest >= 2`. Verified 2026-10-12.)

## 1. `stryker.config.mjs`
```js
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: "npm",
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.ts" },
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.test.json",
  mutate: [
    "src/utils/calculate-totals.utils.ts",
    "src/utils/sale-item.utils.ts",
    "src/utils/promotion-validation.ts",
    "src/utils/promotion-helpers.utils.ts",
    "src/utils/formatters.ts",
    "src/utils/payment-provider.utils.ts",
    "src/utils/invalidate-sales-reports.ts",
    "src/api/axiosInstance.ts",
    "src/components/RequireAuth.tsx",
    "src/components/RequirePermission.tsx",
  ],
  thresholds: { high: 95, low: 90, break: 90 },
  incremental: true,
  incrementalFile: "reports/stryker/incremental.json",
  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: { fileName: "reports/stryker/index.html" },
};
```
Script: `"test:mutation": "stryker run"`. Add `reports/` to `consumer/.gitignore`.

The break threshold is 90 because these are pure functions with exhaustive tests. A surviving
mutant in `calculateSaleTotals` means a cent can change unnoticed. If the first run is below 90:
work the survivors (same procedure as backend B7 §4) before enabling the CI gate. Never lower the threshold.

Typical survivors to expect, and the test that kills each:
- `round2` removed/changed → CO-CALC-008/009 and CO-TOT-P04.
- `isLast` remainder logic → CO-TOT-006.
- tie-break comparisons `>` ↔ `>=` → CO-TOT-020…024 (each tier needs an exact tie on all higher tiers).
- `startsWith("INC")` → CO-CALC-005/006.
- `Math.max(0, …)` in `getItemBaseAmount` → add an INCLUSIVE line where `tax_amount > line_total` (corrupted input) and pin the 0.

## 2. CI
`consumer-mutation` job on PRs, only when the `mutate` files change (`dorny/paths-filter@v3`), with
the incremental file cached via `actions/cache@v4`. Full run nightly (X3).

## Exit criteria
- [ ] Score ≥ 90 overall and 100% killed-or-justified on `calculate-totals.utils.ts` and `sale-item.utils.ts`.
