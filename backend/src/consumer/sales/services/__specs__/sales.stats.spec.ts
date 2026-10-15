import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { expectGenericWrapping } from '../../../../../test/helpers/error-wrapping';
import { setupSales } from '../../../../../test/helpers/sales-service-setup';

afterEach(() => jest.restoreAllMocks());

const start = new Date(2026, 0, 1, 0, 0, 0, 0);
const end = new Date(2026, 0, 31, 23, 59, 59, 999);

describe('SalesService date helpers (unit)', () => {
  it('[BE-MUT-780] local-day boundaries are the start and last millisecond of the day; an invalid date is a 400 naming it', () => {
    const { service } = setupSales();
    const s = service as any;
    expect(s.parseLocalDateStart('2026-01-05')).toEqual(
      new Date(2026, 0, 5, 0, 0, 0, 0),
    );
    expect(s.parseLocalDateEnd('2026-01-05')).toEqual(
      new Date(2026, 0, 5, 23, 59, 59, 999),
    );
    expect(() => s.parseLocalDateStart('abc')).toThrow(
      new BadRequestException('Invalid date: abc'),
    );
    expect(() => s.parseLocalDateEnd('2026-xx-05')).toThrow(
      new BadRequestException('Invalid date: 2026-xx-05'),
    );
  });
});

describe('SalesService.getVariantSalesStats (unit)', () => {
  const row = (extra: object = {}) => ({
    variant_id: BigInt(20),
    product_name: 'Shirt',
    variant_name: 'Small',
    sku: 'S',
    total_qty: BigInt(7),
    total_sales: BigInt(3),
    total_amount: '210.50',
    returned_qty: BigInt(1),
    returned_amount: '30',
    ...extra,
  });

  it('[BE-MUT-781] with no variants the answer is an empty page without running the stats query', async () => {
    const { prisma, service } = setupSales();
    prisma.productVariant.count.mockResolvedValue(0);
    await expect(
      service.getVariantSalesStats(5, '2026-01-01', '2026-01-31'),
    ).resolves.toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 20, total_pages: 0 },
    });
    expect(prisma.productVariant.count).toHaveBeenCalledWith({
      where: { product: { consumer_id: 5 } },
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('[BE-MUT-782] rows become numbers with net = sold - returned, a missing SKU is null, and paging metadata is reported', async () => {
    const { prisma, service } = setupSales();
    prisma.productVariant.count.mockResolvedValue(45);
    prisma.$queryRaw.mockResolvedValue([
      row(),
      row({ variant_id: 21, sku: null }),
    ]);
    const result: any = await service.getVariantSalesStats(
      5,
      '2026-01-01',
      '2026-01-31',
      undefined,
      3,
      10,
    );
    expect(result.data[0]).toEqual({
      variant_id: 20,
      product_name: 'Shirt',
      variant_name: 'Small',
      sku: 'S',
      total_qty: 7,
      total_sales: 3,
      total_amount: 210.5,
      returned_qty: 1,
      returned_amount: 30,
      net_amount: 180.5,
    });
    expect(result.data[1].sku).toBeNull();
    expect(result.meta).toEqual({
      total: 45,
      page: 3,
      limit: 10,
      total_pages: 5,
    });
  });

  it('[BE-MUT-783] the query is scoped to the shop, live non-cancelled sales and the local-day range, with an optional branch filter', async () => {
    const { prisma, service } = setupSales();
    prisma.productVariant.count.mockResolvedValue(1);
    prisma.$queryRaw.mockResolvedValue([]);
    await service.getVariantSalesStats(
      5,
      '2026-01-01',
      '2026-01-31',
      undefined,
      3,
      10,
    );
    let [, ...values] = prisma.$queryRaw.mock.calls[0];
    expect(values.slice(0, 5)).toEqual([5, 'sale', 'cancelled', start, end]);
    expect(values[5]).toBe(Prisma.empty);
    expect(values.slice(6, 9)).toEqual([5, start, end]);
    expect(values[9]).toBe(Prisma.empty);
    expect(values.slice(10)).toEqual([5, 10, 20]);
    await service.getVariantSalesStats(5, '2026-01-01', '2026-01-31', 9);
    [, ...values] = prisma.$queryRaw.mock.calls[1];
    expect(values[5].sql).toContain('s.branch_id');
    expect(values[5].values).toEqual([9]);
    expect(values[9].sql).toContain('r.branch_id');
    expect(values[9].values).toEqual([9]);
  });

  it('[BE-MUT-784] a bad date and database failures are reported correctly', async () => {
    const { service } = setupSales();
    await expect(
      service.getVariantSalesStats(5, 'nope', '2026-01-31'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setupSales();
        prisma.productVariant.count.mockRejectedValue(f);
        return service.getVariantSalesStats(5, '2026-01-01', '2026-01-31');
      },
      message: 'Error fetching variant sales stats',
      logged: ['Error fetching variant sales stats for consumer 5'],
    });
  });
});

