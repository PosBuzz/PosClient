import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createVendor } from '../factories';
import { InventoryBatchService } from '../../src/consumer/inventory/services/inventory-batch.service';
import { InventoryAdjustmentService } from '../../src/consumer/inventory/services/inventory-adjustment.service';
import { InventoryTransferService } from '../../src/consumer/inventory/services/inventory-transfer.service';
import { InventoryService } from '../../src/consumer/inventory/services/inventory.service';

describe('inventory', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let batches: InventoryBatchService;
  let adjustments: InventoryAdjustmentService;
  let transfers: InventoryTransferService;
  let inventory: InventoryService;

  beforeAll(async () => {
    boot = await bootDomain();
    batches = boot.get(InventoryBatchService);
    adjustments = boot.get(InventoryAdjustmentService);
    transfers = boot.get(InventoryTransferService);
    inventory = boot.get(InventoryService);
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
  const main = () => w.tenant.branches[0].id;
  const second = () => w.tenant.branches[1].id;
  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );
  const batchOf = (variantId: number, branchId = main()) =>
    db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: variantId, branch_id: branchId },
    });
  const stocked = (qty = 10) =>
    w.stock({ price: 100, batches: [{ qty, cost: 40 }] });

  describe('batches', () => {
    const dto = (variantId: number, extra: object = {}) => ({
      variant_id: variantId,
      branch_id: main(),
      batch_number: `B-${Math.random().toString(36).slice(2, 8)}`,
      quantity: 5,
      cost_price: '30',
      ...extra,
    });

    it('[BE-INV-010] creating a batch writes a PURCHASE_IN audit row and payment status', async () => {
      const v = await w.stock({ price: 100, batches: [] });
      const full: any = await batches.create(
        cid(),
        uid(),
        dto(v.id, {
          payments: [{ payment_method: 'CASH', amount: 150 }],
        }),
      );
      expect(full).toMatchObject({ quantity: 5, payment_status: 'paid' });
      const part: any = await batches.create(
        cid(),
        uid(),
        dto(v.id, {
          payments: [{ payment_method: 'CASH', amount: 50 }],
        }),
      );
      expect(part.payment_status).toBe('partial');
      expect(Number(part.paid_amount)).toBe(50);
      const unpaid: any = await batches.create(cid(), uid(), dto(v.id));
      expect(unpaid.payment_status).toBe('paid'); // no payments given: backward compatible, treated as paid
      expect(
        await db.inventoryAuditLog.count({
          where: { variant_id: v.id, event_type: 'PURCHASE_IN' },
        }),
      ).toBe(3);
    });

    it('[BE-INV-011] a quantity sent to update is ignored; stock only moves through audited paths', async () => {
      const v = await stocked();
      const b = await batchOf(v.id);
      await batches.update(b.id, cid(), {
        quantity: 99,
        location: ' A-1 ',
      });
      const after = await batchOf(v.id);
      expect(after.quantity).toBe(10);
      expect(after.location).toBe('A-1');
    });

    it('[BE-INV-012] a batch with stock cannot be deleted; an empty one can', async () => {
      const v = await stocked(2);
      const b = await batchOf(v.id);
      const error = await failure(batches.remove(b.id, cid()));
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.message).toMatch(/remaining quantity/);
    });

    it("[BE-INV-013] a batch cannot be moved to another tenant's branch", async () => {
      const v = await stocked();
      const b = await batchOf(v.id);
      const error = await failure(
        batches.update(b.id, cid(), {
          branch_id: w.bystander.branches[0].id,
        }),
      );
      expect(error).toBeInstanceOf(NotFoundException);
      expect((await batchOf(v.id)).branch_id).toBe(main());
    });

    it("[BE-INV-014] a batch cannot reference another tenant's vendor", async () => {
      const v = await w.stock({ price: 100, batches: [] });
      const foreign = await createVendor(db, {
        consumer_id: w.bystander.consumer.id,
      });
      await w.rebaseBystander();
      const error = await failure(
        batches.create(cid(), uid(), dto(v.id, { vendor_id: foreign.id })),
      );
      expect(error).toBeInstanceOf(NotFoundException);
      expect(
        await db.inventoryBatch.count({ where: { variant_id: v.id } }),
      ).toBe(0);
    });

    it('[BE-INV-015] a duplicate batch number for the variant is refused; foreign variants and branches are not found', async () => {
      const v = await stocked();
      const existing = await batchOf(v.id);
      const dup = await failure(
        batches.create(
          cid(),
          uid(),
          dto(v.id, { batch_number: existing.batch_number }),
        ),
      );
      expect(dup.message).toMatch(/already exists/);
      const foreignVariant = await failure(
        batches.create(cid(), uid(), dto(w.theirs.id)),
      );
      expect(foreignVariant).toBeInstanceOf(NotFoundException);
      const foreignBranch = await failure(
        batches.create(
          cid(),
          uid(),
          dto(v.id, { branch_id: w.bystander.branches[0].id }),
        ),
      );
      expect(foreignBranch).toBeInstanceOf(NotFoundException);
    });
  });

  describe('adjustments', () => {
    const adjust = (
      v: { id: number },
      batchId: number,
      change: number,
      branch = main(),
    ) =>
      adjustments.create(cid(), uid(), {
        variant_id: v.id,
        branch_id: branch,
        batch_id: batchId,
        quantity_change: change,
        reason: 'count',
      }) as Promise<any>;

    it('[BE-INV-020] a negative adjustment lowers the batch and audits the delta', async () => {
      const v = await stocked(5);
      const b = await batchOf(v.id);
      await adjust(v, b.id, -2);
      expect((await batchOf(v.id)).quantity).toBe(3);
      const audit = await db.inventoryAuditLog.findFirstOrThrow({
        where: { batch_id: b.id, event_type: 'ADJUSTMENT' },
      });
      expect(audit).toMatchObject({ quantity_delta: -2, quantity_after: 3 });
    });

    it('[BE-INV-021] removing more than the available quantity is a 400, not a 500', async () => {
      const v = await stocked(5);
      const b = await batchOf(v.id);
      await db.inventoryBatch.update({
        where: { id: b.id },
        data: { reserved_quantity: 2 },
      });
      const error = await failure(adjust(v, b.id, -4));
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.message).toMatch(/Insufficient available quantity/);
      expect((await batchOf(v.id)).quantity).toBe(5);
    });

    it('[BE-INV-022] a positive adjustment adds stock and audits it', async () => {
      const v = await stocked(5);
      const b = await batchOf(v.id);
      await adjust(v, b.id, 3);
      expect((await batchOf(v.id)).quantity).toBe(8);
    });

    it("[BE-INV-023] another tenant's variant, branch or batch is not found", async () => {
      const v = await stocked(5);
      const b = await batchOf(v.id);
      const theirBatch = await db.inventoryBatch.findFirstOrThrow({
        where: { variant_id: w.theirs.id },
      });
      expect(await failure(adjust(w.theirs, theirBatch.id, -1))).toBeInstanceOf(
        NotFoundException,
      );
      expect(
        await failure(adjust(v, b.id, -1, w.bystander.branches[0].id)),
      ).toBeInstanceOf(NotFoundException);
      expect(await failure(adjust(v, theirBatch.id, -1))).toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('transfers', () => {
    const transfer = (items: { batch_id: number; quantity: number }[]) =>
      transfers.create(cid(), uid(), {
        source_branch_id: main(),
        destination_branch_id: second(),
        items,
      }) as Promise<any>;

    it('[BE-INV-030] creating a transfer moves no stock', async () => {
      const v = await stocked(5);
      const b = await batchOf(v.id);
      await transfer([{ batch_id: b.id, quantity: 3 }]);
      expect((await batchOf(v.id)).quantity).toBe(5);
      expect(
        await db.inventoryAuditLog.count({
          where: { event_type: 'TRANSFER_OUT' },
        }),
      ).toBe(0);
    });

    it('[BE-INV-031] completing creates a destination batch, or merges into a matching one', async () => {
      const v = await stocked(10);
      const b = await batchOf(v.id);
      const t1 = await transfer([{ batch_id: b.id, quantity: 3 }]);
      const done: any = await transfers.completeTransfer(t1.id, cid());
      expect(done.status).toBe('completed');
      expect((await batchOf(v.id)).quantity).toBe(7);
      const created = await batchOf(v.id, second());
      expect(created.quantity).toBe(3);
      const t2 = await transfer([{ batch_id: b.id, quantity: 2 }]);
      await transfers.completeTransfer(t2.id, cid());
      expect((await batchOf(v.id, second())).quantity).toBe(5);
      expect(
        await db.inventoryBatch.count({
          where: { variant_id: v.id, branch_id: second() },
        }),
      ).toBe(1);
      expect(
        await db.inventoryAuditLog.count({
          where: { variant_id: v.id, event_type: 'TRANSFER_OUT' },
        }),
      ).toBe(2);
      expect(
        await db.inventoryAuditLog.count({
          where: { variant_id: v.id, event_type: 'TRANSFER_IN' },
        }),
      ).toBe(2);
    });

    it('[BE-INV-032] a completed transfer cannot be completed again', async () => {
      const v = await stocked(10);
      const t = await transfer([
        { batch_id: (await batchOf(v.id)).id, quantity: 3 },
      ]);
      await transfers.completeTransfer(t.id, cid());
      const error = await failure(transfers.completeTransfer(t.id, cid()));
      expect(error.message).toMatch(/not in pending status/);
      expect((await batchOf(v.id)).quantity).toBe(7);
    });

    it('[BE-INV-033] a cancelled transfer moves nothing and cannot be completed', async () => {
      const v = await stocked(10);
      const t = await transfer([
        { batch_id: (await batchOf(v.id)).id, quantity: 3 },
      ]);
      const cancelled: any = await transfers.cancelTransfer(t.id, cid());
      expect(cancelled.status).toBe('cancelled');
      expect((await batchOf(v.id)).quantity).toBe(10);
      const error = await failure(transfers.completeTransfer(t.id, cid()));
      expect(error.message).toMatch(/not in pending status/);
    });

    it('[BE-INV-034] same-branch and other-tenant branches are refused', async () => {
      const v = await stocked(10);
      const b = await batchOf(v.id);
      const same = await failure(
        transfers.create(cid(), uid(), {
          source_branch_id: main(),
          destination_branch_id: main(),
          items: [{ batch_id: b.id, quantity: 1 }],
        }),
      );
      expect(same).toBeInstanceOf(BadRequestException);
      const foreign = await failure(
        transfers.create(cid(), uid(), {
          source_branch_id: main(),
          destination_branch_id: w.bystander.branches[0].id,
          items: [{ batch_id: b.id, quantity: 1 }],
        }),
      );
      expect(foreign).toBeInstanceOf(NotFoundException);
    });

    it('[BE-INV-035] transferring more than is available is refused', async () => {
      const v = await stocked(5);
      const b = await batchOf(v.id);
      await db.inventoryBatch.update({
        where: { id: b.id },
        data: { reserved_quantity: 2 },
      });
      const error = await failure(transfer([{ batch_id: b.id, quantity: 4 }]));
      expect(error.message).toMatch(/Insufficient available quantity/);
    });

    it('[BE-INV-036] a transfer whose source was sold down meanwhile fails and stays pending', async () => {
      const v = await stocked(6);
      const b = await batchOf(v.id);
      const t = await transfer([{ batch_id: b.id, quantity: 6 }]);
      await w.sell([{ variant: v, qty: 3 }]);
      const error = await failure(transfers.completeTransfer(t.id, cid()));
      expect(error.message).toMatch(/Insufficient stock in source batch/);
      expect((await batchOf(v.id)).quantity).toBe(3);
      expect(
        (await db.inventoryTransfer.findUniqueOrThrow({ where: { id: t.id } }))
          .status,
      ).toBe('pending');
    });

    it('[BE-INV-037] concurrent complete and cancel move the stock at most once', async () => {
      const v = await stocked(10);
      const t = await transfer([
        { batch_id: (await batchOf(v.id)).id, quantity: 4 },
      ]);
      const results = await Promise.allSettled([
        transfers.completeTransfer(t.id, cid()),
        transfers.completeTransfer(t.id, cid()),
        transfers.cancelTransfer(t.id, cid()),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const status = (
        await db.inventoryTransfer.findUniqueOrThrow({ where: { id: t.id } })
      ).status;
      const moved = status === 'completed';
      expect((await batchOf(v.id)).quantity).toBe(moved ? 6 : 10);
    });

    it('[BE-INV-038] zero or negative transfer quantities are refused', async () => {
      const v = await stocked(10);
      const b = await batchOf(v.id);
      for (const quantity of [0, -3]) {
        const error = await failure(transfer([{ batch_id: b.id, quantity }]));
        expect(error).toBeInstanceOf(BadRequestException);
      }
    });
  });

  it('[BE-INV-039] listing one batch twice cannot exceed its available quantity', async () => {
    const v = await stocked(5);
    const b = await batchOf(v.id);
    const error = await failure(
      transfers.create(cid(), uid(), {
        source_branch_id: main(),
        destination_branch_id: second(),
        items: [
          { batch_id: b.id, quantity: 3 },
          { batch_id: b.id, quantity: 3 },
        ],
      }),
    );
    expect(error.message).toMatch(/Insufficient available quantity/);
  });

  it('[BE-INV-040] summary and stock queries equal the raw tables', async () => {
    const a = await stocked(10);
    const b = await w.stock({
      price: 50,
      batches: [
        { qty: 4, cost: 10 },
        { qty: 6, cost: 12 },
      ],
    });
    await db.inventoryBatch.updateMany({
      where: { variant_id: a.id },
      data: { reserved_quantity: 3 },
    });
    await db.productVariant.update({
      where: { id: b.id },
      data: { alert_quantity: 20 },
    });
    const summary: any = await inventory.getInventorySummary(cid());
    const raw = await db.inventoryBatch.aggregate({
      where: { variant: { product: { consumer_id: cid() } } },
      _sum: { quantity: true, reserved_quantity: true },
      _count: true,
    });
    expect(summary.physical_quantity).toBe(raw._sum.quantity);
    expect(summary.reserved_quantity).toBe(raw._sum.reserved_quantity);
    expect(summary.total_quantity).toBe(
      raw._sum.quantity! - raw._sum.reserved_quantity!,
    );
    expect(summary.total_batches).toBe(raw._count);
    expect(summary.low_stock_variants).toBe(1);
    const low: any = await inventory.getLowStockItems(cid());
    expect(low.map((i: any) => i.id ?? i.variant_id)).toContain(b.id);
    const stock: any = await inventory.getVariantStock(b.id, cid());
    expect(JSON.stringify(stock)).toContain('10');
  });
});
