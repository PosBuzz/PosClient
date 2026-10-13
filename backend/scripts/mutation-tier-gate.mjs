import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';

export function criticalMethodRange(file, method) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  let range;
  const visit = (node) => {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === method) {
      range = {
        file,
        start:
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        end: source.getLineAndCharacterOfPosition(node.end).line + 1,
        name: `${file}#${method}`,
      };
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!range) throw new Error(`Missing critical method ${file}#${method}`);
  return range;
}

export function tierFailures(report, inventory, tiers, criticalRanges = []) {
  const requirements = new Map();
  for (const method of inventory) {
    const tier = tiers[method.service] ?? 'A';
    if (tier === 'C') continue;
    requirements.set(
      method.file,
      Math.max(requirements.get(method.file) ?? 0, tier === 'A' ? 75 : 60),
    );
  }
  const files = new Map(
    Object.entries(report.files ?? {}).map(([file, value]) => [
      file.replaceAll('\\', '/').replace(/^.*?\/(src\/)/, '$1'),
      value,
    ]),
  );
  const failures = [];
  for (const { file, start, end, name } of criticalRanges) {
    const mutants =
      files
        .get(file)
        ?.mutants?.filter(
          (mutant) =>
            mutant.location.start.line >= start &&
            mutant.location.start.line <= end &&
            ['Killed', 'Timeout', 'Survived', 'NoCoverage'].includes(
              mutant.status,
            ),
        ) ?? [];
    const detected = mutants.filter((mutant) =>
      ['Killed', 'Timeout'].includes(mutant.status),
    ).length;
    const score = mutants.length ? (detected / mutants.length) * 100 : 0;
    if (!mutants.length || score < 80)
      failures.push(`${name}: ${score.toFixed(2)}% < critical 80%`);
  }
  for (const [file, floor] of requirements) {
    const mutants = files.get(file)?.mutants;
    if (!mutants) {
      failures.push(`${file}: missing mutation result (required ${floor}%)`);
      continue;
    }
    const measured = mutants.filter((mutant) =>
      ['Killed', 'Timeout', 'Survived', 'NoCoverage'].includes(mutant.status),
    );
    if (!measured.length) {
      failures.push(`${file}: no measured mutants (required ${floor}%)`);
      continue;
    }
    const detected = measured.filter((mutant) =>
      ['Killed', 'Timeout'].includes(mutant.status),
    ).length;
    const score = (detected / measured.length) * 100;
    if (score < floor)
      failures.push(`${file}: ${score.toFixed(2)}% < ${floor}%`);
  }
  return failures;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
  const failures = tierFailures(
    read(process.argv[2] ?? 'reports/stryker/domain.mutation.json'),
    read('test/service-coverage/service-methods.json'),
    read('test/service-coverage/tiers.json'),
    [
      {
        file: 'src/consumer/promotions/promotion-math.ts',
        start: 1,
        end: Infinity,
        name: 'promotion-math',
      },
      {
        file: 'src/consumer/inventory/services/inventory-adjustment.service.ts',
        start: 1,
        end: Infinity,
        name: 'inventory-adjustment',
      },
      criticalMethodRange(
        'src/consumer/payments/services/payments.service.ts',
        'makePayment',
      ),
      criticalMethodRange(
        'src/consumer/returns/services/return.service.ts',
        'create',
      ),
    ],
  );
  if (failures.length) {
    console.error(`BE-COV-020 failed:\n${failures.join('\n')}`);
    process.exitCode = 1;
  } else
    console.log('BE-COV-020: every Tier A/B file meets its mutation floor.');
}
