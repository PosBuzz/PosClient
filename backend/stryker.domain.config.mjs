import { readFileSync } from 'node:fs';
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
  concurrency: 2,
  timeoutMS: 120000,
  mutate: [
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
  ],
  ignoreStatic: true,
  thresholds: { high: 80, low: 70, break: 70 },
  incremental: true,
  incrementalFile: 'reports/stryker/domain-incremental.json',
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/stryker/domain.html' },
  jsonReporter: { fileName: 'reports/stryker/domain.mutation.json' },
};
