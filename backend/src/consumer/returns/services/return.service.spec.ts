import { Logger } from '@nestjs/common';
import { expectGenericWrapping } from '../../../../test/helpers/error-wrapping';
import { ReturnService } from './return.service';

const NOW = new Date(2026, 4, 5, 10, 0, 0); // local time, so the RET-YYYYMMDD prefix is stable

const sale = (extra: object = {}) => ({
  id: 1,
  sale_number: 'S-1',
  total_amount: 200,
  shipping_cost: 10,
  customer_id: 4,
  items: [
    { id: 10, variant_id: 20, quantity: 2, line_total: 100 },
    { id: 11, variant_id: 21, quantity: 1, line_total: 90 },
  ],
  payments: [],
  ...extra,
});

function setup() {
  const mk = (...names: string[]) =>
    Object.fromEntries(names.map((n) => [n, jest.fn()]));
  const prisma: any = {
    sale: mk('findFirst'),
    branch: mk('findFirst'),
    returnItem: mk('aggregate', 'create'),
    return: mk('findMany', 'count', 'create', 'findFirst', 'aggregate'),
    inventoryBatch: mk('findFirst', 'update', 'findUnique'),
    inventoryAdjustment: mk('create'),
    inventoryAuditLog: mk('create'),
    returnPayment: mk('create'),
    returnExchange: mk('create'),
    productVariant: mk('findFirst'),
    rewardsPointTransaction: mk('findMany'),
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(prisma)),
  };
  const rewards: any = {
    processCreditRefund: jest.fn(),
    adjustPoints: jest.fn(),
  };
  prisma.sale.findFirst.mockResolvedValue(sale());
  prisma.branch.findFirst.mockResolvedValue({ id: 2 });
  prisma.returnItem.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
  prisma.return.findMany.mockResolvedValue([]);
  prisma.return.count.mockResolvedValue(0);
  prisma.return.findFirst.mockResolvedValue(null);
  prisma.return.create.mockImplementation(async ({ data }: any) => ({
    id: 77,
    ...data,
  }));
  prisma.returnItem.create.mockImplementation(async ({ data }: any) => ({
    id: 88,
    ...data,
  }));
  prisma.returnPayment.create.mockImplementation(async ({ data }: any) => ({
    id: 99,
    ...data,
  }));
  prisma.returnExchange.create.mockImplementation(async ({ data }: any) => ({
    id: 55,
    ...data,
  }));
  prisma.inventoryBatch.findFirst.mockResolvedValue({ id: 30 });
  prisma.inventoryBatch.update.mockResolvedValue({ quantity: 12 });
  prisma.productVariant.findFirst.mockResolvedValue({ id: 30 });
  prisma.$queryRaw.mockResolvedValue([{ quantity: 4, reserved_quantity: 0 }]);
  prisma.rewardsPointTransaction.findMany.mockResolvedValue([]);
  return { prisma, rewards, service: new ReturnService(prisma, rewards) };
}

const dto = (extra: object = {}): any => ({
  original_sale_id: 1,
  branch_id: 2,
  items: [{ sale_item_id: 10, variant_id: 20, quantity: 1, batch_id: 30 }],
  payments: [{ payment_method: 'CASH', amount: 50 }],
  reason: 'broken',
  notes: 'note',
  ...extra,
});

