import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Boot, bootDomain } from '../../helpers/domain';
import { getPrisma, resetDb, disconnect } from '../../helpers/db';
import { createAdmin } from '../../factories';
import { api, dispatch } from '../../helpers/http';
import { seedTenant, SeededTenant } from '../tenancy/seed';
import type { RouteEntry } from './manifest';

const manifest: RouteEntry[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../contracts/routes.json'), 'utf8'),
);
const authed = manifest.filter(
  (e) =>
    e.guards.includes('ClientAuthGuard') || e.guards.includes('AdminAuthGuard'),
);
// Never executed: they would start a real database dump or restore. Reason recorded per route.
const NEVER_RUN = (e: RouteEntry) => e.path.includes('/backup-restore');
// Routes that return a server error on bad input today; each has a KI. The test fails if one starts passing.
const KNOWN_5XX: Record<string, string> = {};

const GARBAGE = {
  id: 'x',
  quantity: 'abc',
  items: 'nope',
  name: { a: 1 },
  amount: -1e99,
  payments: 5,
  variants: 'x',
  permission_ids: 'x',
};
const fillWith = (path: string, value: string) => path.replace(/:\w+/g, value);

describe('robustness: bad input never produces a server error', () => {
  const db = getPrisma();
  let boot: Boot;
  let a: SeededTenant;
  let admin: Awaited<ReturnType<typeof createAdmin>>;
  const failures: Record<string, string[]> = {
    empty: [],
    garbage: [],
    badParams: [],
  };
  const bodies: string[] = [];
  let visited = 0;

  const session = (e: RouteEntry) =>
    e.guards.includes('AdminAuthGuard')
      ? api(boot.app).asAdmin(admin)
      : api(boot.app).as(a.tenant.adminUser);
  const run = (e: RouteEntry, path: string, body?: object) =>
    dispatch(session(e), e.method, path, body);

  beforeAll(async () => {
    await resetDb();
    boot = await bootDomain();
    a = await seedTenant(db, boot, 'AAAAAA');
    admin = await createAdmin(db);
    for (const e of authed) {
      if (NEVER_RUN(e)) continue;
      const key = `${e.method} ${e.path}`;
      visited++;
      const path = e.path.replace('/api/v1', '');
      if (e.method !== 'GET') {
        for (const [kind, body] of [
          ['empty', {}],
          ['garbage', GARBAGE],
        ] as const) {
          const response = await run(e, fillWith(path, '999999'), body);
          bodies.push(JSON.stringify(response.body ?? ''));
          if (response.status >= 500) {
            failures[kind].push(`${key} -> ${response.status}`);
          }
        }
      }
      if (e.path.includes(':')) {
        for (const junk of ['abc', '-1', '99999999999']) {
          const response = await run(
            e,
            fillWith(path, junk),
            e.method === 'GET' ? undefined : {},
          );
          bodies.push(JSON.stringify(response.body ?? ''));
          if (response.status >= 500) {
            failures.badParams.push(`${key} [${junk}] -> ${response.status}`);
          }
        }
      }
    }
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });

  it('[BE-ROB-000] the sweep covered the authenticated routes', () => {
    expect(visited).toBeGreaterThan(240);
  });

  it('[BE-ROB-001] an empty body never causes a server error', () => {
    expect(
      failures.empty.filter((f) => !(f.split(' ->')[0] in KNOWN_5XX)),
    ).toEqual([]);
  });

  it('[BE-ROB-002] a body of the wrong types never causes a server error', () => {
    expect(
      failures.garbage.filter((f) => !(f.split(' ->')[0] in KNOWN_5XX)),
    ).toEqual([]);
  });

  it('[BE-ROB-003] junk, negative and oversized ids never cause a server error', () => {
    expect(
      failures.badParams.filter((f) => !(f.split(' [')[0] in KNOWN_5XX)),
    ).toEqual([]);
  });

  it('[BE-ROB-004] no error body exposes a password hash, a stack trace or a SQL fragment', () => {
    const all = bodies.join('\n');
    expect(all).not.toMatch(/\$2[aby]\$\d{2}\$/);
    expect(all).not.toMatch(/\bat\s+\S+\s+\(.*\.(ts|js):\d+:\d+\)/);
    expect(all).not.toMatch(/Invalid `prisma\./);
  });
});
