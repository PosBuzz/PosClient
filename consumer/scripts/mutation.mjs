// Runs Stryker once per mutated file and fails if any file is below the break threshold.
import { cpSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const targets = {
  "src/utils/calculate-totals.utils.ts": "src/utils/calculate-totals.utils.test.ts src/utils/__contracts__/sale-totals.contract.test.ts src/utils/__contracts__/pricing.contract.test.ts",
  "src/utils/sale-item.utils.ts": "src/utils/sale-item.utils.test.ts src/utils/__contracts__/pricing.contract.test.ts src/utils/__contracts__/sale-totals.contract.test.ts",
  "src/utils/promotion-validation.ts": "src/utils/promotion-validation.test.ts src/utils/__contracts__/promotions.contract.test.ts",
  "src/utils/promotion-helpers.utils.ts": "src/utils/promotion-helpers.utils.test.ts src/utils/promotion-validation.test.ts",
  "src/utils/formatters.ts": "src/utils/formatters.test.ts",
  "src/utils/payment-provider.utils.ts": "src/utils/payment-provider.utils.test.ts",
  "src/utils/invalidate-sales-reports.ts": "src/utils/invalidate-sales-reports.test.ts",
  "src/api/axiosInstance.ts": "src/api/axiosInstance.test.ts",
  "src/components/RequireAuth.tsx": "src/routes.test.tsx src/components/Require.test.tsx",
  "src/components/RequirePermission.tsx": "src/routes.test.tsx src/components/Require.test.tsx",
};
const only = process.argv[2];
let failed = false;
for (const [file, tests] of Object.entries(only ? { [only]: targets[only] } : targets)) {
  console.log(`\n=== ${file} ===`);
  // The sandbox lives in .stryker-tmp/<id>; its tests resolve ../../../../contracts to .stryker-tmp/contracts.
  rmSync(".stryker-tmp", { recursive: true, force: true });
  cpSync("../contracts", ".stryker-tmp/contracts", { recursive: true });
  const result = spawnSync("npx", ["stryker", "run"], {
    stdio: "inherit",
    env: { ...process.env, MUTATE_FILE: file, MUTATE_TESTS: tests },
  });
  if (result.status !== 0) failed = true;
}
rmSync(".stryker-tmp", { recursive: true, force: true });
process.exit(failed ? 1 : 0);
