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
