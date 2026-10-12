import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STATIC_TEST_ENV, assertTestDatabaseUrl } from './test-env';

export type HarnessGlobal = typeof globalThis & {
  __PG__?: StartedPostgreSqlContainer;
};

export default async function setup(): Promise<void> {
  let databaseUrl = process.env.TEST_DATABASE_URL;
  let container: StartedPostgreSqlContainer | undefined;
  try {
    if (!databaseUrl) {
      container = await new PostgreSqlContainer('postgres:17-alpine')
        .withDatabase('posbuzz_test')
        .withUsername('test')
        .withPassword('test')
        .start();
      databaseUrl = `${container.getConnectionUri()}?schema=public`;
    }
    const url = assertTestDatabaseUrl(databaseUrl);
    const env = {
      ...STATIC_TEST_ENV,
      DATABASE_URL: databaseUrl,
      DB_HOST: url.hostname,
      DB_PORT: url.port || '5432',
      DB_USERNAME: decodeURIComponent(url.username),
      DB_PASSWORD: decodeURIComponent(url.password),
      DB_NAME: decodeURIComponent(url.pathname.slice(1)),
    };
    execFileSync(
      process.execPath,
      [
        resolve(__dirname, '../../node_modules/prisma/build/index.js'),
        'migrate',
        'deploy',
      ],
      {
        cwd: resolve(__dirname, '../..'),
        env: { ...process.env, ...env },
        stdio: 'inherit',
      },
    );
    mkdirSync(resolve(__dirname, '../.tmp'), { recursive: true });
    writeFileSync(resolve(__dirname, '../.tmp/env.json'), JSON.stringify(env), {
      mode: 0o600,
    });
    (globalThis as HarnessGlobal).__PG__ = container;
  } catch (error) {
    await container?.stop();
    throw error;
  }
}
