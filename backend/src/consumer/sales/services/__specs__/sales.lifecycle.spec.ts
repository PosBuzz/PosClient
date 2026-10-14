import { BadRequestException, NotFoundException } from '@nestjs/common';
import { expectGenericWrapping } from '../../../../../test/helpers/error-wrapping';
import { setupSales } from '../../../../../test/helpers/sales-service-setup';

const created = new Date('2026-05-05T10:00:00Z');

const sale = (extra: object = {}): any => ({
  id: 1,
  sale_number: 'SAL-1',
  branch_id: 2,
  created_at: created,
  is_delivery_later: false,
  delivery_status: null,
  converted_to_sale_id: null,
  items: [
    { id: 10, variant_id: 20, batch_id: 30, quantity: 2 },
    { id: 11, variant_id: 21, batch_id: 31, quantity: 1 },
    { id: 12, variant_id: 22, batch_id: null, quantity: 5 },
  ],
  payments: [{ created_at: new Date(created.getTime() + 30_000) }],
  returns_as_original: [],
  returns_as_exchange: [],
  ...extra,
});

afterEach(() => jest.restoreAllMocks());

describe('SalesService.softDelete (unit)', () => {
  const arrange = (row: any = sale()) => {
    const ctx = setupSales();
    ctx.prisma.sale.findFirst.mockResolvedValue(row);
    ctx.tx.sale.updateMany.mockResolvedValue({ count: 1 });
    ctx.tx.inventoryBatch.update.mockResolvedValue({ quantity: 12 });
    ctx.prisma.rewardsPointTransaction.findMany.mockResolvedValue([]);
    return ctx;
  };

  it('[BE-MUT-740] a sale is claimed, its stock put back into the exact batches with SALE_DELETE_IN audit rows, and the delete is reported', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-01T00:00:00Z'));
    const { prisma, tx, service } = arrange();
    await expect(
      service.softDelete(1, 5, 8, { reason: '  mistake  ' } as any),
    ).resolves.toEqual({
      message: 'Sale deleted and stock restored',
      sale_id: 1,
    });
    expect(prisma.sale.findFirst).toHaveBeenCalledWith({
      where: { id: 1, consumer_id: 5, sale_type: 'sale', deleted_at: null },
      include: {
        items: true,
        payments: true,
        returns_as_original: { select: { id: true, return_number: true } },
        returns_as_exchange: { select: { id: true } },
      },
    });
    expect(tx.sale.updateMany).toHaveBeenCalledWith({
      where: { id: 1, deleted_at: null },
      data: {
        deleted_at: new Date('2026-06-01T00:00:00Z'),
        deleted_by_id: 8,
        delete_reason: 'mistake',
      },
    });
    expect(tx.inventoryBatch.update.mock.calls.map(([a]: any) => a)).toEqual([
      { where: { id: 30 }, data: { quantity: { increment: 2 } } },
      { where: { id: 31 }, data: { quantity: { increment: 1 } } },
    ]);
    expect(tx.inventoryAuditLog.create).toHaveBeenNthCalledWith(1, {
      data: {
        consumer_id: 5,
        branch_id: 2,
        variant_id: 20,
        batch_id: 30,
        inventoryBatchId: 30,
        event_type: 'SALE_DELETE_IN',
        quantity_delta: 2,
        quantity_after: 12,
        reference_id: 10,
        reference_type: 'sale_items',
        notes: 'Sale #SAL-1 deleted - stock restored: 2',
        created_by_user_id: 8,
      },
    });
    expect(tx.inventoryAuditLog.create).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('[BE-MUT-741] a missing reason is stored as null', async () => {
    const { tx, service } = arrange();
    await service.softDelete(1, 5, 8, {});
    expect(tx.sale.updateMany.mock.calls[0][0].data.delete_reason).toBeNull();
    await service.softDelete(1, 5, 8, { reason: '   ' });
    expect(tx.sale.updateMany.mock.calls[1][0].data.delete_reason).toBeNull();
    await service.softDelete(1, 5, 8, undefined as any);
    expect(tx.sale.updateMany.mock.calls[2][0].data.delete_reason).toBeNull();
  });

  it('[BE-MUT-742] a pending delivery releases its reservation without an audit row; a cancelled delivery touches no stock', async () => {
    const pending = arrange(
      sale({ is_delivery_later: true, delivery_status: 'PENDING' }),
    );
    await pending.service.softDelete(1, 5, 8, {});
    expect(
      pending.tx.inventoryBatch.update.mock.calls.map(([a]: any) => a),
    ).toEqual([
      { where: { id: 30 }, data: { reserved_quantity: { decrement: 2 } } },
      { where: { id: 31 }, data: { reserved_quantity: { decrement: 1 } } },
    ]);
    expect(pending.tx.inventoryAuditLog.create).not.toHaveBeenCalled();
    const cancelled = arrange(
      sale({ is_delivery_later: true, delivery_status: 'CANCELLED' }),
    );
    await cancelled.service.softDelete(1, 5, 8, {});
    expect(cancelled.tx.inventoryBatch.update).not.toHaveBeenCalled();
    const delivered = arrange(
      sale({ is_delivery_later: true, delivery_status: 'DELIVERED' }),
    );
    await delivered.service.softDelete(1, 5, 8, {});
    expect(delivered.tx.inventoryBatch.update.mock.calls[0][0].data).toEqual({
      quantity: { increment: 2 },
    });
  });

  it('[BE-MUT-743] a sale with returns, an exchange sale, late payments or a quotation link cannot be deleted, with the reason', async () => {
    const withReturns = arrange(
      sale({
        returns_as_original: [
          { id: 1, return_number: 'R-1' },
          { id: 2, return_number: 'R-2' },
        ],
      }),
    );
    await expect(
      withReturns.service.softDelete(1, 5, 8, {} as any),
    ).rejects.toThrow(
      'This sale has 2 return(s) against it (R-1, R-2). Delete or reverse the return(s) first.',
    );
    const exchange = arrange(sale({ returns_as_exchange: [{ id: 3 }] }));
    await expect(
      exchange.service.softDelete(1, 5, 8, {} as any),
    ).rejects.toThrow(
      'This sale was created as an exchange for a return and cannot be deleted.',
    );
    const late = arrange(
      sale({
        payments: [{ created_at: new Date(created.getTime() + 60_001) }],
      }),
    );
    await expect(late.service.softDelete(1, 5, 8, {} as any)).rejects.toThrow(
      'This sale has partial payments collected after it was created. Reverse those payments before deleting.',
    );
    const edge = arrange(
      sale({
        payments: [{ created_at: new Date(created.getTime() + 60_000) }],
      }),
    );
    await expect(
      edge.service.softDelete(1, 5, 8, {} as any),
    ).resolves.toBeDefined();
    const converted = arrange(sale({ converted_to_sale_id: 9 }));
    await expect(
      converted.service.softDelete(1, 5, 8, {} as any),
    ).rejects.toThrow(
      'A quotation-converted record cannot be deleted from here.',
    );
    for (const ctx of [withReturns, exchange, late, converted]) {
      expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
    }
  });

  it('[BE-MUT-744] a missing sale is a 404 and a lost delete race is a 400 that restocks nothing', async () => {
    const missing = arrange(null);
    await expect(
      missing.service.softDelete(1, 5, 8, {} as any),
    ).rejects.toThrow(new NotFoundException('Sale not found'));
    const raced = arrange();
    raced.tx.sale.updateMany.mockResolvedValue({ count: 0 });
    await expect(raced.service.softDelete(1, 5, 8, {} as any)).rejects.toThrow(
      new BadRequestException('Sale has already been deleted'),
    );
    expect(raced.tx.inventoryBatch.update).not.toHaveBeenCalled();
  });

  it('[BE-MUT-745] earned reward points are reversed per customer after the delete, as an offsetting adjustment', async () => {
    const { prisma, rewards, service } = arrange();
    prisma.rewardsPointTransaction.findMany.mockResolvedValue([
      { customer_id: 4, points: 100 },
      { customer_id: 4, points: -30 },
      { customer_id: 6, points: 50 },
      { customer_id: 7, points: 0 },
    ]);
    await service.softDelete(1, 5, 8, {});
    expect(prisma.rewardsPointTransaction.findMany).toHaveBeenCalledWith({
      where: {
        sale_id: 1,
        consumer_id: 5,
        type: { in: ['EARN', 'ADJUSTMENT'] },
      },
      select: { customer_id: true, points: true },
    });
    expect(rewards.adjustPoints.mock.calls).toEqual([
      [
        5,
        {
          customer_id: 4,
          points: -70,
          description: 'Points reversed - sale #SAL-1 deleted',
        },
        8,
      ],
      [
        5,
        {
          customer_id: 6,
          points: -50,
          description: 'Points reversed - sale #SAL-1 deleted',
        },
        8,
      ],
    ]);
  });

  it('[BE-MUT-746] a rewards failure never blocks the delete; other failures are hidden behind a generic 500', async () => {
    const ctx = arrange();
    const log = jest
      .spyOn((ctx.service as any).logger, 'error')
      .mockImplementation();
    ctx.prisma.rewardsPointTransaction.findMany.mockResolvedValue([
      { customer_id: 4, points: 10 },
    ]);
    ctx.rewards.adjustPoints.mockRejectedValue(new Error('rewards down'));
    await expect(
      ctx.service.softDelete(1, 5, 8, {} as any),
    ).resolves.toMatchObject({ sale_id: 1 });
    expect(log).toHaveBeenCalledWith(
      'Failed to delete rewards points for sale 1',
      expect.any(String),
    );
    log.mockRestore();
    await expectGenericWrapping({
      run: (f) => {
        const c = arrange();
        c.prisma.$transaction.mockRejectedValue(f);
        return c.service.softDelete(1, 5, 8, {});
      },
      message: 'Failed to delete sale',
      logged: ['Error deleting sale 1 for consumer 5'],
    });
  });
});

describe('SalesService.restore (unit)', () => {
  const deleted = (extra: object = {}): any =>
    sale({ deleted_at: created, ...extra });
  const arrange = (row: any = deleted(), batches?: any[]) => {
    const ctx = setupSales();
    ctx.prisma.sale.findFirst
      .mockResolvedValueOnce(row)
      .mockResolvedValue({ id: 1, items: [], sale_number: 'SAL-1' });
    ctx.prisma.inventoryBatch.findMany.mockResolvedValue(
      batches ?? [
        { id: 30, quantity: 5, reserved_quantity: 0, batch_number: 'A' },
        { id: 31, quantity: 5, reserved_quantity: 0, batch_number: 'B' },
      ],
    );
    ctx.tx.sale.updateMany.mockResolvedValue({ count: 1 });
    ctx.tx.$queryRaw.mockResolvedValue([{ quantity: 3, reserved_quantity: 0 }]);
    ctx.prisma.rewardsPointTransaction.findMany.mockResolvedValue([]);
    ctx.prisma.return.findMany.mockResolvedValue([]);
    ctx.prisma.returnItem.groupBy.mockResolvedValue([]);
    return ctx;
  };

  it('[BE-MUT-747] a deleted sale is claimed back, its stock taken from the same batches with SALE_RESTORE_OUT audit rows, and the sale is returned', async () => {
    const { prisma, tx, service } = arrange();
    await expect(service.restore(1, 5, 8)).resolves.toMatchObject({ id: 1 });
    expect(prisma.sale.findFirst.mock.calls[0][0]).toEqual({
      where: {
        id: 1,
        consumer_id: 5,
        sale_type: 'sale',
        deleted_at: { not: null },
      },
      include: { items: true },
    });
    expect(prisma.inventoryBatch.findMany).toHaveBeenCalledWith({
      where: { id: { in: [30, 31] } },
      select: {
        id: true,
        quantity: true,
        reserved_quantity: true,
        batch_number: true,
      },
    });
    expect(tx.sale.updateMany).toHaveBeenCalledWith({
      where: { id: 1, deleted_at: { not: null } },
      data: { deleted_at: null, deleted_by_id: null, delete_reason: null },
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.inventoryAuditLog.create).toHaveBeenNthCalledWith(1, {
      data: {
        consumer_id: 5,
        branch_id: 2,
        variant_id: 20,
        batch_id: 30,
        inventoryBatchId: 30,
        event_type: 'SALE_RESTORE_OUT',
        quantity_delta: -2,
        quantity_after: 3,
        reference_id: 10,
        reference_type: 'sale_items',
        notes: 'Sale #SAL-1 restored - stock deducted: 2',
        created_by_user_id: 8,
      },
    });
  });

  it('[BE-MUT-748] a missing deleted sale is a 404; not enough stock (or a vanished batch) refuses the restore with the reason', async () => {
    const missing = arrange(null);
    await expect(missing.service.restore(1, 5, 8)).rejects.toThrow(
      new NotFoundException('Deleted sale not found'),
    );
    const message =
      'Cannot restore this sale: the stock it consumed is no longer available in the original batch(es).';
    const short = arrange(deleted(), [
      { id: 30, quantity: 1, reserved_quantity: 0 },
      { id: 31, quantity: 5, reserved_quantity: 0 },
    ]);
    await expect(short.service.restore(1, 5, 8)).rejects.toThrow(message);
    const gone = arrange(deleted(), [
      { id: 30, quantity: 5, reserved_quantity: 0 },
    ]);
    await expect(gone.service.restore(1, 5, 8)).rejects.toThrow(message);
    const exact = arrange(deleted(), [
      { id: 30, quantity: 2, reserved_quantity: 0 },
      { id: 31, quantity: 1, reserved_quantity: 0 },
    ]);
    await expect(exact.service.restore(1, 5, 8)).resolves.toBeDefined();
    for (const ctx of [short, gone]) {
      expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
    }
  });

  it('[BE-MUT-749] several lines on one batch are summed when checking availability', async () => {
    const row = deleted({
      items: [
        { id: 10, variant_id: 20, batch_id: 30, quantity: 2 },
        { id: 11, variant_id: 20, batch_id: 30, quantity: 2 },
      ],
    });
    const short = arrange(row, [{ id: 30, quantity: 3, reserved_quantity: 0 }]);
    await expect(short.service.restore(1, 5, 8)).rejects.toThrow(
      'no longer available',
    );
    const enough = arrange(row, [
      { id: 30, quantity: 4, reserved_quantity: 0 },
    ]);
    await expect(enough.service.restore(1, 5, 8)).resolves.toBeDefined();
  });

  it('[BE-MUT-750] a pending delivery re-reserves instead of deducting (no audit row) and counts unreserved stock; a cancelled delivery moves nothing', async () => {
    const pendingRow = deleted({
      is_delivery_later: true,
      delivery_status: 'PENDING',
    });
    const reserved = arrange(pendingRow, [
      { id: 30, quantity: 5, reserved_quantity: 4 },
      { id: 31, quantity: 5, reserved_quantity: 0 },
    ]);
    await expect(reserved.service.restore(1, 5, 8)).rejects.toThrow(
      'no longer available',
    );
    const ok = arrange(pendingRow);
    await ok.service.restore(1, 5, 8);
    expect(ok.tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(ok.tx.inventoryAuditLog.create).not.toHaveBeenCalled();
    const cancelled = arrange(
      deleted({ is_delivery_later: true, delivery_status: 'CANCELLED' }),
      [
        { id: 30, quantity: 0, reserved_quantity: 0 },
        { id: 31, quantity: 0, reserved_quantity: 0 },
      ],
    );
    await expect(cancelled.service.restore(1, 5, 8)).resolves.toBeDefined();
    expect(cancelled.tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('[BE-MUT-751] a lost restore race, or stock gone between check and update, aborts the restore', async () => {
    const raced = arrange();
    raced.tx.sale.updateMany.mockResolvedValue({ count: 0 });
    await expect(raced.service.restore(1, 5, 8)).rejects.toThrow(
      'Sale has already been restored',
    );
    expect(raced.tx.$queryRaw).not.toHaveBeenCalled();
    const outOfStock = arrange();
    outOfStock.tx.$queryRaw.mockResolvedValue([]);
    await expect(outOfStock.service.restore(1, 5, 8)).rejects.toThrow(
      'no longer available',
    );
  });

  it('[BE-MUT-752] restoring re-applies the reward points the sale earned; failures are hidden behind a generic 500', async () => {
    const { prisma, rewards, service } = arrange();
    prisma.rewardsPointTransaction.findMany.mockResolvedValue([
      { customer_id: 4, points: 70 },
    ]);
    await service.restore(1, 5, 8);
    expect(rewards.adjustPoints).toHaveBeenCalledWith(
      5,
      {
        customer_id: 4,
        points: 70,
        description: 'Points re-applied - sale #SAL-1 restored',
      },
      8,
    );
    await expectGenericWrapping({
      run: (f) => {
        const c = arrange();
        c.prisma.$transaction.mockRejectedValue(f);
        return c.service.restore(1, 5, 8);
      },
      message: 'Failed to restore sale',
      logged: ['Error restoring sale 1 for consumer 5'],
    });
  });
});
