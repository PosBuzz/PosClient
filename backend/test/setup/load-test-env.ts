import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertTestDatabaseUrl, strykerWorkerEnvironment } from './test-env';

const mutationRun = process.env.STRYKER_DOMAIN_RUN === '1';
let env = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      mutationRun ? '../.tmp/stryker-env.json' : '../.tmp/env.json',
    ),
    'utf8',
  ),
) as Record<string, string>;
if (mutationRun) {
  env = strykerWorkerEnvironment(env, process.env.STRYKER_MUTATOR_WORKER);
}
assertTestDatabaseUrl(env.DATABASE_URL);
Object.assign(process.env, env);
