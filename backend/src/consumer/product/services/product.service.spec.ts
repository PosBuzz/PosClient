import { NotFoundException } from '@nestjs/common';
import { expectGenericWrapping } from '../../../../test/helpers/error-wrapping';
import { ProductService } from './product.service';

const NOW = new Date('2026-05-05T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function setup() {
  const mk = (...names: string[]) =>
    Object.fromEntries(names.map((n) => [n, jest.fn()]));
  const prisma: any = {
    consumer: mk('findUnique'),
    category: mk('count'),
    brand: mk('count'),
    tag: mk('count'),
    unit: mk('count'),
    branch: mk('count'),
    vendor: mk('count'),
    product: mk('count', 'create', 'findMany', 'findFirst', 'update', 'delete'),
    productVariant: mk('findMany'),
    tagOnProduct: mk('create', 'deleteMany'),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? arg(prisma) : Promise.all(arg as unknown[]),
  );
  const variants: any = mk('create', 'update', 'remove');
  prisma.consumer.findUnique.mockResolvedValue({
    plan: { name: 'Pro', max_products: null },
  });
  prisma.product.count.mockResolvedValue(0);
  for (const model of [
    'category',
    'brand',
    'tag',
    'unit',
    'branch',
    'vendor',
  ]) {
    prisma[model].count.mockImplementation(
      async ({ where }: any) => where.id.in.length,
    );
  }
  prisma.product.create.mockResolvedValue({ id: 50 });
  prisma.productVariant.findMany.mockResolvedValue([{ id: 7 }, { id: 8 }]);
  const service = new ProductService(prisma, variants);
  const findOneSpy = jest
    .spyOn(service, 'findOne')
    .mockResolvedValue({ id: 50 } as any);
  return { prisma, variants, service, findOneSpy };
}

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const variantDto = (extra: object = {}) => ({
  name: 'V',
  regular_price: '10',
  sale_unit_id: 1,
  purchase_unit_id: 2,
  ...extra,
});
const productDto = (extra: object = {}): any => ({
  name: 'Shirt',
  code: 'C1',
  description: 'd',
  category_id: 3,
  brand_id: 4,
  has_variants: false,
  variants: [variantDto()],
  ...extra,
});

