import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Boot, bootDomain } from '../../helpers/domain';
import { getPrisma, resetDb, disconnect } from '../../helpers/db';
import { snapshotTenant } from '../../helpers/invariants';
import { api, dispatch } from '../../helpers/http';
import type { RouteEntry } from '../security/manifest';
import { LEAK, SeededTenant, seedTenant } from './seed';
import { QUERY_DEFAULTS, resolvePath } from './param-resolver';
import { bodyFor } from './bodies';

const manifest: RouteEntry[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../contracts/routes.json'), 'utf8'),
);
const withParams = manifest.filter(
  (e) => e.guards.includes('ClientAuthGuard') && e.path.includes(':'),
);
// Routes whose parameters are not tenant resources at all (constants), with the reason
const NOT_A_RESOURCE: Record<string, string> = {
  'GET /api/v1/consumer/rewards/redemption-value/:points':
    "a number to multiply by the shop's own rate",
  'GET /api/v1/receipt-settings/by-type/:type': 'a document type, not an id',
  'GET /api/v1/receipt-settings/defaults/:type': 'a document type, not an id',
  'GET /api/v1/consumer/import/:entity/columns': 'an import kind, not an id',
  'GET /api/v1/consumer/import/:entity/template': 'an import kind, not an id',
  'POST /api/v1/consumer/import/:entity': 'an import kind, not an id',
  'POST /api/v1/consumer/import/:entity/preview': 'an import kind, not an id',
};
// Routes that cannot be driven with the sweep's plain requests (file uploads), with the reason
const SKIPPED: Record<string, string> = {
  'GET /api/v1/consumer/sales/search/:saleNumber':
    "sale numbers are per shop, so the other shop's number finds this shop's own sale: asserted separately (BE-TEN-013)",
};

describe("tenant isolation: another tenant's ids on every parameterized route", () => {
  const db = getPrisma();
  let boot: Boot;
  let a: SeededTenant;
  let b: SeededTenant;
  const results: Array<{
    key: string;
    status: number;
    leaked: boolean;
    changed: boolean;
    text: string;
  }> = [];
  const unresolved: string[] = [];

  beforeAll(async () => {
    await resetDb();
    boot = await bootDomain();
    a = await seedTenant(db, boot, 'AAAAAA');
    b = await seedTenant(db, boot, LEAK);

    for (const route of withParams) {
      const key = `${route.method} ${route.path}`;
      if (key in NOT_A_RESOURCE || key in SKIPPED) continue;
      const path = resolvePath(route.path, b);
      if (!path) {
        unresolved.push(key);
        continue;
      }
      const before = await snapshotTenant(db, b.tenant.consumer.id);
      const session = api(boot.app).as(a.tenant.adminUser);
      const query = route.method === 'GET' ? `?${QUERY_DEFAULTS(a)}` : '';
      const body = bodyFor(route.method, route.path, b);
      const response = await dispatch(
        session,
        route.method,
        route.method === 'GET' ? path + query : path,
        body,
      );
      const text = `${response.text ?? ''}${JSON.stringify(response.body ?? '')}`;
      results.push({
        key,
        status: response.status,
        leaked: text.includes(LEAK),
        changed: (await snapshotTenant(db, b.tenant.consumer.id)) !== before,
        text: text.slice(0, 160),
      });
    }
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });

  it("[BE-TEN-013] a sale number that exists in both shops only ever finds the caller's own sale", async () => {
    expect(a.ids.saleNumber).toBe(b.ids.saleNumber);
    const response = await api(boot.app)
      .as(a.tenant.adminUser)
      .get(`/consumer/sales/search/${b.ids.saleNumber}`);
    expect(response.status).toBe(200);
    expect(response.body.consumer_id).toBe(a.tenant.consumer.id);
    expect(JSON.stringify(response.body)).not.toContain(LEAK);
  });

  it('[BE-TEN-011] every parameterized route has a resolver entry or an explicit reason', () => {
    expect(unresolved).toEqual([]);
    expect(results.length).toBeGreaterThan(70);
  });

  it("[BE-TEN-010] another tenant's id is always refused: 400, 403 or 404", () => {
    expect(
      results
        .filter((r) => ![400, 403, 404].includes(r.status))
        .map((r) => `${r.key} -> ${r.status} ${r.text}`),
    ).toEqual([]);
  });

  it('[BE-TEN-010] ... and never changes or reveals anything of the other tenant', () => {
    expect(results.filter((r) => r.changed).map((r) => r.key)).toEqual([]);
    expect(results.filter((r) => r.leaked).map((r) => r.key)).toEqual([]);
  });
});
