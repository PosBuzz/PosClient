import { BadRequestException, NotFoundException } from '@nestjs/common';
import { expectGenericWrapping } from '../../../../../test/helpers/error-wrapping';
import { setupSales } from '../../../../../test/helpers/sales-service-setup';

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const promoSelect = {
  id: true,
  name: true,
  scope: true,
  discount_type: true,
  discount_value: true,
};
const idName = { select: { id: true, name: true } };

describe('SalesService quotation reads (unit)', () => {
  const arrange = (
    rows: any[] = [{ id: 1, items: [] }],
    total = rows.length,
  ) => {
    const ctx = setupSales();
    ctx.prisma.sale.findMany.mockResolvedValue(rows);
    ctx.prisma.sale.count.mockResolvedValue(total);
    ctx.prisma.sale.aggregate.mockResolvedValue({
      _count: total,
      _sum: {},
      _avg: {},
    });
    ctx.prisma.return.aggregate.mockResolvedValue({ _count: 0, _sum: {} });
    return ctx;
  };

  it('[BE-MUT-770] the default quotation list is page 1 of 20, newest first, live quotations only, with the pinned includes', async () => {
    const { prisma, service } = arrange();
    const result: any = await service.findAllQuotations({}, 5);
    const where = { consumer_id: 5, sale_type: 'quotation', deleted_at: null };
    expect(prisma.sale.findMany).toHaveBeenCalledWith({
      where,
      skip: 0,
      take: 20,
      orderBy: { created_at: 'desc' },
      include: {
        customer: true,
        branch: true,
        user: idName,
        served_by: idName,
        promotion: { select: promoSelect },
        items: {
          include: { variant: { include: { product: true, sale_unit: true } } },
        },
      },
    });
    expect(prisma.sale.count).toHaveBeenCalledWith({ where });
    expect(result.meta).toEqual({
      total: 1,
      page: 1,
      limit: 20,
      total_pages: 1,
    });
    expect(result.summary).toMatchObject({ total_sales: 1 });
  });

  it('[BE-MUT-771] filters reach the query: search, branch, dates and conversion status', async () => {
    const { prisma, service } = arrange([], 45);
    await service.findAllQuotations(
      {
        page: 3,
        limit: 10,
        search: 'abc',
        branch_id: 2,
        date_from: '2026-01-01',
        date_to: '2026-02-01',
        sort_by: 'total_amount',
        sort_order: 'asc',
        source: 'converted',
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
      sale_type: 'quotation',
      deleted_at: null,
      OR: [
        { sale_number: { contains: 'abc', mode: 'insensitive' } },
        { customer_name: { contains: 'abc', mode: 'insensitive' } },
        { customer_phone: { contains: 'abc', mode: 'insensitive' } },
        { customer_email: { contains: 'abc', mode: 'insensitive' } },
      ],
      branch_id: 2,
      sale_date: { gte: new Date('2026-01-01'), lte: new Date('2026-02-01') },
      converted_to_sale_id: { not: null },
    });
    await service.findAllQuotations(
      { source: 'pending', date_from: '2026-01-01' } as any,
      5,
    );
    const pending = prisma.sale.findMany.mock.calls[1][0].where;
    expect(pending.converted_to_sale_id).toBeNull();
    expect(pending.sale_date).toEqual({ gte: new Date('2026-01-01') });
    await service.findAllQuotations({ date_to: '2026-02-01' }, 5);
    expect(prisma.sale.findMany.mock.calls[2][0].where.sale_date).toEqual({
      lte: new Date('2026-02-01'),
    });
    await service.findAllQuotations({ source: 'x' } as any, 5);
    expect(
      'converted_to_sale_id' in prisma.sale.findMany.mock.calls[3][0].where,
    ).toBe(false);
  });

  it('[BE-MUT-772] a quotation is fetched for this shop with its relations and applied promotion; a miss is a 404', async () => {
    const { prisma, service } = arrange();
    prisma.sale.findFirst.mockResolvedValue({
      id: 1,
      items: [{ applied_promotion_id: 7 }],
    });
    prisma.promotion.findMany.mockResolvedValue([{ id: 7, name: 'P' }]);
    const result: any = await service.findOneQuotation(1, 5);
    expect(prisma.sale.findFirst).toHaveBeenCalledWith({
      where: {
        id: 1,
        consumer_id: 5,
        sale_type: 'quotation',
        deleted_at: null,
      },
      include: {
        customer: true,
        consumer: true,
        branch: true,
        served_by: idName,
        promotion: { select: promoSelect },
        user: idName,
        items: {
          include: { variant: { include: { product: true, sale_unit: true } } },
        },
      },
    });
    expect(result.items[0].applied_promotion).toEqual({ id: 7, name: 'P' });
    prisma.sale.findFirst.mockResolvedValue(null);
    await expect(service.findOneQuotation(1, 5)).rejects.toThrow(
      new NotFoundException('Quotation not found'),
    );
  });

  it('[BE-MUT-773] items with no promotion get none; promotions of other shops are never attached', async () => {
    const { prisma, service } = arrange();
    prisma.sale.findFirst.mockResolvedValue({
      id: 1,
      items: [
        { applied_promotion_id: null },
        { applied_promotion_id: 9 },
        { applied_promotion_id: '7' },
      ],
    });
    prisma.promotion.findMany.mockResolvedValue([{ id: 7, name: 'P' }]);
    const result: any = await service.findOneQuotation(1, 5);
    expect(result.items.map((i: any) => i.applied_promotion)).toEqual([
      null,
      null,
      { id: 7, name: 'P' },
    ]);
    expect(prisma.promotion.findMany.mock.calls[0][0].where).toEqual({
      id: { in: [9, 7] },
      consumer_id: 5,
    });
    prisma.sale.findFirst.mockResolvedValue({
      id: 1,
      items: [{ applied_promotion_id: null }],
    });
    prisma.promotion.findMany.mockClear();
    await service.findOneQuotation(1, 5);
    expect(prisma.promotion.findMany).not.toHaveBeenCalled();
    prisma.sale.findFirst.mockResolvedValue({ id: 1 });
    expect(await service.findOneQuotation(1, 5)).toEqual({ id: 1 });
  });

  it('[BE-MUT-774] quotation read failures are logged and hidden behind generic 500s', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = arrange();
        prisma.sale.findMany.mockRejectedValue(f);
        return service.findAllQuotations({}, 5);
      },
      message: 'Error finding all quotations',
      logged: ['Error finding all quotations for consumer 5'],
    });
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = arrange();
        prisma.sale.findFirst.mockRejectedValue(f);
        return service.findOneQuotation(1, 5);
      },
      message: 'Error finding quotation',
      logged: ['Error finding quotation 1 for consumer 5'],
      notFoundPassesThrough: true,
    });
  });
});

