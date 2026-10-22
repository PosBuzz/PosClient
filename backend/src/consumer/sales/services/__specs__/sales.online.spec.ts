import { BadRequestException, NotFoundException } from '@nestjs/common';
import { expectGenericWrapping } from '../../../../../test/helpers/error-wrapping';
import { setupSales } from '../../../../../test/helpers/sales-service-setup';
import * as orderUpdate from '../../../delivery-partners/ledger/order-update';

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const idName = { select: { id: true, name: true } };
const orderInclude = {
  customer: true,
  branch: true,
  user: idName,
  served_by: idName,
  payments: true,
  items: {
    include: { variant: { include: { product: true, sale_unit: true } } },
  },
};

describe('SalesService online orders (unit)', () => {
  const arrange = (rows: any[] = [{ id: 1 }], total = rows.length) => {
    const ctx = setupSales();
    ctx.prisma.sale.findMany.mockResolvedValue(rows);
    ctx.prisma.sale.count.mockResolvedValue(total);
    ctx.prisma.sale.groupBy.mockResolvedValue([]);
    return ctx;
  };

  it('[BE-MUT-800] the default order list is page 1 of 20, newest first, online sales of the shop only, with the pinned includes', async () => {
    const { prisma, service } = arrange();
    const result: any = await service.findAllOnlineOrders({}, 5);
    const where = {
      consumer_id: 5,
      sale_type: 'sale',
      is_online_order: true,
      deleted_at: null,
    };
    expect(prisma.sale.findMany).toHaveBeenCalledWith({
      where,
      skip: 0,
      take: 20,
      orderBy: { created_at: 'desc' },
      include: orderInclude,
    });
    expect(prisma.sale.count).toHaveBeenCalledWith({ where });
    expect(result.meta).toEqual({
      total: 1,
      page: 1,
      limit: 20,
      total_pages: 1,
    });
    expect(prisma.sale.groupBy).toHaveBeenCalledWith({
      by: ['online_order_status'],
      where: { consumer_id: 5, is_online_order: true, deleted_at: null },
      _count: true,
      _sum: { total_amount: true },
    });
  });

  it('[BE-MUT-801] text query values are coerced and clamped (page >= 1, limit 1-100, default 20) and every filter is applied', async () => {
    const { prisma, service } = arrange([], 45);
    await service.findAllOnlineOrders(
      {
        page: '3',
        limit: '10',
        search: 'abc',
        branch_id: '2',
        status: 'READY',
        date_from: '2026-01-01',
        date_to: '2026-02-01',
        sort_by: 'total_amount',
        sort_order: 'asc',
      },
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
      is_online_order: true,
      deleted_at: null,
      OR: [
        { sale_number: { contains: 'abc', mode: 'insensitive' } },
        { customer_name: { contains: 'abc', mode: 'insensitive' } },
        { customer_phone: { contains: 'abc', mode: 'insensitive' } },
        { customer_email: { contains: 'abc', mode: 'insensitive' } },
      ],
      branch_id: 2,
      online_order_status: 'READY',
      sale_date: { gte: new Date('2026-01-01'), lte: new Date('2026-02-01') },
    });
    for (const [input, page, take] of [
      [{ page: 0, limit: 0 }, 1, 20],
      [{ page: -4, limit: 500 }, 1, 100],
      [{ page: 'x', limit: 'y' }, 1, 20],
      [{ limit: 1 }, 1, 1],
      [{ limit: 100 }, 1, 100],
    ] as const) {
      prisma.sale.findMany.mockClear();
      const result: any = await service.findAllOnlineOrders(input, 5);
      expect(result.meta.page).toBe(page);
      expect(prisma.sale.findMany.mock.calls[0][0].take).toBe(take);
    }
    await service.findAllOnlineOrders({ date_from: '2026-01-01' }, 5);
    expect(prisma.sale.findMany.mock.lastCall![0].where.sale_date).toEqual({
      gte: new Date('2026-01-01'),
    });
    await service.findAllOnlineOrders({ date_to: '2026-02-01' }, 5);
    expect(prisma.sale.findMany.mock.lastCall![0].where.sale_date).toEqual({
      lte: new Date('2026-02-01'),
    });
  });

  it('[BE-MUT-802] the summary buckets orders by lower-cased status, treating no status as pending', async () => {
    const { prisma, service } = arrange();
    prisma.sale.groupBy.mockResolvedValue([
      {
        online_order_status: 'READY',
        _count: 2,
        _sum: { total_amount: '150.5' },
      },
      { online_order_status: null, _count: 1, _sum: { total_amount: null } },
    ]);
    const result: any = await service.findAllOnlineOrders({}, 5);
    expect(result.summary).toEqual({
      ready: { count: 2, total: 150.5 },
      pending: { count: 1, total: 0 },
    });
  });

  it('[BE-MUT-803] updating an order runs the edit in one transaction for the shop and user, then returns the order with the pinned includes', async () => {
    const { prisma, service } = arrange();
    const apply = jest
      .spyOn(orderUpdate, 'applyOnlineOrderUpdate')
      .mockResolvedValue(undefined);
    prisma.sale.findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ id: 1, online_order_status: 'READY' });
    const dto = { status: 'READY', delivery_partner_id: 3 } as any;
    await expect(
      service.updateOnlineOrderStatus(1, dto, 5, 9),
    ).resolves.toEqual({ id: 1, online_order_status: 'READY' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(expect.anything(), 1, 5, 9, dto);
    expect(prisma.sale.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 1 },
      include: orderInclude,
    });
  });

  it('[BE-MUT-804] an unknown order is a 404; order failures are hidden behind generic 500s', async () => {
    const { prisma, service, tx } = arrange();
    tx.$queryRaw.mockResolvedValue([]);
    await expect(
      service.updateOnlineOrderStatus(1, { status: 'READY' } as any, 5),
    ).rejects.toThrow(new NotFoundException('Online order not found'));
    expect(tx.sale.update).not.toHaveBeenCalled();
    expect(prisma.sale.update).not.toHaveBeenCalled();
    await expectGenericWrapping({
      run: (f) => {
        const ctx = arrange();
        ctx.prisma.sale.findMany.mockRejectedValue(f);
        return ctx.service.findAllOnlineOrders({}, 5);
      },
      message: 'Error fetching online orders',
      logged: ['Error fetching online orders for consumer 5'],
    });
    await expectGenericWrapping({
      run: (f) => {
        const ctx = arrange();
        ctx.tx.$queryRaw.mockRejectedValue(f);
        return ctx.service.updateOnlineOrderStatus(
          1,
          { status: 'READY' } as any,
          5,
        );
      },
      message: 'Error updating online order status',
      logged: ['Error updating online order status for consumer 5 and order 1'],
      notFoundPassesThrough: true,
    });
  });

  it('[BE-MUT-805] online order stats show the pipeline by status gross, and today net of refunds', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 5, 15, 30));
    const { prisma, service } = arrange();
    prisma.sale.groupBy.mockResolvedValue([
      {
        online_order_status: 'delivered',
        _count: 3,
        _sum: { total_amount: '300' },
      },
      { online_order_status: null, _count: 1, _sum: { total_amount: '20' } },
    ]);
    prisma.sale.aggregate.mockResolvedValue({
      _count: 4,
      _sum: { total_amount: '320' },
    });
    prisma.return.aggregate.mockResolvedValue({
      _sum: { total_refund: '45.5' },
    });
    const result = await service.getOnlineOrderStats(5, 9);
    const baseWhere = {
      consumer_id: 5,
      is_online_order: true,
      sale_type: 'sale',
      deleted_at: null,
      branch_id: 9,
    };
    const todayStart = new Date(2026, 4, 5);
    expect(prisma.sale.groupBy).toHaveBeenCalledWith({
      by: ['online_order_status'],
      where: baseWhere,
      _count: true,
      _sum: { total_amount: true },
    });
    expect(prisma.sale.aggregate).toHaveBeenCalledWith({
      where: { ...baseWhere, sale_date: { gte: todayStart } },
      _count: true,
      _sum: { total_amount: true },
    });
    expect(prisma.return.aggregate).toHaveBeenCalledWith({
      where: {
        consumer_id: 5,
        branch_id: 9,
        return_date: { gte: todayStart },
        original_sale: { is_online_order: true },
      },
      _sum: { total_refund: true },
    });
    expect(result).toEqual({
      by_status: {
        delivered: { count: 3, total: 300 },
        pending: { count: 1, total: 20 },
      },
      today: { count: 4, total: 320, refund: 45.5, net_total: 274.5 },
    });
    prisma.sale.aggregate.mockResolvedValue({ _count: 0, _sum: {} });
    prisma.return.aggregate.mockResolvedValue({ _sum: {} });
    await service.getOnlineOrderStats(5);
    expect('branch_id' in prisma.sale.groupBy.mock.calls[1][0].where).toBe(
      false,
    );
    expect('branch_id' in prisma.return.aggregate.mock.calls[1][0].where).toBe(
      false,
    );
  });

  it('[BE-MUT-806] stats failures are logged and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = arrange();
        prisma.sale.groupBy.mockRejectedValue(f);
        return service.getOnlineOrderStats(5, 9);
      },
      message: 'Error fetching online order stats',
      logged: ['Error fetching online order stats for consumer 5 and branch 9'],
    });
  });
});

