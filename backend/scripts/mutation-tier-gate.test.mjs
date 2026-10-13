import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeReports, tierFailures } from './mutation-tier-gate.mjs';
const inventory = [
  { service: 'MoneyService', file: 'src/money.service.ts' },
  { service: 'CatalogService', file: 'src/catalog.service.ts' },
  { service: 'ViewService', file: 'src/view.service.ts' },
];
const tiers = { MoneyService: 'A', CatalogService: 'B', ViewService: 'C' };
const result = (statuses) => ({
  mutants: statuses.map((status) => ({ status })),
});
test('[BE-COV-020] per-file floors reject a masked low file and unmeasured files', () => {
  assert.deepEqual(
    tierFailures(
      {
        files: {
          'src/money.service.ts': result([
            'Killed',
            'Killed',
            'Killed',
            'Survived',
          ]),
          'src/catalog.service.ts': result(['Killed', 'Killed', 'NoCoverage']),
        },
      },
      inventory,
      tiers,
    ),
    [],
  );
  assert.deepEqual(
    tierFailures(
      {
        files: {
          'src/money.service.ts': result(['Killed', 'Survived']),
          'src/catalog.service.ts': result(['Killed']),
        },
      },
      inventory,
      tiers,
    ),
    ['src/money.service.ts: 50.00% < 75%'],
  );
  assert.equal(tierFailures({ files: {} }, inventory, tiers).length, 2);
  assert.equal(
    tierFailures(
      {
        files: { 'src/money.service.ts': result(['Ignored', 'CompileError']) },
      },
      inventory,
      tiers,
    ).length,
    2,
  );
});
test('[BE-COV-020] new services default to Tier A and absolute report paths resolve', () => {
  assert.deepEqual(
    tierFailures(
      {
        files: {
          '/sandbox/src/new.service.ts': result([
            'Killed',
            'Killed',
            'Killed',
            'Timeout',
          ]),
        },
      },
      [{ service: 'NewService', file: 'src/new.service.ts' }],
      {},
    ),
    [],
  );
});

test('[BE-MUT-001] a passing file cannot mask a low critical method', () => {
  const mutants = Array.from({ length: 20 }, (_, index) => ({
    status: index === 0 ? 'Survived' : 'Killed',
    location: { start: { line: index < 2 ? 10 : 50 } },
  }));
  assert.deepEqual(
    tierFailures(
      { files: { 'src/money.service.ts': { mutants } } },
      [inventory[0]],
      tiers,
      [{ file: 'src/money.service.ts', start: 1, end: 20, name: 'Money.pay' }],
    ),
    ['Money.pay: 50.00% < critical 80%'],
  );
  assert.deepEqual(
    tierFailures(
      { files: { 'src/money.service.ts': { mutants } } },
      [inventory[0]],
      tiers,
      [
        {
          file: 'src/money.service.ts',
          start: 100,
          end: 120,
          name: 'Money.return',
        },
      ],
    ),
    ['Money.return: 0.00% < critical 80%'],
  );
});

test('[BE-COV-020] shard reports merge, and a file split into line ranges combines its mutants', () => {
  const a = { files: { 'src/a.ts': result(['Killed']) } };
  const b = { files: { 'src/b.ts': result(['Survived']) } };
  assert.deepEqual(Object.keys(mergeReports([a, b]).files).sort(), [
    'src/a.ts',
    'src/b.ts',
  ]);
  const split = mergeReports([
    { files: { 'src/a.ts': result(['Killed', 'Killed']) } },
    { files: { 'src/a.ts': result(['Survived', 'Killed']) } },
  ]);
  assert.deepEqual(
    split.files['src/a.ts'].mutants.map((m) => m.status),
    ['Killed', 'Killed', 'Survived', 'Killed'],
  );
});