describe('ProductService product limit (unit)', () => {
  it('[BE-MUT-560] the limit reports the plan, usage, remaining room and whether it is reached', async () => {
    const { prisma, service } = setup();
    prisma.consumer.findUnique.mockResolvedValue({
      plan: { name: 'Pro', max_products: 10 },
    });
    prisma.product.count.mockResolvedValue(4);
    await expect(service.getProductLimit(5)).resolves.toEqual({
      plan_name: 'Pro',
      max_products: 10,
      used: 4,
      remaining: 6,
      limit_reached: false,
    });
    expect(prisma.consumer.findUnique).toHaveBeenCalledWith({
      where: { id: 5 },
      select: { plan: { select: { name: true, max_products: true } } },
    });
    expect(prisma.product.count).toHaveBeenCalledWith({
      where: { consumer_id: 5 },
    });
  });

  it('[BE-MUT-561] hitting or exceeding the cap reaches the limit with no negative remainder; unlimited plans never do', async () => {
    const { prisma, service } = setup();
    prisma.consumer.findUnique.mockResolvedValue({
      plan: { name: 'Pro', max_products: 10 },
    });
    prisma.product.count.mockResolvedValue(10);
    await expect(service.getProductLimit(5)).resolves.toMatchObject({
      remaining: 0,
      limit_reached: true,
    });
    prisma.product.count.mockResolvedValue(14);
    await expect(service.getProductLimit(5)).resolves.toMatchObject({
      remaining: 0,
      limit_reached: true,
    });
    prisma.consumer.findUnique.mockResolvedValue({
      plan: { name: 'Free', max_products: null },
    });
    await expect(service.getProductLimit(5)).resolves.toEqual({
      plan_name: 'Free',
      max_products: null,
      used: 14,
      remaining: null,
      limit_reached: false,
    });
    prisma.consumer.findUnique.mockResolvedValue(null);
    await expect(service.getProductLimit(5)).resolves.toMatchObject({
      plan_name: null,
      max_products: null,
    });
  });

  it('[BE-MUT-562] a full shop cannot add a product and is told which plan limits it', async () => {
    const { prisma, service } = setup();
    prisma.consumer.findUnique.mockResolvedValue({
      plan: { name: 'Pro', max_products: 2 },
    });
    prisma.product.count.mockResolvedValue(2);
    await expect(service.create(5, 8, productDto())).rejects.toThrow(
      'Product limit reached: your Pro plan allows 2 product(s) and you already have 2. Upgrade your plan to add more products.',
    );
    prisma.consumer.findUnique.mockResolvedValue({
      plan: { name: null, max_products: 2 },
    });
    await expect(service.create(5, 8, productDto())).rejects.toThrow(
      'Product limit reached: your current plan allows',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('ProductService.create (unit)', () => {
  it('[BE-MUT-563] every referenced category, brand, tag, unit, branch and vendor must belong to the shop', async () => {
    const { prisma, service } = setup();
    const full = productDto({
      tag_ids: [11, 11, 12],
      variants: [
        variantDto({
          batches: [
            { branch_id: 21, vendor_id: 31 },
            { branch_id: 21, vendor_id: null },
          ],
        }),
      ],
    });
    await service.create(5, 8, full);
    const scoped = (ids: number[]) => ({
      where: { consumer_id: 5, id: { in: ids } },
    });
    expect(prisma.category.count).toHaveBeenCalledWith(scoped([3]));
    expect(prisma.brand.count).toHaveBeenCalledWith(scoped([4]));
    expect(prisma.tag.count).toHaveBeenCalledWith(scoped([11, 12]));
    expect(prisma.unit.count).toHaveBeenCalledWith(scoped([1, 2]));
    expect(prisma.branch.count).toHaveBeenCalledWith(scoped([21]));
    expect(prisma.vendor.count).toHaveBeenCalledWith(scoped([31]));
  });

  it('[BE-MUT-564] a reference from another shop is a 404 naming the kind, and nothing is created', async () => {
    for (const [model, label, dto] of [
      ['category', 'Category', productDto()],
      ['brand', 'Brand', productDto()],
      ['tag', 'Tag', productDto({ tag_ids: [11] })],
      ['unit', 'Unit', productDto()],
      [
        'branch',
        'Branch',
        productDto({
          variants: [variantDto({ batches: [{ branch_id: 21 }] })],
        }),
      ],
      [
        'vendor',
        'Vendor',
        productDto({
          variants: [variantDto({ batches: [{ vendor_id: 31 }] })],
        }),
      ],
    ] as const) {
      const { prisma, service } = setup();
      prisma[model].count.mockResolvedValue(0);
      await expect(service.create(5, 8, dto)).rejects.toThrow(
        new NotFoundException(`${label} not found`),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
    const { prisma, service } = setup();
    await service.create(
      5,
      8,
      productDto({ category_id: undefined, brand_id: null }),
    );
    expect(prisma.category.count).not.toHaveBeenCalled();
    expect(prisma.brand.count).not.toHaveBeenCalled();
  });

  it('[BE-MUT-565] a product needs a variant; a simple product only one; a simple variant becomes the default', async () => {
    const { prisma, variants, service } = setup();
    await expect(
      service.create(5, 8, productDto({ variants: [] })),
    ).rejects.toThrow('At least one variant is required');
    await expect(
      service.create(5, 8, productDto({ variants: undefined })),
    ).rejects.toThrow('At least one variant is required');
    await expect(
      service.create(
        5,
        8,
        productDto({ variants: [variantDto(), variantDto()] }),
      ),
    ).rejects.toThrow('Simple products can only have one variant');
    const simple = productDto();
    await service.create(5, 8, simple);
    expect(variants.create.mock.calls[0][2].is_default).toBe(true);
    variants.create.mockClear();
    const multi = productDto({
      has_variants: true,
      variants: [variantDto(), variantDto({ name: 'W' })],
    });
    await service.create(5, 8, multi);
    expect(variants.create).toHaveBeenCalledTimes(2);
    expect(variants.create.mock.calls[0][2].is_default).toBeUndefined();
    expect(prisma.product.create).toHaveBeenCalledTimes(2);
  });

  it('[BE-MUT-566] the same batch number must keep the same expiry date inside a variant, naming the rows', async () => {
    const { service } = setup();
    const bad = productDto({
      variants: [
        variantDto({
          batches: [
            { batch_number: ' b-1 ', expiry_date: '2027-01-01' },
            { batch_number: 'other', expiry_date: '2027-05-05' },
            { batch_number: 'B-1', expiry_date: '2027-02-01' },
          ],
        }),
      ],
    });
    await expect(service.create(5, 8, bad)).rejects.toThrow(
      'Variant 1: batch number "B-1" has different expiry dates in row 1 and row 3. Same batch number must use the same expiry date.',
    );
    const ok = productDto({
      variants: [
        variantDto({
          batches: [
            { batch_number: 'b-1', expiry_date: '2027-01-01T05:00:00Z' },
            { batch_number: 'B-1', expiry_date: '2027-01-01' },
            { batch_number: '', expiry_date: '2020-01-01' },
            { expiry_date: '2021-01-01' },
            { batch_number: 'N-1' },
            { batch_number: 'n-1', expiry_date: 'not a date' },
          ],
        }),
      ],
    });
    await expect(service.create(5, 8, ok)).resolves.toBeDefined();
    const noExpiryVsDate = productDto({
      has_variants: true,
      variants: [
        variantDto(),
        variantDto({
          batches: [
            { batch_number: 'A' },
            { batch_number: 'a', expiry_date: '2027-01-01' },
          ],
        }),
      ],
    });
    await expect(service.create(5, 8, noExpiryVsDate)).rejects.toThrow(
      'Variant 2: batch number "a" has different expiry dates in row 1 and row 2',
    );
  });

  it('[BE-MUT-567] the product row carries the tenant, tax defaults and every field; tags and variants are created in the transaction', async () => {
    const { prisma, variants, service, findOneSpy } = setup();
    findOneSpy.mockResolvedValue({ id: 50, loaded: true } as any);
    await expect(
      service.create(5, 8, productDto({ tag_ids: [11, 12] })),
    ).resolves.toEqual({ id: 50, loaded: true });
    expect(prisma.product.create).toHaveBeenCalledWith({
      data: {
        consumer_id: 5,
        name: 'Shirt',
        code: 'C1',
        description: 'd',
        category_id: 3,
        brand_id: 4,
        has_variants: false,
        tax_method: 'EXCLUSIVE',
        tax: 0,
      },
    });
    expect(prisma.tagOnProduct.create.mock.calls.map(([a]: any) => a)).toEqual([
      { data: { product_id: 50, tag_id: 11 } },
      { data: { product_id: 50, tag_id: 12 } },
    ]);
    expect(variants.create).toHaveBeenCalledWith(
      50,
      8,
      expect.objectContaining({ name: 'V' }),
      prisma,
      false,
    );
    expect(findOneSpy).toHaveBeenCalledWith(50, 5);
    await service.create(
      5,
      8,
      productDto({ tax_method: 'INCLUSIVE', tax: 7, tag_ids: [] }),
    );
    expect(prisma.product.create.mock.calls[1][0].data).toMatchObject({
      tax_method: 'INCLUSIVE',
      tax: 7,
    });
    expect(prisma.tagOnProduct.create).toHaveBeenCalledTimes(2);
  });

  it('[BE-MUT-568] unexpected create failures are logged and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setup();
        prisma.$transaction.mockRejectedValue(f);
        return service.create(5, 8, productDto());
      },
      message: 'Failed to create product',
      logged: ['Error creating product for consumer 5'],
    });
  });
});

describe('ProductService.findAll (unit)', () => {
  const run = async (options?: object) => {
    const ctx = setup();
    ctx.prisma.product.findMany.mockResolvedValue([{ id: 1 }]);
    ctx.prisma.product.count.mockResolvedValue(25);
    const result = await ctx.service.findAll(5, options);
    return {
      ...ctx,
      result,
      call: ctx.prisma.product.findMany.mock.calls[0][0],
    };
  };

  it('[BE-MUT-569] the default listing is page 1 of 10, newest first, scoped to the shop, with page metadata', async () => {
    const { result, call, prisma } = await run();
    expect(result).toEqual({
      data: [{ id: 1 }],
      meta: { total: 25, page: 1, limit: 10, totalPages: 3 },
    });
    expect(call.where).toEqual({ consumer_id: 5 });
    expect(call).toMatchObject({
      skip: 0,
      take: 10,
      orderBy: { created_at: 'desc' },
    });
    expect(prisma.product.count).toHaveBeenCalledWith({
      where: { consumer_id: 5 },
    });
  });

  it('[BE-MUT-570] paging and every filter reach the query; search matches product and variant fields case-insensitively', async () => {
    const { call } = await run({
      page: 3,
      limit: 5,
      search: 'abc',
      categoryIds: [1, 2],
      brandIds: [3],
      tagIds: [4],
    });
    const contains = { contains: 'abc', mode: 'insensitive' };
    expect(call.where).toEqual({
      consumer_id: 5,
      OR: [
        { name: contains },
        { code: contains },
        { description: contains },
        {
          variants: {
            some: {
              OR: [
                { name: contains },
                { sku: contains },
                { barcode: contains },
              ],
            },
          },
        },
      ],
      category_id: { in: [1, 2] },
      brand_id: { in: [3] },
      tags: { some: { tag_id: { in: [4] } } },
    });
    expect(call).toMatchObject({ skip: 10, take: 5 });
    const empty = await run({ categoryIds: [], brandIds: [], tagIds: [] });
    expect(empty.call.where).toEqual({ consumer_id: 5 });
  });

  it('[BE-MUT-571] the list loads names of category, brand, tags and units plus stock, serial and price summaries', async () => {
    const { call } = await run();
    expect(call.include).toEqual({
      category: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true, logo: true } },
      tags: { include: { tag: { select: { id: true, name: true } } } },
      variants: {
        include: {
          sale_unit: { select: { id: true, name: true } },
          purchase_unit: { select: { id: true, name: true } },
          inventory_items: {
            select: {
              quantity: true,
              branch: { select: { id: true, name: true } },
            },
          },
          serials: { select: { id: true, status: true } },
          price_history: {
            take: 1,
            orderBy: { effective_date: 'desc' },
            select: { regular_price: true, wholesale_price: true },
          },
        },
        orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
      },
    });
  });

  it('[BE-MUT-572] listing failures are logged and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setup();
        prisma.product.findMany.mockRejectedValue(f);
        prisma.product.count.mockResolvedValue(0);
        return service.findAll(5);
      },
      message: 'Failed to fetch products',
      logged: ['Error fetching products for consumer 5'],
    });
  });
});

