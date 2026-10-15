import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Boot, bootDomain } from '../../helpers/domain';
import { getPrisma, resetDb, disconnect } from '../../helpers/db';
import { createAdmin } from '../../factories';
import { api } from '../../helpers/http';
import { NEVER_EXECUTE, type RouteEntry } from '../security/manifest';
import { LEAK, SeededTenant, seedTenant } from './seed';
import { QUERY_DEFAULTS, resolvePath } from './param-resolver';

const manifest: RouteEntry[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../contracts/routes.json'), 'utf8'),
);
const clientGets = manifest.filter(
  (e) => e.method === 'GET' && e.guards.includes('ClientAuthGuard'),
);
// Routes the sweep cannot visit, each with the reason
const SKIPPED: Record<string, string> = {};
const adminGets = manifest.filter(
  (e) =>
    e.method === 'GET' &&
    e.guards.includes('AdminAuthGuard') &&
    !e.path.includes(':') &&
    !NEVER_EXECUTE(e),
);

const SECRET_KEYS = new Set(['password', 'refresh_token']);
const BCRYPT = /^\$2[aby]\$\d{2}\$/;
function secrets(value: unknown, path = ''): string[] {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' && BCRYPT.test(value)
      ? [`${path} looks like a bcrypt hash`]
      : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => [
      ...(SECRET_KEYS.has(key) && child !== null && child !== undefined
        ? [`${path}.${key}`]
        : []),
      ...secrets(child, `${path}.${key}`),
    ],
  );
}

describe('tenant isolation: leak sweep over every client GET route', () => {
  const db = getPrisma();
  let boot: Boot;
  let a: SeededTenant;
  let b: SeededTenant;
  const visited: string[] = [];
  const unresolved: string[] = [];
  const leaks: string[] = [];
  const secretHits: string[] = [];
  const serverErrors: string[] = [];
  const adminSecretHits: string[] = [];
  const adminErrors: string[] = [];

  beforeAll(async () => {
    await resetDb();
    boot = await bootDomain();
    a = await seedTenant(db, boot, 'AAAAAA');
    b = await seedTenant(db, boot, LEAK);

    for (const route of clientGets) {
      const key = `${route.method} ${route.path}`;
      if (key in SKIPPED) continue;
      const path = resolvePath(route.path, a);
      if (!path) {
        unresolved.push(key);
        continue;
      }
      const response = await api(boot.app)
        .as(a.tenant.adminUser)
        .get(`${path}?${QUERY_DEFAULTS(a)}`);
      visited.push(key);
      const text = `${response.text ?? ''}${JSON.stringify(response.body ?? '')}`;
      if (text.includes(LEAK)) leaks.push(`${key} -> ${response.status}`);
      if (response.status >= 500) {
        serverErrors.push(`${key} -> ${response.status}`);
      }
      secretHits.push(...secrets(response.body).map((hit) => `${key}: ${hit}`));
    }

    // Super-admin lists must not expose password or refresh-token hashes either
    const admin = await createAdmin(db);
    for (const route of adminGets) {
      const response = await api(boot.app)
        .asAdmin(admin)
        .get(route.path.replace('/api/v1', ''));
      if (response.status >= 500) {
        adminErrors.push(`${route.path} -> ${response.status}`);
      }
      adminSecretHits.push(
        ...secrets(response.body).map((hit) => `${route.path}: ${hit}`),
      );
    }
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });

  it('[BE-TEN-000] both tenants are seeded with a marker only the victim has', async () => {
    expect(
      await db.customer.count({
        where: { consumer_id: b.tenant.consumer.id, name: { contains: LEAK } },
      }),
    ).toBe(1);
    expect(
      await db.customer.count({
        where: { consumer_id: a.tenant.consumer.id, name: { contains: LEAK } },
      }),
    ).toBe(0);
  });

  it("[BE-TEN-001] no GET route returns the other tenant's data", () => {
    expect(leaks).toEqual([]);
  });

  it('[BE-TEN-002] the sweep visited at least 95% of client GET routes, and the rest are listed with a reason', () => {
    expect(unresolved).toEqual([]);
    expect(visited.length / clientGets.length).toBeGreaterThanOrEqual(0.95);
  });

  it('[BE-ROB-003] no GET route fails with a server error on a well-formed request', () => {
    expect(serverErrors).toEqual([]);
  });

  it('[BE-ROB-004] no response exposes a password, a refresh token or a bcrypt hash', () => {
    expect(secretHits).toEqual([]);
  });

  it('[BE-ROB-004] the super-admin lists expose no password, refresh token or bcrypt hash either', () => {
    expect(adminGets.length).toBeGreaterThan(15);
    expect(adminSecretHits).toEqual([]);
    expect(adminErrors).toEqual([]);
  });
});
