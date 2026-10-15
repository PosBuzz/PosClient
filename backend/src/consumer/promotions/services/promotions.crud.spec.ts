import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PromotionsService } from './promotions.service';

const T0 = new Date('2026-05-05T10:00:00.000Z');

function setup() {
  const mk = (...names: string[]) =>
    Object.fromEntries(names.map((n) => [n, jest.fn()]));
  const tx: any = {
    promotionProduct: mk('deleteMany'),
    promotionBranch: mk('deleteMany'),
    promotion: mk('update'),
  };
  const prisma: any = {
    promotion: mk('findFirst', 'findMany', 'create', 'delete'),
    branch: mk('count', 'findMany'),
    brand: mk('findFirst', 'findMany'),
    productVariant: mk('count', 'findMany'),
    sale: mk('groupBy'),
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
  };
  prisma.sale.groupBy.mockResolvedValue([]);
  prisma.branch.count.mockImplementation(
    async ({ where }: any) => where.id.in.length,
  );
  prisma.productVariant.count.mockImplementation(
    async ({ where }: any) => where.id.in.length,
  );
  prisma.brand.findFirst.mockResolvedValue({ id: 3 });
  return { prisma, tx, service: new PromotionsService(prisma) };
}

const create = (extra: object = {}): any => ({
  name: 'Sale',
  scope: 'SINGLE_PRODUCT',
  discount_type: 'percentage',
  discount_value: 10,
  start_date: '2026-05-01T00:00:00.000Z',
  variant_ids: [7],
  ...extra,
});

const row = (extra: object = {}): any => ({
  id: 1,
  name: 'Sale',
  description: 'd',
  scope: 'SINGLE_PRODUCT',
  discount_type: 'percentage',
  discount_value: '10',
  start_date: new Date('2026-05-01T00:00:00Z'),
  end_date: null,
  is_active: true,
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
  auto_apply: false,
  branch_specific: false,
  brand_id: null,
  brand: null,
  branches: [],
  products: [],
  created_at: T0,
  updated_at: T0,
  ...extra,
});

const include = {
  brand: { select: { id: true, name: true } },
  branches: { include: { branch: { select: { id: true, name: true } } } },
  products: {
    include: {
      variant: {
        include: {
          product: { select: { id: true, name: true, brand_id: true } },
        },
      },
    },
  },
};

const bad = async (promise: Promise<unknown>): Promise<any> =>
  promise.catch((e: unknown) => e);

