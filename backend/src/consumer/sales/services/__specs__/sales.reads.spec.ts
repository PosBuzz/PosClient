import { NotFoundException } from '@nestjs/common';
import { expectGenericWrapping } from '../../../../../test/helpers/error-wrapping';
import { setupSales } from '../../../../../test/helpers/sales-service-setup';

const saleRow = (extra: object = {}): any => ({
  id: 1,
  sale_number: 'SAL-1',
  total_amount: '100',
  items: [
    { id: 10, quantity: 2, applied_promotion_id: null },
    { id: 11, quantity: 1, applied_promotion_id: 7 },
  ],
  ...extra,
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const arrangeList = (rows: any[] = [saleRow()], total = rows.length) => {
  const ctx = setupSales();
  ctx.prisma.sale.findMany.mockResolvedValue(rows);
  ctx.prisma.sale.count.mockResolvedValue(total);
  ctx.prisma.sale.aggregate.mockResolvedValue({
    _count: total,
    _sum: { total_amount: '300', received_amount: '120.5' },
    _avg: { total_amount: '100' },
  });
  ctx.prisma.return.aggregate.mockResolvedValue({
    _count: 2,
    _sum: { total_refund: '40' },
  });
  ctx.prisma.promotion.findMany.mockResolvedValue([
    {
      id: 7,
      name: 'Promo',
      scope: 'BRAND',
      discount_type: 'percentage',
      discount_value: 5,
    },
  ]);
  ctx.prisma.return.findMany.mockResolvedValue([]);
  ctx.prisma.returnItem.groupBy.mockResolvedValue([]);
  return ctx;
};

const saleInclude = {
  customer: true,
  branch: true,
  user: { select: { id: true, name: true } },
  served_by: { select: { id: true, name: true } },
  deleted_by: { select: { id: true, name: true } },
  payments: true,
  items: {
    include: {
      variant: { include: { product: true, sale_unit: true } },
      batch: true,
    },
  },
};

describe('SalesService.findAll (unit)', () => {
  it('[BE-MUT-720] the default listing is page 1 of 20, newest first, live sales only, with the pinned includes and summary', async () => {
    const { prisma, service } = arrangeList();
    const result: any = await service.findAll({}, 5);
    const where = { consumer_id: 5, sale_type: 'sale', deleted_at: null };
    expect(prisma.sale.findMany).toHaveBeenCalledWith({
      where,
      skip: 0,
      take: 20,
      orderBy: { created_at: 'desc' },
      include: saleInclude,
    });
    expect(prisma.sale.count).toHaveBeenCalledWith({ where });
    expect(result.meta).toEqual({
      total: 1,
      page: 1,
      limit: 20,
      total_pages: 1,
    });
    expect(prisma.sale.aggregate).toHaveBeenCalledWith({
      where,
      _count: true,
      _sum: { total_amount: true, received_amount: true },
      _avg: { total_amount: true },
    });
    expect(prisma.return.aggregate).toHaveBeenCalledWith({
      where: { original_sale: where },
      _count: true,
      _sum: { total_refund: true },
    });
    expect(result.summary).toEqual({
      total_sales: 1,
      total_amount: 300,
      total_received: 120.5,
      total_due: 179.5,
      average_sale: 100,
      total_refund: 40,
      return_count: 2,
      net_amount: 260,
    });
  });

  it('[BE-MUT-721] every filter reaches the query: search, branch, payment method/status, dates, source, deleted tab and sorting', async () => {
    const { prisma, service } = arrangeList([], 45);
    await service.findAll(
      {
        page: 3,
        limit: 10,
        search: 'abc',
        branch_id: 2,
        payment_method: 'CASH',
        payment_status: 'paid',
        date_from: '2026-01-01',
        date_to: '2026-02-01',
        sort_by: 'total_amount',
        sort_order: 'asc',
        source: 'quotation',
        status: 'deleted',
      } as any,
      5,
    );
    const call = prisma.sale.findMany.mock.calls[0][0];
    expect(call).toMatchObject({
      skip: 20,
      take: 10,
      orderBy: { total_amount: 'asc' },
    });
    expect(call.where).toEqual({
      consumer_id: 5,
      sale_type: 'sale',
      deleted_at: { not: null },
      OR: [
        { sale_number: { contains: 'abc', mode: 'insensitive' } },
        { customer_name: { contains: 'abc', mode: 'insensitive' } },
        { customer_phone: { contains: 'abc', mode: 'insensitive' } },
        { customer_email: { contains: 'abc', mode: 'insensitive' } },
      ],
      branch_id: 2,
      payments: { some: { payment_method: 'CASH' } },
      payment_status: 'paid',
      sale_date: { gte: new Date('2026-01-01'), lte: new Date('2026-02-01') },
      converted_from_quotations: { some: {} },
    });
    await service.findAll(
      { source: 'direct', date_from: '2026-01-01' } as any,
      5,
    );
    const direct = prisma.sale.findMany.mock.calls[1][0].where;
    expect(direct.converted_from_quotations).toEqual({ none: {} });
    expect(direct.sale_date).toEqual({ gte: new Date('2026-01-01') });
    await service.findAll({ date_to: '2026-02-01' }, 5);
    expect(prisma.sale.findMany.mock.calls[2][0].where.sale_date).toEqual({
      lte: new Date('2026-02-01'),
    });
    await service.findAll({ source: 'other' } as any, 5);
    expect(
      prisma.sale.findMany.mock.calls[3][0].where.converted_from_quotations,
    ).toBeUndefined();
  });

  it('[BE-MUT-722] sales carry their applied promotion and a return summary (none, partial or full)', async () => {
    const { prisma, service } = arrangeList([
      saleRow({ id: 1 }),
      saleRow({
        id: 2,
        items: [{ id: 20, quantity: 1, applied_promotion_id: 7 }],
      }),
      saleRow({
        id: 3,
        items: [{ id: 30, quantity: 1, applied_promotion_id: null }],
      }),
    ]);
    prisma.return.findMany.mockResolvedValue([
      {
        id: 5,
        original_sale_id: 1,
        total_refund: '10',
        total_exchange: '2',
        return_number: 'R1',
      },
      {
        id: 6,
        original_sale_id: 1,
        total_refund: '5',
        total_exchange: '0',
        return_number: 'R2',
      },
      {
        id: 7,
        original_sale_id: 2,
        total_refund: '100',
        total_exchange: '0',
        return_number: 'R3',
      },
    ]);
    prisma.returnItem.groupBy.mockResolvedValue([
      { sale_item_id: 10, _sum: { quantity: 1 } },
      { sale_item_id: 20, _sum: { quantity: 1 } },
    ]);
    const result: any = await service.findAll({}, 5);
    const [partial, full, plain] = result.data;
    expect(partial.return_summary).toEqual({
      has_returns: true,
      return_count: 2,
      total_refund: 15,
      total_exchange: 2,
      net_amount: 85,
      status: 'partially_returned',
    });
    expect(partial.returns.map((r: any) => r.return_number)).toEqual([
      'R1',
      'R2',
    ]);
    expect(partial.returns[0]).not.toHaveProperty('original_sale_id');
    expect(partial.items.map((i: any) => i.returned_quantity)).toEqual([1, 0]);
    expect(partial.items[1].applied_promotion).toMatchObject({
      id: 7,
      name: 'Promo',
    });
    expect(partial.items[0].applied_promotion).toBeNull();
    expect(full.return_summary.status).toBe('fully_returned');
    expect(plain.return_summary).toMatchObject({
      status: 'none',
      has_returns: false,
      net_amount: 100,
    });
    expect(prisma.promotion.findMany).toHaveBeenCalledWith({
      where: { id: { in: [7] }, consumer_id: 5 },
      select: {
        id: true,
        name: true,
        scope: true,
        discount_type: true,
        discount_value: true,
      },
    });
    expect(prisma.return.findMany).toHaveBeenCalledWith({
      where: { original_sale_id: { in: [1, 2, 3] } },
      select: {
        id: true,
        return_number: true,
        return_date: true,
        total_refund: true,
        total_exchange: true,
        reason: true,
        original_sale_id: true,
      },
      orderBy: { return_date: 'desc' },
    });
    expect(prisma.returnItem.groupBy).toHaveBeenCalledWith({
      by: ['sale_item_id'],
      where: { return_record: { original_sale_id: { in: [1, 2, 3] } } },
      _sum: { quantity: true },
    });
  });

  it('[BE-MUT-723] an empty page performs no return or promotion lookups', async () => {
    const { prisma, service } = arrangeList([]);
    const result: any = await service.findAll({}, 5);
    expect(result.data).toEqual([]);
    expect(prisma.return.findMany).not.toHaveBeenCalled();
    expect(prisma.promotion.findMany).not.toHaveBeenCalled();
    prisma.sale.aggregate.mockResolvedValue({ _count: 0, _sum: {}, _avg: {} });
    prisma.return.aggregate.mockResolvedValue({ _count: 0, _sum: {} });
    await expect(service.findAll({} as any, 5)).resolves.toMatchObject({
      summary: {
        total_sales: 0,
        total_amount: 0,
        total_due: 0,
        average_sale: 0,
        total_refund: 0,
        return_count: 0,
        net_amount: 0,
      },
    });
  });

  it('[BE-MUT-724] a sale paid more than its total shows no negative due', async () => {
    const { prisma, service } = arrangeList();
    prisma.sale.aggregate.mockResolvedValue({
      _count: 1,
      _sum: { total_amount: '100', received_amount: '150' },
      _avg: { total_amount: '100' },
    });
    const result: any = await service.findAll({}, 5);
    expect(result.summary.total_due).toBe(0);
  });

  it('[BE-MUT-725] listing failures are logged and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = arrangeList();
        prisma.sale.findMany.mockRejectedValue(f);
        return service.findAll({}, 5);
      },
      message: 'Failed to fetch sales',
      logged: ['Error fetching sales for consumer 5 with filters'],
    });
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = arrangeList();
        prisma.sale.aggregate.mockRejectedValue(f);
        return service.findAll({}, 5);
      },
      message: 'Error calculating summary stats',
      logged: ['Error calculating summary stats'],
    });
  });
});

