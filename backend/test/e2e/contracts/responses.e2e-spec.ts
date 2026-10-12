import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootDomain, Boot } from '../../helpers/domain';
import { getPrisma, resetDb, disconnect } from '../../helpers/db';
import { api } from '../../helpers/http';
import { createAdmin, resetSequence } from '../../factories';
import {
  Scenario,
  at,
  buildBusinessDay,
  iso,
} from '../../integration/reports/scenario';
import { normalize } from './normalize';

const DIR = resolve(__dirname, '../../../../contracts/responses');

/** [contract name, who asks, request] for the canonical business day. */
type Call = {
  name: string;
  as: 'tenant' | 'admin';
  path: (s: Scenario) => string;
  atInstant?: string;
};
const CALLS: Call[] = [
  { name: 'auth-client', as: 'tenant', path: () => '/auth/client' },
  {
    name: 'sales-list',
    as: 'tenant',
    path: () => '/consumer/sales?page=1&limit=10',
  },
  {
    name: 'sale-detail',
    as: 'tenant',
    path: (s) => `/consumer/sales/${s.sales.s2.id}`,
  },
  {
    name: 'sale-by-number',
    as: 'tenant',
    path: (s) => `/consumer/sales/search/${s.sales.s4.sale_number}`,
  },
  {
    name: 'products-for-sale',
    as: 'tenant',
    path: (s) => `/consumer/sales/products?branch_id=${s.main.id}`,
  },
  {
    name: 'dashboard',
    as: 'tenant',
    path: () => '/consumer/dashboard/analytics',
    atInstant: iso('16:00'),
  },
  {
    name: 'eod',
    as: 'tenant',
    path: () => '/consumer/sales/reports/eod?date=2026-03-14',
  },
  { name: 'returns-list', as: 'tenant', path: () => '/consumer/returns' },
  {
    name: 'return-detail',
    as: 'tenant',
    path: (s) => `/consumer/returns/${s.returns.r1.id}`,
  },
  {
    name: 'inventory-summary',
    as: 'tenant',
    path: () => '/consumer/inventory/summary',
  },
  {
    name: 'low-stock',
    as: 'tenant',
    path: () => '/consumer/inventory/low-stock',
  },
  {
    name: 'promotions-active',
    as: 'tenant',
    path: (s) => `/consumer/promotions/active/list?branch_id=${s.second.id}`,
  },
  {
    name: 'customer-points',
    as: 'tenant',
    path: (s) => `/consumer/rewards/customers/${s.c1.id}/points`,
  },
  {
    name: 'partial-payments',
    as: 'tenant',
    path: () => '/consumer/payments/partial-sales',
  },
  {
    name: 'plan-permissions',
    as: 'tenant',
    path: () => '/consumer/users/plan-permissions',
  },
  { name: 'auth-admin', as: 'admin', path: () => '/auth/admin' },
  { name: 'admin-consumers', as: 'admin', path: () => '/admin/consumers' },
  { name: 'admin-plans', as: 'admin', path: () => '/admin/plans' },
];

describe('response contracts for the canonical business day', () => {
  const db = getPrisma();
  let boot: Boot;
  let live: Record<string, unknown>;

  async function collect(): Promise<Record<string, unknown>> {
    await resetDb();
    resetSequence();
    const scenario = await buildBusinessDay(db, boot);
    const admin = await createAdmin(db);
    const out: Record<string, unknown> = {};
    for (const call of CALLS) {
      const session =
        call.as === 'admin'
          ? api(boot.app).asAdmin(admin)
          : api(boot.app).as(scenario.tenant.adminUser);
      const send = () => session.get(call.path(scenario));
      const response = await (call.atInstant
        ? at(call.atInstant, send)
        : send());
      expect({
        call: call.name,
        status: response.status,
        body:
          response.status === 200
            ? undefined
            : JSON.stringify(response.body).slice(0, 300),
      }).toEqual({
        call: call.name,
        status: 200,
        body: undefined,
      });
      out[call.name] = normalize(response.body);
    }
    return out;
  }

  beforeAll(async () => {
    boot = await bootDomain();
    live = await collect();
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });

  it('[BE-CONTRACT-000] the same scenario produces identical bodies on every run (ids are deterministic)', async () => {
    const again = await collect();
    expect(again).toEqual(live);
  });

  it.each(CALLS.map((c) => [c.name] as const))(
    '[BE-CONTRACT] the live response equals its contracts/responses file: %s',
    (name) => {
      const file = resolve(DIR, `${name}.json`);
      if (process.env.UPDATE_CONTRACTS === '1') {
        mkdirSync(DIR, { recursive: true });
        writeFileSync(file, `${JSON.stringify(live[name], null, 2)}\n`);
      }
      expect({ file: `${name}.json`, exists: existsSync(file) }).toEqual({
        file: `${name}.json`,
        exists: true,
      });
      const committed = JSON.parse(readFileSync(file, 'utf8'));
      if (JSON.stringify(committed) !== JSON.stringify(live[name])) {
        throw new Error(
          `Response contract ${name}.json changed. Review, then run UPDATE_CONTRACTS=1 npm run test:e2e and commit contracts/responses/`,
        );
      }
    },
  );

  it('[BE-CONTRACT-SHAPE] money stays a string, ids stay numbers, and no secret is in any contract', () => {
    const text = JSON.stringify(live);
    expect(text).not.toMatch(/"password"|"refresh_token"|\$2[aby]\$/);
    const sale = live['sale-detail'] as {
      total_amount: unknown;
      id: unknown;
      items: Array<{ line_total: unknown }>;
    };
    expect(typeof sale.total_amount).toBe('string');
    expect(typeof sale.id).toBe('number');
    expect(typeof sale.items[0].line_total).toBe('string');
  });
});