const fail = async (service: ReturnService, d: any) =>
  service.create(5, 8, d).catch((e) => e);

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('ReturnService.create validation (unit)', () => {
  it('[BE-MUT-520] the original sale must belong to the shop and be undeleted; the branch must belong to the shop', async () => {
    const { prisma, service } = setup();
    prisma.sale.findFirst.mockResolvedValue(null);
    const noSale = await fail(service, dto());
    expect(noSale.message).toBe('Original sale not found');
    expect(prisma.sale.findFirst).toHaveBeenCalledWith({
      where: { id: 1, consumer_id: 5, deleted_at: null },
      include: { items: true, payments: true },
    });
    prisma.sale.findFirst.mockResolvedValue(sale());
    prisma.branch.findFirst.mockResolvedValue(null);
    const noBranch = await fail(service, dto());
    expect(noBranch.message).toBe('Branch not found');
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { id: 2, consumer_id: 5 },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('[BE-MUT-521] a shipping refund must be a finite non-negative number', async () => {
    const { service } = setup();
    for (const bad of [-1, 'abc', Infinity]) {
      const error = await fail(service, dto({ shipping_refund_amount: bad }));
      expect(error.message).toBe(
        'Shipping refund amount must be a valid non-negative number',
      );
    }
  });

  it('[BE-MUT-522] zero-quantity lines are dropped; lines not on the sale are rejected', async () => {
    const { prisma, service } = setup();
    const foreign = await fail(
      service,
      dto({ items: [{ sale_item_id: 999, variant_id: 20, quantity: 1 }] }),
    );
    expect(foreign.message).toBe(
      'Some return items do not belong to the original sale',
    );
    const onlyZero = await fail(
      service,
      dto({
        items: [{ sale_item_id: 10, variant_id: 20, quantity: 0 }],
        payments: [{ payment_method: 'CASH', amount: 1 }],
      }),
    );
    expect(onlyZero.message).toBe(
      'Select at least one return item or add a shipping refund amount',
    );
    expect(prisma.returnItem.aggregate).not.toHaveBeenCalled();
  });

  it('[BE-MUT-523] the quantity already returned counts against the sold quantity, exactly at the boundary', async () => {
    const { prisma, service } = setup();
    prisma.returnItem.aggregate.mockResolvedValue({ _sum: { quantity: 1 } });
    const over = await fail(
      service,
      dto({ items: [{ sale_item_id: 10, variant_id: 20, quantity: 2 }] }),
    );
    expect(over.message).toBe(
      'Return quantity exceeds available quantity for item 10. Available: 1, Requested: 2',
    );
    expect(prisma.returnItem.aggregate).toHaveBeenCalledWith({
      where: { sale_item_id: 10 },
      _sum: { quantity: true },
    });
    prisma.returnItem.aggregate.mockResolvedValue({ _sum: { quantity: 1 } });
    const exact = await fail(
      service,
      dto({
        items: [{ sale_item_id: 10, variant_id: 20, quantity: 1 }],
      }),
    );
    expect(exact.message).toBeUndefined();
    prisma.returnItem.aggregate.mockResolvedValue({ _sum: {} });
    await expect(
      service.create(
        5,
        8,
        dto({ items: [{ sale_item_id: 10, variant_id: 20, quantity: 1 }] }),
      ),
    ).resolves.toBeDefined();
  });

  it("[BE-MUT-524] the returned variant must be the sold one and the batch must be that variant's batch in this shop", async () => {
    const { prisma, service } = setup();
    const wrongVariant = await fail(
      service,
      dto({ items: [{ sale_item_id: 10, variant_id: 99, quantity: 1 }] }),
    );
    expect(wrongVariant.message).toBe(
      'Return item 10 does not match the sold product variant',
    );
    prisma.inventoryBatch.findFirst.mockResolvedValue(null);
    const wrongBatch = await fail(service, dto());
    expect(wrongBatch.message).toBe('Batch 30 is not a batch of variant 20');
    expect(prisma.inventoryBatch.findFirst).toHaveBeenCalledWith({
      where: { id: 30, variant_id: 20, branch: { consumer_id: 5 } },
      select: { id: true },
    });
    prisma.inventoryBatch.findFirst.mockClear();
    prisma.inventoryBatch.findFirst.mockResolvedValue({ id: 30 });
    await service.create(
      5,
      8,
      dto({ items: [{ sale_item_id: 10, variant_id: 20, quantity: 1 }] }),
    );
    expect(prisma.inventoryBatch.findFirst).not.toHaveBeenCalled();
  });

  it('[BE-MUT-525] at least one positive payment is required', async () => {
    const { service } = setup();
    for (const payments of [undefined, []]) {
      const error = await fail(service, dto({ payments }));
      expect(error.message).toBe(
        'At least one payment method is required to process a return',
      );
    }
    for (const amount of [0, -5, 'x']) {
      const error = await fail(
        service,
        dto({ payments: [{ payment_method: 'CASH', amount }] }),
      );
      expect(error.message).toBe('All payment amounts must be greater than 0');
    }
  });

  it('[BE-MUT-526] shipping can only be refunded once, up to what remains of the sale shipping', async () => {
    const { prisma, service } = setup();
    const ok = await fail(
      service,
      dto({
        items: [],
        shipping_refund_amount: 10,
        payments: [{ payment_method: 'CASH', amount: 10 }],
      }),
    );
    expect(ok.message).toBeUndefined();
    const tooMuch = await fail(
      service,
      dto({
        items: [],
        shipping_refund_amount: 10.02,
        payments: [{ payment_method: 'CASH', amount: 10.02 }],
      }),
    );
    expect(tooMuch.message).toBe(
      'Shipping refund amount (৳10.02) exceeds remaining refundable shipping (৳10.00)',
    );
    prisma.return.findMany.mockResolvedValue([
      {
        total_refund: 60,
        total_exchange: 0,
        items: [{ sale_item_id: 10, quantity: 1 }],
      },
    ]);
    prisma.return.count.mockResolvedValue(1);
    const again = await fail(
      service,
      dto({
        items: [],
        shipping_refund_amount: 5,
        payments: [{ payment_method: 'CASH', amount: 5 }],
      }),
    );
    expect(again.message).toBe(
      'Shipping refund amount (৳5.00) exceeds remaining refundable shipping (৳0.00)',
    );
    expect(prisma.return.findMany).toHaveBeenCalledWith({
      where: { original_sale_id: 1 },
      include: { items: true },
    });
  });

  it('[BE-MUT-527] the sum of earlier returns reduces what can still be returned; the message states both amounts', async () => {
    const { prisma, service } = setup();
    prisma.return.findMany.mockResolvedValue([
      { total_refund: 100, total_exchange: 40, items: [] },
    ]);
    prisma.return.count.mockResolvedValue(1);
    const error = await fail(
      service,
      dto({
        items: [
          { sale_item_id: 10, variant_id: 20, quantity: 2 },
          { sale_item_id: 11, variant_id: 21, quantity: 1 },
        ],
        payments: [{ payment_method: 'CASH', amount: 190 }],
      }),
    );
    expect(error.message).toBe(
      'Selected return value (৳190.00) exceeds available amount (৳60.00)',
    );
  });

  it('[BE-MUT-528] a shipping-only return needs a shipping amount; a mismatching payment is refused with both amounts', async () => {
    const { service } = setup();
    const none = await fail(service, dto({ items: [] }));
    expect(none.message).toBe(
      'Select at least one return item or add a shipping refund amount',
    );
    const mismatch = await fail(
      service,
      dto({ payments: [{ payment_method: 'CASH', amount: 1 }] }),
    );
    expect(mismatch.message).toBe(
      'Total payment amount must exactly match selected return value. Expected ৳50.00, got ৳1.00',
    );
  });

  it('[BE-MUT-529] payments must match the selected value within one cent', async () => {
    const { service } = setup();
    for (const amount of [49.98, 50.02]) {
      const error = await fail(
        service,
        dto({ payments: [{ payment_method: 'CASH', amount }] }),
      );
      expect(error.message).toContain(
        `Total payment amount must exactly match selected return value. Expected ৳50.00, got ৳${amount.toFixed(2)}`,
      );
    }
    for (const amount of [49.995, 50.005]) {
      const error = await fail(
        service,
        dto({ payments: [{ payment_method: 'CASH', amount }] }),
      );
      expect(error.message).toBeUndefined();
    }
  });

  it('[BE-MUT-530] refunds plus exchanges can never exceed what is still available, even inside the one-cent tolerance', async () => {
    const { prisma, service } = setup();
    prisma.sale.findFirst.mockResolvedValue(sale({ shipping_cost: 10.01 }));
    const error = await fail(
      service,
      dto({
        items: [
          { sale_item_id: 10, variant_id: 20, quantity: 2 },
          { sale_item_id: 11, variant_id: 21, quantity: 1 },
        ],
        shipping_refund_amount: 10.01,
        payments: [
          { payment_method: 'CASH', amount: 100 },
          { payment_method: 'exchange', amount: 100.01 },
        ],
      }),
    );
    expect(error.message).toBe(
      'Total refund and exchange amount (৳200.01) exceeds available amount (৳200.00). Already returned: ৳0.00',
    );
  });
});

describe('ReturnService.create writes (unit)', () => {
  it('[BE-MUT-531] a return is recorded under a locked, sequential RET number with refund and exchange totals', async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    const { prisma, service } = setup();
    prisma.return.findFirst.mockResolvedValue({
      return_number: 'RET-20260505-0007',
    });
    const result: any = await service.create(5, 8, dto());
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.return.count).toHaveBeenCalledWith({
      where: { original_sale_id: 1 },
    });
    expect(prisma.return.findFirst).toHaveBeenCalledWith({
      where: { consumer_id: 5, return_number: { startsWith: 'RET-20260505' } },
      orderBy: { return_number: 'desc' },
    });
    expect(prisma.return.create).toHaveBeenCalledWith({
      data: {
        return_number: 'RET-20260505-0008',
        original_sale_id: 1,
        consumer_id: 5,
        branch_id: 2,
        user_id: 8,
        exchange_sale_id: undefined,
        total_refund: 50,
        total_exchange: 0,
        reason: 'broken',
        notes: 'note',
      },
      include: {
        original_sale: { select: { id: true, sale_number: true } },
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });
    expect(result.return_number).toBe('RET-20260505-0008');
    expect(result.items).toHaveLength(1);
    expect(result.payments).toHaveLength(1);
    expect(result.exchanges).toEqual([]);
  });

  it('[BE-MUT-532] the first return of the day is number 0001', async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    const { service } = setup();
    const result: any = await service.create(5, 8, dto());
    expect(result.return_number).toBe('RET-20260505-0001');
  });

  it('[BE-MUT-533] a return recorded meanwhile aborts this one with a reload message', async () => {
    const { prisma, service } = setup();
    prisma.return.count.mockResolvedValue(1);
    const error = await fail(service, dto());
    expect(error.message).toBe(
      'Another return was recorded for this sale at the same time. Please reload the sale and try again.',
    );
    expect(prisma.return.create).not.toHaveBeenCalled();
  });

  it('[BE-MUT-534] each returned line is stored, put back into its batch with an adjustment and a RETURN_IN audit entry', async () => {
    const { prisma, service } = setup();
    await service.create(5, 8, dto());
    expect(prisma.returnItem.create).toHaveBeenCalledWith({
      data: {
        return_id: 77,
        sale_item_id: 10,
        variant_id: 20,
        batch_id: 30,
        quantity: 1,
      },
      include: {
        variant: { include: { product: { select: { id: true, name: true } } } },
        batch: true,
      },
    });
    expect(prisma.inventoryAdjustment.create).toHaveBeenCalledWith({
      data: {
        variant_id: 20,
        branch_id: 2,
        batch_id: 30,
        quantity_change: 1,
        reason: 'Return from sale S-1',
        notes: expect.stringMatching(/^Return ID: RET-\d{8}-0001$/),
        created_by_user_id: 8,
        adjustment_type: 'return_in',
      },
    });
    expect(prisma.inventoryBatch.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: { quantity: { increment: 1 } },
    });
    expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith({
      data: {
        consumer_id: 5,
        branch_id: 2,
        variant_id: 20,
        batch_id: 30,
        inventoryBatchId: 30,
        event_type: 'RETURN_IN',
        quantity_delta: 1,
        quantity_after: 12,
        reference_id: 88,
        reference_type: 'return_items',
        notes: expect.stringMatching(/^Return #RET-\d{8}-0001 from sale S-1$/),
        created_by_user_id: 8,
      },
    });
  });

  it('[BE-MUT-535] a returned line without a batch records the line but moves no stock', async () => {
    const { prisma, service } = setup();
    await service.create(
      5,
      8,
      dto({ items: [{ sale_item_id: 10, variant_id: 20, quantity: 1 }] }),
    );
    expect(prisma.returnItem.create).toHaveBeenCalledTimes(1);
    expect(prisma.inventoryAdjustment.create).not.toHaveBeenCalled();
    expect(prisma.inventoryBatch.update).not.toHaveBeenCalled();
    expect(prisma.inventoryAuditLog.create).not.toHaveBeenCalled();
  });

  it('[BE-MUT-536] payments are stored as given; exchange payments count as exchange, never as cash refund', async () => {
    const { prisma, service } = setup();
    const result: any = await service.create(
      5,
      8,
      dto({
        payments: [
          {
            payment_method: 'CASH',
            amount: 20,
            payment_type: 'cash',
            reference: 'R1',
          },
          { payment_method: 'exchange', amount: 30 },
        ],
      }),
    );
    expect(prisma.returnPayment.create.mock.calls.map(([a]: any) => a)).toEqual(
      [
        {
          data: {
            return_id: 77,
            payment_method: 'CASH',
            payment_type: 'cash',
            amount: 20,
            reference: 'R1',
          },
        },
        {
          data: {
            return_id: 77,
            payment_method: 'exchange',
            payment_type: null,
            amount: 30,
            reference: undefined,
          },
        },
      ],
    );
    expect(prisma.return.create.mock.calls[0][0].data).toMatchObject({
      total_refund: 20,
      total_exchange: 30,
    });
    expect(result.payments).toHaveLength(2);
  });

  it('[BE-MUT-537] a CREDIT payment gives the points back inside the same transaction, only when the sale had a customer', async () => {
    const { prisma, rewards, service } = setup();
    await service.create(
      5,
      8,
      dto({
        payments: [{ payment_method: 'CREDIT', amount: 50, reference: 'CR' }],
      }),
    );
    expect(rewards.processCreditRefund).toHaveBeenCalledWith(
      5,
      4,
      50,
      1,
      77,
      'CR',
      prisma,
    );
    rewards.processCreditRefund.mockClear();
    prisma.sale.findFirst.mockResolvedValue(sale({ customer_id: null }));
    await service.create(
      5,
      8,
      dto({ payments: [{ payment_method: 'CREDIT', amount: 50 }] }),
    );
    expect(rewards.processCreditRefund).not.toHaveBeenCalled();
    await service.create(5, 8, dto());
    expect(rewards.processCreditRefund).not.toHaveBeenCalled();
  });

  const exchangeDto = (extra: object = {}) => ({
    variant_id: 30,
    batch_id: 31,
    quantity: 2,
    unit_price: 10,
    line_total: 20,
    ...extra,
  });

  it('[BE-MUT-538] an exchange takes the new item out of stock with an adjustment and an EXCHANGE_OUT audit entry', async () => {
    const { prisma, service } = setup();
    prisma.inventoryBatch.findFirst.mockResolvedValue({ id: 31 });
    const result: any = await service.create(
      5,
      8,
      dto({
        items: [{ sale_item_id: 10, variant_id: 20, quantity: 1 }],
        payments: [{ payment_method: 'EXCHANGE', amount: 50 }],
        exchanges: [exchangeDto()],
      }),
    );
    expect(prisma.productVariant.findFirst).toHaveBeenCalledWith({
      where: { id: 30, product: { consumer_id: 5 } },
    });
    expect(prisma.returnExchange.create).toHaveBeenCalledWith({
      data: {
        return_id: 77,
        variant_id: 30,
        batch_id: 31,
        quantity: 2,
        unit_price: 10,
        line_total: 20,
      },
      include: {
        variant: { include: { product: { select: { id: true, name: true } } } },
        batch: true,
      },
    });
    expect(prisma.inventoryAdjustment.create).toHaveBeenCalledWith({
      data: {
        variant_id: 30,
        branch_id: 2,
        batch_id: 31,
        quantity_change: -2,
        reason: expect.stringMatching(/^Exchange from return RET-\d{8}-0001$/),
        notes: expect.stringMatching(/^Return ID: RET-\d{8}-0001$/),
        created_by_user_id: 8,
        adjustment_type: 'exchange_out',
      },
    });
    expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        variant_id: 30,
        batch_id: 31,
        inventoryBatchId: 31,
        event_type: 'EXCHANGE_OUT',
        quantity_delta: -2,
        quantity_after: 4,
        reference_id: 55,
        reference_type: 'return_exchanges',
        notes: expect.stringMatching(
          /^Exchange #RET-\d{8}-0001 for return from sale S-1$/,
        ),
      }),
    });
    expect(result.exchanges).toHaveLength(1);
    expect(prisma.inventoryBatch.findFirst).toHaveBeenCalledWith({
      where: { id: 31, variant_id: 30, branch: { consumer_id: 5 } },
      select: { id: true },
    });
  });

  it('[BE-MUT-539] an exchange variant of another shop is a 404; one without a batch moves no stock', async () => {
    const { prisma, service } = setup();
    prisma.productVariant.findFirst.mockResolvedValue(null);
    const error = await fail(
      service,
      dto({
        items: [{ sale_item_id: 10, variant_id: 20, quantity: 1 }],
        payments: [{ payment_method: 'EXCHANGE', amount: 50 }],
        exchanges: [exchangeDto()],
      }),
    );
    expect(error.message).toBe('Exchange variant 30 not found');
    prisma.productVariant.findFirst.mockResolvedValue({ id: 30 });
    prisma.inventoryAdjustment.create.mockClear();
    await service.create(
      5,
      8,
      dto({
        items: [{ sale_item_id: 10, variant_id: 20, quantity: 1 }],
        payments: [{ payment_method: 'EXCHANGE', amount: 50 }],
        exchanges: [exchangeDto({ batch_id: undefined })],
      }),
    );
    expect(prisma.inventoryAdjustment.create).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('[BE-MUT-540] an exchange without enough unreserved stock is refused, naming what is available', async () => {
    const { prisma, service } = setup();
    prisma.inventoryBatch.findFirst.mockResolvedValue({ id: 31 });
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.inventoryBatch.findUnique.mockResolvedValue({
      quantity: 5,
      reserved_quantity: 4,
    });
    const error = await fail(
      service,
      dto({
        items: [{ sale_item_id: 10, variant_id: 20, quantity: 1 }],
        payments: [{ payment_method: 'EXCHANGE', amount: 50 }],
        exchanges: [exchangeDto()],
      }),
    );
    expect(error.message).toBe(
      'Insufficient stock for exchange item 30. Available: 1, Required: 2',
    );
    expect(prisma.inventoryBatch.findUnique).toHaveBeenCalledWith({
      where: { id: 31 },
    });
    prisma.inventoryBatch.findUnique.mockResolvedValue(null);
    const gone = await fail(
      service,
      dto({
        items: [{ sale_item_id: 10, variant_id: 20, quantity: 1 }],
        payments: [{ payment_method: 'EXCHANGE', amount: 50 }],
        exchanges: [exchangeDto()],
      }),
    );
    expect(gone.message).toContain('Available: 0, Required: 2');
  });

  it('[BE-MUT-541] unexpected failures are logged and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setup();
        prisma.$transaction.mockRejectedValue(f);
        return service.create(5, 8, dto());
      },
      message: 'Failed to create return',
      logged: ['Error creating return with user 8 for consumer 5'],
    });
    const { prisma, service } = setup();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    prisma.return.findFirst.mockRejectedValue(new Error('db'));
    const error = await fail(service, dto());
    expect(error.message).toBe('Failed to generate return number');
  });
});

