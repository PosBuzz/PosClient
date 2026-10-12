import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createCustomer, createRewardsSettings } from '../factories';
import { PaymentsService } from '../../src/consumer/payments/services/payments.service';
import { SalesService } from '../../src/consumer/sales/services/sales.service';

describe('sale payments', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let payments: PaymentsService;

  beforeAll(async () => {
    boot = await bootDomain();
    payments = boot.get(PaymentsService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());

  const pay = (
    saleId: number,
    amounts: number[],
    consumerId = w.tenant.consumer.id,
  ) =>
    payments.makePayment(
      {
        sale_id: saleId,
        payments: amounts.map((amount) => ({ payment_method: 'CASH', amount })),
      } as any,
      consumerId,
    ) as Promise<any>;
  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );
  const dueSale = async (
    price = 100,
    qty = 1,
    paid: number | null = null,
    extra: object = {},
  ) => {
    const v = await w.stock({ price, batches: [{ qty: 50, cost: 10 }] });
    return w.sell([{ variant: v, qty }], extra, paid);
  };

  it('[BE-PAY-001] paying half of a due sale makes it partial', async () => {
    const sale = await dueSale();
    const result = await pay(sale.id, [50]);
    expect(result.sale).toMatchObject({
      payment_status: 'partial',
      remaining_amount: 50,
    });
    expect(Number(result.sale.received_amount)).toBe(50);
    expect(await db.salePayment.count({ where: { sale_id: sale.id } })).toBe(1);
  });

  it('[BE-PAY-002] paying the rest completes the sale; points are earned only at creation (characterization: confirm intent)', async () => {
    await createRewardsSettings(db, { consumer_id: w.tenant.consumer.id });
    const customer = await createCustomer(db, {
      consumer_id: w.tenant.consumer.id,
    });
    const sale = await dueSale(100, 1, null, { customer_id: customer.id });
    await pay(sale.id, [40]);
    const result = await pay(sale.id, [60]);
    expect(result.sale.payment_status).toBe('paid');
    // makePayment never calls earnPoints, so a customer who settles a due sale later earns nothing.
    expect(
      await db.rewardsPointTransaction.count({
        where: { customer_id: customer.id },
      }),
    ).toBe(0);
  });

  it('[BE-PAY-003] overpaying is refused', async () => {
    const sale = await dueSale();
    const error = await failure(pay(sale.id, [101]));
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toMatch(/exceeds remaining amount/);
    expect(await db.salePayment.count({ where: { sale_id: sale.id } })).toBe(0);
  });

  it('[BE-PAY-004] a paid sale takes no more payments', async () => {
    const sale = await dueSale(100, 1, 100);
    const error = await failure(pay(sale.id, [1]));
    expect(error.message).toMatch(/already fully paid/);
  });

  it("[BE-PAY-005] another tenant's sale is not found", async () => {
    const sale = await dueSale();
    const error = await failure(pay(sale.id, [10], w.bystander.consumer.id));
    expect(error).toBeInstanceOf(NotFoundException);
    expect(await db.salePayment.count({ where: { sale_id: sale.id } })).toBe(0);
  });

  it('[BE-PAY-006] the partially-paid list holds exactly the due and partial live sales', async () => {
    const due = await dueSale();
    const partial = await dueSale(100, 1, 30);
    await dueSale(100, 1, 100);
    const deleted = await dueSale();
    await boot
      .get(SalesService)
      .softDelete(deleted.id, w.tenant.consumer.id, w.tenant.adminUser.id, {});
    const list: any = await payments.getPartiallyPaidSales(
      {},
      w.tenant.consumer.id,
    );
    const ids = (list.data ?? list.sales).map((s: any) => s.id).sort();
    expect(ids).toEqual([due.id, partial.id].sort());
  });

  it('[BE-PAY-007] concurrent payments never lose an amount or overpay', async () => {
    const sale = await dueSale();
    const results = await Promise.allSettled([
      pay(sale.id, [60]),
      pay(sale.id, [60]),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const stored = await db.sale.findUniqueOrThrow({ where: { id: sale.id } });
    const rows = await db.salePayment.aggregate({
      where: { sale_id: sale.id },
      _sum: { amount: true },
    });
    expect(Number(stored.received_amount)).toBe(Number(rows._sum.amount));
    expect(Number(stored.received_amount)).toBeLessThanOrEqual(100);
    expect(ok).toBe(1);
  });

  it('[BE-PAY-008] cents add up: three payments of 33.33 plus 0.01 settle a 100.00 sale', async () => {
    const sale = await dueSale();
    await pay(sale.id, [33.33]);
    await pay(sale.id, [33.33]);
    await pay(sale.id, [33.33]);
    const last = await pay(sale.id, [0.01]);
    expect(last.sale.payment_status).toBe('paid');
  });
});
