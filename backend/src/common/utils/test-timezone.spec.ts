import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  claimStrykerDatabaseSlot,
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
  it('[BE-HARN-022] recycled Stryker workers reuse freed database slots instead of outgrowing them (KI-108)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stryker-slots-'));
    const live = new Set([101, 102]);
    const isAlive = (pid: number) => live.has(pid);
    try {
      expect(claimStrykerDatabaseSlot(dir, 2, 101, isAlive)).toBe('0');
      // Every test file of the same worker process loads the setup again and keeps its slot.
      expect(claimStrykerDatabaseSlot(dir, 2, 101, isAlive)).toBe('0');
      expect(claimStrykerDatabaseSlot(dir, 2, 102, isAlive)).toBe('1');
      expect(() => claimStrykerDatabaseSlot(dir, 2, 103, isAlive)).toThrow(
        'Stryker worker has no isolated database',
      );
      // Worker 101 was recycled (or killed): its slot goes to the next new worker, never to two.
      live.delete(101);
      live.add(103);
      live.add(104);
      expect(claimStrykerDatabaseSlot(dir, 2, 103, isAlive)).toBe('0');
      expect(readFileSync(join(dir, 'slot-0'), 'utf8')).toBe('103');
      expect(() => claimStrykerDatabaseSlot(dir, 2, 104, isAlive)).toThrow(
        'Stryker worker has no isolated database',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