describe('PromotionsService.create validation (unit)', () => {
  it('[BE-MUT-670] dates must parse and the end may not precede the start (equal is fine)', async () => {
    const { service } = setup();
    expect(
      (await bad(service.create(create({ start_date: 'nope' }), 5, 8))).message,
    ).toBe('Invalid start_date');
    expect(
      (await bad(service.create(create({ end_date: 'nope' }), 5, 8))).message,
    ).toBe('Invalid end_date');
    expect(
      (
        await bad(
          service.create(create({ end_date: '2026-04-30T00:00:00Z' }), 5, 8),
        )
      ).message,
    ).toBe('The end date must be after the start date.');
    const { prisma, service: ok } = setup();
    prisma.promotion.create.mockResolvedValue(row());
    await expect(
      ok.create(create({ end_date: '2026-05-01T00:00:00.000Z' }), 5, 8),
    ).resolves.toBeDefined();
  });

  it('[BE-MUT-671] the cap quantity may not be below the minimum quantity; a zero or null cap means no cap', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(row());
    const error = await bad(
      service.create(create({ min_quantity: 3, cap_quantity: 2 }), 5, 8),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe(
      'The cap quantity must be at least the minimum quantity.',
    );
    for (const cap of [3, 0, null, undefined]) {
      await expect(
        service.create(create({ min_quantity: 3, cap_quantity: cap }), 5, 8),
      ).resolves.toBeDefined();
    }
  });

  it('[BE-MUT-672] the cap discount may not exceed the maximum discount when both are set', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(row());
    const error = await bad(
      service.create(
        create({ max_discount_amount: 50, cap_discount_amount: 60 }),
        5,
        8,
      ),
    );
    expect(error.message).toBe(
      'The cap discount amount cannot be greater than the maximum discount amount.',
    );
    for (const [max, cap] of [
      [50, 50],
      [50, null],
      [null, 60],
      [undefined, 60],
      [50, undefined],
    ]) {
      await expect(
        service.create(
          create({ max_discount_amount: max, cap_discount_amount: cap }),
          5,
          8,
        ),
      ).resolves.toBeDefined();
    }
  });

  it('[BE-MUT-673] per-customer limits need a limit of at least 1; daily reset needs the per-customer limit', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(row());
    for (const limit of [undefined, 0, null]) {
      const error = await bad(
        service.create(
          create({ limit_per_customer: true, customer_usage_limit: limit }),
          5,
          8,
        ),
      );
      expect(error.message).toBe(
        'A customer usage limit is required when the promotion is limited per customer.',
      );
    }
    await expect(
      service.create(
        create({ limit_per_customer: true, customer_usage_limit: 1 }),
        5,
        8,
      ),
    ).resolves.toBeDefined();
    const reset = await bad(
      service.create(create({ customer_usage_daily_reset: true }), 5, 8),
    );
    expect(reset.message).toBe(
      'Daily reset of customer usage requires the promotion to be limited per customer.',
    );
  });

  it('[BE-MUT-674] branch-specific promotions need valid branches of this shop', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(row());
    expect(
      (await bad(service.create(create({ branch_specific: true }), 5, 8)))
        .message,
    ).toBe('Select at least one branch for a branch-specific promotion.');
    prisma.branch.count.mockResolvedValue(1);
    expect(
      (
        await bad(
          service.create(
            create({ branch_specific: true, branch_ids: [1, 2, 2] }),
            5,
            8,
          ),
        )
      ).message,
    ).toBe('One or more selected branches are invalid for this consumer');
    expect(prisma.branch.count).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] }, consumer_id: 5 },
    });
  });

  it('[BE-MUT-675] a brand promotion needs a brand of this shop and no products', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(row());
    const brandPromo = (extra: object = {}) =>
      create({ scope: 'BRAND', variant_ids: [], ...extra });
    expect((await bad(service.create(brandPromo(), 5, 8))).message).toBe(
      'Select a brand for a brand promotion.',
    );
    expect(
      (
        await bad(
          service.create(brandPromo({ brand_id: 3, variant_ids: [7] }), 5, 8),
        )
      ).message,
    ).toBe(
      'Brand promotions apply to a whole brand; remove the selected products.',
    );
    prisma.brand.findFirst.mockResolvedValue(null);
    expect(
      (await bad(service.create(brandPromo({ brand_id: 3 }), 5, 8))).message,
    ).toBe('Selected brand is invalid');
    expect(prisma.brand.findFirst).toHaveBeenCalledWith({
      where: { id: 3, consumer_id: 5 },
    });
    prisma.brand.findFirst.mockResolvedValue({ id: 3 });
    await service.create(brandPromo({ brand_id: 3 }), 5, 8);
    expect(prisma.promotion.create.mock.calls[0][0].data).toMatchObject({
      brand_id: 3,
      products: undefined,
    });
  });

  it('[BE-MUT-676] product promotions need valid variants; single-product ones exactly one', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(row());
    expect(
      (await bad(service.create(create({ variant_ids: [] }), 5, 8))).message,
    ).toBe(
      'Select at least one product for a single-product or bundle promotion.',
    );
    expect(
      (await bad(service.create(create({ variant_ids: [7, 8] }), 5, 8)))
        .message,
    ).toBe('SINGLE_PRODUCT promotions must have exactly one variant_id');
    prisma.productVariant.count.mockResolvedValue(1);
    expect(
      (
        await bad(
          service.create(
            create({ scope: 'BUNDLE', variant_ids: [7, 8] }),
            5,
            8,
          ),
        )
      ).message,
    ).toBe('One or more selected variants are invalid for this consumer');
    expect(prisma.productVariant.count).toHaveBeenCalledWith({
      where: { id: { in: [7, 8] }, product: { consumer_id: 5 } },
    });
    prisma.productVariant.count.mockImplementation(
      async ({ where }: any) => where.id.in.length,
    );
    await expect(
      service.create(create({ scope: 'BUNDLE', variant_ids: [7, 8, 8] }), 5, 8),
    ).resolves.toBeDefined();
  });
});

