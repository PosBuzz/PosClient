// Runs Stryker once per mutated file and fails if any file is below the break threshold.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  mutationFingerprint,
  invalidateMutationCache,
} from "./mutation-cache.mjs";

const targets = {
  "src/utils/calculate-totals.utils.ts":
    "src/utils/calculate-totals.utils.test.ts src/utils/__contracts__/sale-totals.contract.test.ts src/utils/__contracts__/pricing.contract.test.ts",
  "src/utils/sale-item.utils.ts":
    "src/utils/sale-item.utils.test.ts src/utils/__contracts__/pricing.contract.test.ts src/utils/__contracts__/sale-totals.contract.test.ts",
  "src/utils/promotion-validation.ts":
    "src/utils/promotion-validation.test.ts src/utils/__contracts__/promotions.contract.test.ts",
  "src/utils/promotion-helpers.utils.ts":
    "src/utils/promotion-helpers.utils.test.ts src/utils/promotion-validation.test.ts",
  "src/utils/formatters.ts": "src/utils/formatters.test.ts",
  "src/utils/payment-provider.utils.ts":
    "src/utils/payment-provider.utils.test.ts",
  "src/utils/invalidate-sales-reports.ts":
    "src/utils/invalidate-sales-reports.test.ts",
  "src/api/axiosInstance.ts": "src/api/axiosInstance.test.ts",
  "src/components/RequireAuth.tsx":
    "src/routes.test.tsx src/components/Require.test.tsx",
  "src/components/RequirePermission.tsx":
    "src/routes.test.tsx src/components/Require.test.tsx",
};
const only = process.argv[2];
if (only && !targets[only]) throw new Error(`Unknown mutation target: ${only}`);
mkdirSync("reports/stryker", { recursive: true });
const fingerprint = mutationFingerprint(process.cwd());
let failed = false;
for (const [file, tests] of Object.entries(
  only ? { [only]: targets[only] } : targets,
)) {
  console.log(`\n=== ${file} ===`);
  // The sandbox lives in .stryker-tmp/<id>; its tests resolve ../../../../contracts to .stryker-tmp/contracts.
  rmSync(".stryker-tmp", { recursive: true, force: true });
  cpSync("../contracts", ".stryker-tmp/contracts", { recursive: true });
  const stamp = invalidateMutationCache(
    `reports/stryker/${file.replace(/[^a-z0-9]+/gi, "-")}.json`,
    fingerprint,
  );
  const result = spawnSync("npx", ["stryker", "run"], {
    stdio: "inherit",
    env: { ...process.env, MUTATE_FILE: file, MUTATE_TESTS: tests },
  });
  // Keep below-threshold measured results for survivor work, but never trust an aborted run.
  if (result.status === 0 || result.status === 1) stamp();
  if (result.status !== 0) failed = true;
}
rmSync(".stryker-tmp", { recursive: true, force: true });
process.exit(failed ? 1 : 0);