const idName = { select: { id: true, name: true } };

function findOneInclude() {
  return {
    category: idName,
    brand: { select: { id: true, name: true, logo: true } },
    consumer: { select: { id: true, company_name: true, subdomain: true } },
    tags: { include: { tag: idName } },
    variants: {
      include: {
        sale_unit: idName,
        purchase_unit: idName,
        VariantAttribute: { select: { id: true, name: true, value: true } },
        serials: {
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            serial_number: true,
            status: true,
            sold_date: true,
            notes: true,
            created_at: true,
            updated_at: true,
            batch: {
              select: { id: true, batch_number: true, expiry_date: true },
            },
          },
        },
        inventory_items: {
          include: {
            branch: {
              select: { id: true, name: true, is_main: true, address: true },
            },
            vendor: {
              select: {
                id: true,
                name: true,
                contact: true,
                phone: true,
                email: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
        },
        price_history: {
          include: {
            created_by_user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { effective_date: 'desc' },
          take: 10,
        },
        promotions: {
          where: {
            promotion: {
              is_active: true,
              start_date: { lte: NOW },
              OR: [{ end_date: null }, { end_date: { gte: NOW } }],
            },
          },
          include: {
            promotion: {
              select: {
                id: true,
                name: true,
                description: true,
                discount_type: true,
                discount_value: true,
                start_date: true,
                end_date: true,
                min_purchase: true,
                branch_specific: true,
                branches: {
                  include: { branch: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
    },
  };
}

const variantRow = (extra: object = {}): any => ({
  id: 1,
  regular_price: '100',
  alert_quantity: 0,
  inventory_items: [],
  serials: [],
  price_history: [],
  promotions: [],
  ...extra,
});

describe('ProductService.findOne (unit)', () => {
  const arrange = (variants: object[]) => {
    jest.useFakeTimers().setSystemTime(NOW);
    const ctx = setup();
    (ctx.service.findOne as unknown as jest.SpyInstance).mockRestore();
    ctx.prisma.product.findFirst.mockResolvedValue({ id: 50, variants });
    return ctx;
  };

  it('[BE-MUT-573] findOne is tenant scoped and loads the full product shape; a miss is a 404 naming the id', async () => {
    const { prisma, service } = arrange([variantRow()]);
    await service.findOne(50, 5);
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: 50, consumer_id: 5 },
      include: findOneInclude(),
    });
    prisma.product.findFirst.mockResolvedValue(null);
    await expect(service.findOne(50, 5)).rejects.toThrow(
      new NotFoundException('Product with ID 50 not found'),
    );
  });

  it('[BE-MUT-574] per-variant stock is totalled and split by branch, with central inventory for batches without a branch', async () => {
    const { service } = arrange([
      variantRow({
        inventory_items: [
          { quantity: 3, branch: { name: 'Main' } },
          { quantity: 4, branch: { name: 'Main' } },
          { quantity: 5, branch: null },
          { quantity: 1, branch: { name: 'Shop' } },
        ],
      }),
    ]);
    const result: any = await service.findOne(50, 5);
    expect(result.variants[0]).toMatchObject({
      total_stock: 13,
      stock_by_branch: { Main: 7, 'Central Inventory': 5, Shop: 1 },
    });
    expect(result.metrics.total_stock_all_variants).toBe(13);
  });

  it('[BE-MUT-575] serial counts are summarised by status', async () => {
    const { service } = arrange([
      variantRow({
        serials: [
          { status: 'available' },
          { status: 'available' },
          { status: 'sold' },
          { status: 'defective' },
          { status: 'returned' },
          { status: 'returned' },
        ],
      }),
      variantRow({ id: 2 }),
    ]);
    const result: any = await service.findOne(50, 5);
    expect(result.variants[0]).toMatchObject({
      serials_summary: { available: 2, sold: 1, defective: 1, returned: 2 },
      available_serials_count: 2,
      sold_serials_count: 1,
      defective_serials_count: 1,
      returned_serials_count: 2,
    });
    expect(result.variants[1]).toMatchObject({
      available_serials_count: 0,
      sold_serials_count: 0,
      defective_serials_count: 0,
      returned_serials_count: 0,
    });
    expect(result.metrics).toMatchObject({
      total_serials_all_variants: 6,
      available_serials_all_variants: 2,
    });
  });

  it('[BE-MUT-576] low stock needs an alert level and stock at or below it', async () => {
    const { service } = arrange([
      variantRow({
        id: 1,
        alert_quantity: 5,
        inventory_items: [{ quantity: 5 }],
      }),
      variantRow({
        id: 2,
        alert_quantity: 5,
        inventory_items: [{ quantity: 6 }],
      }),
      variantRow({ id: 3, alert_quantity: 0, inventory_items: [] }),
      variantRow({ id: 4, alert_quantity: null, inventory_items: [] }),
    ]);
    const result: any = await service.findOne(50, 5);
    expect(result.variants.map((v: any) => v.is_low_stock)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(result.metrics.variants_with_low_stock).toBe(1);
  });

  it('[BE-MUT-577] the price change percentage compares the two latest regular prices; absent with fewer than two', async () => {
    const { service } = arrange([
      variantRow({
        price_history: [{ regular_price: '120' }, { regular_price: '100' }],
      }),
      variantRow({ id: 2, price_history: [{ regular_price: '120' }] }),
      variantRow({
        id: 3,
        price_history: [{ regular_price: '80' }, { regular_price: '100' }],
      }),
    ]);
    const result: any = await service.findOne(50, 5);
    expect(result.variants.map((v: any) => v.price_change_percentage)).toEqual([
      20,
      null,
      -20,
    ]);
  });

  it('[BE-MUT-578] inventory expiring within 30 days (exclusive of already expired) is listed with branch names', async () => {
    const { service } = arrange([
      variantRow({
        inventory_items: [
          {
            batch_number: 'A',
            quantity: 1,
            expiry_date: new Date(NOW.getTime() + 30 * DAY),
            branch: { name: 'Main' },
          },
          {
            batch_number: 'B',
            quantity: 2,
            expiry_date: new Date(NOW.getTime() + 30 * DAY + 1),
            branch: { name: 'Main' },
          },
          {
            batch_number: 'C',
            quantity: 3,
            expiry_date: new Date(NOW.getTime()),
            branch: { name: 'Main' },
          },
          {
            batch_number: 'D',
            quantity: 4,
            expiry_date: new Date(NOW.getTime() - DAY),
            branch: { name: 'Main' },
          },
          { batch_number: 'E', quantity: 5, expiry_date: null, branch: null },
          {
            batch_number: 'F',
            quantity: 6,
            expiry_date: new Date(NOW.getTime() + 1000),
            branch: null,
          },
        ],
      }),
      variantRow({ id: 2 }),
    ]);
    const result: any = await service.findOne(50, 5);
    expect(result.variants[0]).toMatchObject({
      has_expiring_inventory: true,
      expiring_inventory_count: 2,
      expiring_inventory: [
        {
          batch_number: 'A',
          quantity: 1,
          expiry_date: new Date(NOW.getTime() + 30 * DAY),
          branch_name: 'Main',
        },
        {
          batch_number: 'F',
          quantity: 6,
          expiry_date: new Date(NOW.getTime() + 1000),
          branch_name: 'Central Inventory',
        },
      ],
    });
    expect(result.variants[1]).toMatchObject({
      has_expiring_inventory: false,
      expiring_inventory_count: 0,
      expiring_inventory: [],
    });
    expect(result.metrics.variants_with_expiring_inventory).toBe(1);
  });

  it('[BE-MUT-579] product metrics: variant count, active promotions and the regular price range', async () => {
    const { service } = arrange([
      variantRow({ id: 1, regular_price: '50.5', promotions: [{ id: 1 }] }),
      variantRow({ id: 2, regular_price: '200' }),
      variantRow({ id: 3, regular_price: '10' }),
    ]);
    const result: any = await service.findOne(50, 5);
    expect(result.metrics).toMatchObject({
      total_variants: 3,
      has_active_promotions: true,
      price_range: { min_regular_price: 10, max_regular_price: 200 },
    });
    const none = arrange([variantRow()]);
    const plain: any = await none.service.findOne(50, 5);
    expect(plain.metrics.has_active_promotions).toBe(false);
  });

  it('[BE-MUT-580] read failures are logged and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setup();
        (service.findOne as unknown as jest.SpyInstance).mockRestore();
        prisma.product.findFirst.mockRejectedValue(f);
        return service.findOne(50, 5);
      },
      message: 'Failed to find product',
      logged: ['Error finding product with ID 50 for consumer 5'],
      notFoundPassesThrough: true,
    });
  });
});

describe('ProductService.update/remove (unit)', () => {
  const arrange = () => {
    const ctx = setup();
    ctx.prisma.product.update.mockResolvedValue({});
    return ctx;
  };

  it('[BE-MUT-581] update checks the product and references, writes every product field and returns the reloaded product', async () => {
    const { prisma, service, findOneSpy } = arrange();
    await expect(
      service.update(
        50,
        {
          name: 'N',
          code: 'C',
          description: 'd',
          category_id: 3,
          brand_id: 4,
          has_variants: true,
          tax_method: 'INCLUSIVE',
          tax: 5,
        } as any,
        5,
        8,
      ),
    ).resolves.toEqual({ id: 50 });
    expect(findOneSpy).toHaveBeenNthCalledWith(1, 50, 5);
    expect(findOneSpy).toHaveBeenNthCalledWith(2, 50, 5);
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: {
        name: 'N',
        code: 'C',
        description: 'd',
        category_id: 3,
        brand_id: 4,
        has_variants: true,
        tax_method: 'INCLUSIVE',
        tax: 5,
      },
    });
    expect(prisma.category.count).toHaveBeenCalledWith({
      where: { consumer_id: 5, id: { in: [3] } },
    });
    expect(prisma.productVariant.findMany).toHaveBeenCalledWith({
      where: { product_id: 50 },
      select: { id: true },
    });
  });

  it('[BE-MUT-582] touching a variant of another product (edit or delete) is a 404 naming it, before any write', async () => {
    const { prisma, service } = arrange();
    await expect(
      service.update(50, { variants: [{ id: 99, name: 'x' }] } as any, 5, 8),
    ).rejects.toThrow(
      new NotFoundException('Product variant with ID 99 not found'),
    );
    await expect(
      service.update(50, { variant_ids_to_delete: [7, 77] } as any, 5, 8),
    ).rejects.toThrow('Product variant with ID 77 not found');
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('[BE-MUT-583] tags are replaced when sent; an empty list only clears them; omitted leaves them alone', async () => {
    const replace = arrange();
    await replace.service.update(50, { tag_ids: [11, 12] } as any, 5, 8);
    expect(replace.prisma.tagOnProduct.deleteMany).toHaveBeenCalledWith({
      where: { product_id: 50 },
    });
    expect(
      replace.prisma.tagOnProduct.create.mock.calls.map(([a]: any) => a),
    ).toEqual([
      { data: { product_id: 50, tag_id: 11 } },
      { data: { product_id: 50, tag_id: 12 } },
    ]);
    const clear = arrange();
    await clear.service.update(50, { tag_ids: [] } as any, 5, 8);
    expect(clear.prisma.tagOnProduct.deleteMany).toHaveBeenCalledTimes(1);
    expect(clear.prisma.tagOnProduct.create).not.toHaveBeenCalled();
    const omit = arrange();
    await omit.service.update(50, {} as any, 5, 8);
    expect(omit.prisma.tagOnProduct.deleteMany).not.toHaveBeenCalled();
  });

  it('[BE-MUT-584] existing variants are updated (preserving inventory in edit mode); new ones are created and need their required fields', async () => {
    const { variants, service } = arrange();
    await service.update(50, { variants: [{ id: 7, name: 'A' }] } as any, 5, 8);
    expect(variants.update).toHaveBeenCalledWith(7, { id: 7, name: 'A' });
    await service.update(
      50,
      { is_edit_mode: true, variants: [{ id: 8, name: 'B' }] } as any,
      5,
      8,
    );
    expect(variants.update).toHaveBeenLastCalledWith(8, {
      id: 8,
      name: 'B',
      preserve_inventory: true,
    });
    const fresh = variantDto();
    await service.update(50, { variants: [fresh] } as any, 5, 8);
    expect(variants.create).toHaveBeenCalledWith(50, 8, fresh);
    for (const missing of [
      'name',
      'regular_price',
      'sale_unit_id',
      'purchase_unit_id',
    ]) {
      const incomplete: any = variantDto();
      delete incomplete[missing];
      await expect(
        service.update(50, { variants: [incomplete] } as any, 5, 8),
      ).rejects.toThrow('New variants require all required fields');
    }
    variants.update.mockClear();
    await service.update(50, { variants: [] } as any, 5, 8);
    expect(variants.update).not.toHaveBeenCalled();
  });

  it('[BE-MUT-585] requested variants are deleted through the variant service', async () => {
    const { variants, service } = arrange();
    await service.update(50, { variant_ids_to_delete: [7, 8] } as any, 5, 8);
    expect(variants.remove.mock.calls).toEqual([[7], [8]]);
    variants.remove.mockClear();
    await service.update(50, { variant_ids_to_delete: [] } as any, 5, 8);
    expect(variants.remove).not.toHaveBeenCalled();
  });

  it('[BE-MUT-586] remove checks ownership, deletes only that product and reports success', async () => {
    const { prisma, service, findOneSpy } = arrange();
    prisma.product.delete.mockResolvedValue({});
    await expect(service.remove(50, 5)).resolves.toEqual({
      success: true,
      message: 'Product deleted successfully',
    });
    expect(findOneSpy).toHaveBeenCalledWith(50, 5);
    expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 50 } });
  });

  it('[BE-MUT-587] unexpected update and delete failures are logged with ids and hidden behind generic 500s', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = arrange();
        prisma.product.update.mockRejectedValue(f);
        return service.update(50, {} as any, 5, 8);
      },
      message: 'Failed to update product',
      logged: ['Error updating product with ID 50 for consumer 5'],
    });
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = arrange();
        prisma.product.delete.mockRejectedValue(f);
        return service.remove(50, 5);
      },
      message: 'Failed to delete product',
      logged: ['Error deleting product with ID 50 for consumer 5'],
    });
  });
});