describe('SalesService.getVariantSalesDetail (unit)', () => {
  const arrange = () => {
    const ctx = setupSales();
    ctx.prisma.productVariant.findFirst.mockResolvedValue({
      id: 20,
      name: 'Small',
      product: { id: 3, name: 'Shirt', consumer_id: 5 },
    });
    const rowsPage = [
      {
        id: 100,
        quantity: 2,
        line_total: '40',
        sale: {
          id: 1,
          sale_number: 'S1',
          sale_date: new Date(2026, 0, 5, 12),
          payment_status: 'paid',
          customer_name: 'Walk-in',
          customer: { id: 4, name: 'Ann' },
          branch: { id: 2, name: 'Main' },
        },
      },
      {
        id: 101,
        quantity: 1,
        line_total: '10',
        sale: {
          id: 2,
          sale_number: 'S2',
          sale_date: new Date(2026, 0, 6, 12),
          payment_status: 'due',
          customer_name: 'Walk-in',
          customer: null,
          branch: null,
        },
      },
    ];
    const all = [
      {
        quantity: 2,
        line_total: '40',
        sale_id: 1,
        sale: { sale_date: new Date(2026, 0, 5, 12) },
      },
      {
        quantity: 1,
        line_total: '10',
        sale_id: 2,
        sale: { sale_date: new Date(2026, 0, 5, 18) },
      },
      {
        quantity: 3,
        line_total: '60',
        sale_id: 2,
        sale: { sale_date: new Date(2026, 0, 6, 12) },
      },
    ];
    ctx.prisma.saleItem.findMany.mockImplementation(async (args: any) => {
      if (args.select?.sale?.select?.sale_number) return rowsPage;
      if (args.select?.sale_id) return all;
      return [{ id: 100, quantity: 2, line_total: '40' }];
    });
    ctx.prisma.saleItem.groupBy.mockResolvedValue([]);
    ctx.prisma.saleItem.aggregate.mockResolvedValue({
      _sum: { quantity: 6, line_total: '110' },
    });
    ctx.prisma.returnItem.groupBy.mockResolvedValue([
      { sale_item_id: 100, _sum: { quantity: 1 } },
    ]);
    ctx.prisma.saleItem.count.mockResolvedValue(2);
    return ctx;
  };

  it('[BE-MUT-785] the detail combines summary, daily chart, returns and the page of lines', async () => {
    const { prisma, service } = arrange();
    const result: any = await service.getVariantSalesDetail(
      5,
      20,
      '2026-01-01',
      '2026-01-31',
    );
    const where = {
      variant_id: 20,
      sale: {
        consumer_id: 5,
        sale_type: 'sale',
        deleted_at: null,
        payment_status: { not: 'cancelled' },
        sale_date: { gte: start, lte: end },
      },
    };
    expect(prisma.saleItem.count).toHaveBeenCalledWith({ where });
    expect(prisma.saleItem.aggregate).toHaveBeenCalledWith({
      where,
      _sum: {
        quantity: true,
        line_total: true,
        average_discount_amount: true,
        special_discount_amount: true,
        promotion_discount_amount: true,
      },
      _count: { sale_id: true },
    });
    expect(prisma.returnItem.groupBy).toHaveBeenCalledWith({
      by: ['sale_item_id'],
      where: { sale_item: where },
      _sum: { quantity: true },
    });
    expect(result.variant).toEqual({
      id: 20,
      name: 'Small',
      product_name: 'Shirt',
    });
    expect(result.summary).toEqual({
      total_qty: 6,
      total_sales: 2,
      total_amount: 110,
      avg_qty: 3,
      avg_amount: 55,
      returned_qty: 1,
      returned_amount: 20,
      net_qty: 5,
      net_amount: 90,
    });
    expect(result.chart_data).toEqual([
      { date: '2026-01-05', qty: 3, total_amount: 50 },
      { date: '2026-01-06', qty: 3, total_amount: 60 },
    ]);
    expect(result.data).toEqual([
      {
        id: 100,
        sale_id: 1,
        sale_number: 'S1',
        sale_date: new Date(2026, 0, 5, 12),
        customer_name: 'Ann',
        branch_name: 'Main',
        qty: 2,
        returned_qty: 1,
        line_total: 40,
        payment_status: 'paid',
      },
      {
        id: 101,
        sale_id: 2,
        sale_number: 'S2',
        sale_date: new Date(2026, 0, 6, 12),
        customer_name: 'Walk-in',
        branch_name: null,
        qty: 1,
        returned_qty: 0,
        line_total: 10,
        payment_status: 'due',
      },
    ]);
    expect(result.meta).toEqual({
      total: 2,
      page: 1,
      limit: 20,
      total_pages: 1,
    });
    const pageCall = prisma.saleItem.findMany.mock.calls.find(
      ([a]: any) => a.take,
    );
    expect(pageCall![0]).toMatchObject({
      where,
      skip: 0,
      take: 20,
      orderBy: { sale: { sale_date: 'desc' } },
    });
  });

  it('[BE-MUT-786] a branch filter, paging and no sales give zero averages; a variant of another shop is a 404', async () => {
    const ctx = arrange();
    ctx.prisma.saleItem.findMany.mockResolvedValue([]);
    ctx.prisma.saleItem.aggregate.mockResolvedValue({ _sum: {} });
    ctx.prisma.returnItem.groupBy.mockResolvedValue([]);
    ctx.prisma.saleItem.count.mockResolvedValue(0);
    const result: any = await ctx.service.getVariantSalesDetail(
      5,
      20,
      '2026-01-01',
      '2026-01-31',
      9,
      3,
      5,
    );
    expect(result.summary).toMatchObject({
      total_qty: 0,
      total_sales: 0,
      avg_qty: 0,
      avg_amount: 0,
      net_amount: 0,
    });
    expect(
      ctx.prisma.saleItem.count.mock.calls[0][0].where.sale.branch_id,
    ).toBe(9);
    expect(ctx.prisma.saleItem.findMany.mock.calls[0][0]).toMatchObject({
      skip: 10,
      take: 5,
    });
    ctx.prisma.productVariant.findFirst.mockResolvedValue({
      id: 20,
      name: 'x',
      product: { id: 3, name: 'y', consumer_id: 6 },
    });
    await expect(
      ctx.service.getVariantSalesDetail(5, 20, '2026-01-01', '2026-01-31'),
    ).rejects.toThrow(new NotFoundException('Product variant not found'));
    ctx.prisma.productVariant.findFirst.mockResolvedValue(null);
    await expect(
      ctx.service.getVariantSalesDetail(5, 20, '2026-01-01', '2026-01-31'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('[BE-MUT-787] detail failures are logged and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const ctx = arrange();
        ctx.prisma.productVariant.findFirst.mockRejectedValue(f);
        return ctx.service.getVariantSalesDetail(
          5,
          20,
          '2026-01-01',
          '2026-01-31',
        );
      },
      message: 'Error fetching variant sales detail',
      logged: [
        'Error fetching variant sales detail for variant 20 and consumer 5',
      ],
      notFoundPassesThrough: true,
    });
  });
});

