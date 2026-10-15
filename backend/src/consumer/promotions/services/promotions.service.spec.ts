import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PromotionsService } from './promotions.service';

const NOW = new Date('2026-05-05T10:00:00.000Z');
const start = new Date('2026-05-01T00:00:00.000Z');

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

const promotionRow = (extra: object = {}): any => ({
  id: 7,
  consumer_id: 5,
  name: 'Summer',
  description: 'desc',
  scope: 'SINGLE_PRODUCT',
  discount_type: 'percentage',
  discount_value: '10',
  start_date: start,
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
  products: [
    {
      variant_id: 11,
      variant: { name: 'Small', product: { id: 3, name: 'Shirt' } },
    },
  ],
  created_at: start,
  updated_at: start,
  ...extra,
});

function setup() {
  const mk = (...names: string[]) =>
    Object.fromEntries(names.map((n) => [n, jest.fn()]));
  const tx: any = {
    promotionProduct: mk('deleteMany'),
    promotionBranch: mk('deleteMany'),
    promotion: mk('update'),
  };
  const prisma: any = {
    promotion: mk(
      'create',
      'findMany',
      'findFirst',
      'update',
      'updateMany',
      'delete',
    ),
    sale: mk('groupBy', 'aggregate', 'count', 'findMany'),
    branch: mk('count', 'findMany'),
    brand: mk('findFirst', 'findMany'),
    productVariant: mk('count', 'findMany'),
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
  };
  prisma.sale.groupBy.mockResolvedValue([]);
  prisma.sale.aggregate.mockResolvedValue({ _sum: {} });
  prisma.sale.count.mockResolvedValue(0);
  prisma.branch.count.mockImplementation(
    async ({ where }: any) => where.id.in.length,
  );
  prisma.productVariant.count.mockImplementation(
    async ({ where }: any) => where.id.in.length,
  );
  prisma.brand.findFirst.mockResolvedValue({ id: 2 });
  return { prisma, tx, service: new PromotionsService(prisma) };
}

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const createDto = (extra: object = {}): any => ({
  name: 'Summer',
  scope: 'SINGLE_PRODUCT',
  discount_type: 'percentage',
  discount_value: 10,
  start_date: '2026-05-01T00:00:00.000Z',
  variant_ids: [11],
  ...extra,
});

const reject = (promise: Promise<unknown>): Promise<any> =>
  promise.catch((e) => e);

describe('PromotionsService validation (unit)', () => {
  it('[BE-MUT-670] dates must parse and the end may not precede the start; equal dates are fine', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(promotionRow());
    expect(
      (await reject(service.create(createDto({ start_date: 'nope' }), 5, 8)))
        .message,
    ).toBe('Invalid start_date');
    expect(
      (await reject(service.create(createDto({ end_date: 'nope' }), 5, 8)))
        .message,
    ).toBe('Invalid end_date');
    expect(
      (
        await reject(
          service.create(createDto({ end_date: '2026-04-30T00:00:00Z' }), 5, 8),
        )
      ).message,
    ).toBe('The end date must be after the start date.');
    await expect(
      service.create(createDto({ end_date: '2026-05-01T00:00:00.000Z' }), 5, 8),
    ).resolves.toBeDefined();
  });

  it('[BE-MUT-671] the cap quantity may not be below the minimum quantity, but is only checked when set above zero', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(promotionRow());
    const bad = await reject(
      service.create(createDto({ min_quantity: 5, cap_quantity: 4 }), 5, 8),
    );
    expect(bad.message).toBe(
      'The cap quantity must be at least the minimum quantity.',
    );
    for (const extra of [
      { min_quantity: 5, cap_quantity: 5 },
      { min_quantity: 5, cap_quantity: 0 },
      { min_quantity: 5, cap_quantity: null },
      { min_quantity: 5 },
    ]) {
      await expect(
        service.create(createDto(extra), 5, 8),
      ).resolves.toBeDefined();
    }
  });

  it('[BE-MUT-672] the discount cap may not exceed the maximum discount, only checked when both are set', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(promotionRow());
    const bad = await reject(
      service.create(
        createDto({ max_discount_amount: 100, cap_discount_amount: 101 }),
        5,
        8,
      ),
    );
    expect(bad.message).toBe(
      'The cap discount amount cannot be greater than the maximum discount amount.',
    );
    for (const extra of [
      { max_discount_amount: 100, cap_discount_amount: 100 },
      { max_discount_amount: null, cap_discount_amount: 999 },
      { max_discount_amount: 100, cap_discount_amount: null },
      { cap_discount_amount: 999 },
      { max_discount_amount: 100 },
    ]) {
      await expect(
        service.create(createDto(extra), 5, 8),
      ).resolves.toBeDefined();
    }
  });

  it('[BE-MUT-673] per-customer limits need a usage limit of at least 1; daily reset needs the per-customer limit', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(promotionRow());
    for (const customer_usage_limit of [undefined, 0]) {
      expect(
        (
          await reject(
            service.create(
              createDto({ limit_per_customer: true, customer_usage_limit }),
              5,
              8,
            ),
          )
        ).message,
      ).toBe(
        'A customer usage limit is required when the promotion is limited per customer.',
      );
    }
    await expect(
      service.create(
        createDto({ limit_per_customer: true, customer_usage_limit: 1 }),
        5,
        8,
      ),
    ).resolves.toBeDefined();
    expect(
      (
        await reject(
          service.create(createDto({ customer_usage_daily_reset: true }), 5, 8),
        )
      ).message,
    ).toBe(
      'Daily reset of customer usage requires the promotion to be limited per customer.',
    );
    await expect(
      service.create(
        createDto({
          limit_per_customer: true,
          customer_usage_limit: 2,
          customer_usage_daily_reset: true,
        }),
        5,
        8,
      ),
    ).resolves.toBeDefined();
  });

  it('[BE-MUT-674] branch-specific promotions need branches of this shop', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(promotionRow());
    expect(
      (
        await reject(
          service.create(
            createDto({ branch_specific: true, branch_ids: [] }),
            5,
            8,
          ),
        )
      ).message,
    ).toBe('Select at least one branch for a branch-specific promotion.');
    prisma.branch.count.mockResolvedValue(1);
    expect(
      (
        await reject(
          service.create(
            createDto({ branch_specific: true, branch_ids: [1, 2, 2] }),
            5,
            8,
          ),
        )
      ).message,
    ).toBe('One or more selected branches are invalid for this consumer');
    expect(prisma.branch.count).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] }, consumer_id: 5 },
    });
    prisma.branch.count.mockClear();
    await service.create(createDto(), 5, 8);
    expect(prisma.branch.count).not.toHaveBeenCalled();
  });

  it('[BE-MUT-675] brand promotions need a brand of this shop and no products', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(promotionRow());
    const brand = (extra: object = {}) =>
      createDto({ scope: 'BRAND', variant_ids: [], brand_id: 2, ...extra });
    expect(
      (await reject(service.create(brand({ brand_id: undefined }), 5, 8)))
        .message,
    ).toBe('Select a brand for a brand promotion.');
    expect(
      (await reject(service.create(brand({ variant_ids: [11] }), 5, 8)))
        .message,
    ).toBe(
      'Brand promotions apply to a whole brand; remove the selected products.',
    );
    prisma.brand.findFirst.mockResolvedValue(null);
    expect((await reject(service.create(brand(), 5, 8))).message).toBe(
      'Selected brand is invalid',
    );
    expect(prisma.brand.findFirst).toHaveBeenCalledWith({
      where: { id: 2, consumer_id: 5 },
    });
    prisma.brand.findFirst.mockResolvedValue({ id: 2 });
    await expect(service.create(brand(), 5, 8)).resolves.toBeDefined();
    expect(prisma.productVariant.count).not.toHaveBeenCalled();
  });

  it('[BE-MUT-676] product promotions need variants of this shop; a single-product promotion exactly one', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(promotionRow());
    expect(
      (await reject(service.create(createDto({ variant_ids: [] }), 5, 8)))
        .message,
    ).toBe(
      'Select at least one product for a single-product or bundle promotion.',
    );
    expect(
      (await reject(service.create(createDto({ variant_ids: [11, 12] }), 5, 8)))
        .message,
    ).toBe('SINGLE_PRODUCT promotions must have exactly one variant_id');
    await expect(
      service.create(
        createDto({ scope: 'BUNDLE', variant_ids: [11, 12, 12] }),
        5,
        8,
      ),
    ).resolves.toBeDefined();
    prisma.productVariant.count.mockResolvedValue(0);
    expect((await reject(service.create(createDto(), 5, 8))).message).toBe(
      'One or more selected variants are invalid for this consumer',
    );
    expect(prisma.productVariant.count).toHaveBeenLastCalledWith({
      where: { id: { in: [11] }, product: { consumer_id: 5 } },
    });
  });
});

