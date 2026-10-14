import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PromotionsService } from './promotions.service';

const NOW = new Date('2026-05-05T10:00:00.000Z');

function setup() {
  const mk = (...names: string[]) =>
    Object.fromEntries(names.map((n) => [n, jest.fn()]));
  const prisma: any = {
    promotion: mk('findFirst', 'findMany', 'update', 'updateMany'),
    productVariant: mk('findMany'),
    sale: mk('aggregate', 'count', 'findMany', 'groupBy'),
  };
  prisma.sale.aggregate.mockResolvedValue({ _sum: { promotion_discount: 0 } });
  prisma.sale.count.mockResolvedValue(0);
  prisma.sale.groupBy.mockResolvedValue([]);
  return { prisma, service: new PromotionsService(prisma) };
}

const promo = (extra: object = {}): any => ({
  id: 1,
  consumer_id: 5,
  is_active: true,
  scope: 'SINGLE_PRODUCT',
  discount_type: 'percentage',
  discount_value: '10',
  start_date: new Date('2026-05-01T00:00:00Z'),
  end_date: null,
  min_purchase: null,
  min_quantity: 1,
  usage_limit: null,
  cap_quantity: null,
  max_discount_amount: null,
  cap_discount_amount: null,
  member_only: false,
  limit_per_customer: false,
  customer_usage_limit: null,
  customer_usage_daily_reset: false,
  branch_specific: false,
  brand_id: null,
  products: [{ variant_id: 7 }],
  branches: [],
  ...extra,
});

const item = (
  variant_id: number,
  quantity: number,
  unit_price: number,
  line_total = quantity * unit_price,
) => ({
  variant_id,
  quantity,
  unit_price,
  line_total,
});