describe('PromotionsService create/read/update/remove (unit)', () => {
  it('[BE-MUT-677] create stores the validated promotion with defaults, product and branch links, and returns it mapped', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(
      row({
        discount_value: '12.5',
        min_purchase: '100',
        max_discount_amount: '40',
        cap_discount_amount: '30',
        branches: [{ branch_id: 4, branch: { id: 4, name: 'B' } }],
        products: [
          {
            variant_id: 7,
            variant: { name: 'Small', product: { id: 2, name: 'Shirt' } },
          },
        ],
        brand: { id: 3, name: 'Nike' },
        brand_id: 3,
      }),
    );
    prisma.sale.groupBy.mockResolvedValue([
      {
        promotion_id: 1,
        _count: { _all: 3 },
        _sum: { promotion_discount: '15.5', total_amount: '300' },
      },
      { promotion_id: null, _count: { _all: 9 }, _sum: {} },
    ]);
    const result = await service.create(
      create({
        description: 'desc',
        branch_specific: true,
        branch_ids: [4],
        min_purchase: 100,
      }),
      5,
      8,
    );
    expect(prisma.promotion.create).toHaveBeenCalledWith({
      data: {
        consumer_id: 5,
        created_by_user_id: 8,
        name: 'Sale',
        description: 'desc',
        scope: 'SINGLE_PRODUCT',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: new Date('2026-05-01T00:00:00.000Z'),
        end_date: null,
        is_active: true,
        min_purchase: 100,
        min_quantity: 1,
        usage_limit: undefined,
        cap_quantity: undefined,
        max_discount_amount: undefined,
        cap_discount_amount: undefined,
        member_only: false,
        limit_per_customer: false,
        customer_usage_limit: null,
        customer_usage_daily_reset: false,
        auto_apply: false,
        branch_specific: true,
        brand_id: null,
        products: { createMany: { data: [{ variant_id: 7 }] } },
        branches: { createMany: { data: [{ branch_id: 4 }] } },
      },
      include,
    });
    expect(prisma.sale.groupBy).toHaveBeenCalledWith({
      by: ['promotion_id'],
      where: {
        promotion_id: { in: [1] },
        sale_type: 'sale',
        payment_status: { not: 'cancelled' },
        deleted_at: null,
      },
      _count: { _all: true },
      _sum: { promotion_discount: true, total_amount: true },
    });
    expect(result).toEqual({
      id: 1,
      name: 'Sale',
      description: 'd',
      scope: 'SINGLE_PRODUCT',
      discount_type: 'percentage',
      discount_value: 12.5,
      start_date: new Date('2026-05-01T00:00:00Z'),
      end_date: null,
      is_active: true,
      min_purchase: 100,
      min_quantity: 1,
      usage_limit: null,
      cap_quantity: null,
      max_discount_amount: 40,
      cap_discount_amount: 30,
      member_only: false,
      limit_per_customer: false,
      customer_usage_limit: null,
      customer_usage_daily_reset: false,
      auto_apply: false,
      branch_specific: false,
      branch_ids: [4],
      variant_ids: [7],
      brand_id: 3,
      brand: { id: 3, name: 'Nike' },
      branches: [{ id: 4, name: 'B' }],
      products: [
        {
          variant_id: 7,
          variant_name: 'Small',
          product_id: 2,
          product_name: 'Shirt',
        },
      ],
      sales_count: 3,
      total_discount_given: 15.5,
      total_discounted_sales: 300,
      created_at: T0,
      updated_at: T0,
    });
  });

  it('[BE-MUT-678] explicit flags are kept and per-customer limits are stored only when limiting per customer', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(row());
    await service.create(
      create({
        is_active: false,
        member_only: true,
        auto_apply: true,
        limit_per_customer: true,
        customer_usage_limit: 2,
        customer_usage_daily_reset: true,
        usage_limit: 100,
        cap_quantity: 9,
        max_discount_amount: 50,
        cap_discount_amount: 40,
        end_date: '2026-06-01T00:00:00.000Z',
      }),
      5,
      8,
    );
    expect(prisma.promotion.create.mock.calls[0][0].data).toMatchObject({
      is_active: false,
      member_only: true,
      auto_apply: true,
      limit_per_customer: true,
      customer_usage_limit: 2,
      customer_usage_daily_reset: true,
      usage_limit: 100,
      cap_quantity: 9,
      max_discount_amount: 50,
      cap_discount_amount: 40,
      end_date: new Date('2026-06-01T00:00:00.000Z'),
    });
  });

  it('[BE-MUT-679] unexpected create/list/get/delete failures become pinned 500s; client errors pass through', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockRejectedValue(new Error('db'));
    prisma.promotion.findMany.mockRejectedValue(new Error('db'));
    prisma.promotion.findFirst.mockRejectedValue(new Error('db'));
    for (const [call, message] of [
      [() => service.create(create(), 5, 8), 'Failed to create promotion'],
      [() => service.findAll(5), 'Failed to fetch promotions'],
      [() => service.findOne(1, 5), 'Failed to fetch promotion'],
      [() => service.update(1, {}, 5), 'Failed to update promotion'],
      [() => service.remove(1, 5), 'Failed to delete promotion'],
    ] as const) {
      const error = await bad(call());
      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect(error.message).toBe(message);
    }
    prisma.promotion.findFirst.mockResolvedValue(null);
    const missing = await bad(service.findOne(1, 5));
    expect(missing).toBeInstanceOf(NotFoundException);
    expect(missing.message).toBe('Promotion with ID 1 not found');
    expect(prisma.promotion.findFirst).toHaveBeenLastCalledWith({
      where: { id: 1, consumer_id: 5 },
      include,
    });
  });

  it('[BE-MUT-680] findAll lists the shop promotions newest first with their sales summaries; none means no summary query', async () => {
    const { prisma, service } = setup();
    prisma.promotion.findMany.mockResolvedValue([
      row({ id: 1 }),
      row({ id: 2 }),
    ]);
    prisma.sale.groupBy.mockResolvedValue([
      {
        promotion_id: 2,
        _count: { _all: 4 },
        _sum: { promotion_discount: 8, total_amount: 80 },
      },
    ]);
    const list: any[] = await service.findAll(5);
    expect(prisma.promotion.findMany).toHaveBeenCalledWith({
      where: { consumer_id: 5 },
      include,
      orderBy: { created_at: 'desc' },
    });
    expect(
      list.map((p) => [
        p.id,
        p.sales_count,
        p.total_discount_given,
        p.total_discounted_sales,
      ]),
    ).toEqual([
      [1, 0, 0, 0],
      [2, 4, 8, 80],
    ]);
    prisma.sale.groupBy.mockClear();
    prisma.promotion.findMany.mockResolvedValue([]);
    await expect(service.findAll(5)).resolves.toEqual([]);
    expect(prisma.sale.groupBy).not.toHaveBeenCalled();
  });

  it('[BE-MUT-681] remove checks ownership first and deletes only that promotion', async () => {
    const { prisma, service } = setup();
    prisma.promotion.findFirst.mockResolvedValue(row());
    await expect(service.remove(1, 5)).resolves.toEqual({ success: true });
    expect(prisma.promotion.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    prisma.promotion.findFirst.mockResolvedValue(null);
    prisma.promotion.delete.mockClear();
    await expect(service.remove(1, 5)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.promotion.delete).not.toHaveBeenCalled();
  });

  it('[BE-MUT-682] options list the shop branches, brands and variants by name with numeric prices', async () => {
    const { prisma, service } = setup();
    prisma.branch.findMany.mockResolvedValue([{ id: 1, name: 'B' }]);
    prisma.brand.findMany.mockResolvedValue([{ id: 2, name: 'Nike' }]);
    prisma.productVariant.findMany.mockResolvedValue([
      {
        id: 7,
        name: 'S',
        sku: 'SK',
        regular_price: '10.5',
        product: { id: 3, name: 'Shirt', brand_id: 2 },
      },
    ]);
    await expect(service.getOptions(5)).resolves.toEqual({
      branches: [{ id: 1, name: 'B' }],
      brands: [{ id: 2, name: 'Nike' }],
      variants: [
        {
          id: 7,
          name: 'S',
          sku: 'SK',
          regular_price: 10.5,
          product_id: 3,
          product_name: 'Shirt',
          brand_id: 2,
        },
      ],
    });
    expect(prisma.branch.findMany).toHaveBeenCalledWith({
      where: { consumer_id: 5 },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    expect(prisma.brand.findMany).toHaveBeenCalledWith({
      where: { consumer_id: 5 },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    expect(prisma.productVariant.findMany).toHaveBeenCalledWith({
      where: { product: { consumer_id: 5 } },
      select: {
        id: true,
        name: true,
        sku: true,
        regular_price: true,
        product: { select: { id: true, name: true, brand_id: true } },
      },
      orderBy: [{ product: { name: 'asc' } }, { name: 'asc' }],
    });
    prisma.branch.findMany.mockRejectedValue(new Error('db'));
    await expect(service.getOptions(5)).rejects.toThrow(
      'Failed to fetch promotion options',
    );
  });

  const existing = (extra: object = {}) =>
    row({
      description: 'old',
      end_date: new Date('2026-06-01T00:00:00Z'),
      min_purchase: '50',
      usage_limit: 10,
      cap_quantity: 9,
      min_quantity: 2,
      max_discount_amount: '40',
      cap_discount_amount: '30',
      member_only: true,
      limit_per_customer: true,
      customer_usage_limit: 3,
      customer_usage_daily_reset: true,
      auto_apply: true,
      branch_specific: true,
      branches: [{ branch_id: 4 }],
      products: [{ variant_id: 7 }],
      ...extra,
    });

  it('[BE-MUT-683] an empty update re-validates and rewrites the promotion unchanged, replacing its links in one transaction', async () => {
    const { prisma, tx, service } = setup();
    prisma.promotion.findFirst.mockResolvedValue(existing());
    tx.promotion.update.mockResolvedValue(row({ id: 1 }));
    await service.update(1, {}, 5);
    expect(tx.promotionProduct.deleteMany).toHaveBeenCalledWith({
      where: { promotion_id: 1 },
    });
    expect(tx.promotionBranch.deleteMany).toHaveBeenCalledWith({
      where: { promotion_id: 1 },
    });
    expect(tx.promotion.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: 'Sale',
        description: 'old',
        scope: 'SINGLE_PRODUCT',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: new Date('2026-05-01T00:00:00Z'),
        end_date: new Date('2026-06-01T00:00:00Z'),
        is_active: true,
        min_purchase: 50,
        min_quantity: 2,
        usage_limit: 10,
        cap_quantity: 9,
        max_discount_amount: 40,
        cap_discount_amount: 30,
        member_only: true,
        limit_per_customer: true,
        customer_usage_limit: 3,
        customer_usage_daily_reset: true,
        auto_apply: true,
        branch_specific: true,
        brand_id: null,
        products: { createMany: { data: [{ variant_id: 7 }] } },
        branches: { createMany: { data: [{ branch_id: 4 }] } },
      },
      include,
    });
  });

  it('[BE-MUT-684] an update can change, clear or keep each optional field; null clears and undefined keeps', async () => {
    const { prisma, tx, service } = setup();
    prisma.promotion.findFirst.mockResolvedValue(existing());
    tx.promotion.update.mockResolvedValue(row());
    await service.update(
      1,
      {
        name: 'New',
        description: 'new',
        discount_value: 20,
        start_date: '2026-05-02T00:00:00.000Z',
        end_date: null,
        min_purchase: null,
        usage_limit: null,
        cap_quantity: null,
        max_discount_amount: null,
        cap_discount_amount: null,
        member_only: false,
        auto_apply: false,
        is_active: false,
        min_quantity: 1,
        limit_per_customer: false,
        customer_usage_limit: null,
        customer_usage_daily_reset: false,
        branch_specific: false,
        branch_ids: [],
        variant_ids: [8],
      } as any,
      5,
    );
    expect(tx.promotion.update.mock.calls[0][0].data).toMatchObject({
      name: 'New',
      description: 'new',
      discount_value: 20,
      start_date: new Date('2026-05-02T00:00:00.000Z'),
      end_date: null,
      min_purchase: null,
      usage_limit: null,
      cap_quantity: null,
      max_discount_amount: null,
      cap_discount_amount: null,
      member_only: false,
      auto_apply: false,
      is_active: false,
      min_quantity: 1,
      limit_per_customer: false,
      customer_usage_limit: null,
      customer_usage_daily_reset: false,
      branch_specific: false,
      products: { createMany: { data: [{ variant_id: 8 }] } },
      branches: undefined,
    });
  });

  it('[BE-MUT-685] an update with explicit values replaces existing ones; the merged result is validated before anything is deleted', async () => {
    const { prisma, tx, service } = setup();
    prisma.promotion.findFirst.mockResolvedValue(existing());
    tx.promotion.update.mockResolvedValue(row());
    await service.update(
      1,
      {
        min_purchase: 70,
        usage_limit: 20,
        cap_quantity: 8,
        max_discount_amount: 60,
        cap_discount_amount: 55,
        customer_usage_limit: 5,
      },
      5,
    );
    expect(tx.promotion.update.mock.calls[0][0].data).toMatchObject({
      min_purchase: 70,
      usage_limit: 20,
      cap_quantity: 8,
      max_discount_amount: 60,
      cap_discount_amount: 55,
      customer_usage_limit: 5,
    });
    tx.promotionProduct.deleteMany.mockClear();
    const error = await bad(
      service.update(1, { end_date: '2026-04-01T00:00:00Z' }, 5),
    );
    expect(error.message).toBe('The end date must be after the start date.');
    expect(tx.promotionProduct.deleteMany).not.toHaveBeenCalled();
  });

  it('[BE-MUT-686] an existing brand promotion keeps its brand on update; changing scope needs matching inputs', async () => {
    const { prisma, tx, service } = setup();
    prisma.promotion.findFirst.mockResolvedValue(
      existing({
        scope: 'BRAND',
        brand_id: 3,
        products: [],
        branch_specific: false,
        branches: [],
      }),
    );
    tx.promotion.update.mockResolvedValue(row());
    await service.update(1, { name: 'N' }, 5);
    expect(tx.promotion.update.mock.calls[0][0].data).toMatchObject({
      scope: 'BRAND',
      brand_id: 3,
      products: undefined,
    });
    await service.update(1, { brand_id: null } as any, 5).catch((e) => {
      expect(e.message).toBe('Select a brand for a brand promotion.');
    });
  });
});