describe('SalesService.findOne and updateNote (unit)', () => {
  const arrangeOne = (row: any = saleRow()) => {
    const ctx = arrangeList();
    ctx.prisma.sale.findFirst.mockResolvedValue(row);
    return ctx;
  };

  it('[BE-MUT-726] findOne is tenant scoped to live sales, loads the full sale and attaches promotions and return summary', async () => {
    const { prisma, service } = arrangeOne();
    const result: any = await service.findOne(1, 5);
    expect(prisma.sale.findFirst).toHaveBeenCalledWith({
      where: { id: 1, consumer_id: 5, sale_type: 'sale', deleted_at: null },
      include: {
        customer: { include: { rewards_points: true } },
        consumer: true,
        branch: true,
        user: { select: { id: true, name: true } },
        served_by: { select: { id: true, name: true } },
        deleted_by: { select: { id: true, name: true } },
        promotion: {
          select: {
            id: true,
            name: true,
            scope: true,
            discount_type: true,
            discount_value: true,
          },
        },
        payments: true,
        converted_from_quotations: {
          select: { id: true, sale_number: true, created_at: true },
        },
        items: {
          include: {
            variant: { include: { product: true, sale_unit: true } },
            batch: true,
          },
        },
      },
    });
    expect(result.return_summary.status).toBe('none');
    expect(result.items[1].applied_promotion.id).toBe(7);
    await service.findOne(1, 5, true);
    expect(prisma.sale.findFirst.mock.calls[1][0].where).toEqual({
      id: 1,
      consumer_id: 5,
      sale_type: 'sale',
    });
  });

  it('[BE-MUT-727] a missing or foreign sale is a 404; read failures are hidden behind a generic 500', async () => {
    const { prisma, service } = arrangeOne(null);
    await expect(service.findOne(1, 5)).rejects.toThrow(
      new NotFoundException('Sale not found'),
    );
    await expectGenericWrapping({
      run: (f) => {
        const ctx = arrangeOne();
        ctx.prisma.sale.findFirst.mockRejectedValue(f);
        return ctx.service.findOne(1, 5);
      },
      message: 'Failed to fetch sale',
      logged: ['Error fetching sale 1 for consumer 5'],
      notFoundPassesThrough: true,
    });
    expect(prisma.sale.findFirst).toHaveBeenCalledTimes(1);
  });

  it('[BE-MUT-728] updateNote trims the note (blank clears it), logs who changed it and returns the reloaded sale', async () => {
    const ctx = arrangeOne();
    ctx.prisma.sale.findFirst
      .mockResolvedValueOnce({ id: 1, sale_number: 'SAL-1' })
      .mockResolvedValue(saleRow());
    const log = jest
      .spyOn((ctx.service as any).logger, 'log')
      .mockImplementation();
    const result: any = await ctx.service.updateNote(
      1,
      5,
      { notes: '  hello  ' },
      8,
    );
    expect(ctx.prisma.sale.findFirst.mock.calls[0][0]).toEqual({
      where: { id: 1, consumer_id: 5, deleted_at: null },
      select: { id: true, sale_number: true },
    });
    expect(ctx.prisma.sale.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { notes: 'hello' },
    });
    expect(log).toHaveBeenCalledWith('Note updated on sale SAL-1 by user 8');
    expect(result.id).toBe(1);
    for (const notes of ['   ', '', undefined]) {
      ctx.prisma.sale.findFirst
        .mockResolvedValueOnce({ id: 1, sale_number: 'SAL-1' })
        .mockResolvedValue(saleRow());
      await ctx.service.updateNote(1, 5, { notes }, 8);
      expect(ctx.prisma.sale.update.mock.lastCall![0].data).toEqual({
        notes: null,
      });
    }
  });

  it('[BE-MUT-729] updateNote on a missing sale is a 404 without any write; write failures are hidden behind a generic 500', async () => {
    const missing = arrangeOne(null);
    await expect(
      missing.service.updateNote(1, 5, { notes: 'x' } as any, 8),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(missing.prisma.sale.update).not.toHaveBeenCalled();
    await expectGenericWrapping({
      run: (f) => {
        const ctx = arrangeOne();
        ctx.prisma.sale.findFirst.mockResolvedValue({
          id: 1,
          sale_number: 'SAL-1',
        });
        ctx.prisma.sale.update.mockRejectedValue(f);
        return ctx.service.updateNote(1, 5, { notes: 'x' }, 8);
      },
      message: 'Failed to update sale note',
      logged: ['Error updating note on sale 1 for consumer 5'],
    });
  });
});