async function run(
  promotion: any,
  items = [item(7, 2, 100)],
  opts: { branch?: number; customer?: number; prisma?: any } = {},
) {
  jest.useFakeTimers().setSystemTime(NOW);
  const ctx = setup();
  ctx.prisma.promotion.findFirst.mockResolvedValue(promotion);
  if (opts.prisma) opts.prisma(ctx.prisma);
  const result = await ctx.service
    .assertAndCalculateDiscount(1, 5, opts.branch ?? 2, opts.customer, items)
    .catch((e: unknown) => e);
  return { ...ctx, result: result as any };
}

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('PromotionsService cart evaluation: eligibility gates (unit)', () => {
  it('[BE-MUT-690] the promotion is looked up for this shop with its links; a miss is a 404', async () => {
    const { prisma, result } = await run(null);
    expect(result).toBeInstanceOf(NotFoundException);
    expect(result.message).toBe('Promotion not found');
    expect(prisma.promotion.findFirst).toHaveBeenCalledWith({
      where: { id: 1, consumer_id: 5 },
      include: { products: true, branches: true },
    });
  });

  it('[BE-MUT-691] inactive, not yet started and expired promotions explain why; the boundaries are inclusive', async () => {
    expect((await run(promo({ is_active: false }))).result.message).toBe(
      'Promotion is inactive',
    );
    expect(
      (await run(promo({ start_date: new Date(NOW.getTime() + 1) }))).result
        .message,
    ).toBe('Promotion has not started yet');
    expect(
      (await run(promo({ end_date: new Date(NOW.getTime() - 1) }))).result
        .message,
    ).toBe('Promotion has already expired');
    expect((await run(promo({ start_date: NOW }))).result.is_eligible).toBe(
      true,
    );
    expect((await run(promo({ end_date: NOW }))).result.is_eligible).toBe(true);
  });

  it('[BE-MUT-692] a branch-specific promotion is limited to its branches', async () => {
    const ctx = await run(
      promo({ branch_specific: true, branches: [{ branch_id: 3 }] }),
      undefined,
      { branch: 2 },
    );
    expect(ctx.result.message).toBe(
      'Promotion is not available for selected branch',
    );
    expect(
      (
        await run(
          promo({ branch_specific: true, branches: [{ branch_id: 3 }] }),
          undefined,
          { branch: 3 },
        )
      ).result.is_eligible,
    ).toBe(true);
    expect(
      (
        await run(promo({ branches: [{ branch_id: 3 }] }), undefined, {
          branch: 2,
        })
      ).result.is_eligible,
    ).toBe(true);
  });

  it('[BE-MUT-693] usage is counted from live sales of this promotion only', async () => {
    const { prisma } = await run(promo({ usage_limit: 5 }));
    const where = {
      consumer_id: 5,
      promotion_id: 1,
      sale_type: 'sale',
      payment_status: { not: 'cancelled' },
      deleted_at: null,
    };
    expect(prisma.sale.aggregate).toHaveBeenCalledWith({
      where,
      _sum: { promotion_discount: true },
    });
    expect(prisma.sale.count).toHaveBeenCalledWith({ where });
  });

  it('[BE-MUT-694] reaching the usage limit closes the promotion and says so; one use short of the limit still applies', async () => {
    const used = (count: number) => (prisma: any) =>
      prisma.sale.count.mockResolvedValue(count);
    const reached = await run(promo({ usage_limit: 3 }), undefined, {
      prisma: used(3),
    });
    expect(reached.result.message).toBe(
      'Promotion usage limit reached and promo closed',
    );
    expect(reached.prisma.promotion.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { is_active: false },
    });
    expect(
      (await run(promo({ usage_limit: 3 }), undefined, { prisma: used(2) }))
        .result.is_eligible,
    ).toBe(true);
    expect(
      (await run(promo({ usage_limit: 3 }), undefined, { prisma: used(4) }))
        .result.message,
    ).toContain('usage limit');
  });

  it('[BE-MUT-695] reaching the total discount limit closes the promotion; the remaining room caps later discounts', async () => {
    const spent = (amount: number) => (prisma: any) =>
      prisma.sale.aggregate.mockResolvedValue({
        _sum: { promotion_discount: amount },
      });
    const reached = await run(promo({ max_discount_amount: '50' }), undefined, {
      prisma: spent(50),
    });
    expect(reached.result.message).toBe(
      'Promotion max discount reached and promo closed',
    );
    expect(reached.prisma.promotion.update).toHaveBeenCalledTimes(1);
    const capped = await run(promo({ max_discount_amount: '50' }), undefined, {
      prisma: spent(40),
    });
    expect(capped.result).toMatchObject({
      is_eligible: true,
      discount_amount: 10,
    });
    const roomy = await run(promo({ max_discount_amount: '50' }), undefined, {
      prisma: spent(0),
    });
    expect(roomy.result.discount_amount).toBe(20);
    expect(
      (
        await run(promo({ max_discount_amount: '50' }), undefined, {
          prisma: spent(49.99),
        })
      ).result.discount_amount,
    ).toBe(0.01);
  });

  it('[BE-MUT-696] member-only and per-customer promotions need a registered customer', async () => {
    expect((await run(promo({ member_only: true }))).result.message).toBe(
      'This promotion is for registered customers only',
    );
    expect(
      (await run(promo({ member_only: true }), undefined, { customer: 9 }))
        .result.is_eligible,
    ).toBe(true);
    expect(
      (await run(promo({ limit_per_customer: true, customer_usage_limit: 1 })))
        .result.message,
    ).toBe('Select a registered customer to apply this promotion');
  });

  it('[BE-MUT-697] a customer who used the promotion up to their limit is refused, with the daily wording when it resets daily', async () => {
    const usage = (count: number) => (prisma: any) =>
      prisma.sale.count.mockResolvedValue(count);
    const base = { limit_per_customer: true, customer_usage_limit: 2 };
    const total = await run(promo(base), undefined, {
      customer: 9,
      prisma: usage(2),
    });
    expect(total.result.message).toBe(
      'Customer usage limit reached for this promotion',
    );
    expect(total.prisma.sale.count).toHaveBeenCalledWith({
      where: {
        consumer_id: 5,
        promotion_id: 1,
        customer_id: 9,
        sale_type: 'sale',
        payment_status: { not: 'cancelled' },
        deleted_at: null,
      },
    });
    const daily = await run(
      promo({ ...base, customer_usage_daily_reset: true }),
      undefined,
      {
        customer: 9,
        prisma: usage(2),
      },
    );
    expect(daily.result.message).toBe(
      'Customer daily usage limit reached for this promotion',
    );
    const where = daily.prisma.sale.count.mock.calls.at(-1)[0].where;
    const start = new Date(NOW);
    start.setHours(0, 0, 0, 0);
    const end = new Date(NOW);
    end.setHours(23, 59, 59, 999);
    expect(where.sale_date).toEqual({ gte: start, lte: end });
    expect(
      (await run(promo(base), undefined, { customer: 9, prisma: usage(1) }))
        .result.is_eligible,
    ).toBe(true);
    const noLimit = await run(
      promo({ limit_per_customer: true, customer_usage_limit: 0 }),
      undefined,
      { customer: 9, prisma: usage(99) },
    );
    expect(noLimit.result.is_eligible).toBe(true);
  });

  it('[BE-MUT-698] the minimum purchase is measured on the whole cart, merging lines of the same variant and falling back to unit price x quantity', async () => {
    const gated = promo({ min_purchase: '300' });
    expect(
      (await run(gated, [item(7, 2, 100), item(8, 1, 99.99)])).result.message,
    ).toBe('Minimum purchase amount condition not met');
    expect(
      (await run(gated, [item(7, 2, 100), item(8, 1, 100)])).result.is_eligible,
    ).toBe(true);
    expect(
      (await run(gated, [item(7, 1, 100), item(7, 1, 100), item(8, 1, 100)]))
        .result.discount_amount,
    ).toBe(20);
    const fallback = await run(promo({ min_purchase: '200' }), [
      item(7, 2, 100, 0),
    ]);
    expect(fallback.result).toMatchObject({
      is_eligible: true,
      discount_base: 200,
    });
  });
});

