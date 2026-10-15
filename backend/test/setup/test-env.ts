import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

export const STATIC_TEST_ENV = {
  NODE_ENV: 'test',
  PORT: '0',
  TZ: 'UTC',
  JWT_SECRET_KEY: 'test-jwt-secret-not-for-prod-0123456789',
  JWT_ALGORITHM: 'HS256',
  JWT_EXPIRATION: '15m',
  JWT_REFRESH_EXPIRATION: '7d',
  CSRF_SECRET_KEY: 'test-csrf-secret-not-for-prod-0123456789',
  CORS_ORIGINS: 'http://*.localhost:3000,http://localhost:3001',
  REDIS_ENABLED: 'false',
  REDIS_HOST: '127.0.0.1',
  REDIS_PORT: '9',
  REDIS_PASSWORD: '',
  REDIS_PREFIX: 'posbuzz_test',
  CACHE_TTL: '60',
  RABBITMQ_ENABLED: 'false',
  RABBITMQ_URL: 'amqp://127.0.0.1:9',
  BUSINESS_TIMEZONE: 'UTC',
  FASTAPI_URL: 'http://127.0.0.1:9',
  PORTFOLIO_REVALIDATE_URL: 'http://127.0.0.1:9',
  PORTFOLIO_REVALIDATE_SECRET: 'test-revalidation-not-for-prod',
};

/** Keep an explicitly requested process timezone so the nightly matrix exercises it. */
export function testEnvironment(timezone = process.env.TZ ?? 'UTC') {
  return { ...STATIC_TEST_ENV, TZ: timezone };
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function sleep(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Stryker numbers every worker process it starts (0, 1, 2, …) and `maxTestRunnerReuse` keeps starting
 * new ones, so its worker ids outgrow the prepared databases mid-run (KI-108). A worker process instead
 * claims the first database slot whose lock file names no live process, and keeps it for its lifetime.
 * Claims are serialised by a short-lived directory mutex so two new workers never take the same slot.
 */
export function claimStrykerDatabaseSlot(
  lockDir: string,
  count: number,
  pid = process.pid,
  isAlive: (pid: number) => boolean = processIsAlive,
): string {
  mkdirSync(lockDir, { recursive: true });
  const mutex = join(lockDir, 'claim.lock');
  for (let attempt = 0; ; attempt++) {
    try {
      mkdirSync(mutex);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      // A claim takes microseconds; a mutex this old belongs to a process that died holding it.
      if (attempt >= 1000) rmSync(mutex, { recursive: true, force: true });
      sleep(5);
    }
  }
  try {
    let free: number | undefined;
    for (let slot = 0; slot < count; slot++) {
      const file = join(lockDir, `slot-${slot}`);
      const owner = existsSync(file) ? Number(readFileSync(file, 'utf8')) : 0;
      if (owner === pid) return String(slot);
      if (free === undefined && (!owner || !isAlive(owner))) free = slot;
    }
    if (free === undefined) {
      throw new Error(
        'Stryker worker has no isolated database. Increase STRYKER_DATABASE_COUNT and rerun test:mutation:domain.',
      );
    }
    writeFileSync(join(lockDir, `slot-${free}`), String(pid));
    return String(free);
  } finally {
    rmSync(mutex, { recursive: true, force: true });
  }
}

export function strykerWorkerEnvironment(
  env: Record<string, string>,
  worker: string | undefined,
): Record<string, string> {
  const count = Number(env.STRYKER_DATABASE_COUNT);
  if (
    !worker ||
    !/^\d+$/.test(worker) ||
    !Number.isInteger(count) ||
    count < 1 ||
    Number(worker) >= count
  ) {
    throw new Error(
      'Stryker worker has no isolated database. Increase STRYKER_DATABASE_COUNT and rerun test:mutation:domain.',
    );
  }
  const url = assertTestDatabaseUrl(env.DATABASE_URL);
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.port !== '55432'
  ) {
    throw new Error(
      'Stryker requires the isolated local test server on port 55432.',
    );
  }
  url.pathname = `/posbuzz_test_w${worker}`;
  return {
    ...env,
    DATABASE_URL: url.toString(),
    DB_NAME: `posbuzz_test_w${worker}`,
  };
}

export function assertTestDatabaseUrl(value: string): URL {
  const url = new URL(value);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !/(^|[_-])test($|[_-])/.test(name)
  ) {
    throw new Error(
      'Use a disposable database with a test-qualified name, such as posbuzz_test.',
    );
  }
  if ((url.searchParams.get('schema') ?? 'public') !== 'public') {
    throw new Error(
      'The harness requires the public schema of a disposable test database.',
    );
  }
  return url;
}
