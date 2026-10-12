import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertTestDatabaseUrl } from './test-env';

const env = JSON.parse(
  readFileSync(resolve(__dirname, '../.tmp/env.json'), 'utf8'),
) as Record<string, string>;
assertTestDatabaseUrl(env.DATABASE_URL);
Object.assign(process.env, env);
