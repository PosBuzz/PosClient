import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TaxMethod } from '@prisma/client';
import { createTestApp } from '../../helpers/app';
import { getPrisma, resetDb, disconnect } from '../../helpers/db';
import {
  createTenant,
  createStockedVariant,
  createPromotion,
} from '../../factories';
import { SalesService } from '../../../src/consumer/sales/services/sales.service';
import { PaymentMethod } from '../../../src/consumer/sales/dto/create-sale.dto';
import { assertInvariants } from '../../helpers/invariants';

// Replays the payloads the consumer generated (X-TOT-R00/R01) through the real SalesService.create
// and asserts the stored totals equal what the POS showed. Regenerate with
// `UPDATE_CONTRACTS=1 npm test -- sale-totals.contract` in consumer/.
const generated = (name: string): Entry[] =>
  JSON.parse(
    readFileSync(
      resolve(__dirname, '../../../../contracts/generated', name),
      'utf8',
    ),
  );

type Entry = {
  id: string;
  variants: { id: number; price: number; taxPct: number; method: string }[];
  promotions: Record<string, any>[];
  payload: { items: Record<string, any>[]; shipping_cost: number };
  expected: Record<
    'subtotal' | 'tax_amount' | 'discount_amount' | 'total_amount',
    string
  >;
};

describe('consumer-generated sale totals replayed on the backend', () => {
  const db = getPrisma();
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let sales: SalesService;
  let tenant: Awaited<ReturnType<typeof createTenant>>;

  beforeAll(async () => {
    await resetDb();
    ({ app } = await createTestApp());
    sales = app.get(SalesService, { strict: false });
    tenant = await createTenant(db);
  });
  afterAll(async () => {
    await app.close();
    await disconnect();
  });

  async function replay(entry: Entry) {
    const variantIds = new Map<number, number>();
    for (const v of entry.variants) {
      const created = await createStockedVariant(db, tenant, {
        price: v.price,
        taxPercent: v.taxPct,
        taxMethod: v.method as TaxMethod,
        batches: [{ qty: 1000, cost: 1 }],
      });
      variantIds.set(v.id, created.id);
    }
    const promotionIds = new Map<number, number>();
    for (const p of entry.promotions) {
      const created = await createPromotion(db, tenant, {
        variants: (p.variant_ids as number[]).map((id) => variantIds.get(id)!),
        overrides: {
          scope: p.scope,
          discount_type: p.discount_type,
          discount_value: p.discount_value,
          min_quantity: p.min_quantity,
          cap_quantity: p.cap_quantity,
        },
      });
      promotionIds.set(p.id, created.id);
    }
    const total = Number(entry.expected.total_amount);
    const dto: any = {
      branch_id: tenant.branches[0].id,
      shipping_cost: entry.payload.shipping_cost,
      items: entry.payload.items.map((item) => ({
        ...item,
        variant_id: variantIds.get(item.variant_id),
        applied_promotion_id:
          item.applied_promotion_id === undefined
            ? undefined
            : promotionIds.get(item.applied_promotion_id),
      })),
      payments:
        total > 0
          ? [{ payment_method: PaymentMethod.CASH, amount: total }]
          : [],
    };
    const sale: any = await sales.create(
      dto,
      tenant.consumer.id,
      tenant.adminUser.id,
    );
    return db.sale.findUniqueOrThrow({ where: { id: sale.id } });
  }

  const check = async (entry: Entry) => {
    const stored = await replay(entry);
    expect({
      subtotal: stored.subtotal.toFixed(2),
      tax_amount: stored.tax_amount.toFixed(2),
      discount_amount: stored.discount_amount.toFixed(2),
      total_amount: stored.total_amount.toFixed(2),
    }).toEqual(entry.expected);
    if (Number(entry.expected.total_amount) > 0) {
      expect(stored.payment_status).toBe('paid');
    }
  };

  const fixtures = generated('sale-totals-fixtures.json');
  it.each(fixtures.map((e) => [e.id, e] as const))(
    '[%s] backend stores the totals the POS showed',
    (_id, entry) => check(entry),
  );

  it('[X-TOT-R02] all 200 generated carts store the expected totals', async () => {
    const random = generated('sale-totals-random.json');
    expect(random).toHaveLength(200);
    const failures: string[] = [];
    for (const entry of random) {
      try {
        await check(entry);
      } catch (error) {
        failures.push(
          `${entry.id}: ${(error as Error).message.split('\n').slice(0, 12).join(' | ')}`,
        );
      }
    }
    expect(failures).toEqual([]);
  }, 600000);
  it('[X-TOT-R03] the invariant net holds after every golden/random replay', async () => {
    await assertInvariants(db);
  });
});
