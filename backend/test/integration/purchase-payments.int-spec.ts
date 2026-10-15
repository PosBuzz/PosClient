import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { PurchasePaymentsService } from '../../src/consumer/purchase-payments/services/purchase-payments.service';
import { InventoryBatchService } from '../../src/consumer/inventory/services/inventory-batch.service';

describe('vendor (purchase) payments', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let ppay: PurchasePaymentsService;
  let batches: InventoryBatchService;

  beforeAll(async () => {
    boot = await bootDomain();
    ppay = boot.get(PurchasePaymentsService);
    batches = boot.get(InventoryBatchService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());

  const cid = () => w.tenant.consumer.id;
  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );
  const pay = (batchId: number, amounts: number[], consumerId = cid()) =>
    ppay.makePayment(
      {
        batch_id: batchId,
        payments: amounts.map((amount) => ({ payment_method: 'CASH', amount })),
      } as any,
      consumerId,
    ) as Promise<any>;
  /** 10 units at 40 bought on credit: the vendor is owed 400. */
  async function unpaidPurchase() {
    const v = await w.stock({ price: 100, batches: [] });
    const batch: any = await batches.create(cid(), w.tenant.adminUser.id, {
      variant_id: v.id,
      branch_id: w.tenant.branches[0].id,
      batch_number: 'PO-1',
      quantity: 10,
      cost_price: '40',
      payments: [{ payment_method: 'CASH', amount: 100 }],
    } as any);
    return { v, batch };
  }

  it('[BE-PPAY-001] a part-paid purchase accepts payments until it is settled', async () => {
    const { batch } = await unpaidPurchase();
    expect(batch).toMatchObject({ payment_status: 'partial' });
    const mid = await pay(batch.id, [100, 50]);
    expect(mid.batch).toMatchObject({
      payment_status: 'partial',
      remaining_amount: 150,
    });
    const done = await pay(batch.id, [150]);
    expect(done.batch.payment_status).toBe('paid');
    const rows = await db.purchasePayment.aggregate({
      where: { batch_id: batch.id },
      _sum: { amount: true },
    });
    expect(Number(rows._sum.amount)).toBe(400);
  });

  it('[BE-PPAY-002] {PurchasePaymentsService.makePayment} each invalid payment is refused with its own message', async () => {
    const { batch } = await unpaidPurchase();
    expect(
      (
        await failure(
          ppay.makePayment({ batch_id: batch.id, payments: [] } as any, cid()),
        )
      ).message,
    ).toMatch(/At least one payment method/);
    expect((await failure(pay(batch.id, [0]))).message).toMatch(
      /greater than 0/,
    );
    const over = await failure(pay(batch.id, [301]));
    expect(over).toBeInstanceOf(BadRequestException);
    expect(over.message).toMatch(/exceeds remaining amount/);
    await pay(batch.id, [300]);
    expect((await failure(pay(batch.id, [1]))).message).toMatch(
      /already fully paid/,
    );
  });

  it("[BE-PPAY-003] {PurchasePaymentsService.getBatchPayments} {PurchasePaymentsService.getBatchForPayment} another tenant's batch is not found", async () => {
    const { batch } = await unpaidPurchase();
    const error = await failure(pay(batch.id, [10], w.bystander.consumer.id));
    expect(error).toBeInstanceOf(NotFoundException);
    expect(
      (await failure(
        ppay.getBatchPayments(batch.id, w.bystander.consumer.id),
      )) instanceof NotFoundException,
    ).toBe(true);
    expect(
      (await failure(
        ppay.getBatchForPayment(batch.id, w.bystander.consumer.id),
      )) instanceof NotFoundException,
    ).toBe(true);
  });

  it('[BE-PPAY-004] concurrent payments cannot overpay the vendor', async () => {
    const { batch } = await unpaidPurchase();
    const results = await Promise.allSettled([
      pay(batch.id, [200]),
      pay(batch.id, [200]),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const stored = await db.inventoryBatch.findUniqueOrThrow({
      where: { id: batch.id },
    });
    const rows = await db.purchasePayment.aggregate({
      where: { batch_id: batch.id },
      _sum: { amount: true },
    });
    expect(Number(stored.paid_amount)).toBe(300);
    expect(Number(rows._sum.amount)).toBe(Number(stored.paid_amount));
  });

  it('[BE-PPAY-005] {PurchasePaymentsService.getBatchForPayment} selling the stock does not change what the vendor is owed', async () => {
    const { v, batch } = await unpaidPurchase();
    await w.sell([{ variant: v, qty: 10 }]);
    const ledger: any = await ppay.getBatchForPayment(batch.id, cid());
    expect(ledger.total_cost).toBe(400);
    expect(ledger.remaining_amount).toBe(300);
    const result = await pay(batch.id, [300]);
    expect(result.batch.payment_status).toBe('paid');
  });

  it('[BE-PPAY-006] {PurchasePaymentsService.getPurchaseBatches} the ledger lists unpaid purchases and hides paid ones', async () => {
    const { batch } = await unpaidPurchase();
    const unpaid: any = await ppay.getPurchaseBatches(
      { payment_status: 'unpaid' } as any,
      cid(),
    );
    expect(unpaid.data.map((b: any) => b.id)).toEqual([batch.id]);
    await pay(batch.id, [300]);
    const after: any = await ppay.getPurchaseBatches(
      { payment_status: 'unpaid' } as any,
      cid(),
    );
    expect(after.data).toHaveLength(0);
  });
});