describe('SalesService user sales (unit)', () => {
  it('[BE-MUT-788] team stats rank salespeople by sales and subtract the refunds of their own sales', async () => {
    const { prisma, service } = setupSales();
    prisma.sale.groupBy.mockResolvedValue([
      { served_by_id: 4, _sum: { total_amount: '500' }, _count: { id: 5 } },
      { served_by_id: 6, _sum: { total_amount: null }, _count: { id: 1 } },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 4, name: 'Ann', email: 'a@x.io' },
    ]);
    prisma.return.findMany.mockResolvedValue([
      { total_refund: '40', original_sale: { served_by_id: 4 } },
      { total_refund: '10', original_sale: { served_by_id: 4 } },
      { total_refund: '99', original_sale: { served_by_id: null } },
      { total_refund: '99', original_sale: null },
    ]);
    const result = await service.getUsersSalesStats(
      5,
      '2026-01-01',
      '2026-01-31',
      9,
    );
    const where = {
      consumer_id: 5,
      sale_type: 'sale',
      deleted_at: null,
      served_by_id: { not: null },
      payment_status: { not: 'cancelled' },
      sale_date: { gte: start, lte: end },
      branch_id: 9,
    };
    expect(prisma.sale.groupBy).toHaveBeenCalledWith({
      by: ['served_by_id'],
      where,
      _sum: { total_amount: true },
      _count: { id: true },
      orderBy: { _sum: { total_amount: 'desc' } },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: [4, 6] }, consumer_id: 5 },
      select: { id: true, name: true, email: true },
    });
    expect(prisma.return.findMany).toHaveBeenCalledWith({
      where: { consumer_id: 5, original_sale: where },
      select: {
        total_refund: true,
        original_sale: { select: { served_by_id: true } },
      },
    });
    expect(result).toEqual([
      {
        id: 4,
        name: 'Ann',
        email: 'a@x.io',
        totalSales: 500,
        salesCount: 5,
        totalRefunds: 50,
        returnsCount: 2,
        netSales: 450,
      },
      {
        id: 6,
        name: 'Unknown',
        email: null,
        totalSales: 0,
        salesCount: 1,
        totalRefunds: 0,
        returnsCount: 0,
        netSales: 0,
      },
    ]);
  });

  it('[BE-MUT-789] team stats are empty when nobody sold, and use no branch filter by default', async () => {
    const { prisma, service } = setupSales();
    prisma.sale.groupBy.mockResolvedValue([]);
    await expect(
      service.getUsersSalesStats(5, '2026-01-01', '2026-01-31'),
    ).resolves.toEqual([]);
    expect('branch_id' in prisma.sale.groupBy.mock.calls[0][0].where).toBe(
      false,
    );
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("[BE-MUT-790] one salesperson's detail lists their sales with per-sale refunds and totals; an unknown user is a 404", async () => {
    const { prisma, service } = setupSales();
    prisma.user.findFirst.mockResolvedValue({
      id: 4,
      name: 'Ann',
      email: 'a@x.io',
    });
    prisma.sale.findMany.mockResolvedValue([
      { id: 1, total_amount: '100' },
      { id: 2, total_amount: '60' },
    ]);
    prisma.sale.count.mockResolvedValue(25);
    prisma.sale.aggregate.mockResolvedValue({ _sum: { total_amount: '160' } });
    prisma.return.findMany.mockResolvedValue([
      { total_refund: '10', original_sale_id: 1 },
      { total_refund: '5', original_sale_id: 1 },
    ]);
    const result: any = await service.getUserSalesDetail(
      5,
      4,
      '2026-01-01',
      '2026-01-31',
      9,
      2,
      10,
    );
    const where = {
      consumer_id: 5,
      sale_type: 'sale',
      deleted_at: null,
      served_by_id: 4,
      payment_status: { not: 'cancelled' },
      sale_date: { gte: start, lte: end },
      branch_id: 9,
    };
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 4, consumer_id: 5 },
      select: { id: true, name: true, email: true },
    });
    expect(prisma.sale.findMany).toHaveBeenCalledWith({
      where,
      skip: 10,
      take: 10,
      orderBy: { sale_date: 'desc' },
      select: {
        id: true,
        sale_number: true,
        sale_date: true,
        total_amount: true,
        payment_status: true,
        customer_name: true,
        customer: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
    expect(prisma.return.findMany).toHaveBeenCalledWith({
      where: { consumer_id: 5, original_sale: where },
      select: { total_refund: true, original_sale_id: true },
    });
    expect(result.user).toEqual({ id: 4, name: 'Ann', email: 'a@x.io' });
    expect(result.data).toEqual([
      { id: 1, total_amount: '100', total_refund: 15, net_amount: 85 },
      { id: 2, total_amount: '60', total_refund: 0, net_amount: 60 },
    ]);
    expect(result.meta).toEqual({
      total: 25,
      total_amount: 160,
      total_refund: 15,
      net_amount: 145,
      page: 2,
      limit: 10,
      total_pages: 3,
    });
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.getUserSalesDetail(5, 4, '2026-01-01', '2026-01-31'),
    ).rejects.toThrow(new NotFoundException('User not found'));
    prisma.user.findFirst.mockResolvedValue({ id: 4 });
    prisma.sale.aggregate.mockResolvedValue({ _sum: {} });
    prisma.return.findMany.mockResolvedValue([]);
    const plain: any = await service.getUserSalesDetail(
      5,
      4,
      '2026-01-01',
      '2026-01-31',
    );
    expect(plain.meta).toMatchObject({ total_amount: 0, page: 1, limit: 20 });
    expect('branch_id' in prisma.sale.findMany.mock.calls[1][0].where).toBe(
      false,
    );
  });
});
