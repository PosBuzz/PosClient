import { BadRequestException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld, saleDto } from '../helpers/domain';
import { createCustomer, createRewardsSettings } from '../factories';
import { SalesService } from '../../src/consumer/sales/services/sales.service';
import { PaymentsService } from '../../src/consumer/payments/services/payments.service';

describe('sales: soft delete, restore and concurrency', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let sales: SalesService;

  beforeAll(async () => {
    boot = await bootDomain();
    sales = boot.get(SalesService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());

  const ids = () => [w.tenant.consumer.id, w.tenant.adminUser.id] as const;
  const del = (id: number) =>
    sales.softDelete(id, w.tenant.consumer.id, w.tenant.adminUser.id, {
      reason: 'mistake',
    });
  const restore = (id: number) => sales.restore(id, ...ids());
  const batchFor = (variantId: number) =>
    db.inventoryBatch.findFirstOrThrow({ where: { variant_id: variantId } });
  const stocked = (qty = 10) =>
    w.stock({ price: 100, batches: [{ qty, cost: 40 }] });
  const failureOf = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );

  it('[BE-SALE-050] deleting restores stock to the original batch and reverses earned points', async () => {
    await createRewardsSettings(db, { consumer_id: w.tenant.consumer.id });
    const customer = await createCustomer(db, {
      consumer_id: w.tenant.consumer.id,
    });
    const v = await stocked();
    const sale = await w.sell([{ variant: v, qty: 3 }], {
      customer_id: customer.id,
    });
    await del(sale.id);
    expect((await batchFor(v.id)).quantity).toBe(10);
    const deleted = await db.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(deleted.deleted_at).not.toBeNull();
    expect(deleted.delete_reason).toBe('mistake');
    expect(
      await db.inventoryAuditLog.count({
        where: { variant_id: v.id, event_type: 'SALE_DELETE_IN' },
      }),
    ).toBe(1);
    const points = await db.customerRewardsPoints.findUniqueOrThrow({
      where: { customer_id: customer.id },
    });
    expect(points.total_points).toBe(0);
  });

  it('[BE-SALE-051] deleting a pending delivery releases the reservation instead of quantity', async () => {
    const v = await stocked();
    const sale = await w.sell([{ variant: v, qty: 3 }], {
      is_delivery_later: true,
    });
    await del(sale.id);
    expect(await batchFor(v.id)).toMatchObject({
      quantity: 10,
      reserved_quantity: 0,
    });
    expect(
      await db.inventoryAuditLog.count({
        where: { variant_id: v.id, event_type: 'SALE_DELETE_IN' },
      }),
    ).toBe(0);
  });

  it('[BE-SALE-054] {PaymentsService.makePayment} a sale with payments collected later cannot be deleted', async () => {
    const v = await stocked();
    const sale = await w.sell([{ variant: v, qty: 1 }], {}, 40);
    const payments = boot.get(PaymentsService);
    await payments.makePayment(
      {
        sale_id: sale.id,
        payments: [{ payment_method: 'CASH', amount: 60 }],
      } as any,
      w.tenant.consumer.id,
    );
    await db.sale.update({
      where: { id: sale.id },
      data: { created_at: new Date(Date.now() - 3_600_000) },
    });
    const error = await failureOf(del(sale.id));
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toMatch(/Reverse those payments/);
  });

  it('[BE-SALE-055] restoring deducts the stock again and re-earns points', async () => {
    await createRewardsSettings(db, { consumer_id: w.tenant.consumer.id });
    const customer = await createCustomer(db, {
      consumer_id: w.tenant.consumer.id,
    });
    const v = await stocked();
    const sale = await w.sell([{ variant: v, qty: 3 }], {
      customer_id: customer.id,
    });
    await del(sale.id);
    await restore(sale.id);
    expect((await batchFor(v.id)).quantity).toBe(7);
    expect(
      (await db.sale.findUniqueOrThrow({ where: { id: sale.id } })).deleted_at,
    ).toBeNull();
    expect(
      await db.inventoryAuditLog.count({
        where: { variant_id: v.id, event_type: 'SALE_RESTORE_OUT' },
      }),
    ).toBe(1);
    const points = await db.customerRewardsPoints.findUniqueOrThrow({
      where: { customer_id: customer.id },
    });
    expect(points.total_points).toBe(300);
  });

  it('[BE-SALE-056] restoring fails without partial writes when the stock is gone', async () => {
    const v = await stocked(3);
    const sale = await w.sell([{ variant: v, qty: 3 }]);
    await del(sale.id);
    await w.sell([{ variant: v, qty: 2 }]);
    const auditsBefore = await db.inventoryAuditLog.count({
      where: { variant_id: v.id },
    });
    const error = await failureOf(restore(sale.id));
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toMatch(/Cannot restore this sale/);
    expect(
      (await db.sale.findUniqueOrThrow({ where: { id: sale.id } })).deleted_at,
    ).not.toBeNull();
    expect(
      await db.inventoryAuditLog.count({ where: { variant_id: v.id } }),
    ).toBe(auditsBefore);
    expect((await batchFor(v.id)).quantity).toBe(1);
  });

  it('[BE-SALE-057] {SalesService.findAll} {SalesService.findBySaleNumber} deleted sales disappear from listings and return lookups', async () => {
    const v = await stocked();
    const sale = await w.sell([{ variant: v, qty: 1 }]);
    await del(sale.id);
    const list: any = await sales.findAll({}, w.tenant.consumer.id);
    expect(list.data.map((s: any) => s.id)).not.toContain(sale.id);
    await expect(
      sales.findBySaleNumber(sale.sale_number, w.tenant.consumer.id),
    ).rejects.toThrow();
  });

  it('[BE-SALE-058] two concurrent deletes restock exactly once', async () => {
    const v = await stocked();
    const sale = await w.sell([{ variant: v, qty: 3 }]);
    const results = await Promise.allSettled([del(sale.id), del(sale.id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(failed.reason.message).toMatch(
      /already been deleted|Sale not found/,
    );
    expect((await batchFor(v.id)).quantity).toBe(10);
    expect(
      await db.inventoryAuditLog.count({
        where: { variant_id: v.id, event_type: 'SALE_DELETE_IN' },
      }),
    ).toBe(1);
  });

  it('[BE-SALE-059] two concurrent restores deduct exactly once', async () => {
    const v = await stocked();
    const sale = await w.sell([{ variant: v, qty: 3 }]);
    await del(sale.id);
    const results = await Promise.allSettled([
      restore(sale.id),
      restore(sale.id),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await batchFor(v.id)).quantity).toBe(7);
  });

  it('[BE-SALE-060] restore respects reserved units of pending deliveries', async () => {
    const v = await stocked(5);
    const sale = await w.sell([{ variant: v, qty: 3 }]);
    await del(sale.id); // stock back to 5
    await w.sell([{ variant: v, qty: 4 }], { is_delivery_later: true }); // 4 of 5 reserved
    const error = await failureOf(restore(sale.id));
    expect(error).toBeInstanceOf(BadRequestException);
    expect(await batchFor(v.id)).toMatchObject({
      quantity: 5,
      reserved_quantity: 4,
    });
  });

  it('[BE-SALE-061] {SalesService.completePendingDelivery} {SalesService.cancelPendingDelivery} concurrent complete and cancel of a delivery move the stock once', async () => {
    const v = await stocked();
    const sale = await w.sell([{ variant: v, qty: 3 }], {
      is_delivery_later: true,
    });
    const [c1, c2] = await Promise.allSettled([
      sales.completePendingDelivery(sale.id, ...ids()),
      sales.cancelPendingDelivery(sale.id, w.tenant.consumer.id),
    ]);
    expect([c1, c2].filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const batch = await batchFor(v.id);
    expect(batch.reserved_quantity).toBe(0);
    expect([7, 10]).toContain(batch.quantity);
    const twoCompletes = await w.sell([{ variant: v, qty: 2 }], {
      is_delivery_later: true,
    });
    const results = await Promise.allSettled([
      sales.completePendingDelivery(twoCompletes.id, ...ids()),
      sales.completePendingDelivery(twoCompletes.id, ...ids()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('[BE-SALE-062] {SalesService.create} {SalesService.convertQuotationToSale} concurrent conversions of one quotation create exactly one sale', async () => {
    const v = await stocked();
    const quotation: any = await sales.create(
      saleDto(
        w.tenant,
        [{ variant: v, qty: 2 }],
        { sale_type: 'quotation' as any },
        null,
      ),
      ...ids(),
    );
    const viaCreate = () =>
      sales.create(
        saleDto(w.tenant, [{ variant: v, qty: 2 }], {
          quotation_id: quotation.id,
        }),
        ...ids(),
      ) as Promise<any>;
    const viaConvert = () =>
      sales.convertQuotationToSale(quotation.id, ...ids());
    const results = await Promise.allSettled([viaCreate(), viaConvert()]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const stored = await db.sale.findUniqueOrThrow({
      where: { id: quotation.id },
    });
    expect(stored.converted_to_sale_id).not.toBeNull();
    expect((await batchFor(v.id)).quantity).toBe(8);
  });
});
