import { readFileSync, writeFileSync } from 'node:fs';
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

export function mergeReports(reports) {
  // A large file is split into line ranges across shards, so its mutants arrive from several reports.
  const files = {};
  for (const report of reports)
    for (const [file, value] of Object.entries(report.files ?? {})) {
      files[file] = files[file]
        ? {
            ...files[file],
            mutants: [...files[file].mutants, ...(value.mutants ?? [])],
          }
        : { ...value, mutants: [...(value.mutants ?? [])] };
    }
  return { files };
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

const DETECTED = ['Killed', 'Timeout'];
const MEASURED = ['Killed', 'Timeout', 'Survived', 'NoCoverage'];

/** Per-file mutation score (0-100) for every file in a merged report that has measured mutants. */
export function fileScores(report) {
  const scores = {};
  for (const [path, value] of Object.entries(report.files ?? {})) {
    const file = path.replaceAll('\\', '/').replace(/^.*?\/(src\/)/, '$1');
    const measured = (value.mutants ?? []).filter((m) =>
      MEASURED.includes(m.status),
    );
    if (!measured.length) continue;
    const detected = measured.filter((m) => DETECTED.includes(m.status)).length;
    scores[file] = Math.round((detected / measured.length) * 10000) / 100;
  }
  return scores;
}

/**
 * Rotating nightly gate: a measured file may not fall more than `tolerance` points below its
 * recorded baseline. Files without a baseline are reported, not failed; the Tier A/B floors stay
 * the target and are listed while unmet (strict mode, without --baseline, still enforces them).
 */
export function ratchetResult(report, baseline, tolerance = 1) {
  const scores = fileScores(report);
  const failures = [];
  const unrecorded = [];
  for (const [file, score] of Object.entries(scores)) {
    if (baseline[file] === undefined) unrecorded.push(`${file}: ${score}%`);
    else if (score < baseline[file] - tolerance)
      failures.push(`${file}: ${score}% < baseline ${baseline[file]}%`);
  }
  return {
    scores,
    failures,
    unrecorded,
    candidate: { ...baseline, ...scores },
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
  const args = process.argv.slice(2);
  const flag = (name) => {
    const at = args.indexOf(name);
    return at === -1 ? undefined : args.splice(at, 2)[1];
  };
  const baselinePath = flag('--baseline');
  const candidatePath = flag('--candidate');
  const paths = args;
  if (baselinePath) {
    const merged = mergeReports(
      (paths.length ? paths : ['reports/stryker/domain.mutation.json']).map(
        read,
      ),
    );
    const { scores, failures, unrecorded, candidate } = ratchetResult(
      merged,
      read(baselinePath),
    );
    if (candidatePath)
      writeFileSync(
        candidatePath,
        `${JSON.stringify(sortKeys(candidate), null, 2)}\n`,
      );
    console.log(`Measured ${Object.keys(scores).length} file(s) tonight.`);
    if (unrecorded.length)
      console.log(
        `No baseline yet (recorded in the candidate):\n${unrecorded.join('\n')}`,
      );
    if (failures.length) {
      console.error(`BE-COV-020 (ratchet) failed:\n${failures.join('\n')}`);
      process.exitCode = 1;
    } else
      console.log(
        'BE-COV-020 (ratchet): no measured file fell below its baseline.',
      );
  } else {
    const failures = tierFailures(
      mergeReports(
        (paths.length ? paths : ['reports/stryker/domain.mutation.json']).map(
          read,
        ),
      ),
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
}

function sortKeys(object) {
  return Object.fromEntries(
    Object.entries(object).sort(([a], [b]) => a.localeCompare(b)),
  );
}