describe('SalesService.convertQuotationToSale (unit)', () => {
  const batch = (
    id: number,
    quantity: number,
    reserved = 0,
    at = '2026-01-01',
  ) => ({
    id,
    quantity,
    reserved_quantity: reserved,
    created_at: new Date(at),
  });
  const quotation = (extra: object = {}): any => ({
    id: 1,
    sale_number: 'QUO-1',
    branch_id: 2,
    customer_id: 4,
    customer_name: 'Ann',
    customer_phone: '1',
    customer_email: 'a@x.io',
    promotion_id: 7,
    served_by_id: 3,
    price_type: 'retail',
    subtotal: 100,
    discount_amount: 5,
    promotion_discount: 0,
    shipping_cost: 2,
    tax_amount: 3,
    total_amount: 100,
    notes: 'n',
    converted_to_sale_id: null,
    items: [
      {
        variant_id: 20,
        quantity: 2,
        unit_price: 10,
        sold_unit_price: 9,
        average_discount_amount: 1,
        special_discount_amount: 2,
        promotion_discount_amount: 3,
        applied_promotion_id: 7,
        tax_amount: 1,
        line_total: 18,
      },
    ],
    ...extra,
  });
  const arrange = (q: any = quotation(), batches: any[] = [batch(30, 10)]) => {
    const ctx = setupSales();
    ctx.prisma.sale.findFirst.mockResolvedValue(q);
    ctx.prisma.productVariant.findFirst.mockResolvedValue({
      id: 20,
      inventory_items: batches,
    });
    ctx.tx.sale.findFirst.mockResolvedValue(null);
    ctx.tx.sale.create.mockResolvedValue({ id: 99, promotion_id: 7 });
    ctx.tx.saleItem.create.mockResolvedValue({ id: 500 });
    ctx.tx.$queryRaw.mockResolvedValue([{ quantity: 8, reserved_quantity: 0 }]);
    ctx.tx.sale.updateMany.mockResolvedValue({ count: 1 });
    ctx.prisma.promotion.findMany.mockResolvedValue([]);
    return ctx;
  };

  it('[BE-MUT-775] a quotation becomes a due sale copying its amounts, with items taken from the oldest batch that has stock and a SALE_OUT audit row', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 5, 10));
    const { prisma, tx, promotions, service } = arrange(quotation(), [
      batch(31, 10, 0, '2026-03-01'),
      batch(30, 10, 0, '2026-01-01'),
      batch(29, 5, 5, '2025-01-01'),
    ]);
    const result: any = await service.convertQuotationToSale(1, 5, 8);
    expect(result).toEqual({ id: 99, promotion_id: 7 });
    expect(prisma.productVariant.findFirst).toHaveBeenCalledWith({
      where: { id: 20, product: { consumer_id: 5 } },
      include: { inventory_items: { where: { branch_id: 2 } } },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.sale.create).toHaveBeenCalledWith({
      data: {
        sale_number: 'SAL-20260505-0001',
        consumer_id: 5,
        customer_id: 4,
        customer_name: 'Ann',
        customer_phone: '1',
        customer_email: 'a@x.io',
        promotion_id: 7,
        branch_id: 2,
        user_id: 8,
        served_by_id: 3,
        sale_type: 'sale',
        price_type: 'retail',
        subtotal: 100,
        discount_amount: 5,
        promotion_discount: 0,
        shipping_cost: 2,
        tax_amount: 3,
        total_amount: 100,
        payment_status: 'due',
        received_amount: 0,
        notes: 'n',
      },
    });
    expect(tx.saleItem.create).toHaveBeenCalledWith({
      data: {
        sale_id: 99,
        variant_id: 20,
        batch_id: 30,
        quantity: 2,
        unit_price: 10,
        sold_unit_price: 9,
        average_discount_amount: 1,
        special_discount_amount: 2,
        promotion_discount_amount: 3,
        applied_promotion_id: 7,
        tax_amount: 1,
        line_total: 18,
      },
    });
    expect(tx.inventoryAuditLog.create).toHaveBeenCalledWith({
      data: {
        consumer_id: 5,
        branch_id: 2,
        variant_id: 20,
        batch_id: 30,
        inventoryBatchId: 30,
        event_type: 'SALE_OUT',
        quantity_delta: -2,
        quantity_after: 8,
        reference_id: 500,
        reference_type: 'sale_items',
        notes: 'Sale #SAL-20260505-0001 (converted from quotation #QUO-1)',
        created_by_user_id: 8,
      },
    });
    expect(tx.sale.updateMany).toHaveBeenCalledWith({
      where: { id: 1, converted_to_sale_id: null },
      data: {
        converted_to_sale_id: 99,
        converted_at: new Date(2026, 4, 5, 10),
      },
    });
    expect(promotions.closePromotionIfExhausted).toHaveBeenCalledWith(7, 5);
  });

  it('[BE-MUT-776] optional item amounts default to zero or null; a sale without a promotion does not touch promotions', async () => {
    const q = quotation({
      promotion_id: null,
      promotion_discount: null,
      items: [{ variant_id: 20, quantity: 1, unit_price: 10, line_total: 10 }],
    });
    const ctx = arrange(q);
    ctx.tx.sale.create.mockResolvedValue({ id: 99, promotion_id: null });
    await ctx.service.convertQuotationToSale(1, 5, 8);
    expect(ctx.tx.sale.create.mock.calls[0][0].data.promotion_discount).toBe(0);
    expect(ctx.tx.saleItem.create.mock.calls[0][0].data).toMatchObject({
      sold_unit_price: null,
      average_discount_amount: 0,
      special_discount_amount: 0,
      promotion_discount_amount: 0,
      applied_promotion_id: null,
      tax_amount: 0,
    });
    expect(ctx.promotions.closePromotionIfExhausted).not.toHaveBeenCalled();
  });

  it('[BE-MUT-777] an already converted quotation, a missing variant or too little stock refuses the conversion with the reason', async () => {
    const done = arrange(quotation({ converted_to_sale_id: 55 }));
    await expect(done.service.convertQuotationToSale(1, 5, 8)).rejects.toThrow(
      'Quotation has already been converted to sale #55',
    );
    const noVariant = arrange();
    noVariant.prisma.productVariant.findFirst.mockResolvedValue(null);
    await expect(
      noVariant.service.convertQuotationToSale(1, 5, 8),
    ).rejects.toThrow('Product variant 20 not found');
    const empty = arrange(quotation(), [batch(30, 5, 5)]);
    await expect(empty.service.convertQuotationToSale(1, 5, 8)).rejects.toThrow(
      'Insufficient stock for variant 20. Available: 0, Requested: 2',
    );
    const short = arrange(quotation(), [batch(30, 3, 2)]);
    await expect(short.service.convertQuotationToSale(1, 5, 8)).rejects.toThrow(
      'Insufficient stock for variant 20. Available: 1, Requested: 2',
    );
    const exact = arrange(quotation(), [batch(30, 3, 1)]);
    await expect(
      exact.service.convertQuotationToSale(1, 5, 8),
    ).resolves.toBeDefined();
    for (const ctx of [done, noVariant, empty, short]) {
      expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
    }
  });

  it('[BE-MUT-778] stock that vanishes during the conversion, or a concurrent conversion, aborts it', async () => {
    const stock = arrange();
    stock.tx.$queryRaw.mockResolvedValue([]);
    await expect(stock.service.convertQuotationToSale(1, 5, 8)).rejects.toThrow(
      'Insufficient stock for variant 20. Stock changed while the sale was being saved; please try again.',
    );
    const raced = arrange();
    raced.tx.sale.updateMany.mockResolvedValue({ count: 0 });
    await expect(raced.service.convertQuotationToSale(1, 5, 8)).rejects.toThrow(
      new BadRequestException('Quotation has already been converted to a sale'),
    );
  });

  it('[BE-MUT-779] an unknown quotation is a 404; unexpected failures are logged and hidden behind a generic 500', async () => {
    const missing = arrange(null);
    await expect(
      missing.service.convertQuotationToSale(1, 5, 8),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expectGenericWrapping({
      run: (f) => {
        const ctx = arrange();
        ctx.prisma.$transaction.mockRejectedValue(f);
        return ctx.service.convertQuotationToSale(1, 5, 8);
      },
      message: 'Error converting quotation to sale',
      logged: [
        'Error converting quotation 1 to sale for consumer 5 and user 8',
      ],
    });
  });
});