describe('ReturnService reward reversal (unit)', () => {
  const run = async (
    rows: Array<{ type: string; points: number }>,
    opts: { refund?: number; total?: number; customer?: number | null } = {},
  ) => {
    const ctx = setup();
    ctx.prisma.sale.findFirst.mockResolvedValue(
      sale({
        total_amount: opts.total ?? 200,
        customer_id: opts.customer === undefined ? 4 : opts.customer,
      }),
    );
    ctx.prisma.rewardsPointTransaction.findMany.mockResolvedValue(rows);
    const refund = opts.refund ?? 50;
    await ctx.service
      .create(
        5,
        8,
        dto({
          payments: [{ payment_method: 'CASH', amount: refund }],
          items: [
            {
              sale_item_id: 10,
              variant_id: 20,
              quantity: refund === 100 ? 2 : 1,
            },
          ].map((i) => ({ ...i })),
        }),
      )
      .catch(() => undefined);
    return ctx;
  };

  it('[BE-MUT-542] a refund takes back its share of the points the sale earned, rounded', async () => {
    const ctx = await run(
      [
        { type: 'EARN', points: 100 },
        { type: 'ADJUSTMENT', points: -10 },
      ],
      { refund: 50 },
    );
    expect(ctx.prisma.rewardsPointTransaction.findMany).toHaveBeenCalledWith({
      where: {
        sale_id: 1,
        consumer_id: 5,
        customer_id: 4,
        type: { in: ['EARN', 'ADJUSTMENT'] },
      },
      select: { points: true, type: true },
    });
    expect(ctx.rewards.adjustPoints).toHaveBeenCalledWith(
      5,
      {
        customer_id: 4,
        points: -25,
        description: expect.stringMatching(
          /^Points reversed - return #RET-\d{8}-0001 against sale #S-1$/,
        ),
      },
      8,
    );
  });

  it('[BE-MUT-543] the reversal is capped by what still stands and never exceeds the earned points', async () => {
    const capped = await run(
      [
        { type: 'EARN', points: 100 },
        { type: 'ADJUSTMENT', points: -90 },
      ],
      { refund: 50 },
    );
    expect(capped.rewards.adjustPoints.mock.calls[0][1].points).toBe(-10);
    const full = await run([{ type: 'EARN', points: 100 }], {
      refund: 100,
      total: 100,
    });
    expect(full.rewards.adjustPoints.mock.calls[0][1].points).toBe(-100);
  });

  it('[BE-MUT-544] nothing is reversed without a customer, without earned points, with nothing left, or for a rounded-away share', async () => {
    for (const [rows, opts] of [
      [[{ type: 'EARN', points: 100 }], { customer: null }],
      [[], {}],
      [[{ type: 'ADJUSTMENT', points: 50 }], {}],
      [
        [
          { type: 'EARN', points: 100 },
          { type: 'ADJUSTMENT', points: -100 },
        ],
        {},
      ],
      [[{ type: 'EARN', points: 1 }], {}],
    ] as const) {
      const ctx = await run(rows as any, opts);
      expect(ctx.rewards.adjustPoints).not.toHaveBeenCalled();
    }
  });

  it('[BE-MUT-545] a failing reversal is logged and never undoes the refund', async () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const ctx = setup();
    ctx.prisma.rewardsPointTransaction.findMany.mockResolvedValue([
      { type: 'EARN', points: 100 },
    ]);
    ctx.rewards.adjustPoints.mockRejectedValue(new Error('rewards down'));
    await expect(ctx.service.create(5, 8, dto())).resolves.toMatchObject({
      id: 77,
    });
    expect(log).toHaveBeenCalledWith(
      'Failed to reverse rewards points for return against sale 1',
      expect.any(String),
    );
  });
});

