import { PurchasePaymentsService } from './purchase-payments.service';
import { PaymentMethodEnum } from '@prisma/client';

describe('vendor payment guards', () => {
  const payment = {
    batch_id: 1,
    payments: [{ payment_method: PaymentMethodEnum.CASH, amount: 5 }],
  };
  const batch = {
    id: 1,
    quantity: 2,
    cost_price: '10',
    paid_amount: '0',
    payment_status: 'due',
  };
  function setup(overrides = {}) {
    const tx = {
      inventoryBatch: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ ...batch, paid_amount: '5' }),
      },
      purchasePayment: { create: jest.fn().mockResolvedValue({ amount: 5 }) },
    };
    const prisma = {
      inventoryBatch: {
        findFirst: jest.fn().mockResolvedValue({ ...batch, ...overrides }),
      },
      inventoryAuditLog: { groupBy: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };
    return { service: new PurchasePaymentsService(prisma as any), prisma, tx };
  }
  it('rejects zero quantity without opening a payment transaction', async () => {
    const { service, prisma } = setup({ quantity: 0 });
    await expect(service.makePayment(payment, 7)).rejects.toThrow(
      'zero quantity',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects an overpayment', async () => {
    const { service, prisma } = setup({ paid_amount: '18' });
    await expect(service.makePayment(payment, 7)).rejects.toThrow(
      'exceeds remaining amount',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects a concurrent stock or balance change before recording payment', async () => {
    const { service, tx } = setup();
    tx.inventoryBatch.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.makePayment(payment, 7)).rejects.toThrow(
      'Batch changed',
    );
    expect(tx.purchasePayment.create).not.toHaveBeenCalled();
  });
  it('records a valid payment after atomically claiming the observed balance', async () => {
    const { service, tx } = setup();
    const result = await service.makePayment(payment, 7);
    expect(tx.inventoryBatch.updateMany).toHaveBeenCalledWith({
      where: { id: 1, paid_amount: '0', cost_price: '10' },
      data: { paid_amount: 5 },
    });
    expect(tx.purchasePayment.create).toHaveBeenCalledTimes(1);
    expect(result.batch.remaining_amount).toBe(15);
  });
});