describe('SalesService number generation (unit)', () => {
  it('[BE-MUT-730] sale and quotation numbers are prefixed with the local date and continue the day sequence', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 5, 10));
    const { prisma, service } = setupSales();
    prisma.sale.findFirst.mockResolvedValue(null);
    await expect((service as any).generateSaleNumber(5)).resolves.toBe(
      'SAL-20260505-0001',
    );
    expect(prisma.sale.findFirst).toHaveBeenCalledWith({
      where: {
        consumer_id: 5,
        sale_number: { startsWith: 'SAL-20260505' },
        sale_type: 'sale',
      },
      orderBy: { sale_number: 'desc' },
    });
    prisma.sale.findFirst.mockResolvedValue({
      sale_number: 'SAL-20260505-0099',
    });
    await expect((service as any).generateSaleNumber(5)).resolves.toBe(
      'SAL-20260505-0100',
    );
    prisma.sale.findFirst.mockResolvedValue(null);
    await expect((service as any).generateQuotationNumber(5)).resolves.toBe(
      'QUO-20260505-0001',
    );
    expect(prisma.sale.findFirst).toHaveBeenLastCalledWith({
      where: {
        consumer_id: 5,
        sale_number: { startsWith: 'QUO-20260505' },
        sale_type: 'quotation',
      },
      orderBy: { sale_number: 'desc' },
    });
    prisma.sale.findFirst.mockResolvedValue({
      sale_number: 'QUO-20260505-0009',
    });
    await expect((service as any).generateQuotationNumber(5)).resolves.toBe(
      'QUO-20260505-0010',
    );
    const tx: any = {
      sale: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ sale_number: 'SAL-20260505-0001' }),
      },
    };
    await expect((service as any).generateSaleNumber(5, tx)).resolves.toBe(
      'SAL-20260505-0002',
    );
    await expect((service as any).generateQuotationNumber(5, tx)).resolves.toBe(
      'QUO-20260505-0002',
    );
  });

  it('[BE-MUT-731] number generation failures are logged and hidden behind generic 500s', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setupSales();
        prisma.sale.findFirst.mockRejectedValue(f);
        return (service as any).generateSaleNumber(5);
      },
      message: 'Error generating sale number',
      logged: ['Error generating sale number for consumer 5'],
    });
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setupSales();
        prisma.sale.findFirst.mockRejectedValue(f);
        return (service as any).generateQuotationNumber(5);
      },
      message: 'Error generating quotation number',
      logged: ['Error generating quotation number for consumer 5'],
    });
  });
});