describe('PromotionsService cart evaluation: discounts by scope (unit)', () => {
  it('[BE-MUT-699] a single-product promotion needs its product and minimum quantity, then discounts that line', async () => {
    expect((await run(promo(), [item(8, 1, 10)])).result.message).toBe(
      'Required product is not present in cart',
    );
    expect(
      (await run(promo({ min_quantity: 3 }), [item(7, 2, 100)])).result.message,
    ).toBe('Minimum quantity 3 not met');
    expect(
      (await run(promo({ min_quantity: 2 }), [item(7, 2, 100)])).result,
    ).toEqual({
      is_eligible: true,
      discount_amount: 20,
      discount_base: 200,
      matched_variant_ids: [7],
    });
    expect(
      (await run(promo({ min_quantity: 0 }), [item(7, 1, 100)])).result
        .is_eligible,
    ).toBe(true);
    expect((await run(promo({ products: [] }))).result.message).toBe(
      'Promotion has no products configured',
    );
  });

  it('[BE-MUT-700] quantity cap limits the discounted base to the dearest units; fixed amounts apply per eligible unit; the discount cap applies', async () => {
    const capped = await run(promo({ cap_quantity: 1 }), [item(7, 3, 100)]);
    expect(capped.result).toMatchObject({
      discount_amount: 10,
      discount_base: 100,
    });
    const fixed = await run(
      promo({ discount_type: 'fixed_amount', discount_value: '15' }),
      [item(7, 3, 100)],
    );
    expect(fixed.result.discount_amount).toBe(45);
    const fixedCapQty = await run(
      promo({
        discount_type: 'fixed_amount',
        discount_value: '15',
        cap_quantity: 2,
      }),
      [item(7, 3, 100)],
    );
    expect(fixedCapQty.result).toMatchObject({
      discount_amount: 30,
      discount_base: 200,
    });
    const capDiscount = await run(promo({ cap_discount_amount: '12.345' }), [
      item(7, 3, 100),
    ]);
    expect(capDiscount.result.discount_amount).toBe(12.35);
    expect(
      (await run(promo({ discount_value: '33.333' }), [item(7, 1, 10)])).result,
    ).toMatchObject({ discount_amount: 3.33, discount_base: 10 });
  });

  it('[BE-MUT-701] a promotion whose discount works out to nothing is reported as closed', async () => {
    const zero = await run(promo({ discount_value: '0' }));
    expect(zero.result.message).toBe(
      'Promotion max discount reached and promo closed',
    );
    expect(zero.result).toBeInstanceOf(BadRequestException);
  });

  it('[BE-MUT-702] a bundle needs every product, the total minimum quantity, and discounts the matched lines together', async () => {
    const bundle = promo({
      scope: 'BUNDLE',
      products: [{ variant_id: 7 }, { variant_id: 8 }],
      min_quantity: 3,
    });
    expect((await run(bundle, [item(7, 5, 10)])).result.message).toBe(
      'Bundle conditions are not matched in cart',
    );
    expect(
      (await run(bundle, [item(7, 1, 10), item(8, 1, 10)])).result.message,
    ).toBe('Minimum quantity 3 not met');
    expect(
      (await run(bundle, [item(7, 2, 10), item(8, 1, 30), item(9, 4, 1000)]))
        .result,
    ).toEqual({
      is_eligible: true,
      discount_amount: 5,
      discount_base: 50,
      matched_variant_ids: [7, 8],
    });
    const noProducts = promo({ scope: 'BUNDLE', products: [] });
    expect((await run(noProducts)).result.message).toBe(
      'Promotion has no products configured',
    );
    const limited = promo({
      scope: 'BUNDLE',
      products: [{ variant_id: 7 }, { variant_id: 8 }],
      cap_quantity: 2,
      max_discount_amount: '1',
    });
    expect(
      (await run(limited, [item(7, 2, 10), item(8, 2, 30)])).result
        .discount_amount,
    ).toBe(1);
    const exhausted = promo({
      scope: 'BUNDLE',
      products: [{ variant_id: 7 }],
      discount_value: '0',
    });
    expect((await run(exhausted, [item(7, 2, 10)])).result.message).toContain(
      'max discount reached',
    );
  });

  it('[BE-MUT-703] a brand promotion matches cart variants of its brand in this shop', async () => {
    const brand = promo({
      scope: 'BRAND',
      brand_id: 3,
      products: [],
      min_quantity: 2,
    });
    const variants = (rows: any[]) => (prisma: any) =>
      prisma.productVariant.findMany.mockResolvedValue(rows);
    expect(
      (await run(promo({ scope: 'BRAND', brand_id: null, products: [] })))
        .result.message,
    ).toBe('Promotion brand is not configured correctly');
    const none = await run(brand, [item(7, 2, 10)], {
      prisma: variants([{ id: 7, product: { brand_id: 9 } }]),
    });
    expect(none.result.message).toBe(
      'No matching brand products found in cart',
    );
    expect(none.prisma.productVariant.findMany).toHaveBeenCalledWith({
      where: { id: { in: [7] }, product: { consumer_id: 5 } },
      select: { id: true, product: { select: { brand_id: true } } },
    });
    const few = await run(brand, [item(7, 1, 10)], {
      prisma: variants([{ id: 7, product: { brand_id: 3 } }]),
    });
    expect(few.result.message).toBe('Minimum quantity 2 not met');
    const ok = await run(
      brand,
      [item(7, 1, 10), item(8, 1, 30), item(9, 5, 1000)],
      {
        prisma: variants([
          { id: 7, product: { brand_id: 3 } },
          { id: 8, product: { brand_id: 3 } },
          { id: 9, product: { brand_id: 4 } },
        ]),
      },
    );
    expect(ok.result).toEqual({
      is_eligible: true,
      discount_amount: 4,
      discount_base: 40,
      matched_variant_ids: [7, 8],
    });
    const closed = await run(
      promo({ scope: 'BRAND', brand_id: 3, products: [], discount_value: '0' }),
      [item(7, 2, 10)],
      { prisma: variants([{ id: 7, product: { brand_id: 3 } }]) },
    );
    expect(closed.result.message).toContain('max discount reached');
    const capped = await run(
      promo({
        scope: 'BRAND',
        brand_id: 3,
        products: [],
        cap_quantity: 1,
        max_discount_amount: '3',
      }),
      [item(7, 2, 10)],
      { prisma: variants([{ id: 7, product: { brand_id: 3 } }]) },
    );
    expect(capped.result).toMatchObject({
      discount_amount: 1,
      discount_base: 10,
    });
  });

  it('[BE-MUT-704] unexpected failures become a pinned 500', async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    const { prisma, service } = setup();
    prisma.promotion.findFirst.mockRejectedValue(new Error('db'));
    await expect(
      service.assertAndCalculateDiscount(1, 5, 2, undefined, []),
    ).rejects.toThrow('Failed to assert and calculate discount');
  });
});

