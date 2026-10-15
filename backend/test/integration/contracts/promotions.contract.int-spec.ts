import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTestApp } from '../../helpers/app';
import { getPrisma, resetDb, disconnect } from '../../helpers/db';
import {
  createTenant,
  createBrand,
  createVariant,
  createCustomer,
  createPromotion,
} from '../../factories';
import { PromotionsService } from '../../../src/consumer/promotions/services/promotions.service';

// Shared with consumer/src/utils/__contracts__/promotions.contract.test.ts.
const dir = resolve(__dirname, '../../../../contracts/fixtures');
const reasonCodes: { code: string; pattern: string }[] = JSON.parse(
  readFileSync(resolve(dir, 'promotion-reason-codes.json'), 'utf8'),
);
const reasonCode = (message?: string) =>
  reasonCodes.find((r) => new RegExp(r.pattern).test(message ?? ''))?.code ??
  `UNMAPPED:${message}`;

type Expected = {
  eligible: boolean;
  reason_code?: string;
  discount_amount?: number;
  matched?: string[];
};
type Case = {
  id: string;
  promotion: Record<string, any>;
  branch: string;
  customer: boolean;
  customerSales?: number;
  cart: { variant: string; qty: number; price: number }[];
  expected?: Expected;
  expected_backend?: Expected;
};
type FixtureFile = {
  defaults: {
    now: string;
    variants: Record<string, { brand: string }>;
    promotion: Record<string, any>;
  };
  cases: Case[];
};

const files = readdirSync(resolve(dir, 'promotions')).filter((f) =>
  f.endsWith('.json'),
);
// Only Date is frozen; Prisma needs the real timers.
const ONLY_DATE = [
  'nextTick',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
  'queueMicrotask',
  'hrtime',
  'performance',
] as const;

describe('shared promotion fixtures (backend)', () => {
  const db = getPrisma();
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let service: any;
  let tenant: Awaited<ReturnType<typeof createTenant>>;
  let brands: Record<string, number>;
  let variants: Record<string, number>;
  let branches: Record<string, number>;
  let customerId: number;
  let saleSeq = 0;

  beforeAll(async () => {
    await resetDb();
    ({ app } = await createTestApp());
    service = app.get(PromotionsService, { strict: false });
    tenant = await createTenant(db, { branches: 2 });
    branches = { main: tenant.branches[0].id, other: tenant.branches[1].id };
    brands = {
      B1: (await createBrand(db, { consumer_id: tenant.consumer.id })).id,
      B2: (await createBrand(db, { consumer_id: tenant.consumer.id })).id,
    };
    variants = {};
    const brandOf: Record<string, string> = { P1: 'B1', P2: 'B1', P3: 'B2' };
    for (const key of ['P1', 'P2', 'P3']) {
      variants[key] = (
        await createVariant(db, tenant, {}, { brand_id: brands[brandOf[key]] })
      ).id;
    }
    customerId = (await createCustomer(db, { consumer_id: tenant.consumer.id }))
      .id;
  });
  afterAll(async () => {
    await app.close();
    await disconnect();
  });
  afterEach(() => jest.useRealTimers());

  async function priorSale(
    promotionId: number,
    discount: number,
    forCustomer?: number,
  ) {
    saleSeq += 1;
    await db.sale.create({
      data: {
        sale_number: `CONTRACT-${saleSeq}`,
        consumer_id: tenant.consumer.id,
        branch_id: branches.main,
        customer_id: forCustomer,
        promotion_id: promotionId,
        promotion_discount: discount,
        subtotal: 100,
        total_amount: 100,
      },
    });
  }

  describe.each(files)('%s', (file) => {
    const fixture: FixtureFile = JSON.parse(
      readFileSync(resolve(dir, 'promotions', file), 'utf8'),
    );
    it.each(fixture.cases.map((c) => [c.id, c] as const))(
      '[%s] backend evaluation matches the contract',
      async (_id, c) => {
        const p = { ...fixture.defaults.promotion, ...c.promotion };
        const promo = await createPromotion(db, tenant, {
          variants: (p.products as string[]).map((k) => variants[k]),
          branches: (p.branches as string[]).map((b) => branches[b]),
          overrides: {
            scope: p.scope,
            discount_type: p.discount_type,
            discount_value: p.discount_value,
            is_active: p.is_active,
            start_date: new Date(p.start_date),
            end_date: p.end_date ? new Date(p.end_date) : null,
            branch_specific: p.branch_specific,
            brand_id: p.brand ? brands[p.brand] : null,
            min_purchase: p.min_purchase,
            min_quantity: p.min_quantity,
            cap_quantity: p.cap_quantity,
            cap_discount_amount: p.cap_discount_amount,
            max_discount_amount: p.max_discount_amount,
            usage_limit: p.usage_limit,
            member_only: p.member_only,
            limit_per_customer: p.limit_per_customer,
            customer_usage_limit: p.customer_usage_limit,
          },
        });
        // The consumer reads stored counters; the server derives them from sales.
        for (let i = 0; i < p.sales_count; i++) {
          await priorSale(promo.id, i === 0 ? p.total_discount_given : 0);
        }
        if (!p.sales_count && p.total_discount_given) {
          await priorSale(promo.id, p.total_discount_given);
        }
        for (let i = 0; i < (c.customerSales ?? 0); i++) {
          await priorSale(promo.id, 0, customerId);
        }

        jest.useFakeTimers({
          now: new Date(fixture.defaults.now),
          doNotFake: [...ONLY_DATE],
        });
        // The POS sends unit_price × quantity as the base (see sales.service#assertItemPromotionDiscounts).
        const result = await service.evaluatePromotionForCart(
          promo.id,
          tenant.consumer.id,
          {
            branch_id: branches[c.branch],
            customer_id: c.customer ? customerId : undefined,
            items: c.cart.map((l) => ({
              variant_id: variants[l.variant],
              quantity: l.qty,
              unit_price: l.price,
              line_total: l.price * l.qty,
            })),
          },
        );
        jest.useRealTimers();

        const expected = c.expected_backend ?? c.expected!;
        expect(result.is_eligible).toBe(expected.eligible);
        if (expected.eligible) {
          expect(result.discount_amount).toBe(expected.discount_amount);
          const keyOf = (id: number) =>
            Object.keys(variants).find((k) => variants[k] === id);
          expect(
            (result.matched_variant_ids as number[]).map(keyOf).sort(),
          ).toEqual([...expected.matched!].sort());
        } else {
          expect(reasonCode(result.reason)).toBe(expected.reason_code);
        }

        await db.sale.deleteMany({ where: { promotion_id: promo.id } });
        await db.promotion.delete({ where: { id: promo.id } });
      },
    );
  });
});
