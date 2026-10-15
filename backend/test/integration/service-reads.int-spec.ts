import { NotFoundException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { ReturnService } from '../../src/consumer/returns/services/return.service';
import { SalesService } from '../../src/consumer/sales/services/sales.service';
import { PaymentsService } from '../../src/consumer/payments/services/payments.service';
import { InventoryBatchService } from '../../src/consumer/inventory/services/inventory-batch.service';
import { InventoryTransferService } from '../../src/consumer/inventory/services/inventory-transfer.service';
import { InventoryAdjustmentService } from '../../src/consumer/inventory/services/inventory-adjustment.service';

/** Read paths of the money and stock services: values, tenant scoping and not-found behaviour. */
describe('service read paths', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let returns: ReturnService;
  let sales: SalesService;
  let payments: PaymentsService;
  let batches: InventoryBatchService;
  let transfers: InventoryTransferService;
  let adjustments: InventoryAdjustmentService;

  beforeAll(async () => {
    boot = await bootDomain();
    returns = boot.get(ReturnService);
    sales = boot.get(SalesService);
    payments = boot.get(PaymentsService);
    batches = boot.get(InventoryBatchService);
    transfers = boot.get(InventoryTransferService);
    adjustments = boot.get(InventoryAdjustmentService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot, { branches: 2 });
  });
  afterEach(() => w.check());

  const cid = () => w.tenant.consumer.id;
  const uid = () => w.tenant.adminUser.id;
  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );

  async function soldAndReturned() {
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    const sale = await w.sell([{ variant: v, qty: 3 }], {}, 150);
    const batch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: v.id },
    });
    const item = await db.saleItem.findFirstOrThrow({
      where: { sale_id: sale.id },
    });
    const ret: any = await returns.create(cid(), uid(), {
      original_sale_id: sale.id,
      branch_id: w.tenant.branches[0].id,
      items: [
        {
          sale_item_id: item.id,
          variant_id: v.id,
          batch_id: batch.id,
          quantity: 1,
        },
      ],
      payments: [{ payment_method: 'CASH', amount: 100 }],
    });
    return { v, sale, batch, ret };
  }

  it('[BE-RET-040] {ReturnService.findOne} {ReturnService.findAll} a return is listed and read back for its own tenant only', async () => {
    const { ret, sale } = await soldAndReturned();
    const one: any = await returns.findOne(ret.id, cid());
    expect(one.id).toBe(ret.id);
    expect(one.original_sale_id).toBe(sale.id);
    expect(Number(one.total_refund)).toBe(100);
    const list: any = await returns.findAll(cid(), {});
    expect(list.data.map((row: any) => row.id)).toEqual([ret.id]);
    const foreign: any = await returns.findAll(w.bystander.consumer.id, {});
    expect(foreign.data).toEqual([]);
    expect(
      await failure(returns.findOne(ret.id, w.bystander.consumer.id)),
    ).toBeInstanceOf(NotFoundException);
    expect(await failure(returns.findOne(999999, cid()))).toBeInstanceOf(
      NotFoundException,
    );
  });

  it('[BE-PAY-040] {PaymentsService.getSaleForPayment} {PaymentsService.getSalePayments} a partly paid sale reports what is left and its payments', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 5, cost: 40 }] });
    const sale = await w.sell([{ variant: v, qty: 2 }], {}, 80);
    const owed: any = await payments.getSaleForPayment(sale.id, cid());
    expect(owed.id).toBe(sale.id);
    expect(Number(owed.remaining_amount)).toBe(120);
    const paid: any = await payments.getSalePayments(sale.id, cid());
    const list = Array.isArray(paid) ? paid : paid.payments;
    expect(list.map((p: any) => Number(p.amount))).toEqual([80]);
    for (const call of [
      () => payments.getSaleForPayment(sale.id, w.bystander.consumer.id),
      () => payments.getSalePayments(sale.id, w.bystander.consumer.id),
    ]) {
      expect(await failure(call())).toBeInstanceOf(NotFoundException);
    }
  });

  it('[BE-SALE-070] {SalesService.findOne} {SalesService.updateNote} a sale is read back with its lines and its note can be changed by its own tenant only', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 5, cost: 40 }] });
    const sale = await w.sell([{ variant: v, qty: 2 }]);
    const found: any = await sales.findOne(sale.id, cid());
    expect(found.id).toBe(sale.id);
    expect(found.items).toHaveLength(1);
    expect(found.items[0].quantity).toBe(2);
    const updated: any = await sales.updateNote(
      sale.id,
      cid(),
      { notes: '  Collected by courier ' },
      uid(),
    );
    expect(updated.notes).toBe('Collected by courier');
    expect(
      (await db.sale.findUniqueOrThrow({ where: { id: sale.id } })).notes,
    ).toBe('Collected by courier');
    expect(
      await failure(sales.findOne(sale.id, w.bystander.consumer.id)),
    ).toBeInstanceOf(NotFoundException);
    expect(
      await failure(
        sales.updateNote(
          sale.id,
          w.bystander.consumer.id,
          { notes: 'Hijacked' },
          uid(),
        ),
      ),
    ).toBeInstanceOf(NotFoundException);
    expect(
      (await db.sale.findUniqueOrThrow({ where: { id: sale.id } })).notes,
    ).toBe('Collected by courier');
    const cleared: any = await sales.updateNote(
      sale.id,
      cid(),
      { notes: '   ' },
      uid(),
    );
    expect(cleared.notes).toBeNull();
  });

  it('[BE-INV-060] {InventoryBatchService.findOne} {InventoryBatchService.findAll} batches are listed and read back for their own tenant only', async () => {
    const v = await w.stock({ price: 10, batches: [{ qty: 7, cost: 4 }] });
    const batch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: v.id },
    });
    const one: any = await batches.findOne(batch.id, cid());
    expect(one.quantity).toBe(7);
    const list: any = await batches.findAll(cid(), {});
    expect(list.data.map((row: any) => row.id)).toContain(batch.id);
    const foreign: any = await batches.findAll(w.bystander.consumer.id, {});
    expect(foreign.data.map((row: any) => row.id)).not.toContain(batch.id);
    expect(
      await failure(batches.findOne(batch.id, w.bystander.consumer.id)),
    ).toBeInstanceOf(NotFoundException);
  });

  it('[BE-INV-061] {InventoryTransferService.findOne} {InventoryTransferService.findAll} a transfer is listed and read back for its own tenant only', async () => {
    const v = await w.stock({ price: 10, batches: [{ qty: 6, cost: 4 }] });
    const batch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: v.id },
    });
    const transfer: any = await transfers.create(cid(), uid(), {
      source_branch_id: w.tenant.branches[0].id,
      destination_branch_id: w.tenant.branches[1].id,
      items: [{ batch_id: batch.id, quantity: 2 }],
    });
    const one: any = await transfers.findOne(transfer.id, cid());
    expect(one.status).toBe('pending');
    expect(one.items.map((i: any) => i.quantity)).toEqual([2]);
    const list: any = await transfers.findAll(cid(), {});
    expect(list.data.map((row: any) => row.id)).toEqual([transfer.id]);
    expect(
      await failure(transfers.findOne(transfer.id, w.bystander.consumer.id)),
    ).toBeInstanceOf(NotFoundException);
    const foreign: any = await transfers.findAll(w.bystander.consumer.id, {});
    expect(foreign.data).toEqual([]);
  });

  it('[BE-INV-062] {InventoryAdjustmentService.findOne} {InventoryAdjustmentService.findAll} an adjustment is listed and read back for its own tenant only', async () => {
    const v = await w.stock({ price: 10, batches: [{ qty: 6, cost: 4 }] });
    const batch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: v.id },
    });
    const adjustment: any = await adjustments.create(cid(), uid(), {
      variant_id: v.id,
      branch_id: w.tenant.branches[0].id,
      batch_id: batch.id,
      quantity_change: -2,
      reason: 'count',
    });
    const one: any = await adjustments.findOne(adjustment.id, cid());
    expect(one.quantity_change).toBe(-2);
    const list: any = await adjustments.findAll(cid(), {});
    expect(list.data.map((row: any) => row.id)).toContain(adjustment.id);
    expect(
      await failure(
        adjustments.findOne(adjustment.id, w.bystander.consumer.id),
      ),
    ).toBeInstanceOf(NotFoundException);
    const foreign: any = await adjustments.findAll(w.bystander.consumer.id, {});
    expect(foreign.data.map((row: any) => row.id)).not.toContain(adjustment.id);
  });
});
