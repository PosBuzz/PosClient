import {
  testEnvironment,
  strykerWorkerEnvironment,
} from '../../../test/setup/test-env';

describe('integration timezone configuration', () => {
  it('[BE-HARN-019] preserves each requested nightly timezone and safe test settings', () => {
    for (const timezone of ['UTC', 'Asia/Dhaka', 'America/New_York']) {
      expect(testEnvironment(timezone)).toMatchObject({
        TZ: timezone,
        NODE_ENV: 'test',
        REDIS_ENABLED: 'false',
        RABBITMQ_ENABLED: 'false',
        BUSINESS_TIMEZONE: 'UTC',
      });
    }
  });
  it('[BE-HARN-020] worker zero and worker one use distinct test databases without changing the base manifest', () => {
    const env = {
      DATABASE_URL:
        'postgresql://test:test@localhost:55432/posbuzz_test_template?schema=public',
      STRYKER_DATABASE_COUNT: '16',
      TZ: 'UTC',
    };
    expect(strykerWorkerEnvironment(env, '0')).toMatchObject({
      DB_NAME: 'posbuzz_test_w0',
      TZ: 'UTC',
    });
    expect(
      new URL(strykerWorkerEnvironment(env, '1').DATABASE_URL).pathname,
    ).toBe('/posbuzz_test_w1');
    expect(strykerWorkerEnvironment(env, '0').DATABASE_URL).not.toBe(
      strykerWorkerEnvironment(env, '1').DATABASE_URL,
    );
    expect(new URL(env.DATABASE_URL).pathname).toBe('/posbuzz_test_template');
  });
  it('[BE-HARN-021] missing, malformed, unprepared workers and a nonlocal base URL fail closed', () => {
    const env = {
      DATABASE_URL:
        'postgresql://test:test@localhost:55432/posbuzz_test_template?schema=public',
      STRYKER_DATABASE_COUNT: '16',
    };
    for (const worker of [undefined, '', '-1', 'abc', '16', '99']) {
      expect(() => strykerWorkerEnvironment(env, worker)).toThrow(
        'Stryker worker has no isolated database',
      );
    }
    expect(() =>
      strykerWorkerEnvironment({ ...env, STRYKER_DATABASE_COUNT: '' }, '0'),
    ).toThrow('Stryker worker has no isolated database');
    expect(() =>
      strykerWorkerEnvironment(
        {
          ...env,
          DATABASE_URL: env.DATABASE_URL.replace(
            'localhost',
            'remote.example.test',
          ),
        },
        '0',
      ),
    ).toThrow('isolated local test server');
    expect(() =>
      strykerWorkerEnvironment(
        {
          ...env,
          DATABASE_URL: env.DATABASE_URL.replace(
            'posbuzz_test_template',
            'production',
          ),
        },
        '0',
      ),
    ).toThrow('disposable database');
  });
});
