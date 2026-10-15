// The vitest runner for Stryker 10 reads vitest internals that changed in vitest 5 (it finds no
// tests), so mutants are tested with the command runner running only the tests that own the file.
// One file per run (see scripts/mutation.mjs). The sandbox is a copy of consumer/, but tests import
// fixtures from the repo's contracts/ folder, which scripts/mutation.mjs places beside the sandbox.
const file = process.env.MUTATE_FILE;
const tests = process.env.MUTATE_TESTS;
if (!file || !tests) throw new Error("Run via `npm run test:mutation` (sets MUTATE_FILE and MUTATE_TESTS)");
const name = file.replace(/[^a-z0-9]+/gi, "-");

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: "npm",
  testRunner: "command",
  commandRunner: { command: `TZ=UTC npx vitest run ${tests} --bail 1` },
  coverageAnalysis: "off",
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.test.json",
  mutate: [file],
  concurrency: 4,
  timeoutMS: 120000,
  thresholds: { high: 95, low: 90, break: 90 },
  incremental: true,
  incrementalFile: `reports/stryker/${name}.json`,
  reporters: ["clear-text", "html", "json"],
  htmlReporter: { fileName: `reports/stryker/${name}.html` },
  jsonReporter: { fileName: `reports/stryker/${name}.mutation.json` },
};
