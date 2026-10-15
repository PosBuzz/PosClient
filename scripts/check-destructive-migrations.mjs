// BE-SCHEMA-004: a migration added on this branch must not lose data unless its folder carries an
// ALLOW_DESTRUCTIVE.md that explains the data migration.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = 'backend/prisma/migrations';

// SQL comments are ignored, so a note saying "we do not DROP TABLE" cannot trip the guard
const strip = (sql) => sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const RULES = [
  [/\bDROP\s+TABLE\b/i, 'DROP TABLE'],
  [/\bDROP\s+COLUMN\b/i, 'DROP COLUMN'],
  [/\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i, 'ALTER COLUMN ... TYPE'],
  [/\bTRUNCATE\b/i, 'TRUNCATE'],
];

export function findDestructive(sql) {
  const clean = strip(sql);
  return RULES.filter(([pattern]) => pattern.test(clean)).map(([, label]) => label);
}

/** Folders of migrations added since `base`, from `git diff --name-only`. */
export function addedMigrationFolders(diffOutput) {
  return [
    ...new Set(
      diffOutput
        .split('\n')
        .filter((file) => file.startsWith(`${MIGRATIONS}/`) && file.endsWith('/migration.sql'))
        .map((file) => file.slice(0, file.lastIndexOf('/'))),
    ),
  ];
}

export function evaluate(folders, read = (p) => readFileSync(resolve(root, p), 'utf8'), has = (p) => existsSync(resolve(root, p))) {
  const problems = [];
  for (const folder of folders) {
    const found = findDestructive(read(`${folder}/migration.sql`));
    if (found.length && !has(`${folder}/ALLOW_DESTRUCTIVE.md`)) {
      problems.push(`${folder}: ${found.join(', ')} without ${folder}/ALLOW_DESTRUCTIVE.md`);
    }
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.env.MIGRATION_BASE || 'origin/main';
  let diff = '';
  try {
    diff = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`, '--', MIGRATIONS], { cwd: root, encoding: 'utf8' });
  } catch (error) {
    console.error(`Cannot compare against ${base}: ${error.message}. Fetch the base branch (fetch-depth: 0).`);
    process.exit(2);
  }
  const added = addedMigrationFolders(diff);
  const problems = evaluate(added);
  console.log(`Destructive migration guard: ${added.length} migration(s) added since ${base}`);
  problems.forEach((problem) => console.error(`FAIL ${problem}`));
  process.exit(problems.length ? 1 : 0);
}