describe('PromotionsService active promotions and sales (unit)', () => {
  const row = (extra: object = {}): any => ({
    id: 1,
    name: 'P',
    discount_value: 5,
    branches: [],
    products: [],
    usage_limit: null,
    max_discount_amount: null,
    ...extra,
  });

  it('[BE-MUT-705] active promotions are those started, not ended and active for the shop, filtered by branch when given', async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    const { prisma, service } = setup();
    prisma.promotion.findMany.mockResolvedValue([row()]);
    await service.findActive(5);
    const call = prisma.promotion.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      consumer_id: 5,
      is_active: true,
      start_date: { lte: NOW },
      OR: [{ end_date: null }, { end_date: { gte: NOW } }],
    });
    expect(call.orderBy).toEqual([
      { auto_apply: 'desc' },
      { created_at: 'desc' },
    ]);
    await service.findActive(5, 4);
    expect(prisma.promotion.findMany.mock.calls[1][0].where.AND).toEqual([
      {
        OR: [
          { branch_specific: false },
          { branches: { some: { branch_id: 4 } } },
        ],
      },
    ]);
  });

  it('[BE-MUT-706] promotions that used up their limits are switched off and left out; unlimited ones skip the usage check', async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    const { prisma, service } = setup();
    prisma.promotion.findMany.mockResolvedValue([
      row({ id: 1 }),
      row({ id: 2, usage_limit: 3 }),
      row({ id: 3, max_discount_amount: '10' }),
      row({ id: 4, usage_limit: 3, max_discount_amount: '100' }),
    ]);
    prisma.sale.count.mockImplementation(async ({ where }: any) =>
      where.promotion_id === 2 ? 3 : 1,
    );
    prisma.sale.aggregate.mockImplementation(async ({ where }: any) => ({
      _sum: { promotion_discount: where.promotion_id === 3 ? 10 : 1 },
    }));
    const result: any[] = await service.findActive(5);
    expect(result.map((p) => p.id)).toEqual([1, 4]);
    expect(prisma.promotion.updateMany).toHaveBeenCalledWith({
      where: { consumer_id: 5, id: { in: [2, 3] }, is_active: true },
      data: { is_active: false },
    });
    expect(
      prisma.sale.aggregate.mock.calls
        .map(([a]: any) => a.where.promotion_id)
        .sort(),
    ).toEqual([2, 3, 4]);
    prisma.promotion.updateMany.mockClear();
    prisma.promotion.findMany.mockResolvedValue([row({ id: 1 })]);
    await service.findActive(5);
    expect(prisma.promotion.updateMany).not.toHaveBeenCalled();
    prisma.promotion.findMany.mockRejectedValue(new Error('db'));
    await expect(service.findActive(5)).rejects.toThrow(
      'Failed to fetch active promotions',
    );
  });

  it('[BE-MUT-707] an exhausted promotion is closed once; a missing or still-open one is left alone; failures are pinned', async () => {
    const { prisma, service } = setup();
    prisma.promotion.findFirst.mockResolvedValue(null);
    await expect(
      service.closePromotionIfExhausted(1, 5),
    ).resolves.toBeUndefined();
    expect(prisma.promotion.findFirst).toHaveBeenCalledWith({
      where: { id: 1, consumer_id: 5 },
    });
    prisma.promotion.findFirst.mockResolvedValue(
      row({ is_active: true, usage_limit: 3 }),
    );
    prisma.sale.count.mockResolvedValue(2);
    await service.closePromotionIfExhausted(1, 5);
    expect(prisma.promotion.update).not.toHaveBeenCalled();
    prisma.sale.count.mockResolvedValue(3);
    await service.closePromotionIfExhausted(1, 5);
    expect(prisma.promotion.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { is_active: false },
    });
    prisma.promotion.update.mockClear();
    prisma.promotion.findFirst.mockResolvedValue(
      row({ is_active: false, usage_limit: 3 }),
    );
    await service.closePromotionIfExhausted(1, 5);
    expect(prisma.promotion.update).not.toHaveBeenCalled();
    prisma.promotion.findFirst.mockResolvedValue(
      row({ is_active: true, max_discount_amount: '10' }),
    );
    prisma.sale.aggregate.mockResolvedValue({
      _sum: { promotion_discount: 10 },
    });
    await service.closePromotionIfExhausted(1, 5);
    expect(prisma.promotion.update).toHaveBeenCalledTimes(1);
    prisma.promotion.findFirst.mockRejectedValue(new Error('db'));
    await expect(service.closePromotionIfExhausted(1, 5)).rejects.toThrow(
      'Failed to close exhausted promotion',
    );
  });

  it('[BE-MUT-708] promotion sales are paged newest first, within the optional date range, with totals', async () => {
    const { prisma, service } = setup();
    prisma.promotion.findFirst.mockResolvedValue(row());
    prisma.sale.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.sale.count.mockResolvedValue(45);
    prisma.sale.aggregate.mockResolvedValue({
      _sum: { discount_amount: '12.5', total_amount: '300' },
    });
    const result = await service.getPromotionSales(1, {}, 5);
    expect(result).toEqual({
      data: [{ id: 1 }],
      meta: { total: 45, page: 1, limit: 20, total_pages: 3 },
      summary: { total_discount_amount: 12.5, total_sales_amount: 300 },
    });
    const where = {
      consumer_id: 5,
      promotion_id: 1,
      sale_type: 'sale',
      payment_status: { not: 'cancelled' },
      deleted_at: null,
    };
    expect(prisma.sale.findMany).toHaveBeenCalledWith({
      where,
      skip: 0,
      take: 20,
      orderBy: { sale_date: 'desc' },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });
    await service.getPromotionSales(
      1,
      {
        page: 3,
        limit: 10,
        date_from: '2026-01-01',
        date_to: '2026-02-01',
      },
      5,
    );
    expect(prisma.sale.findMany.mock.calls[1][0]).toMatchObject({
      skip: 20,
      take: 10,
      where: {
        ...where,
        sale_date: { gte: new Date('2026-01-01'), lte: new Date('2026-02-01') },
      },
    });
    await service.getPromotionSales(1, { date_from: '2026-01-01' }, 5);
    expect(prisma.sale.findMany.mock.calls[2][0].where.sale_date).toEqual({
      gte: new Date('2026-01-01'),
    });
    await service.getPromotionSales(1, { date_to: '2026-02-01' }, 5);
    expect(prisma.sale.findMany.mock.calls[3][0].where.sale_date).toEqual({
      lte: new Date('2026-02-01'),
    });
    prisma.promotion.findFirst.mockResolvedValue(null);
    await expect(
      service.getPromotionSales(1, {} as any, 5),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.promotion.findFirst.mockResolvedValue(row());
    prisma.sale.findMany.mockRejectedValue(new Error('db'));
    await expect(service.getPromotionSales(1, {} as any, 5)).rejects.toThrow(
      'Failed to fetch promotion sales',
    );
  });
});