describe('PromotionsService create/read (unit)', () => {
  it('[BE-MUT-677] create stores every rule with the shop and author, defaulting flags, and returns the mapped promotion with its sales summary', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(
      promotionRow({
        branch_specific: true,
        branches: [{ branch_id: 1, branch: { id: 1, name: 'Main' } }],
      }),
    );
    prisma.sale.groupBy.mockResolvedValue([
      {
        promotion_id: 7,
        _count: { _all: 3 },
        _sum: { promotion_discount: '12.5', total_amount: '300' },
      },
      { promotion_id: null, _count: { _all: 1 }, _sum: {} },
    ]);
    prisma.branch.count.mockResolvedValue(1);
    const result: any = await service.create(
      createDto({
        description: 'desc',
        min_purchase: 50,
        usage_limit: 10,
        cap_quantity: 4,
        min_quantity: 2,
        max_discount_amount: 100,
        cap_discount_amount: 50,
        limit_per_customer: true,
        customer_usage_limit: 2,
        customer_usage_daily_reset: true,
        branch_specific: true,
        branch_ids: [1],
        member_only: true,
        auto_apply: true,
        is_active: false,
      }),
      5,
      8,
    );
    expect(prisma.promotion.create).toHaveBeenCalledWith({
      data: {
        consumer_id: 5,
        created_by_user_id: 8,
        name: 'Summer',
        description: 'desc',
        scope: 'SINGLE_PRODUCT',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: start,
        end_date: null,
        is_active: false,
        min_purchase: 50,
        min_quantity: 2,
        usage_limit: 10,
        cap_quantity: 4,
        max_discount_amount: 100,
        cap_discount_amount: 50,
        member_only: true,
        limit_per_customer: true,
        customer_usage_limit: 2,
        customer_usage_daily_reset: true,
        auto_apply: true,
        branch_specific: true,
        brand_id: null,
        products: { createMany: { data: [{ variant_id: 11 }] } },
        branches: { createMany: { data: [{ branch_id: 1 }] } },
      },
      include,
    });
    expect(prisma.sale.groupBy).toHaveBeenCalledWith({
      by: ['promotion_id'],
      where: {
        promotion_id: { in: [7] },
        sale_type: 'sale',
        payment_status: { not: 'cancelled' },
        deleted_at: null,
      },
      _count: { _all: true },
      _sum: { promotion_discount: true, total_amount: true },
    });
    expect(result).toMatchObject({
      sales_count: 3,
      total_discount_given: 12.5,
      total_discounted_sales: 300,
      branch_ids: [1],
      variant_ids: [11],
      branches: [{ id: 1, name: 'Main' }],
    });
  });

  it('[BE-MUT-678] create defaults: active, not member-only, no auto-apply, per-customer settings cleared, no branches', async () => {
    const { prisma, service } = setup();
    prisma.promotion.create.mockResolvedValue(promotionRow());
    await service
      .create(
        createDto({
          customer_usage_limit: 9,
          customer_usage_daily_reset: true,
          branch_ids: [4],
        }),
        5,
        8,
      )
      .catch(() => undefined);
    await service.create(createDto({ branch_ids: [4] }), 5, 8);
    const data = prisma.promotion.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      is_active: true,
      member_only: false,
      auto_apply: false,
      limit_per_customer: false,
      customer_usage_limit: null,
      customer_usage_daily_reset: false,
      branch_specific: false,
      min_quantity: 1,
      brand_id: null,
    });
    expect(data.branches).toBeUndefined();
    const brandData = setup();
    brandData.prisma.promotion.create.mockResolvedValue(promotionRow());
    await brandData.service.create(
      createDto({ scope: 'BRAND', variant_ids: [], brand_id: 2 }),
      5,
      8,
    );
    const brand = brandData.prisma.promotion.create.mock.calls[0][0].data;
    expect(brand.brand_id).toBe(2);
    expect(brand.products).toBeUndefined();
  });

  it('[BE-MUT-679] the mapped promotion exposes numbers as numbers and null for unset optional amounts', async () => {
    const { prisma, service } = setup();
    prisma.promotion.findFirst.mockResolvedValue(
      promotionRow({
        min_purchase: '25.5',
        max_discount_amount: '80',
        cap_discount_amount: '0',
        brand: { id: 2, name: 'Nike' },
        brand_id: 2,
        usage_limit: 5,
        cap_quantity: 3,
      }),
    );
    const result: any = await service.findOne(7, 5);
    expect(prisma.promotion.findFirst).toHaveBeenCalledWith({
      where: { id: 7, consumer_id: 5 },
      include,
    });
    expect(result).toMatchObject({
      id: 7,
      name: 'Summer',
      description: 'desc',
      scope: 'SINGLE_PRODUCT',
      discount_type: 'percentage',
      discount_value: 10,
      min_purchase: 25.5,
      max_discount_amount: 80,
      cap_discount_amount: 0,
      usage_limit: 5,
      cap_quantity: 3,
      brand_id: 2,
      brand: { id: 2, name: 'Nike' },
      sales_count: 0,
      total_discount_given: 0,
      total_discounted_sales: 0,
      products: [
        {
          variant_id: 11,
          variant_name: 'Small',
          product_id: 3,
          product_name: 'Shirt',
        },
      ],
      created_at: start,
      updated_at: start,
    });
    prisma.promotion.findFirst.mockResolvedValue(promotionRow());
    const plain: any = await service.findOne(7, 5);
    expect(plain.min_purchase).toBeNull();
    expect(plain.max_discount_amount).toBeNull();
    expect(plain.cap_discount_amount).toBeNull();
    expect(prisma.sale.groupBy.mock.calls[1][0].where.promotion_id).toEqual({
      in: [7],
    });
  });

  it('[BE-MUT-680] findAll lists the shop promotions newest first and summarises sales only when there are promotions', async () => {
    const { prisma, service } = setup();
    prisma.promotion.findMany.mockResolvedValue([]);
    await expect(service.findAll(5)).resolves.toEqual([]);
    expect(prisma.promotion.findMany).toHaveBeenCalledWith({
      where: { consumer_id: 5 },
      include,
      orderBy: { created_at: 'desc' },
    });
    expect(prisma.sale.groupBy).not.toHaveBeenCalled();
    prisma.promotion.findMany.mockResolvedValue([
      promotionRow({ id: 1 }),
      promotionRow({ id: 2 }),
    ]);
    await service.findAll(5);
    expect(prisma.sale.groupBy.mock.calls[0][0].where.promotion_id).toEqual({
      in: [1, 2],
    });
  });

  it('[BE-MUT-681] a promotion of another shop is a 404 naming the id; unexpected failures become generic 500s, client errors pass', async () => {
    const { prisma, service } = setup();
    prisma.promotion.findFirst.mockResolvedValue(null);
    await expect(service.findOne(7, 5)).rejects.toThrow(
      new NotFoundException('Promotion with ID 7 not found'),
    );
    const boom = new Error('db');
    prisma.promotion.findFirst.mockRejectedValue(boom);
    prisma.promotion.findMany.mockRejectedValue(boom);
    prisma.promotion.create.mockRejectedValue(boom);
    for (const [call, message] of [
      [() => service.findOne(7, 5), 'Failed to fetch promotion'],
      [() => service.findAll(5), 'Failed to fetch promotions'],
      [() => service.create(createDto(), 5, 8), 'Failed to create promotion'],
      [() => service.update(7, {}, 5), 'Failed to update promotion'],
      [() => service.remove(7, 5), 'Failed to delete promotion'],
      [() => service.getOptions(5), 'Failed to fetch promotion options'],
      [() => service.findActive(5), 'Failed to fetch active promotions'],
      [
        () => service.closePromotionIfExhausted(7, 5),
        'Failed to close exhausted promotion',
      ],
      [
        () => service.getPromotionSales(7, {}, 5),
        'Failed to fetch promotion sales',
      ],
    ] as const) {
      prisma.branch.findMany.mockRejectedValue(boom);
      const error = await reject(call());
      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect(error.message).toBe(message);
    }
    const prismaError = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 't',
      meta: { target: ['name'] },
    });
    prisma.promotion.create.mockRejectedValue(prismaError);
    await expect(service.create(createDto(), 5, 8)).rejects.toBe(prismaError);
  });

  it('[BE-MUT-682] getOptions returns branches, brands and variants sorted by name with prices as numbers', async () => {
    const { prisma, service } = setup();
    prisma.branch.findMany.mockResolvedValue([{ id: 1, name: 'Main' }]);
    prisma.brand.findMany.mockResolvedValue([{ id: 2, name: 'Nike' }]);
    prisma.productVariant.findMany.mockResolvedValue([
      {
        id: 11,
        name: 'Small',
        sku: 'S',
        regular_price: '12.5',
        product: { id: 3, name: 'Shirt', brand_id: 2 },
      },
    ]);
    await expect(service.getOptions(5)).resolves.toEqual({
      branches: [{ id: 1, name: 'Main' }],
      brands: [{ id: 2, name: 'Nike' }],
      variants: [
        {
          id: 11,
          name: 'Small',
          sku: 'S',
          regular_price: 12.5,
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
  });

  it('[BE-MUT-683] remove deletes only an owned promotion and reports success', async () => {
    const { prisma, service } = setup();
    prisma.promotion.findFirst.mockResolvedValue(promotionRow());
    prisma.promotion.delete.mockResolvedValue({});
    await expect(service.remove(7, 5)).resolves.toEqual({ success: true });
    expect(prisma.promotion.delete).toHaveBeenCalledWith({ where: { id: 7 } });
    prisma.promotion.findFirst.mockResolvedValue(null);
    await expect(service.remove(7, 5)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('[BE-MUT-684] promotion sales are paged, filtered by date and summarised; the shop and promotion are always in the filter', async () => {
    const { prisma, service } = setup();
    prisma.promotion.findFirst.mockResolvedValue(promotionRow());
    prisma.sale.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.sale.count.mockResolvedValue(45);
    prisma.sale.aggregate.mockResolvedValue({
      _sum: { discount_amount: '10.5', total_amount: '99' },
    });
    const result: any = await service.getPromotionSales(7, {}, 5);
    expect(result).toEqual({
      data: [{ id: 1 }],
      meta: { total: 45, page: 1, limit: 20, total_pages: 3 },
      summary: { total_discount_amount: 10.5, total_sales_amount: 99 },
    });
    const where = {
      consumer_id: 5,
      promotion_id: 7,
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
    expect(prisma.sale.aggregate).toHaveBeenCalledWith({
      where,
      _sum: { discount_amount: true, total_amount: true },
    });
    await service.getPromotionSales(
      7,
      {
        page: 3,
        limit: 5,
        date_from: '2026-01-01',
        date_to: '2026-02-01',
      },
      5,
    );
    expect(prisma.sale.findMany.mock.calls[1][0]).toMatchObject({
      skip: 10,
      take: 5,
      where: {
        ...where,
        sale_date: { gte: new Date('2026-01-01'), lte: new Date('2026-02-01') },
      },
    });
    await service.getPromotionSales(7, { date_from: '2026-01-01' }, 5);
    expect(prisma.sale.findMany.mock.calls[2][0].where.sale_date).toEqual({
      gte: new Date('2026-01-01'),
    });
    await service.getPromotionSales(7, { date_to: '2026-02-01' }, 5);
    expect(prisma.sale.findMany.mock.calls[3][0].where.sale_date).toEqual({
      lte: new Date('2026-02-01'),
    });
  });
});

describe('PromotionsService.update (unit)', () => {
  const arrange = (existing: object = {}) => {
    const ctx = setup();
    ctx.prisma.promotion.findFirst.mockResolvedValue(
      promotionRow({
        end_date: new Date('2026-06-01T00:00:00Z'),
        min_purchase: '20',
        usage_limit: 9,
        cap_quantity: 4,
        min_quantity: 2,
        max_discount_amount: '100',
        cap_discount_amount: '50',
        member_only: true,
        limit_per_customer: true,
        customer_usage_limit: 3,
        customer_usage_daily_reset: true,
        auto_apply: true,
        branch_specific: true,
        branches: [{ branch_id: 1, branch: { id: 1, name: 'Main' } }],
        ...existing,
      }),
    );
    ctx.tx.promotion.update.mockResolvedValue(promotionRow({ id: 7 }));
    return ctx;
  };
  const data = (ctx: ReturnType<typeof setup>) =>
    ctx.tx.promotion.update.mock.calls[0][0].data;

  it('[BE-MUT-685] an empty update keeps every stored rule (numbers converted from decimals) and rewrites products and branches', async () => {
    const ctx = arrange();
    ctx.prisma.branch.count.mockResolvedValue(1);
    await ctx.service.update(7, {}, 5);
    expect(ctx.tx.promotionProduct.deleteMany).toHaveBeenCalledWith({
      where: { promotion_id: 7 },
    });
    expect(ctx.tx.promotionBranch.deleteMany).toHaveBeenCalledWith({
      where: { promotion_id: 7 },
    });
    expect(ctx.tx.promotion.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        name: 'Summer',
        description: 'desc',
        scope: 'SINGLE_PRODUCT',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: start,
        end_date: new Date('2026-06-01T00:00:00Z'),
        is_active: true,
        min_purchase: 20,
        min_quantity: 2,
        usage_limit: 9,
        cap_quantity: 4,
        max_discount_amount: 100,
        cap_discount_amount: 50,
        member_only: true,
        limit_per_customer: true,
        customer_usage_limit: 3,
        customer_usage_daily_reset: true,
        auto_apply: true,
        branch_specific: true,
        brand_id: null,
        products: { createMany: { data: [{ variant_id: 11 }] } },
        branches: { createMany: { data: [{ branch_id: 1 }] } },
      },
      include,
    });
  });

  it('[BE-MUT-686] every supplied field overrides the stored one', async () => {
    const ctx = arrange();
    ctx.prisma.branch.count.mockResolvedValue(1);
    await ctx.service.update(
      7,
      {
        name: 'New',
        description: 'nd',
        scope: 'BUNDLE',
        discount_type: 'fixed_amount',
        discount_value: 3,
        start_date: '2026-05-02T00:00:00.000Z',
        end_date: '2026-07-01T00:00:00.000Z',
        is_active: false,
        min_purchase: 0,
        min_quantity: 1,
        usage_limit: 4,
        cap_quantity: 3,
        max_discount_amount: 60,
        cap_discount_amount: 40,
        member_only: false,
        limit_per_customer: true,
        customer_usage_limit: 5,
        customer_usage_daily_reset: false,
        auto_apply: false,
        branch_specific: true,
        branch_ids: [2],
        variant_ids: [12, 13],
      } as any,
      5,
    );
    expect(data(ctx)).toMatchObject({
      name: 'New',
      description: 'nd',
      scope: 'BUNDLE',
      discount_type: 'fixed_amount',
      discount_value: 3,
      start_date: new Date('2026-05-02T00:00:00.000Z'),
      end_date: new Date('2026-07-01T00:00:00.000Z'),
      is_active: false,
      min_purchase: 0,
      min_quantity: 1,
      usage_limit: 4,
      cap_quantity: 3,
      max_discount_amount: 60,
      cap_discount_amount: 40,
      member_only: false,
      limit_per_customer: true,
      customer_usage_limit: 5,
      customer_usage_daily_reset: false,
      auto_apply: false,
      branch_specific: true,
      products: {
        createMany: { data: [{ variant_id: 12 }, { variant_id: 13 }] },
      },
      branches: { createMany: { data: [{ branch_id: 2 }] } },
    });
  });

  it('[BE-MUT-687] explicit nulls clear optional limits instead of keeping the stored value', async () => {
    const ctx = arrange({
      branch_specific: false,
      branches: [],
      limit_per_customer: false,
      customer_usage_daily_reset: false,
    });
    await ctx.service.update(
      7,
      {
        end_date: null,
        min_purchase: null,
        usage_limit: null,
        cap_quantity: null,
        max_discount_amount: null,
        cap_discount_amount: null,
        customer_usage_limit: null,
      } as any,
      5,
    );
    expect(data(ctx)).toMatchObject({
      end_date: null,
      min_purchase: null,
      usage_limit: null,
      cap_quantity: null,
      max_discount_amount: null,
      cap_discount_amount: null,
    });
  });

  it('[BE-MUT-688] stored nulls stay null; a stored zero minimum purchase stays zero', async () => {
    const ctx = arrange({
      end_date: null,
      min_purchase: null,
      usage_limit: null,
      cap_quantity: null,
      max_discount_amount: null,
      cap_discount_amount: null,
      customer_usage_limit: null,
      limit_per_customer: false,
      customer_usage_daily_reset: false,
      branch_specific: false,
      branches: [],
      min_quantity: null,
    });
    await ctx.service.update(7, {}, 5);
    expect(data(ctx)).toMatchObject({
      end_date: null,
      min_purchase: undefined,
      usage_limit: undefined,
      cap_quantity: undefined,
      max_discount_amount: undefined,
      cap_discount_amount: undefined,
      min_quantity: 1,
    });
    const zero = arrange({
      min_purchase: '0',
      branch_specific: false,
      branches: [],
      limit_per_customer: false,
      customer_usage_daily_reset: false,
      max_discount_amount: null,
      cap_discount_amount: null,
    });
    await zero.service.update(7, {}, 5);
    expect(zero.tx.promotion.update.mock.calls[0][0].data.min_purchase).toBe(0);
  });

  it('[BE-MUT-689] brand changes switch the promotion between brand and product scope; the merged rules are re-validated', async () => {
    const ctx = arrange({
      branch_specific: false,
      branches: [],
      limit_per_customer: false,
      customer_usage_daily_reset: false,
    });
    await ctx.service.update(
      7,
      { scope: 'BRAND', brand_id: 2, variant_ids: [] } as any,
      5,
    );
    expect(data(ctx)).toMatchObject({ scope: 'BRAND', brand_id: 2 });
    expect(data(ctx).products).toBeUndefined();
    const stored = arrange({
      scope: 'BRAND',
      brand_id: 2,
      products: [],
      branch_specific: false,
      branches: [],
      limit_per_customer: false,
      customer_usage_daily_reset: false,
    });
    await stored.service.update(7, { name: 'Renamed' }, 5);
    expect(data(stored)).toMatchObject({
      scope: 'BRAND',
      brand_id: 2,
      name: 'Renamed',
    });
    const invalid = arrange({
      branch_specific: false,
      branches: [],
      limit_per_customer: false,
      customer_usage_daily_reset: false,
    });
    expect(
      (
        await reject(
          invalid.service.update(
            7,
            { end_date: '2026-04-01T00:00:00Z' } as any,
            5,
          ),
        )
      ).message,
    ).toBe('The end date must be after the start date.');
    expect(invalid.tx.promotion.update).not.toHaveBeenCalled();
  });

  it('[BE-MUT-690] a promotion of another shop cannot be updated', async () => {
    const { prisma, service } = setup();
    prisma.promotion.findFirst.mockResolvedValue(null);
    await expect(service.update(7, {} as any, 5)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('PromotionsService.findActive and exhaustion (unit)', () => {
  const arrange = (rows: object[]) => {
    jest.useFakeTimers().setSystemTime(NOW);
    const ctx = setup();
    ctx.prisma.promotion.findMany.mockResolvedValue(rows);
    return ctx;
  };

  it('[BE-MUT-691] only live promotions of the shop are fetched; a branch narrows to unrestricted or matching ones; auto-apply comes first', async () => {
    const ctx = arrange([]);
    await ctx.service.findActive(5);
    expect(ctx.prisma.promotion.findMany).toHaveBeenCalledWith({
      where: {
        consumer_id: 5,
        is_active: true,
        start_date: { lte: NOW },
        OR: [{ end_date: null }, { end_date: { gte: NOW } }],
      },
      include,
      orderBy: [{ auto_apply: 'desc' }, { created_at: 'desc' }],
    });
    await ctx.service.findActive(5, 3);
    expect(ctx.prisma.promotion.findMany.mock.calls[1][0].where.AND).toEqual([
      {
        OR: [
          { branch_specific: false },
          { branches: { some: { branch_id: 3 } } },
        ],
      },
    ]);
  });

  it('[BE-MUT-692] promotions without limits are active as they are; ones that reached their usage or discount limit are switched off and hidden', async () => {
    const ctx = arrange([
      promotionRow({ id: 1 }),
      promotionRow({ id: 2, usage_limit: 2 }),
      promotionRow({ id: 3, max_discount_amount: '50' }),
      promotionRow({ id: 4, usage_limit: 5, max_discount_amount: '500' }),
    ]);
    ctx.prisma.sale.count.mockImplementation(async ({ where }: any) =>
      where.promotion_id === 2 ? 2 : 1,
    );
    ctx.prisma.sale.aggregate.mockImplementation(async ({ where }: any) => ({
      _sum: { promotion_discount: where.promotion_id === 3 ? '50' : '10' },
    }));
    const result = await ctx.service.findActive(5);
    expect(result.map((p: any) => p.id)).toEqual([1, 4]);
    expect(ctx.prisma.promotion.updateMany).toHaveBeenCalledWith({
      where: { consumer_id: 5, id: { in: [2, 3] }, is_active: true },
      data: { is_active: false },
    });
    expect(ctx.prisma.sale.aggregate).toHaveBeenCalledWith({
      where: {
        consumer_id: 5,
        promotion_id: 2,
        sale_type: 'sale',
        payment_status: { not: 'cancelled' },
        deleted_at: null,
      },
      _sum: { promotion_discount: true },
    });
    const none = arrange([promotionRow({ id: 1 })]);
    await none.service.findActive(5);
    expect(none.prisma.promotion.updateMany).not.toHaveBeenCalled();
    const under = arrange([promotionRow({ id: 2, usage_limit: 2 })]);
    under.prisma.sale.count.mockResolvedValue(1);
    expect(await under.service.findActive(5)).toHaveLength(1);
  });

  it('[BE-MUT-693] closePromotionIfExhausted switches off an active promotion at its limits only', async () => {
    const run = async (row: object | null, used = 0, discount = '0') => {
      const ctx = setup();
      ctx.prisma.promotion.findFirst.mockResolvedValue(row);
      ctx.prisma.sale.count.mockResolvedValue(used);
      ctx.prisma.sale.aggregate.mockResolvedValue({
        _sum: { promotion_discount: discount },
      });
      await ctx.service.closePromotionIfExhausted(7, 5);
      return ctx;
    };
    expect((await run(null)).prisma.promotion.update).not.toHaveBeenCalled();
    expect(
      (await run(promotionRow({ usage_limit: 3 }), 3)).prisma.promotion.update,
    ).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { is_active: false },
    });
    expect(
      (await run(promotionRow({ max_discount_amount: '10' }), 0, '10')).prisma
        .promotion.update,
    ).toHaveBeenCalledTimes(1);
    expect(
      (await run(promotionRow({ usage_limit: 3 }), 2)).prisma.promotion.update,
    ).not.toHaveBeenCalled();
    expect(
      (await run(promotionRow({ max_discount_amount: '10' }), 0, '9.99')).prisma
        .promotion.update,
    ).not.toHaveBeenCalled();
    expect(
      (await run(promotionRow({ is_active: false, usage_limit: 1 }), 5)).prisma
        .promotion.update,
    ).not.toHaveBeenCalled();
    expect(
      (await run(promotionRow())).prisma.promotion.update,
    ).not.toHaveBeenCalled();
  });
});

describe('PromotionsService cart evaluation (unit)', () => {
  const item = (
    variant_id: number,
    quantity: number,
    unit_price: number,
    line_total = unit_price * quantity,
  ) => ({
    variant_id,
    quantity,
    unit_price,
    line_total,
  });
  const evaluate = async (
    row: object,
    items: ReturnType<typeof item>[],
    options: {
      branchId?: number;
      customerId?: number;
      used?: number;
      discountUsed?: string;
      customerUsed?: number;
      brandVariants?: object[];
    } = {},
  ) => {
    jest.useFakeTimers().setSystemTime(NOW);
    const ctx = setup();
    ctx.prisma.promotion.findFirst.mockResolvedValue(
      promotionRow({ products: [{ variant_id: 11 }], ...row }),
    );
    ctx.prisma.sale.count.mockImplementation(async ({ where }: any) =>
      where.customer_id ? (options.customerUsed ?? 0) : (options.used ?? 0),
    );
    ctx.prisma.sale.aggregate.mockResolvedValue({
      _sum: { promotion_discount: options.discountUsed ?? '0' },
    });
    ctx.prisma.productVariant.findMany.mockResolvedValue(
      options.brandVariants ?? [],
    );
    const result = await reject(
      ctx.service.assertAndCalculateDiscount(
        7,
        5,
        options.branchId ?? 1,
        options.customerId,
        items,
      ),
    );
    return { ctx, result };
  };
  const reason = async (
    row: object,
    items: ReturnType<typeof item>[],
    options = {},
  ) => (await evaluate(row, items, options)).result.message;

  it('[BE-MUT-694] a missing promotion is a 404; inactive, not started and expired promotions are refused with their reason', async () => {
    const { prisma, service } = setup();
    prisma.promotion.findFirst.mockResolvedValue(null);
    expect(
      (await reject(service.assertAndCalculateDiscount(7, 5, 1, undefined, [])))
        .message,
    ).toBe('Promotion not found');
    expect(prisma.promotion.findFirst).toHaveBeenCalledWith({
      where: { id: 7, consumer_id: 5 },
      include: { products: true, branches: true },
    });
    expect(await reason({ is_active: false }, [item(11, 1, 10)])).toBe(
      'Promotion is inactive',
    );
    expect(
      await reason({ start_date: new Date('2026-05-06T00:00:00Z') }, [
        item(11, 1, 10),
      ]),
    ).toBe('Promotion has not started yet');
    expect(
      await reason({ end_date: new Date('2026-05-04T00:00:00Z') }, [
        item(11, 1, 10),
      ]),
    ).toBe('Promotion has already expired');
    const ok = await evaluate({ end_date: NOW }, [item(11, 1, 10)]);
    expect(ok.result.is_eligible).toBe(true);
  });

  it('[BE-MUT-695] branch-specific promotions apply only in their branches', async () => {
    const row = {
      branch_specific: true,
      branches: [{ branch_id: 1 }, { branch_id: 2 }],
    };
    expect(await reason(row, [item(11, 1, 10)], { branchId: 3 })).toBe(
      'Promotion is not available for selected branch',
    );
    expect(
      (await evaluate(row, [item(11, 1, 10)], { branchId: 2 })).result
        .is_eligible,
    ).toBe(true);
  });

  it('[BE-MUT-696] reaching the usage or discount limit closes the promotion and says which limit was hit', async () => {
    const used = await evaluate({ usage_limit: 3 }, [item(11, 1, 10)], {
      used: 3,
    });
    expect(used.result.message).toBe(
      'Promotion usage limit reached and promo closed',
    );
    expect(used.ctx.prisma.promotion.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { is_active: false },
    });
    const money = await evaluate(
      { max_discount_amount: '20' },
      [item(11, 1, 10)],
      { discountUsed: '20' },
    );
    expect(money.result.message).toBe(
      'Promotion max discount reached and promo closed',
    );
    const under = await evaluate(
      { usage_limit: 3, max_discount_amount: '20' },
      [item(11, 1, 10)],
      {
        used: 2,
        discountUsed: '19.99',
      },
    );
    expect(under.result.is_eligible).toBe(true);
    expect(under.ctx.prisma.promotion.update).not.toHaveBeenCalled();
  });

  it('[BE-MUT-697] member-only promotions need a customer; per-customer limits need one and count their earlier uses, optionally per day', async () => {
    expect(await reason({ member_only: true }, [item(11, 1, 10)])).toBe(
      'This promotion is for registered customers only',
    );
    expect(
      (
        await evaluate({ member_only: true }, [item(11, 1, 10)], {
          customerId: 4,
        })
      ).result.is_eligible,
    ).toBe(true);
    expect(
      await reason({ limit_per_customer: true, customer_usage_limit: 2 }, [
        item(11, 1, 10),
      ]),
    ).toBe('Select a registered customer to apply this promotion');
    expect(
      await reason(
        { limit_per_customer: true, customer_usage_limit: 2 },
        [item(11, 1, 10)],
        { customerId: 4, customerUsed: 2 },
      ),
    ).toBe('Customer usage limit reached for this promotion');
    expect(
      await reason(
        {
          limit_per_customer: true,
          customer_usage_limit: 2,
          customer_usage_daily_reset: true,
        },
        [item(11, 1, 10)],
        { customerId: 4, customerUsed: 5 },
      ),
    ).toBe('Customer daily usage limit reached for this promotion');
    const under = await evaluate(
      {
        limit_per_customer: true,
        customer_usage_limit: 2,
        customer_usage_daily_reset: true,
      },
      [item(11, 1, 10)],
      { customerId: 4, customerUsed: 1 },
    );
    expect(under.result.is_eligible).toBe(true);
    const where = under.ctx.prisma.sale.count.mock.calls.find(
      ([a]: any) => a.where.customer_id,
    )![0].where;
    const startOfDay = new Date(NOW);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(NOW);
    endOfDay.setHours(23, 59, 59, 999);
    expect(where).toEqual({
      consumer_id: 5,
      promotion_id: 7,
      customer_id: 4,
      sale_type: 'sale',
      payment_status: { not: 'cancelled' },
      deleted_at: null,
      sale_date: { gte: startOfDay, lte: endOfDay },
    });
    const total = await evaluate(
      { limit_per_customer: true, customer_usage_limit: 2 },
      [item(11, 1, 10)],
      {
        customerId: 4,
        customerUsed: 1,
      },
    );
    expect(
      total.ctx.prisma.sale.count.mock.calls.find(
        ([a]: any) => a.where.customer_id,
      )![0].where.sale_date,
    ).toBeUndefined();
    const unlimited = await evaluate(
      { limit_per_customer: true, customer_usage_limit: 0 },
      [item(11, 1, 10)],
      {
        customerId: 4,
        customerUsed: 99,
      },
    );
    expect(unlimited.result.is_eligible).toBe(true);
  });

  it('[BE-MUT-698] the cart is summed per variant, using the line total or unit price x quantity, and must reach the minimum purchase', async () => {
    const row = { min_purchase: '30' };
    expect(await reason(row, [item(11, 1, 29.99)])).toBe(
      'Minimum purchase amount condition not met',
    );
    const split = await evaluate(row, [item(11, 1, 15), item(11, 1, 15)]);
    expect(split.result).toMatchObject({
      is_eligible: true,
      discount_base: 30,
      discount_amount: 3,
    });
    const fallback = await evaluate({}, [
      { variant_id: 11, quantity: 3, unit_price: 5, line_total: 0 },
    ]);
    expect(fallback.result).toMatchObject({
      discount_base: 15,
      discount_amount: 1.5,
    });
  });

  it('[BE-MUT-699] a single-product promotion needs its product and the minimum quantity, and discounts that product only', async () => {
    expect(await reason({}, [item(12, 1, 10)])).toBe(
      'Required product is not present in cart',
    );
    expect(await reason({ min_quantity: 3 }, [item(11, 2, 10)])).toBe(
      'Minimum quantity 3 not met',
    );
    const ok = await evaluate({ min_quantity: 3 }, [
      item(11, 3, 10),
      item(12, 1, 99),
    ]);
    expect(ok.result).toEqual({
      is_eligible: true,
      discount_amount: 3,
      discount_base: 30,
      matched_variant_ids: [11],
    });
  });

  it('[BE-MUT-700] the quantity cap, discount cap and remaining discount budget limit the single-product discount', async () => {
    const capped = await evaluate({ cap_quantity: 2 }, [item(11, 5, 10)]);
    expect(capped.result).toMatchObject({
      discount_base: 20,
      discount_amount: 2,
    });
    const cappedAmount = await evaluate({ cap_discount_amount: '1.5' }, [
      item(11, 5, 10),
    ]);
    expect(cappedAmount.result.discount_amount).toBe(1.5);
    const budget = await evaluate(
      { max_discount_amount: '4' },
      [item(11, 5, 10)],
      { discountUsed: '1' },
    );
    expect(budget.result.discount_amount).toBe(3);
    const none = await evaluate(
      { discount_type: 'fixed_amount', discount_value: '0' },
      [item(11, 1, 10)],
    );
    expect(none.result.message).toBe(
      'Promotion max discount reached and promo closed',
    );
    const fixed = await evaluate(
      { discount_type: 'fixed_amount', discount_value: '2' },
      [item(11, 3, 10)],
    );
    expect(fixed.result.discount_amount).toBe(6);
  });

  it('[BE-MUT-701] a promotion without products is not applicable', async () => {
    expect(await reason({ products: [] }, [item(11, 1, 10)])).toBe(
      'Promotion has no products configured',
    );
  });

  it('[BE-MUT-702] a bundle needs every product in the cart and the minimum total quantity, then discounts all of them', async () => {
    const row = {
      scope: 'BUNDLE',
      products: [{ variant_id: 11 }, { variant_id: 12 }],
      min_quantity: 3,
    };
    expect(await reason(row, [item(11, 2, 10)])).toBe(
      'Bundle conditions are not matched in cart',
    );
    expect(await reason(row, [item(11, 1, 10), item(12, 1, 10)])).toBe(
      'Minimum quantity 3 not met',
    );
    const ok = await evaluate(row, [
      item(11, 2, 10),
      item(12, 1, 20),
      item(13, 1, 500),
    ]);
    expect(ok.result).toEqual({
      is_eligible: true,
      discount_amount: 4,
      discount_base: 40,
      matched_variant_ids: [11, 12],
    });
    const capped = await evaluate(
      { ...row, cap_quantity: 3, max_discount_amount: '3' },
      [item(11, 3, 10), item(12, 3, 10)],
    );
    expect(capped.result.discount_amount).toBe(3);
  });

  it('[BE-MUT-703] a brand promotion matches cart variants of the brand (looked up for this shop) and needs the minimum quantity', async () => {
    const row = { scope: 'BRAND', brand_id: 2, products: [], min_quantity: 2 };
    expect(await reason({ ...row, brand_id: null }, [item(11, 1, 10)])).toBe(
      'Promotion brand is not configured correctly',
    );
    expect(
      await reason(row, [item(11, 1, 10)], {
        brandVariants: [{ id: 11, product: { brand_id: 9 } }],
      }),
    ).toBe('No matching brand products found in cart');
    expect(
      await reason(row, [item(11, 1, 10)], {
        brandVariants: [{ id: 11, product: { brand_id: 2 } }],
      }),
    ).toBe('Minimum quantity 2 not met');
    const ok = await evaluate(
      row,
      [item(11, 1, 10), item(12, 1, 30), item(13, 5, 100)],
      {
        brandVariants: [
          { id: 11, product: { brand_id: 2 } },
          { id: 12, product: { brand_id: 2 } },
          { id: 13, product: { brand_id: 3 } },
        ],
      },
    );
    expect(ok.result).toEqual({
      is_eligible: true,
      discount_amount: 4,
      discount_base: 40,
      matched_variant_ids: [11, 12],
    });
    expect(ok.ctx.prisma.productVariant.findMany).toHaveBeenCalledWith({
      where: { id: { in: [11, 12, 13] }, product: { consumer_id: 5 } },
      select: { id: true, product: { select: { brand_id: true } } },
    });
    const none = await evaluate(
      { ...row, discount_type: 'fixed_amount', discount_value: '0' },
      [item(11, 2, 10)],
      {
        brandVariants: [{ id: 11, product: { brand_id: 2 } }],
      },
    );
    expect(none.result.message).toBe(
      'Promotion max discount reached and promo closed',
    );
  });

  it('[BE-MUT-704] a failed evaluation is a 400 with its reason; unexpected errors become a generic 500', async () => {
    const { result } = await evaluate({ is_active: false }, [item(11, 1, 10)]);
    expect(result).toBeInstanceOf(BadRequestException);
    const { prisma, service } = setup();
    prisma.promotion.findFirst.mockRejectedValue(new Error('db'));
    const error = await reject(
      service.assertAndCalculateDiscount(7, 5, 1, undefined, []),
    );
    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect(error.message).toBe('Failed to assert and calculate discount');
  });
});