describe('ReturnService reads (unit)', () => {
  it("[BE-MUT-546] findAll pages 10 at a time, newest first, and reports totals, refund/exchange sums and this month's count", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 15, 12));
    const { prisma, service } = setup();
    prisma.return.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.return.count.mockResolvedValueOnce(25).mockResolvedValueOnce(4);
    prisma.return.aggregate.mockResolvedValue({
      _sum: { total_refund: '12.5', total_exchange: null },
    });
    await expect(service.findAll(5)).resolves.toEqual({
      data: [{ id: 1 }],
      total: 25,
      page: 1,
      limit: 10,
      totalPages: 3,
      summary: {
        total_returns: 25,
        total_refund: 12.5,
        total_exchange: 0,
        this_month_count: 4,
      },
    });
    const call = prisma.return.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ consumer_id: 5 });
    expect(call).toMatchObject({
      orderBy: { created_at: 'desc' },
      skip: 0,
      take: 10,
    });
    expect(call.include.original_sale).toEqual({
      select: { id: true, sale_number: true, customer_name: true },
    });
    expect(call.include.exchange_sale).toEqual({
      select: { id: true, sale_number: true },
    });
    expect(call.include.payments).toBe(true);
    expect(prisma.return.aggregate).toHaveBeenCalledWith({
      where: { consumer_id: 5 },
      _sum: { total_refund: true, total_exchange: true },
    });
    expect(prisma.return.count).toHaveBeenLastCalledWith({
      where: { consumer_id: 5, return_date: { gte: new Date(2026, 4, 1) } },
    });
  });

  it('[BE-MUT-547] every findAll filter reaches the query: paging, branch, sale, inclusive date range and a three-way search', async () => {
    const { prisma, service } = setup();
    prisma.return.findMany.mockResolvedValue([]);
    prisma.return.count.mockResolvedValue(0);
    prisma.return.aggregate.mockResolvedValue({ _sum: {} });
    await service.findAll(5, {
      page: 3,
      limit: 5,
      branch_id: 2,
      original_sale_id: 9,
      date_from: '2026-01-01',
      date_to: '2026-01-31',
      search: 'abc',
    });
    const call = prisma.return.findMany.mock.calls[0][0];
    const to = new Date('2026-01-31');
    to.setHours(23, 59, 59, 999);
    expect(call.where).toEqual({
      consumer_id: 5,
      branch_id: 2,
      original_sale_id: 9,
      return_date: { gte: new Date('2026-01-01'), lte: to },
      OR: [
        { return_number: { contains: 'abc', mode: 'insensitive' } },
        {
          original_sale: {
            sale_number: { contains: 'abc', mode: 'insensitive' },
          },
        },
        {
          original_sale: {
            customer_name: { contains: 'abc', mode: 'insensitive' },
          },
        },
      ],
    });
    expect(call).toMatchObject({ skip: 10, take: 5 });
    await service.findAll(5, { date_from: '2026-01-01' });
    expect(prisma.return.findMany.mock.calls[1][0].where.return_date).toEqual({
      gte: new Date('2026-01-01'),
    });
    await service.findAll(5, { date_to: '2026-01-31' });
    expect(
      Object.keys(prisma.return.findMany.mock.calls[2][0].where.return_date),
    ).toEqual(['lte']);
  });

  it('[BE-MUT-548] findOne is tenant scoped and loads the full return; a miss is a 404', async () => {
    const { prisma, service } = setup();
    prisma.return.findFirst.mockResolvedValue({ id: 3 });
    await expect(service.findOne(3, 5)).resolves.toEqual({ id: 3 });
    const call = prisma.return.findFirst.mock.calls[0][0];
    expect(call.where).toEqual({ id: 3, consumer_id: 5 });
    expect(call.include.items.include.batch).toBe(true);
    expect(call.include.exchanges.include.batch).toBe(true);
    expect(call.include.original_sale.include.payments).toBe(true);
    expect(call.include.payments).toBe(true);
    prisma.return.findFirst.mockResolvedValue(null);
    await expect(service.findOne(3, 5)).rejects.toThrow('Return not found');
  });

  it('[BE-MUT-549] read failures are logged and hidden behind generic 500s', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setup();
        prisma.return.findMany.mockRejectedValue(f);
        prisma.return.count.mockResolvedValue(0);
        prisma.return.aggregate.mockResolvedValue({ _sum: {} });
        return service.findAll(5);
      },
      message: 'Failed to fetch returns',
      logged: ['Error fetching returns for consumer 5'],
    });
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setup();
        prisma.return.findFirst.mockRejectedValue(f);
        return service.findOne(3, 5);
      },
      message: 'Failed to fetch return',
      logged: ['Error fetching return with ID 3 for consumer 5'],
      notFoundPassesThrough: true,
    });
  });
});
