import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootDomain, Boot, saleDto } from '../../helpers/domain';
import { getPrisma, resetDb, disconnect } from '../../helpers/db';
import { api, dispatch } from '../../helpers/http';
import { assertInvariants } from '../../helpers/invariants';
import { createAdmin, resetSequence } from '../../factories';
import { buildBusinessDay, at, iso } from '../../integration/reports/scenario';
import { SalesService } from '../../../src/consumer/sales/services/sales.service';

const DIR = resolve(__dirname, '../../../../contracts/requests');
const CASES = [
  'pos-cash-sale',
  'pos-discounts-sale',
  'pos-split-payment',
  'pos-promotion-sale',
  'quotation',
  'return-cash',
  'return-exchange',
  'make-payment',
  'inventory-batch-create',
  'inventory-transfer-create',
  'admin-plan-create',
  'admin-plan-update',
  'admin-consumer-create',
  'admin-role-create',
  'admin-user-create',
  'admin-billing-create',
];
type Contract = {
  method: string;
  path: string;
  auth: 'client' | 'admin';
  body: any;
  expect?: Record<string, string>;
};

describe('recorded browser requests replayed over HTTP', () => {
  const db = getPrisma();
  let boot: Boot;
  beforeAll(async () => {
    boot = await bootDomain();
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });

  it('[X-REQ-000] every request recording has an explicit replay case', () => {
    expect(
      readdirSync(DIR)
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.slice(0, -5))
        .sort(),
    ).toEqual([...CASES].sort());
  });

  for (const name of CASES) {
    it(`[X-REQ-${name}] accepts the unchanged recorded request and preserves invariants`, async () => {
      await resetDb();
      resetSequence();
      const scenario = await buildBusinessDay(db, boot);
      const admin = await createAdmin(db);
      const contract: Contract = JSON.parse(
        readFileSync(resolve(DIR, `${name}.json`), 'utf8'),
      );
      // These operational endpoints must never execute in backend sweeps.
      expect(contract.path).not.toMatch(/^\/admin\/(backup|restore)(?:\/|$)/);
      if (name === 'return-exchange') {
        const dto = saleDto(
          scenario.tenant,
          [{ variant: scenario.p3.variant, qty: 1 }],
          {
            branch_id: scenario.main.id,
            served_by_id: scenario.tenant.adminUser.id,
            items: [
              {
                variant_id: scenario.p3.variant.id,
                quantity: 1,
                unit_price: 40,
                sold_unit_price: 36,
                special_discount_amount: 4,
                tax_amount: 0,
                line_total: 36,
              },
            ],
          },
          0,
        );
        const replacement: any = await at(iso('17:00'), () =>
          boot
            .get(SalesService)
            .create(
              dto,
              scenario.tenant.consumer.id,
              scenario.tenant.adminUser.id,
            ),
        );
        await db.sale.update({
          where: { id: replacement.id },
          data: {
            id: contract.body.exchange_sale_id,
            sale_number: 'SAL-EXCHANGE-0099',
          },
        });
      }
      const session =
        contract.auth === 'admin'
          ? api(boot.app).asAdmin(admin)
          : api(boot.app).as(scenario.tenant.adminUser);
      const response = await at(iso('17:01'), () =>
        dispatch(session, contract.method, contract.path, contract.body),
      );
      expect({
        name,
        status: response.status,
        error: response.status >= 300 ? response.body : undefined,
      }).toEqual({ name, status: expect.any(Number), error: undefined });
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
      if (contract.expect) {
        const sale = await db.sale.findUniqueOrThrow({
          where: { id: response.body.id },
        });
        for (const [field, value] of Object.entries(contract.expect)) {
          expect(Number(sale[field as keyof typeof sale]).toFixed(2)).toBe(
            value,
          );
        }
      }
      await assertInvariants(db);
    });
  }
});
