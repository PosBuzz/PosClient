import base from './stryker.domain.config.mjs';

// Fast local loop: mutate the given files and judge them by the unit specs alone (no database tests),
// e.g. `STRYKER_DOMAIN_RUN=1 npx stryker run stryker.unit-only.config.mjs --mutate src/x.service.ts`.
// Scores are a lower bound for the domain run, which adds the integration specs.
export default {
  ...base,
  jest: { ...base.jest, configFile: 'test/jest-stryker-unit-only.json' },
  concurrency: Number(process.env.STRYKER_CONCURRENCY ?? 6),
  incremental: false,
  reporters: ['json', 'clear-text'],
  jsonReporter: { fileName: 'reports/stryker/unit-only.mutation.json' },
  htmlReporter: undefined,
};
