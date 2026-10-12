import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld, saleDto } from '../helpers/domain';
import {
  createBrand,
  createPromotion,
  createStockedVariant,
} from '../factories';
import { PromotionsService } from '../../src/consumer/promotions/services/promotions.service';
import { SalesService } from '../../src/consumer/sales/services/sales.service';

describe('promotions management', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let promotions: PromotionsService;
  let sales: SalesService;

  beforeAll(async () => {
    boot = await bootDomain();
    promotions = boot.get(PromotionsService);
    sales = boot.get(SalesService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot, { branches: 2 });
  });
  afterEach(() => w.check());

  const cid = () => w.tenant.consumer.id;
  const uid = () => w.tenant.adminUser.id;
  const failure = async (promise: Promise<unknown> | (() => unknown)) =>
    Promise.resolve()
      .then(() => (typeof promise === 'function' ? promise() : promise))
      .then(
        () => null,
        (e: any) => e,
      );
  const stocked = () =>
    w.stock({ price: 100, batches: [{ qty: 50, cost: 10 }] });
  const base = (variantIds: number[], extra: object = {}) =>
    ({
      name: 'Offer',
      scope: 'SINGLE_PRODUCT',
      discount_type: 'percentage',
      discount_value: 10,
      start_date: '2026-01-01T00:00:00.000Z',
      end_date: '2040-01-01T00:00:00.000Z',
      variant_ids: variantIds,
      ...extra,
    }) as any;
  const create = (dto: any) =>
    promotions.create(dto, cid(), uid()) as Promise<any>;

  it('[BE-PRM-001] a promotion is stored with its products, branches and brand', async () => {
    const a = await stocked();
    const b = await stocked();
    const bundle = await create(
      base([a.id, b.id], {
        scope: 'BUNDLE',
        branch_specific: true,
        branch_ids: [w.tenant.branches[1].id],
        min_purchase: 150,
        usage_limit: 5,
      }),
    );
    expect(bundle).toMatchObject({
      scope: 'BUNDLE',
      branch_specific: true,
      min_purchase: 150,
      usage_limit: 5,
      sales_count: 0,
    });
    expect(bundle.variant_ids.sort()).toEqual([a.id, b.id].sort());
    expect(bundle.branch_ids).toEqual([w.tenant.branches[1].id]);
    const brand = await createBrand(db, { consumer_id: cid() });
    const byBrand = await create(
      base([], { scope: 'BRAND', brand_id: brand.id }),
    );
    expect(byBrand.brand_id).toBe(brand.id);
    expect(byBrand.variant_ids).toEqual([]);
  });

  describe('rule validation', () => {
    const rejected: Array<[string, (v: number[]) => object, RegExp]> = [
      [
        'bad start date',
        () => ({ start_date: 'nonsense' }),
        /Invalid start_date/,
      ],
      ['bad end date', () => ({ end_date: 'nonsense' }), /Invalid end_date/],
      [
        'end before start',
        () => ({ end_date: '2025-01-01T00:00:00.000Z' }),
        /end_date must be after start_date/,
      ],
      [
        'cap quantity below minimum',
        () => ({ min_quantity: 5, cap_quantity: 2 }),
        /cap_quantity must be greater than or equal/,
      ],
      [
        'discount cap above max discount',
        () => ({ max_discount_amount: 50, cap_discount_amount: 80 }),
        /cap_discount_amount cannot be greater/,
      ],
      [
        'per-customer limit without a number',
        () => ({ limit_per_customer: true }),
        /customer_usage_limit is required/,
      ],
      [
        'daily reset without per-customer limit',
        () => ({ customer_usage_daily_reset: true }),
        /requires limit_per_customer/,
      ],
      [
        'branch-specific without branches',
        () => ({ branch_specific: true }),
        /branch_ids is required/,
      ],
      [
        'brand scope without a brand',
        () => ({ scope: 'BRAND' }),
        /brand_id is required/,
      ],
      [
        'brand scope with variants',
        (v) => ({ scope: 'BRAND', brand_id: 1, variant_ids: v }),
        /variant_ids should not be provided/,
      ],
      [
        'product scope without variants',
        () => ({ variant_ids: [] }),
        /variant_ids is required/,
      ],
      [
        'single product with two variants',
        (v) => ({ variant_ids: v }),
        /exactly one variant_id/,
      ],
    ];
    it.each(rejected)(
      '[BE-PRM-002] %s is refused',
      async (_name, extra, message) => {
        const a = await stocked();
        const b = await stocked();
        const error = await failure(
          create(base([a.id, b.id], extra([a.id, b.id]))),
        );
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toMatch(message);
        expect(
          await db.promotion.count({ where: { consumer_id: cid() } }),
        ).toBe(0);
      },
    );

    it('[BE-PRM-003] branches, variants and brands of another tenant are refused', async () => {
      const mine = await stocked();
      const foreignBrand = await createBrand(db, {
        consumer_id: w.bystander.consumer.id,
      });
      const foreignVariant = await createStockedVariant(db, w.bystander, {
        price: 5,
        batches: [{ qty: 1, cost: 1 }],
      });
      await w.rebaseBystander();
      expect(
        (
          await failure(
            create(
              base([mine.id], {
                branch_specific: true,
                branch_ids: [w.bystander.branches[0].id],
              }),
            ),
          )
        ).message,
      ).toMatch(/branches are invalid/);
      expect(
        (await failure(create(base([foreignVariant.id])))).message,
      ).toMatch(/variants are invalid/);
      expect(
        (
          await failure(
            create(base([], { scope: 'BRAND', brand_id: foreignBrand.id })),
          )
        ).message,
      ).toMatch(/brand is invalid/);
    });
  });

  it("[BE-PRM-004] another tenant's promotion is NotFound for every call", async () => {
    const theirs = await createPromotion(db, w.bystander, {
      variants: [w.theirs.id],
    });
    await w.rebaseBystander();
    for (const call of [
      () => promotions.findOne(theirs.id, cid()),
      () => promotions.update(theirs.id, { name: 'x' }, cid()),
      () => promotions.remove(theirs.id, cid()),
      () => promotions.getPromotionSales(theirs.id, {}, cid()),
    ]) {
      expect(await failure(call)).toBeInstanceOf(NotFoundException);
    }
    expect((await promotions.findAll(cid())).length).toBe(0);
  });

  it('[BE-PRM-005] update merges with the stored promotion, rewrites relations and re-validates the result', async () => {
    const a = await stocked();
    const b = await stocked();
    const promo = await create(base([a.id], { min_purchase: 100 }));
    const updated = await promotions.update(
      promo.id,
      { variant_ids: [b.id], discount_value: 25 },
      cid(),
    );
    expect(updated).toMatchObject({ discount_value: 25, min_purchase: 100 });
    expect(updated.variant_ids).toEqual([b.id]);
    const invalid = await failure(
      promotions.update(promo.id, { scope: 'BRAND' } as any, cid()),
    );
    expect(invalid).toBeInstanceOf(BadRequestException);
    expect((await promotions.findOne(promo.id, cid())).scope).toBe(
      'SINGLE_PRODUCT',
    );
    const cleared = await promotions.update(
      promo.id,
      { min_purchase: null } as any,
      cid(),
    );
    expect(cleared.min_purchase).toBeNull();
  });

  it('[BE-PRM-006] removing a promotion keeps the sales that used it', async () => {
    const v = await stocked();
    const promo = await create(base([v.id]));
    const dto = saleDto(
      w.tenant,
      [{ variant: v, qty: 2, promotionDiscount: 20 }],
      { applied_promotion_id: promo.id },
    );
    dto.items[0].applied_promotion_id = promo.id;
    const sale: any = await sales.create(dto, cid(), uid());
    await promotions.remove(promo.id, cid());
    const kept = await db.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(kept.promotion_id).toBeNull();
    expect(Number(kept.discount_amount)).toBe(20);
  });

  it('[BE-PRM-007] options list only my branches, brands and variants', async () => {
    await stocked();
    await createBrand(db, { consumer_id: cid(), name: 'Mine' });
    await createBrand(db, {
      consumer_id: w.bystander.consumer.id,
      name: 'Theirs',
    });
    await w.rebaseBystander();
    const options: any = await promotions.getOptions(cid());
    expect(options.branches).toHaveLength(2);
    expect(options.brands.map((b: any) => b.name)).toEqual(['Mine']);
    expect(options.variants).toHaveLength(1);
  });

  describe('active promotions', () => {
    it('[BE-PRM-008] only live promotions for the branch are returned; exhausted ones are closed', async () => {
      const v = await stocked();
      const live = await create(base([v.id], { name: 'Live' }));
      await create(base([v.id], { name: 'Inactive', is_active: false }));
      await create(
        base([v.id], { name: 'Expired', end_date: '2026-01-02T00:00:00.000Z' }),
      );
      await create(
        base([v.id], {
          name: 'Future',
          start_date: '2099-01-01T00:00:00.000Z',
          end_date: undefined,
        }),
      );
      await create(
        base([v.id], {
          name: 'Other branch',
          branch_specific: true,
          branch_ids: [w.tenant.branches[1].id],
        }),
      );
      const used = await create(
        base([v.id], { name: 'Used up', usage_limit: 1 }),
      );
      const dto = saleDto(
        w.tenant,
        [{ variant: v, qty: 1, promotionDiscount: 10 }],
        { applied_promotion_id: used.id },
      );
      dto.items[0].applied_promotion_id = used.id;
      await db.promotion.update({
        where: { id: used.id },
        data: { is_active: true },
      });
      await sales.create(dto, cid(), uid());
      await db.promotion.update({
        where: { id: used.id },
        data: { is_active: true },
      });
      const active = await promotions.findActive(
        cid(),
        w.tenant.branches[0].id,
      );
      expect(active.map((p: any) => p.name)).toEqual(['Live']);
      expect(
        (await db.promotion.findUniqueOrThrow({ where: { id: used.id } }))
          .is_active,
      ).toBe(false);
      const second = await promotions.findActive(
        cid(),
        w.tenant.branches[1].id,
      );
      expect(second.map((p: any) => p.name).sort()).toEqual([
        'Live',
        'Other branch',
      ]);
      expect(live.id).toBeGreaterThan(0);
    });

    it('[BE-PRM-009] a promotion is closed once its discount budget is spent', async () => {
      const v = await stocked();
      const promo = await create(base([v.id], { max_discount_amount: 20 }));
      const dto = saleDto(
        w.tenant,
        [{ variant: v, qty: 2, promotionDiscount: 20 }],
        { applied_promotion_id: promo.id },
      );
      dto.items[0].applied_promotion_id = promo.id;
      await sales.create(dto, cid(), uid());
      expect(
        (await db.promotion.findUniqueOrThrow({ where: { id: promo.id } }))
          .is_active,
      ).toBe(false);
      await promotions.closePromotionIfExhausted(999999, cid());
    });
  });

  it("[BE-PRM-010] usage figures count live sales only, as the server's own usage check does", async () => {
    const v = await stocked();
    const promo = await create(base([v.id]));
    const use = async (qty: number, extra: object = {}) => {
      const dto = saleDto(
        w.tenant,
        [{ variant: v, qty, promotionDiscount: 10 * qty }],
        { applied_promotion_id: promo.id, ...extra },
      );
      dto.items[0].applied_promotion_id = promo.id;
      return sales.create(dto, cid(), uid()) as Promise<any>;
    };
    await use(1);
    const deleted = await use(2);
    await sales.softDelete(deleted.id, cid(), uid(), {});
    // A quotation carrying the promotion is not a use either
    const dto = saleDto(
      w.tenant,
      [{ variant: v, qty: 3, promotionDiscount: 30 }],
      { applied_promotion_id: promo.id, sale_type: 'quotation' as any },
      null,
    );
    dto.items[0].applied_promotion_id = promo.id;
    await sales.create(dto, cid(), uid());
    const figures = await promotions.findOne(promo.id, cid());
    expect(figures.sales_count).toBe(1);
    expect(figures.total_discount_given).toBe(10);
    const listed = (await promotions.findAll(cid())).find(
      (p: any) => p.id === promo.id,
    );
    expect(listed?.sales_count).toBe(1);
  });

  it("[BE-PRM-011] the promotion sales report lists only this promotion's sales in my tenant", async () => {
    const v = await stocked();
    const promo = await create(base([v.id]));
    const dto = saleDto(
      w.tenant,
      [{ variant: v, qty: 2, promotionDiscount: 20 }],
      { applied_promotion_id: promo.id },
    );
    dto.items[0].applied_promotion_id = promo.id;
    await sales.create(dto, cid(), uid());
    await w.sell([{ variant: v, qty: 1 }]);
    const report: any = await promotions.getPromotionSales(promo.id, {}, cid());
    expect(report.meta.total).toBe(1);
    expect(report.summary.total_sales_amount).toBe(180);
  });
});
