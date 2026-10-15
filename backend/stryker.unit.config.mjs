import { cpSync, mkdirSync } from 'node:fs';

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'npm',
  testRunner: 'jest',
  // no configFile: the jest-runner falls back to the "jest" key in package.json (the unit config)
  jest: { projectType: 'custom', enableFindRelatedTests: true },
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  ignorePatterns: ['.env*', 'reports/**', 'coverage/**'],
  coverageAnalysis: 'perTest',
  concurrency: 1,
  timeoutMS: 60000,
  // Files with unit tests. DB-backed utilities (stock-mutation, document-number-lock, business-time)
  // are killed by the integration suites and belong to the domain config.
  mutate: [
    'src/consumer/promotions/promotion-math.ts',
    'src/consumer/inventory/utils/batch-location.util.ts',
    'src/consumer/inventory/utils/validate-purchase.util.ts',
    'src/consumer/sales/utils/sale-pricing.util.ts',
    'src/common/services/subdomain-util.service.ts',
    'src/common/utils/error.util.ts',
    'src/common/errors/client-error.ts',
    'prisma-client-exception/*.ts',
    '!**/*.spec.ts',
  ],
  thresholds: { high: 90, low: 85, break: 85 },
  incremental: true,
  incrementalFile: 'reports/stryker/unit-incremental.json',
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/stryker/unit.html' },
  jsonReporter: { fileName: 'reports/stryker/unit.mutation.json' },
};

// Contract specs resolve fixtures beside Stryker's sandbox, just like the consumer runner.
mkdirSync('.stryker-tmp', { recursive: true });
cpSync('../contracts', '.stryker-tmp/contracts', { recursive: true });
