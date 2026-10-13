import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
require('ts-node/register/transpile-only');
const { testEnvironment, assertTestDatabaseUrl } = require('./test-env.ts');
const count = Number(process.env.STRYKER_DATABASE_COUNT ?? 16);
if (!Number.isInteger(count) || count < 6 || count > 100)
  throw new Error('STRYKER_DATABASE_COUNT must be an integer from 6 to 100.');
const compose = ['compose', '-f', resolve('../docker-compose.test.yml')];
execFileSync('docker', [...compose, 'up', '-d', '--wait'], {
  stdio: 'inherit',
});
const sql = (statement) =>
  execFileSync(
    'docker',
    [
      ...compose,
      'exec',
      '-T',
      'postgres-test',
      'psql',
      '-h',
      '127.0.0.1',
      '-U',
      'test',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      statement,
    ],
    { stdio: 'inherit' },
  );
// Only the disposable test-qualified databases on the fixed local test server are touched.
const databaseUrl =
  'postgresql://test:test@localhost:55432/posbuzz_test_template?schema=public';
assertTestDatabaseUrl(databaseUrl);
for (let worker = 0; worker < count; worker++)
  sql(`DROP DATABASE IF EXISTS posbuzz_test_w${worker} WITH (FORCE)`);
sql('DROP DATABASE IF EXISTS posbuzz_test_template WITH (FORCE)');
sql('CREATE DATABASE posbuzz_test_template');
const env = {
  ...testEnvironment(),
  DATABASE_URL: databaseUrl,
  DB_HOST: 'localhost',
  DB_PORT: '55432',
  DB_USERNAME: 'test',
  DB_PASSWORD: 'test',
  DB_NAME: 'posbuzz_test_template',
  STRYKER_DATABASE_COUNT: String(count),
};
execFileSync(
  process.execPath,
  [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
  { env: { ...process.env, ...env }, stdio: 'inherit' },
);
for (let worker = 0; worker < count; worker++)
  sql(`CREATE DATABASE posbuzz_test_w${worker} TEMPLATE posbuzz_test_template`);
mkdirSync('test/.tmp', { recursive: true });
writeFileSync('test/.tmp/stryker-env.json', JSON.stringify(env), {
  mode: 0o600,
});
mkdirSync('.stryker-tmp', { recursive: true });
cpSync('../contracts', '.stryker-tmp/contracts', { recursive: true });
console.log(
  `Prepared ${count} isolated Stryker databases (worker ids start at zero).`,
);
