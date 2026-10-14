import { ForbiddenException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { expectGenericWrapping } from '../../../../test/helpers/error-wrapping';
import { businessTimeZone } from '../../../common/utils/business-time.util';
import { DashboardService } from './dashboard.service';

// Local-time constructors, as the service uses, so the expectations hold in every TZ of the matrix.
const local = (y: number, m: number, d: number, h = 0, mi = 0, s = 0, ms = 0) =>
  new Date(y, m, d, h, mi, s, ms);

function setup() {
  const mk = (...names: string[]) =>
    Object.fromEntries(names.map((n) => [n, jest.fn()]));
  const prisma: any = {
    sale: mk('aggregate'),
    return: mk('aggregate'),
    salePayment: mk('groupBy'),
    returnPayment: mk('groupBy'),
    saleItem: mk('groupBy'),
    inventoryBatch: mk('findMany', 'count'),
    productVariant: mk('findMany'),
    $queryRaw: jest.fn(),
  };
  const inventory: any = { getLowStockItems: jest.fn() };
  const agg = { _count: { id: 0 }, _sum: {} };
  prisma.sale.aggregate.mockResolvedValue(agg);
  prisma.return.aggregate.mockResolvedValue(agg);
  prisma.$queryRaw.mockResolvedValue([]);
  prisma.salePayment.groupBy.mockResolvedValue([]);
  prisma.returnPayment.groupBy.mockResolvedValue([]);
  prisma.saleItem.groupBy.mockResolvedValue([]);
  prisma.inventoryBatch.findMany.mockResolvedValue([]);
  prisma.inventoryBatch.count.mockResolvedValue(0);
  prisma.productVariant.findMany.mockResolvedValue([]);
  inventory.getLowStockItems.mockResolvedValue([]);
  return {
    prisma,
    inventory,
    service: new DashboardService(prisma, inventory),
  };
}

// Wednesday: the Saturday-Friday week started on Saturday 2 May
const WED = local(2026, 4, 6, 15, 30);
const WEEK_START = local(2026, 4, 2);
const WEEK_END = local(2026, 4, 8, 23, 59, 59, 999);
const TODAY_START = local(2026, 4, 6);
const TODAY_END = local(2026, 4, 6, 23, 59, 59, 999);
const MONTH_START = local(2026, 4, 1);
const MONTH_END = local(2026, 4, 31, 23, 59, 59, 999);

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('DashboardService.getAnalytics queries (unit)', () => {
  const run = async (query: object = {}, now = WED) => {
    jest.useFakeTimers().setSystemTime(now);
    const ctx = setup();
    const result = await ctx.service.getAnalytics(5, query);
    return { ...ctx, result };
  };

  it('[BE-MUT-710] sales and returns are aggregated for the Saturday-Friday week and for today, scoped to live sales of the shop', async () => {
    const { prisma } = await run();
    const base = {
      consumer_id: 5,
      sale_type: 'sale',
      payment_status: { not: 'cancelled' },
      deleted_at: null,
    };
    const saleAgg = (where: object) => ({
      where,
      _count: { id: true },
      _sum: { total_amount: true, received_amount: true },
    });
    expect(prisma.sale.aggregate).toHaveBeenNthCalledWith(
      1,
      saleAgg({ ...base, sale_date: { gte: WEEK_START, lte: WEEK_END } }),
    );
    expect(prisma.sale.aggregate).toHaveBeenNthCalledWith(
      2,
      saleAgg({ ...base, sale_date: { gte: TODAY_START, lte: TODAY_END } }),
    );
    const returnAgg = (range: object) => ({
      where: { consumer_id: 5, return_date: range },
      _count: { id: true },
      _sum: { total_refund: true, total_exchange: true },
    });
    expect(prisma.return.aggregate).toHaveBeenNthCalledWith(
      1,
      returnAgg({ gte: WEEK_START, lte: WEEK_END }),
    );
    expect(prisma.return.aggregate).toHaveBeenNthCalledWith(
      2,
      returnAgg({ gte: TODAY_START, lte: TODAY_END }),
    );
  });

  it('[BE-MUT-711] the week starts on the most recent Saturday: on Saturday itself, on Sunday and on Friday', async () => {
    for (const [now, start, end] of [
      [
        local(2026, 4, 9, 12),
        local(2026, 4, 9),
        local(2026, 4, 15, 23, 59, 59, 999),
      ],
      [
        local(2026, 4, 10, 12),
        local(2026, 4, 9),
        local(2026, 4, 15, 23, 59, 59, 999),
      ],
      [
        local(2026, 4, 8, 12),
        local(2026, 4, 2),
        local(2026, 4, 8, 23, 59, 59, 999),
      ],
    ] as const) {
      const { prisma } = await run({}, now);
      expect(prisma.sale.aggregate.mock.calls[0][0].where.sale_date).toEqual({
        gte: start,
        lte: end,
      });
    }
  });

  it('[BE-MUT-712] a branch filter reaches every query, including the raw SQL ones', async () => {
    const { prisma, inventory } = await run({ branch_id: 4 });
    expect(prisma.sale.aggregate.mock.calls[0][0].where.branch_id).toBe(4);
    expect(prisma.return.aggregate.mock.calls[0][0].where.branch_id).toBe(4);
    expect(
      prisma.salePayment.groupBy.mock.calls[0][0].where.sale.branch_id,
    ).toBe(4);
    expect(
      prisma.returnPayment.groupBy.mock.calls[0][0].where.return_record
        .branch_id,
    ).toBe(4);
    expect(prisma.saleItem.groupBy.mock.calls[0][0].where.sale.branch_id).toBe(
      4,
    );
    expect(
      prisma.inventoryBatch.findMany.mock.calls[0][0].where.branch_id,
    ).toBe(4);
    expect(inventory.getLowStockItems).toHaveBeenCalledWith(5, 4);
    const sqlFragments = prisma.$queryRaw.mock.calls.map(
      ([, ...values]: any[]) =>
        values.find(
          (v: unknown) => typeof v === 'object' && v !== null && 'sql' in v,
        ),
    );
    expect(sqlFragments[0].sql).toContain('branch_id = ');
    expect(sqlFragments[0].values).toContain(4);
    expect(sqlFragments[1].sql).toContain('branch_id = ');
    expect(sqlFragments[1].values).toContain(4);
  });

  it('[BE-MUT-713] without a branch no branch condition is added anywhere', async () => {
    const { prisma, inventory } = await run();
    expect(prisma.sale.aggregate.mock.calls[0][0].where).not.toHaveProperty(
      'branch_id',
    );
    expect(
      prisma.inventoryBatch.findMany.mock.calls[0][0].where,
    ).not.toHaveProperty('branch_id');
    expect(inventory.getLowStockItems).toHaveBeenCalledWith(5, undefined);
    for (const [, ...values] of prisma.$queryRaw.mock.calls) {
      const fragment = values.find(
        (v: unknown) => typeof v === 'object' && v !== null && 'sql' in v,
      ) as Prisma.Sql;
      expect(fragment.sql).not.toContain('branch_id');
    }
  });

  it('[BE-MUT-714] the grouped-by-day SQL is week scoped, live-sales only, and uses the business time zone', async () => {
    const { prisma } = await run();
    const [returnsCall, salesCall] = prisma.$queryRaw.mock.calls;
    const flat = (call: any[]) => (call[0] as string[]).join('?');
    expect(flat(returnsCall)).toContain('FROM "returns"');
    expect(flat(returnsCall)).toContain(
      "(return_date AT TIME ZONE 'UTC') AT TIME ZONE",
    );
    expect(flat(salesCall)).toContain('FROM "sales"');
    expect(flat(salesCall)).toContain(
      'COALESCE(SUM(total_amount), 0) AS total_amount',
    );
    expect(returnsCall[1]).toBe(businessTimeZone());
    expect(salesCall[1]).toBe(businessTimeZone());
    const salesWhere = salesCall[2] as Prisma.Sql;
    expect(salesWhere.sql).toBe(
      "consumer_id = ? AND sale_type = 'sale' AND payment_status <> 'cancelled' AND deleted_at IS NULL AND sale_date BETWEEN ? AND ?",
    );
    expect(salesWhere.values).toEqual([5, WEEK_START, WEEK_END]);
    const returnsWhere = returnsCall[2] as Prisma.Sql;
    expect(returnsWhere.sql).toBe(
      'consumer_id = ? AND return_date BETWEEN ? AND ?',
    );
    expect(returnsWhere.values).toEqual([5, WEEK_START, WEEK_END]);
  });

  it('[BE-MUT-715] payment breakdowns follow their own period: daily by default, weekly, or monthly', async () => {
    const { prisma } = await run();
    expect(
      prisma.salePayment.groupBy.mock.calls[0][0].where.created_at,
    ).toEqual({
      gte: TODAY_START,
      lte: TODAY_END,
    });
    expect(
      prisma.returnPayment.groupBy.mock.calls[0][0].where.created_at,
    ).toEqual({
      gte: TODAY_START,
      lte: TODAY_END,
    });
    const weekly = await run({
      payment_period: 'weekly',
      return_payment_period: 'monthly',
      top_products_period: 'monthly',
    });
    expect(
      weekly.prisma.salePayment.groupBy.mock.calls[0][0].where.created_at,
    ).toEqual({
      gte: WEEK_START,
      lte: WEEK_END,
    });
    expect(
      weekly.prisma.returnPayment.groupBy.mock.calls[0][0].where.created_at,
    ).toEqual({
      gte: MONTH_START,
      lte: MONTH_END,
    });
    expect(
      weekly.prisma.saleItem.groupBy.mock.calls[0][0].where.sale.sale_date,
    ).toEqual({
      gte: MONTH_START,
      lte: MONTH_END,
    });
  });

  it('[BE-MUT-716] the payment and top-product queries have their pinned shapes', async () => {
    const { prisma } = await run();
    expect(prisma.salePayment.groupBy).toHaveBeenCalledWith({
      by: ['payment_method'],
      where: {
        created_at: { gte: TODAY_START, lte: TODAY_END },
        sale: {
          consumer_id: 5,
          sale_type: 'sale',
          payment_status: { not: 'cancelled' },
          deleted_at: null,
        },
      },
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: { _sum: { amount: 'desc' } },
    });
    expect(prisma.returnPayment.groupBy).toHaveBeenCalledWith({
      by: ['payment_method'],
      where: {
        created_at: { gte: TODAY_START, lte: TODAY_END },
        return_record: { consumer_id: 5 },
      },
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: { _sum: { amount: 'desc' } },
    });
    expect(prisma.saleItem.groupBy).toHaveBeenCalledWith({
      by: ['variant_id'],
      where: {
        sale: {
          consumer_id: 5,
          sale_type: 'sale',
          payment_status: { not: 'cancelled' },
          deleted_at: null,
          sale_date: { gte: TODAY_START, lte: TODAY_END },
        },
      },
      _sum: { quantity: true, line_total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });
  });

  it('[BE-MUT-717] expiring stock is the next 30 days from the end of today, with stock, scoped to the shop; five rows shown, all counted', async () => {
    const { prisma } = await run();
    const where = {
      variant: { product: { consumer_id: 5 } },
      expiry_date: {
        gte: TODAY_START,
        lte: local(2026, 5, 5, 23, 59, 59, 999),
      },
      quantity: { gt: 0 },
    };
    expect(prisma.inventoryBatch.findMany).toHaveBeenCalledWith({
      where,
      select: {
        id: true,
        batch_number: true,
        quantity: true,
        expiry_date: true,
        variant: {
          select: { name: true, product: { select: { name: true } } },
        },
        branch: { select: { name: true } },
      },
      orderBy: { expiry_date: 'asc' },
      take: 5,
    });
    expect(prisma.inventoryBatch.count).toHaveBeenCalledWith({ where });
  });
});

describe('DashboardService.getAnalytics response (unit)', () => {
  const run = async (arrange: (ctx: ReturnType<typeof setup>) => void) => {
    jest.useFakeTimers().setSystemTime(WED);
    const ctx = setup();
    arrange(ctx);
    return { ...ctx, result: await ctx.service.getAnalytics(5, {}) };
  };

  it('[BE-MUT-718] the summary reports gross, collected, due, returns, exchanges and net for the week and today', async () => {
    const { result } = await run(({ prisma }) => {
      prisma.sale.aggregate
        .mockResolvedValueOnce({
          _count: { id: 7 },
          _sum: { total_amount: '1000', received_amount: '700' },
        })
        .mockResolvedValueOnce({
          _count: { id: 2 },
          _sum: { total_amount: '300', received_amount: '350' },
        });
      prisma.return.aggregate
        .mockResolvedValueOnce({
          _count: { id: 3 },
          _sum: { total_refund: '120', total_exchange: '30' },
        })
        .mockResolvedValueOnce({
          _count: { id: 1 },
          _sum: { total_refund: '20', total_exchange: '5' },
        });
    });
    expect(result.summary).toEqual({
      weekly_total_sale: 1000,
      weekly_collected: 700,
      weekly_due: 300,
      weekly_transactions: 7,
      weekly_returns_total: 150,
      weekly_refunds_total: 120,
      weekly_exchanges_total: 30,
      weekly_returns_count: 3,
      weekly_net_sale: 880,
      today_total_sale: 300,
      today_collected: 350,
      today_due: 0,
      today_transactions: 2,
      today_returns_total: 25,
      today_refunds_total: 20,
      today_exchanges_total: 5,
      today_returns_count: 1,
      today_net_sale: 280,
    });
  });

  it('[BE-MUT-719] empty periods report zeros, not nulls', async () => {
    const { result } = await run(({ prisma }) => {
      const empty = {
        _count: { id: null },
        _sum: {
          total_amount: null,
          received_amount: null,
          total_refund: null,
          total_exchange: null,
        },
      };
      prisma.sale.aggregate.mockResolvedValue(empty);
      prisma.return.aggregate.mockResolvedValue(empty);
    });
    expect(Object.values(result.summary).every((v) => v === 0)).toBe(true);
  });

  it('[BE-MUT-720] the weekly trend merges sales and returns per day, sorted, with net amounts', async () => {
    const { result } = await run(({ prisma }) => {
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { date: '2026-05-04', return_count: 1n, total_refund: '20' },
          { date: '2026-05-06', return_count: 2n, total_refund: '5.5' },
        ])
        .mockResolvedValueOnce([
          { date: '2026-05-05', sales_count: 3n, total_amount: '100' },
          { date: '2026-05-04', sales_count: 1n, total_amount: '50' },
        ]);
    });
    expect(result.weekly_sales_trend).toEqual([
      {
        date: '2026-05-04',
        sales_count: 1,
        total_amount: 50,
        returns_count: 1,
        returns_amount: 20,
        net_amount: 30,
      },
      {
        date: '2026-05-05',
        sales_count: 3,
        total_amount: 100,
        returns_count: 0,
        returns_amount: 0,
        net_amount: 100,
      },
      {
        date: '2026-05-06',
        sales_count: 0,
        total_amount: 0,
        returns_count: 2,
        returns_amount: 5.5,
        net_amount: -5.5,
      },
    ]);
  });

  it('[BE-MUT-721] payment breakdowns map method, amount and count', async () => {
    const { result } = await run(({ prisma }) => {
      prisma.salePayment.groupBy.mockResolvedValue([
        {
          payment_method: 'CASH',
          _sum: { amount: '60.5' },
          _count: { _all: 4 },
        },
        { payment_method: 'CARD', _sum: { amount: null }, _count: { _all: 1 } },
      ]);
      prisma.returnPayment.groupBy.mockResolvedValue([
        { payment_method: 'CASH', _sum: { amount: '5' }, _count: { _all: 2 } },
      ]);
    });
    expect(result.payment_method_breakdown).toEqual([
      { payment_method: 'CASH', total_amount: 60.5, transaction_count: 4 },
      { payment_method: 'CARD', total_amount: 0, transaction_count: 1 },
    ]);
    expect(result.return_payment_breakdown).toEqual([
      { payment_method: 'CASH', total_amount: 5, transaction_count: 2 },
    ]);
  });

  it('[BE-MUT-722] top products are enriched with names and sku in one lookup, with fallbacks for unknown variants', async () => {
    const { result, prisma } = await run(({ prisma }) => {
      prisma.saleItem.groupBy.mockResolvedValue([
        { variant_id: 1, _sum: { quantity: 9, line_total: '90.5' } },
        { variant_id: 2, _sum: { quantity: null, line_total: null } },
      ]);
      prisma.productVariant.findMany.mockResolvedValue([
        { id: 1, name: 'Small', sku: 'SK', product: { name: 'Shirt' } },
      ]);
    });
    expect(prisma.productVariant.findMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
      select: {
        id: true,
        name: true,
        sku: true,
        product: { select: { name: true } },
      },
    });
    expect(result.top_products).toEqual([
      {
        variant_id: 1,
        variant_name: 'Small',
        product_name: 'Shirt',
        sku: 'SK',
        total_quantity: 9,
        total_amount: 90.5,
      },
      {
        variant_id: 2,
        variant_name: 'Unknown Variant',
        product_name: 'Unknown Product',
        sku: undefined,
        total_quantity: 0,
        total_amount: 0,
      },
    ]);
    const none = await run(() => undefined);
    expect(none.prisma.productVariant.findMany).not.toHaveBeenCalled();
    expect(none.result.top_products).toEqual([]);
  });

  it('[BE-MUT-723] low stock reports the total and the first five items with fallbacks', async () => {
    const items = Array.from({ length: 7 }, (_, i) => ({
      id: i + 1,
      product: { name: `P${i + 1}` },
      name: `V${i + 1}`,
      sku: `S${i + 1}`,
      alert_quantity: 5,
      total_stock: 1,
      shortage: 4,
      affected_branch_name: 'Main',
    }));
    const { result } = await run(({ inventory }) =>
      inventory.getLowStockItems.mockResolvedValue(items),
    );
    expect(result.low_stock.total_critical_items).toBe(7);
    expect(result.low_stock.items).toHaveLength(5);
    expect(result.low_stock.items[0]).toEqual({
      variant_id: 1,
      product_name: 'P1',
      variant_name: 'V1',
      sku: 'S1',
      alert_quantity: 5,
      total_stock: 1,
      shortage: 4,
      affected_branch_name: 'Main',
    });
    const bare = await run(({ inventory }) =>
      inventory.getLowStockItems.mockResolvedValue([{ id: 9 }]),
    );
    expect(bare.result.low_stock.items[0]).toEqual({
      variant_id: 9,
      product_name: 'Unknown Product',
      variant_name: 'Unknown Variant',
      sku: undefined,
      alert_quantity: 0,
      total_stock: 0,
      shortage: 0,
      affected_branch_name: undefined,
    });
  });

  it('[BE-MUT-724] expiring items list batch, product, quantity, ISO expiry and branch, with fallbacks', async () => {
    const { result } = await run(({ prisma }) => {
      prisma.inventoryBatch.count.mockResolvedValue(12);
      prisma.inventoryBatch.findMany.mockResolvedValue([
        {
          id: 1,
          batch_number: 'B1',
          quantity: 3,
          expiry_date: new Date('2026-05-20T00:00:00Z'),
          variant: { name: 'Small', product: { name: 'Shirt' } },
          branch: { name: 'Main' },
        },
        {
          id: 2,
          batch_number: 'B2',
          quantity: 1,
          expiry_date: new Date('2026-05-21T00:00:00Z'),
          variant: null,
          branch: null,
        },
      ]);
    });
    expect(result.expiring_items).toEqual({
      total_expiring_items: 12,
      items: [
        {
          batch_id: 1,
          product_name: 'Shirt',
          variant_name: 'Small',
          batch_number: 'B1',
          quantity: 3,
          expiry_date: '2026-05-20T00:00:00.000Z',
          branch_name: 'Main',
        },
        {
          batch_id: 2,
          product_name: 'Unknown Product',
          variant_name: 'Unknown Variant',
          batch_number: 'B2',
          quantity: 1,
          expiry_date: '2026-05-21T00:00:00.000Z',
          branch_name: undefined,
        },
      ],
    });
  });

  it('[BE-MUT-725] failures are logged and hidden behind a generic 500, forbidden errors pass through', async () => {
    await expectGenericWrapping({
      run: (f) => {
        jest.useFakeTimers().setSystemTime(WED);
        const { prisma, service } = setup();
        prisma.sale.aggregate.mockRejectedValue(f);
        return service.getAnalytics(5, {});
      },
      message: 'Failed to fetch dashboard analytics',
      logged: ['Error fetching dashboard analytics for consumer 5'],
    });
    jest.useFakeTimers().setSystemTime(WED);
    const { prisma, service } = setup();
    const forbidden = new ForbiddenException('nope');
    prisma.sale.aggregate.mockRejectedValue(forbidden);
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    await expect(service.getAnalytics(5, {} as any)).rejects.toBe(forbidden);
  });
});
