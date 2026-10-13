import { globSync, readFileSync, statSync } from 'node:fs';
const inventory = JSON.parse(
  readFileSync(
    new URL('./test/service-coverage/service-methods.json', import.meta.url),
    'utf8',
  ),
);
const tiers = JSON.parse(
  readFileSync(
    new URL('./test/service-coverage/tiers.json', import.meta.url),
    'utf8',
  ),
);
const tierFiles = [
  ...new Set(
    inventory
      .filter((method) => (tiers[method.service] ?? 'A') !== 'C')
      .map((method) => method.file),
  ),
];

const targets = [
  ...tierFiles,
  'src/consumer/promotions/promotion-math.ts',
  'src/consumer/inventory/services/inventory-adjustment.service.ts',
  'src/consumer/rewards/services/rewards.service.ts',
  'src/consumer/dashboard/services/dashboard.service.ts',
  'src/auth/guards/*.ts',
  'src/auth/*.strategy.ts',
  'src/common/utils/document-number-lock.util.ts',
  'src/common/utils/business-time.util.ts',
  'src/common/guards/development-only.guard.ts',
];

// STRYKER_SHARD="i/N" (1-based) mutates a deterministic, size-balanced slice so the nightly can run
// N parallel jobs; each writes its own report and the tier gate merges them. Unset = every file.
const shard = process.env.STRYKER_SHARD?.match(/^(\d+)\/(\d+)$/);
const [shardIndex, shardCount] = shard
  ? [Number(shard[1]), Number(shard[2])]
  : [1, 1];
if (
  process.env.STRYKER_SHARD &&
  (!shard || shardIndex < 1 || shardIndex > shardCount)
)
  throw new Error(
    'STRYKER_SHARD must look like "2/8" with 1 <= index <= count.',
  );
const files = [
  ...new Set(targets.flatMap((pattern) => globSync(pattern))),
].sort();
const loads = Array.from({ length: shardCount }, () => 0);
const slices = Array.from({ length: shardCount }, () => []);
for (const file of [...files].sort(
  (a, b) => statSync(b).size - statSync(a).size || a.localeCompare(b),
)) {
  const lightest = loads.indexOf(Math.min(...loads));
  slices[lightest].push(file);
  loads[lightest] += statSync(file).size;
}
const suffix = shard ? `-shard-${shardIndex}` : '';

// Reviewed A/B service inventory plus the B7 guard and pure-domain targets.
export default {
  packageManager: 'npm',
  testRunner: 'jest',
  jest: {
    projectType: 'custom',
    configFile: 'test/jest-stryker-domain.json',
    enableFindRelatedTests: false,
  },
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  coverageAnalysis: 'perTest',
  concurrency: 3,
  timeoutMS: 120000,
  dryRunTimeoutMinutes: 30,
  mutate: slices[shardIndex - 1],
  ignoreStatic: true,
  thresholds: { high: 80, low: 70, break: 70 },
  incremental: true,
  incrementalFile: `reports/stryker/domain-incremental${suffix}.json`,
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: `reports/stryker/domain${suffix}.html` },
  jsonReporter: { fileName: `reports/stryker/domain${suffix}.mutation.json` },
};