describe('SalesService pending deliveries (unit)', () => {
  const pending = (extra: object = {}): any => ({
    id: 1,
    sale_number: 'SAL-1',
    branch_id: 2,
    items: [
      { id: 10, variant_id: 20, batch_id: 30, quantity: 2 },
      { id: 11, variant_id: 21, batch_id: null, quantity: 1 },
    ],
    ...extra,
  });

  it('[BE-MUT-807] the list of pending deliveries is paged and clamped, filtered and searchable', async () => {
    const { prisma, service } = setupSales();
    prisma.sale.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.sale.count.mockResolvedValue(45);
    const result = await service.getPendingDeliveries(5, {});
    const where = { consumer_id: 5, is_delivery_later: true, deleted_at: null };
    expect(prisma.sale.findMany).toHaveBeenCalledWith({
      where,
      include: {
        branch: true,
        customer: true,
        items: {
          include: {
            variant: { include: { product: true, sale_unit: true } },
            batch: true,
          },
        },
        payments: true,
      },
      orderBy: { created_at: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(prisma.sale.count).toHaveBeenCalledWith({ where });
    expect(result.meta).toEqual({
      total: 45,
      page: 1,
      limit: 20,
      total_pages: 3,
    });
    await service.getPendingDeliveries(5, {
      page: '3',
      limit: '10',
      status: 'PENDING',
      branch_id: '2',
      search: 'abc',
    });
    const call = prisma.sale.findMany.mock.calls[1][0];
    expect(call).toMatchObject({ skip: 20, take: 10 });
    expect(call.where).toEqual({
      ...where,
      delivery_status: 'PENDING',
      branch_id: 2,
      OR: [
        { sale_number: { contains: 'abc', mode: 'insensitive' } },
        { customer_name: { contains: 'abc', mode: 'insensitive' } },
        { customer_phone: { contains: 'abc' } },
      ],
    });
    await service.getPendingDeliveries(5, { page: 0, limit: 999 });
    expect(prisma.sale.findMany.mock.calls[2][0]).toMatchObject({
      skip: 0,
      take: 100,
    });
    await service.getPendingDeliveries(5, { limit: 0 });
    expect(prisma.sale.findMany.mock.calls[3][0].take).toBe(20);
    await service.getPendingDeliveries(5, { limit: 1 });
    expect(prisma.sale.findMany.mock.calls[4][0].take).toBe(1);
  });

  const arrange = (row: any = pending()) => {
    const ctx = setupSales();
    ctx.prisma.sale.findFirst.mockResolvedValue(row);
    ctx.tx.sale.updateMany.mockResolvedValue({ count: 1 });
    ctx.tx.$queryRaw.mockResolvedValue([{ quantity: 3, reserved_quantity: 0 }]);
    const findOneSpy = jest
      .spyOn(ctx.service, 'findOne')
      .mockResolvedValue({ id: 1, reloaded: true } as any);
    return { ...ctx, findOneSpy };
  };
  const lookup = {
    where: {
      id: 1,
      consumer_id: 5,
      is_delivery_later: true,
      delivery_status: 'PENDING',
      deleted_at: null,
    },
    include: { items: true },
  };

  it('[BE-MUT-808] completing a delivery claims it, takes the reserved stock of each batch with a SALE_OUT audit row and returns the sale', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-01T10:00:00Z'));
    const { prisma, tx, service, findOneSpy } = arrange();
    await expect(service.completePendingDelivery(1, 5, 8)).resolves.toEqual({
      id: 1,
      reloaded: true,
    });
    expect(prisma.sale.findFirst).toHaveBeenCalledWith(lookup);
    expect(tx.sale.updateMany).toHaveBeenCalledWith({
      where: { id: 1, delivery_status: 'PENDING' },
      data: {
        delivery_status: 'DELIVERED',
        delivered_at: new Date('2026-06-01T10:00:00Z'),
      },
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.inventoryAuditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.inventoryAuditLog.create).toHaveBeenCalledWith({
      data: {
        consumer_id: 5,
        branch_id: 2,
        variant_id: 20,
        batch_id: 30,
        inventoryBatchId: 30,
        event_type: 'SALE_OUT',
        quantity_delta: -2,
        quantity_after: 3,
        reference_id: 10,
        reference_type: 'sale_items',
        notes: 'Delivery completed for sale #SAL-1',
        created_by_user_id: 8,
      },
    });
    expect(findOneSpy).toHaveBeenCalledWith(1, 5);
  });

  it('[BE-MUT-809] completing refuses a missing delivery, a lost race and vanished reservations', async () => {
    const missing = arrange(null);
    await expect(
      missing.service.completePendingDelivery(1, 5, 8),
    ).rejects.toThrow(new NotFoundException('Pending delivery not found'));
    const raced = arrange();
    raced.tx.sale.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      raced.service.completePendingDelivery(1, 5, 8),
    ).rejects.toThrow(
      new BadRequestException('Delivery is no longer pending.'),
    );
    const gone = arrange();
    gone.tx.$queryRaw.mockResolvedValue([]);
    await expect(gone.service.completePendingDelivery(1, 5, 8)).rejects.toThrow(
      'Reserved inventory is no longer available for this delivery.',
    );
  });

  it('[BE-MUT-810] cancelling a delivery claims it and releases the reservation of each batch only', async () => {
    const { prisma, tx, service } = arrange();
    await expect(service.cancelPendingDelivery(1, 5)).resolves.toEqual({
      id: 1,
      reloaded: true,
    });
    expect(prisma.sale.findFirst).toHaveBeenCalledWith(lookup);
    expect(tx.sale.updateMany).toHaveBeenCalledWith({
      where: { id: 1, delivery_status: 'PENDING' },
      data: { delivery_status: 'CANCELLED' },
    });
    expect(tx.inventoryBatch.update.mock.calls.map(([a]: any) => a)).toEqual([
      { where: { id: 30 }, data: { reserved_quantity: { decrement: 2 } } },
    ]);
    const missing = arrange(null);
    await expect(missing.service.cancelPendingDelivery(1, 5)).rejects.toThrow(
      new NotFoundException('Pending delivery not found'),
    );
    const raced = arrange();
    raced.tx.sale.updateMany.mockResolvedValue({ count: 0 });
    await expect(raced.service.cancelPendingDelivery(1, 5)).rejects.toThrow(
      'Delivery is no longer pending.',
    );
    expect(raced.tx.inventoryBatch.update).not.toHaveBeenCalled();
  });
});

describe('SalesService.getDailyTargetReport (unit)', () => {
  const variant = (id: number, target: number, extra: object = {}) => ({
    id,
    name: `V${id}`,
    sku: `S${id}`,
    regular_price: 10,
    daily_sale_objective: target,
    product: { id: 100 + id, name: `P${id}` },
    ...extra,
  });
  const arrange = () => {
    const ctx = setupSales();
    ctx.prisma.productVariant.findMany.mockResolvedValue([
      variant(1, 10),
      variant(2, 4),
      variant(3, 5, { sku: null }),
    ]);
    ctx.prisma.saleItem.groupBy.mockResolvedValue([
      { variant_id: 1, _sum: { quantity: 7, line_total: '70' } },
      { variant_id: 2, _sum: { quantity: 9, line_total: null } },
    ]);
    ctx.prisma.returnItem.groupBy.mockResolvedValue([
      { variant_id: 1, _sum: { quantity: 2 } },
      { variant_id: 3, _sum: { quantity: 4 } },
    ]);
    ctx.prisma.branch.findFirst.mockResolvedValue({ name: 'Main' });
    return ctx;
  };

  it('[BE-MUT-811] each targeted variant shows sold, returned, net and the gap or achievement; totals add up', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 5, 15));
    const { prisma, service } = arrange();
    const result = await service.getDailyTargetReport(5, {});
    expect(prisma.productVariant.findMany).toHaveBeenCalledWith({
      where: { daily_sale_objective: { gt: 0 }, product: { consumer_id: 5 } },
      select: {
        id: true,
        name: true,
        sku: true,
        regular_price: true,
        daily_sale_objective: true,
        product: { select: { id: true, name: true } },
      },
    });
    const day = {
      gte: new Date(2026, 4, 5, 0, 0, 0, 0),
      lte: new Date(2026, 4, 5, 23, 59, 59, 999),
    };
    expect(prisma.saleItem.groupBy).toHaveBeenCalledWith({
      by: ['variant_id'],
      where: {
        sale: {
          consumer_id: 5,
          sale_type: 'sale',
          deleted_at: null,
          sale_date: day,
        },
      },
      _sum: { quantity: true, line_total: true },
    });
    expect(prisma.returnItem.groupBy).toHaveBeenCalledWith({
      by: ['variant_id'],
      where: { return_record: { consumer_id: 5, return_date: day } },
      _sum: { quantity: true },
    });
    expect(result.rows).toEqual([
      {
        product_id: 101,
        product_name: 'P1',
        variant_id: 1,
        variant_name: 'V1',
        sku: 'S1',
        daily_target: 10,
        gross_sold: 7,
        returned: 2,
        actual_sold: 5,
        achievement_pct: 50,
        gap: 5,
      },
      {
        product_id: 102,
        product_name: 'P2',
        variant_id: 2,
        variant_name: 'V2',
        sku: 'S2',
        daily_target: 4,
        gross_sold: 9,
        returned: 0,
        actual_sold: 9,
        achievement_pct: 225,
        gap: 0,
      },
      {
        product_id: 103,
        product_name: 'P3',
        variant_id: 3,
        variant_name: 'V3',
        sku: undefined,
        daily_target: 5,
        gross_sold: 0,
        returned: 4,
        actual_sold: 0,
        achievement_pct: 0,
        gap: 5,
      },
    ]);
    expect(result.summary).toEqual({
      total_target: 19,
      total_gross_sold: 16,
      total_returned: 6,
      total_sold: 14,
      overall_achievement_pct: 73.68,
    });
    expect(result).toMatchObject({
      date: '2026-05-05',
      branch_id: undefined,
      branch_name: undefined,
      meta: { total: 3, page: 1, limit: 20, total_pages: 1 },
    });
  });

  it('[BE-MUT-812] a branch narrows variants, sales and returns and names the branch; a chosen date and page slice the rows', async () => {
    const { prisma, service } = arrange();
    prisma.branch.findUnique.mockResolvedValue({ name: 'Main' });
    const result = await service.getDailyTargetReport(5, {
      date: '2026-01-10T12:00:00',
      branch_id: 2,
      page: 2,
      limit: 2,
    });
    expect(prisma.branch.findUnique).toHaveBeenCalledWith({
      where: { id: 2 },
      select: { name: true },
    });
    expect(
      prisma.productVariant.findMany.mock.calls[0][0].where.inventory_items,
    ).toEqual({
      some: { branch_id: 2 },
    });
    expect(prisma.saleItem.groupBy.mock.calls[0][0].where.sale.branch_id).toBe(
      2,
    );
    expect(
      prisma.returnItem.groupBy.mock.calls[0][0].where.return_record.branch_id,
    ).toBe(2);
    expect(result).toMatchObject({
      date: '2026-01-10',
      branch_id: 2,
      branch_name: 'Main',
      meta: { total: 3, page: 2, limit: 2, total_pages: 2 },
    });
    expect(result.rows.map((r) => r.variant_id)).toEqual([3]);
    prisma.branch.findUnique.mockResolvedValue(null);
    expect(
      (await service.getDailyTargetReport(5, { branch_id: 2 } as any))
        .branch_name,
    ).toBeUndefined();
  });

  it('[BE-MUT-813] with no targets everything is zero', async () => {
    const { prisma, service } = arrange();
    prisma.productVariant.findMany.mockResolvedValue([]);
    const result = await service.getDailyTargetReport(5, {});
    expect(result.rows).toEqual([]);
    expect(result.summary).toEqual({
      total_target: 0,
      total_gross_sold: 0,
      total_returned: 0,
      total_sold: 0,
      overall_achievement_pct: 0,
    });
    expect(result.meta.total_pages).toBe(0);
    prisma.productVariant.findMany.mockResolvedValue([variant(1, 3)]);
    prisma.saleItem.groupBy.mockResolvedValue([
      { variant_id: 1, _sum: { quantity: 1, line_total: '1' } },
    ]);
    prisma.returnItem.groupBy.mockResolvedValue([]);
    const third = await service.getDailyTargetReport(5, {});
    expect(third.rows[0]).toMatchObject({ achievement_pct: 33.33, gap: 2 });
    expect(third.summary.overall_achievement_pct).toBe(33.33);
    prisma.productVariant.findMany.mockResolvedValue([
      variant(1, 3, { daily_sale_objective: null }),
    ]);
    const none = await service.getDailyTargetReport(5, {});
    expect(none.rows[0]).toMatchObject({
      daily_target: 0,
      achievement_pct: 0,
      gap: 0,
    });
  });
});
