import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createVendor } from '../factories';
import { InventoryBatchService } from '../../src/consumer/inventory/services/inventory-batch.service';
import { InventoryAdjustmentService } from '../../src/consumer/inventory/services/inventory-adjustment.service';
import { InventoryTransferService } from '../../src/consumer/inventory/services/inventory-transfer.service';
import { PrismaService } from '../../src/prisma/prisma.service';
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

    it('[BE-INV-010] {InventoryBatchService.create} creating a batch writes a PURCHASE_IN audit row and payment status', async () => {
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

    it('[BE-INV-011] {InventoryBatchService.update} a quantity sent to update is ignored; stock only moves through audited paths', async () => {
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

    it('[BE-INV-012] {InventoryBatchService.remove} {InventoryAdjustmentService.create} a batch with stock cannot be deleted, and one with history stays even at zero', async () => {
      const v = await stocked(2);
      const b = await batchOf(v.id);
      const error = await failure(batches.remove(b.id, cid()));
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.message).toMatch(/still has stock/);
      await adjustments.create(cid(), uid(), {
        variant_id: v.id,
        branch_id: main(),
        batch_id: b.id,
        quantity_change: -2,
        reason: 'empty it',
      });
      // Its audit trail and adjustment rows still point at it, so it is kept
      const kept = await failure(batches.remove(b.id, cid()));
      expect(kept).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect(kept.code).toBe('P2003');
      expect(await db.inventoryBatch.count({ where: { id: b.id } })).toBe(1);
    });

    it("[BE-INV-013] {InventoryBatchService.update} a batch cannot be moved to another tenant's branch", async () => {
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

    it("[BE-INV-014] {InventoryBatchService.create} a batch cannot reference another tenant's vendor", async () => {
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

    it('[BE-INV-015] {InventoryBatchService.create} a duplicate batch number for the variant is refused; foreign variants and branches are not found', async () => {
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

    it('[BE-INV-031] {InventoryTransferService.completeTransfer} completing creates a destination batch, or merges into a matching one', async () => {
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

    it('[BE-INV-032] {InventoryTransferService.completeTransfer} a completed transfer cannot be completed again', async () => {
      const v = await stocked(10);
      const t = await transfer([
        { batch_id: (await batchOf(v.id)).id, quantity: 3 },
      ]);
      await transfers.completeTransfer(t.id, cid());
      const error = await failure(transfers.completeTransfer(t.id, cid()));
      expect(error.message).toMatch(/not in pending status/);
      expect((await batchOf(v.id)).quantity).toBe(7);
    });

    it('[BE-INV-033] {InventoryTransferService.cancelTransfer} {InventoryTransferService.completeTransfer} a cancelled transfer moves nothing and cannot be completed', async () => {
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

    it('[BE-INV-034] {InventoryTransferService.create} same-branch and other-tenant branches are refused', async () => {
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

    it('[BE-INV-036] {InventoryTransferService.completeTransfer} a transfer whose source was sold down meanwhile fails and stays pending', async () => {
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

    it('[BE-INV-037] {InventoryTransferService.completeTransfer} {InventoryTransferService.cancelTransfer} concurrent complete and cancel move the stock at most once', async () => {
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

  it('[BE-INV-039] {InventoryTransferService.create} listing one batch twice cannot exceed its available quantity', async () => {
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

  it('[BE-INV-040] {InventoryService.getInventorySummary} {InventoryService.getLowStockItems} {InventoryService.getVariantStock} summary and stock queries equal the raw tables', async () => {
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

  describe('mutation hardening', () => {
    // Batches get their PURCHASE_IN audit row through the service (INV-01)
    const mk = async ({ data }: { data: any }) => {
      if (data.quantity === 0) return db.inventoryBatch.create({ data });
      const { location, expiry_date, ...rest } = data;
      const made: any = await batches.create(cid(), uid(), {
        ...rest,
        cost_price: String(rest.cost_price),
      });
      return db.inventoryBatch.update({
        where: { id: made.id },
        data: { location, expiry_date },
      });
    };
    const adj = (
      v: { id: number },
      batchId: number,
      change: number,
      extra: object = {},
    ) =>
      adjustments.create(cid(), uid(), {
        variant_id: v.id,
        branch_id: main(),
        batch_id: batchId,
        quantity_change: change,
        reason: 'count',
        ...extra,
      }) as Promise<any>;
    const xfer = (
      items: { batch_id: number; quantity: number }[],
      extra: object = {},
    ) =>
      transfers.create(cid(), uid(), {
        source_branch_id: main(),
        destination_branch_id: second(),
        items,
        ...extra,
      }) as Promise<any>;

    it('[BE-INV-050] {InventoryAdjustmentService.create} exact messages, audit row fields and a boundary removal', async () => {
      const v = await stocked(5);
      const b = await batchOf(v.id);
      expect((await failure(adj(w.theirs, b.id, 1))).message).toBe(
        'Product variant not found',
      );
      expect(
        (
          await failure(
            adj(v, b.id, 1, { branch_id: w.bystander.branches[0].id }),
          )
        ).message,
      ).toBe('Branch not found');
      expect(
        (await failure(adj(v, b.id, 1, { branch_id: second() }))).message,
      ).toBe('Batch not found for the specified variant and branch');
      await db.inventoryBatch.update({
        where: { id: b.id },
        data: { reserved_quantity: 2 },
      });
      expect((await failure(adj(v, b.id, -4))).message).toBe(
        'Insufficient available quantity in batch. Available: 3, Requested: 4',
      );
      // exactly the available amount is allowed
      const done = await adj(v, b.id, -3, { notes: 'shrink', reason: 'r' });
      expect(done).toMatchObject({
        quantity_change: -3,
        notes: 'shrink',
        created_by_user_id: uid(),
        branch_id: main(),
        variant_id: v.id,
        batch_id: b.id,
      });
      expect(done.branch).toEqual({ id: main(), name: expect.any(String) });
      expect(done.batch.variant.product).toEqual({
        id: expect.any(Number),
        name: expect.any(String),
      });
      const audit = await db.inventoryAuditLog.findFirstOrThrow({
        where: { batch_id: b.id, event_type: 'ADJUSTMENT' },
      });
      expect(audit).toMatchObject({
        consumer_id: cid(),
        branch_id: main(),
        variant_id: v.id,
        inventoryBatchId: b.id,
        quantity_delta: -3,
        quantity_after: 2,
        reference_id: done.id,
        reference_type: 'inventory_adjustments',
        notes: 'shrink',
        created_by_user_id: uid(),
      });
      // notes fall back to reason
      const plus = await adj(v, b.id, 1, { reason: 'found one' });
      const a2 = await db.inventoryAuditLog.findFirstOrThrow({
        where: { reference_id: plus.id, event_type: 'ADJUSTMENT' },
      });
      expect(a2.notes).toBe('found one');
      expect(a2.quantity_after).toBe(3);
    });

    it('[BE-INV-051] {InventoryAdjustmentService.findAll} {InventoryAdjustmentService.findOne} paging, filters and tenant scoping', async () => {
      const v1 = await stocked(20);
      const v2 = await stocked(20);
      const b1 = await batchOf(v1.id);
      const b2 = await batchOf(v2.id);
      const other = await mk({
        data: {
          variant_id: v1.id,
          branch_id: second(),
          batch_number: 'S-1',
          quantity: 9,
          cost_price: 1,
        },
      });
      const made: any[] = [];
      for (const d of [1, 2, 3]) made.push(await adj(v1, b1.id, d));
      made.push(await adj(v2, b2.id, 4));
      made.push(
        await adjustments.create(cid(), uid(), {
          variant_id: v1.id,
          branch_id: second(),
          batch_id: other.id,
          quantity_change: 5,
          reason: 'x',
        }),
      );
      const all: any = await adjustments.findAll(cid());
      expect(all.meta).toEqual({ total: 5, page: 1, limit: 10, totalPages: 1 });
      // newest first
      expect(all.data.map((a: any) => a.id)).toEqual(
        made.map((m) => m.id).reverse(),
      );
      const p2: any = await adjustments.findAll(cid(), { page: 2, limit: 2 });
      expect(p2.meta).toEqual({ total: 5, page: 2, limit: 2, totalPages: 3 });
      expect(p2.data.map((a: any) => a.id)).toEqual([made[2].id, made[1].id]);
      const byV: any = await adjustments.findAll(cid(), { variant_id: v2.id });
      expect(byV.data.map((a: any) => a.id)).toEqual([made[3].id]);
      expect(byV.meta.total).toBe(1);
      const byB: any = await adjustments.findAll(cid(), {
        branch_id: second(),
      });
      expect(byB.data.map((a: any) => a.id)).toEqual([made[4].id]);
      const both: any = await adjustments.findAll(cid(), {
        variant_id: v1.id,
        branch_id: main(),
      });
      expect(both.meta.total).toBe(3);
      expect(
        (await adjustments.findAll(w.bystander.consumer.id)).meta.total,
      ).toBe(0);
      const one: any = await adjustments.findOne(made[0].id, cid());
      expect(one).toMatchObject({ id: made[0].id, quantity_change: 1 });
      expect(one.created_by_user.id).toBe(uid());
      const nf = await failure(
        adjustments.findOne(made[0].id, w.bystander.consumer.id),
      );
      expect(nf).toBeInstanceOf(NotFoundException);
      expect(nf.message).toBe(`Adjustment with ID ${made[0].id} not found`);
    });

    it('[BE-INV-052] {InventoryAdjustmentService.create} unexpected failures surface as a generic 500', async () => {});

    it('[BE-INV-053] {InventoryTransferService.create} messages, validation and returned shape', async () => {
      const v = await stocked(10);
      const b = await batchOf(v.id);
      const one = [{ batch_id: b.id, quantity: 1 }];
      const f = (extra: object, items = one) => failure(xfer(items, extra));
      expect(
        (await f({ source_branch_id: w.bystander.branches[0].id })).message,
      ).toBe('Source branch not found');
      expect(
        (await f({ destination_branch_id: w.bystander.branches[0].id }))
          .message,
      ).toBe('Destination branch not found');
      expect((await f({ destination_branch_id: main() })).message).toBe(
        'Source and destination branches cannot be the same',
      );
      const need =
        'A transfer needs at least one item and every quantity must be a positive whole number';
      expect((await f({}, [])).message).toBe(need);
      expect((await f({}, null as any)).message).toBe(need);
      expect((await f({}, [{ batch_id: b.id, quantity: 1.5 }])).message).toBe(
        need,
      );
      expect((await f({}, [{ batch_id: b.id, quantity: 0 }])).message).toBe(
        need,
      );
      // one is the smallest valid quantity
      const ok = await xfer([{ batch_id: b.id, quantity: 1 }], {
        notes: 'n1',
      });
      expect(ok).toMatchObject({
        status: 'pending',
        notes: 'n1',
        created_by_user_id: uid(),
        source_branch_id: main(),
        destination_branch_id: second(),
      });
      expect(ok.items).toHaveLength(1);
      expect(ok.items[0]).toMatchObject({ batch_id: b.id, quantity: 1 });
      expect(ok.source_branch.id).toBe(main());
      expect(ok.destination_branch.id).toBe(second());
      expect(ok.created_by_user.id).toBe(uid());
      expect(ok.items[0].batch.variant.product.id).toEqual(expect.any(Number));
      const theirBatch = await db.inventoryBatch.findFirstOrThrow({
        where: { variant_id: w.theirs.id },
      });
      const nf = await failure(
        xfer([{ batch_id: theirBatch.id, quantity: 1 }]),
      );
      expect(nf).toBeInstanceOf(NotFoundException);
      expect(nf.message).toBe(
        `Batch with ID ${theirBatch.id} not found in ${w.tenant.branches[0].name}`,
      );
      // batch in the other branch is not found in the source branch
      const inSecond = await mk({
        data: {
          variant_id: v.id,
          branch_id: second(),
          batch_number: 'Q',
          quantity: 5,
          cost_price: 1,
        },
      });
      expect(
        (await failure(xfer([{ batch_id: inSecond.id, quantity: 1 }]))).message,
      ).toMatch(/not found in/);
      await db.inventoryBatch.update({
        where: { id: b.id },
        data: { reserved_quantity: 4 },
      });
      expect((await f({}, [{ batch_id: b.id, quantity: 7 }])).message).toBe(
        `Insufficient available quantity in batch ${b.id}. Available: 6, Requested: 7`,
      );
      // exactly available is fine
      await xfer([{ batch_id: b.id, quantity: 6 }]);
    });

    it('[BE-INV-054] {InventoryTransferService.findAll} {InventoryTransferService.findOne} filters, paging and tenant scoping', async () => {
      const v = await stocked(50);
      const b = await batchOf(v.id);
      const t1 = await xfer([{ batch_id: b.id, quantity: 1 }]);
      const t2 = await xfer([{ batch_id: b.id, quantity: 2 }]);
      const t3 = await xfer([{ batch_id: b.id, quantity: 3 }]);
      await transfers.cancelTransfer(t2.id, cid());
      await transfers.completeTransfer(t3.id, cid());
      const all: any = await transfers.findAll(cid());
      expect(all.meta).toEqual({
        current_page: 1,
        per_page: 10,
        total: 3,
        last_page: 1,
      });
      expect(all.data.map((t: any) => t.id)).toEqual([t3.id, t2.id, t1.id]);
      const pg: any = await transfers.findAll(cid(), { page: 2, limit: 1 });
      expect(pg.meta).toEqual({
        current_page: 2,
        per_page: 1,
        total: 3,
        last_page: 3,
      });
      expect(pg.data.map((t: any) => t.id)).toEqual([t2.id]);
      const st: any = await transfers.findAll(cid(), { status: 'cancelled' });
      expect(st.data.map((t: any) => t.id)).toEqual([t2.id]);
      const br: any = await transfers.findAll(cid(), { branch_id: second() });
      expect(br.meta.total).toBe(3);
      const none: any = await transfers.findAll(cid(), { branch_id: 0 });
      expect(none.meta.total).toBe(0);
      expect(
        (await transfers.findAll(w.bystander.consumer.id)).meta.total,
      ).toBe(0);
      const one: any = await transfers.findOne(t1.id, cid());
      expect(one.items[0].batch.variant.product.id).toEqual(expect.any(Number));
      expect(one.created_by_user.id).toBe(uid());
      const nf = await failure(
        transfers.findOne(t1.id, w.bystander.consumer.id),
      );
      expect(nf.message).toBe('Transfer not found');
    });

    it('[BE-INV-055] {InventoryTransferService.completeTransfer} audit rows, dest batch link, tenant scope and errors', async () => {
      const v = await stocked(10);
      const b = await batchOf(v.id);
      await db.inventoryBatch.update({
        where: { id: b.id },
        data: { location: 'A-1', expiry_date: new Date('2031-01-01') },
      });
      const t = await xfer([{ batch_id: b.id, quantity: 4 }]);
      const nf = await failure(
        transfers.completeTransfer(t.id, w.bystander.consumer.id),
      );
      expect(nf).toBeInstanceOf(NotFoundException);
      expect(nf.message).toBe('Transfer not found');
      expect(
        (await failure(transfers.cancelTransfer(t.id, w.bystander.consumer.id)))
          .message,
      ).toBe('Transfer not found');
      const done: any = await transfers.completeTransfer(t.id, cid());
      expect(done.completed_date).toBeInstanceOf(Date);
      expect(done.items[0].dest_batch_id).toEqual(expect.any(Number));
      const dest = await batchOf(v.id, second());
      expect(done.items[0].dest_batch_id).toBe(dest.id);
      expect(dest).toMatchObject({
        batch_number: b.batch_number,
        quantity: 4,
        vendor_id: b.vendor_id,
      });
      expect(Number(dest.cost_price)).toBe(Number(b.cost_price));
      expect(dest.expiry_date).toEqual(new Date('2031-01-01'));
      const item = done.items[0];
      const srcName = w.tenant.branches[0].name;
      const dstName = w.tenant.branches[1].name;
      const out = await db.inventoryAuditLog.findFirstOrThrow({
        where: { event_type: 'TRANSFER_OUT', variant_id: v.id },
      });
      expect(out).toMatchObject({
        consumer_id: cid(),
        branch_id: main(),
        batch_id: b.id,
        inventoryBatchId: b.id,
        quantity_delta: -4,
        quantity_after: 6,
        reference_id: item.id,
        reference_type: 'inventory_transfer_items',
        notes: `Transfer #${t.id} to ${dstName}`,
        created_by_user_id: uid(),
      });
      const inn = await db.inventoryAuditLog.findFirstOrThrow({
        where: { event_type: 'TRANSFER_IN', variant_id: v.id },
      });
      expect(inn).toMatchObject({
        consumer_id: cid(),
        branch_id: second(),
        batch_id: dest.id,
        inventoryBatchId: dest.id,
        quantity_delta: 4,
        quantity_after: 4,
        reference_id: item.id,
        reference_type: 'inventory_transfer_items',
        notes: `Transfer #${t.id} from ${srcName} - New batch created`,
        created_by_user_id: uid(),
      });
      // merge: matching batch gets incremented, and note has no "new batch"
      const t2 = await xfer([{ batch_id: b.id, quantity: 1 }]);
      const d2: any = await transfers.completeTransfer(t2.id, cid());
      expect(d2.items[0].dest_batch_id).toBe(dest.id);
      const merged = await db.inventoryAuditLog.findFirstOrThrow({
        where: { event_type: 'TRANSFER_IN', reference_id: d2.items[0].id },
      });
      expect(merged).toMatchObject({
        quantity_delta: 1,
        quantity_after: 5,
        notes: `Transfer #${t2.id} from ${srcName}`,
        branch_id: second(),
        batch_id: dest.id,
        inventoryBatchId: dest.id,
        reference_type: 'inventory_transfer_items',
      });
      // a different cost makes a separate destination batch
      await db.inventoryBatch.update({
        where: { id: b.id },
        data: { cost_price: 99 },
      });
      const t3 = await xfer([{ batch_id: b.id, quantity: 1 }]);
      await transfers.completeTransfer(t3.id, cid());
      expect(
        await db.inventoryBatch.count({
          where: { variant_id: v.id, branch_id: second() },
        }),
      ).toBe(2);
      // cancel messages
      const c = await failure(transfers.cancelTransfer(t.id, cid()));
      expect(c.message).toBe('Transfer is not in pending status');
    });

    it('[BE-INV-056] {InventoryTransferService.completeTransfer} insufficient-stock message names the batch and rolls back', async () => {
      const v = await stocked(6);
      const b = await batchOf(v.id);
      const t = await xfer([{ batch_id: b.id, quantity: 6 }]);
      await w.sell([{ variant: v, qty: 3 }]);
      const e = await failure(transfers.completeTransfer(t.id, cid()));
      expect(e.message).toBe(
        `Insufficient stock in source batch ${b.batch_number} to complete this transfer`,
      );
      expect(
        await db.inventoryTransfer.findUniqueOrThrow({ where: { id: t.id } }),
      ).toMatchObject({ status: 'pending', completed_date: null });
      expect(
        await db.inventoryAuditLog.count({
          where: { event_type: { in: ['TRANSFER_OUT', 'TRANSFER_IN'] } },
        }),
      ).toBe(0);
    });

    it('[BE-INV-057] {InventoryService.getInventorySummary} branch filter, expiry window and low-stock counting', async () => {
      const v = await stocked(10);
      const b = await batchOf(v.id);
      const day = 24 * 3600 * 1000;
      await db.inventoryBatch.update({
        where: { id: b.id },
        data: {
          reserved_quantity: 2,
          expiry_date: new Date(Date.now() + 10 * day),
        },
      });
      const sec = await mk({
        data: {
          variant_id: v.id,
          branch_id: second(),
          batch_number: 'S',
          quantity: 3,
          cost_price: 1,
          expiry_date: new Date(Date.now() + 60 * day),
        },
      });
      await mk({
        data: {
          variant_id: v.id,
          branch_id: second(),
          batch_number: 'OLD',
          quantity: 1,
          cost_price: 1,
          expiry_date: new Date(Date.now() - day),
        },
      });
      await db.productVariant.update({
        where: { id: v.id },
        data: { alert_quantity: 4 },
      });
      const all: any = await inventory.getInventorySummary(cid());
      expect(all).toEqual({
        total_batches: 3,
        total_quantity: 12,
        physical_quantity: 14,
        reserved_quantity: 2,
        low_stock_variants: 1, // second branch: 3+1=4 <= 4; main 8 > 4
        expiring_soon: 1,
      });
      const m: any = await inventory.getInventorySummary(cid(), main());
      expect(m).toEqual({
        total_batches: 1,
        total_quantity: 8,
        physical_quantity: 10,
        reserved_quantity: 2,
        low_stock_variants: 0,
        expiring_soon: 1,
      });
      const s: any = await inventory.getInventorySummary(cid(), second());
      expect(s).toMatchObject({
        total_batches: 2,
        total_quantity: 4,
        low_stock_variants: 1,
        expiring_soon: 0,
      });
      // alert exactly equal counts; zero alert never counts
      await db.productVariant.update({
        where: { id: v.id },
        data: { alert_quantity: 0 },
      });
      expect(
        (await inventory.getInventorySummary(cid(), second()))
          .low_stock_variants,
      ).toBe(0);
      expect(sec.id).toBeGreaterThan(0);
      const empty: any = await inventory.getInventorySummary(
        w.bystander.consumer.id,
        main(),
      );
      expect(empty.total_batches).toBe(0);
      expect(empty.total_quantity).toBe(0);
    });

    it('[BE-INV-058] {InventoryService.getStockByVariant} enrichment, search, low-stock filter and paging', async () => {
      const v = await stocked(10);
      const b = await batchOf(v.id);
      await db.inventoryBatch.update({
        where: { id: b.id },
        data: { reserved_quantity: 3, location: ' Rack 9 ' },
      });
      await mk({
        data: {
          variant_id: v.id,
          branch_id: second(),
          batch_number: 'S',
          quantity: 2,
          cost_price: 1,
          location: 'Shelf 2',
        },
      });
      await db.productVariant.update({
        where: { id: v.id },
        data: { alert_quantity: 2, sku: 'ZZSKU-1' },
      });
      const other = await stocked(50);
      const variant = await db.productVariant.findUniqueOrThrow({
        where: { id: v.id },
        include: { product: true },
      });
      const res: any = await inventory.getStockByVariant(cid());
      expect(res.meta.total).toBe(2);
      const row = res.data.find((r: any) => r.id === v.id);
      expect(row).toMatchObject({
        total_stock: 9,
        pending_delivery: 3,
        is_low_stock: true, // second branch 2 <= 2
      });
      expect(row.locations).toEqual(['Rack 9', 'Shelf 2']);
      const n0 = w.tenant.branches[0].name;
      const n1 = w.tenant.branches[1].name;
      expect(row.stock_by_branch).toEqual({ [n0]: 7, [n1]: 2 });
      expect(row.locations_by_branch).toEqual({
        [n0]: ['Rack 9'],
        [n1]: ['Shelf 2'],
      });
      const rowOther = res.data.find((r: any) => r.id === other.id);
      expect(rowOther.is_low_stock).toBe(false);
      expect(rowOther.pending_delivery).toBe(0);
      // branch filter: only main branch stock considered
      const mainOnly: any = await inventory.getStockByVariant(cid(), {
        branch_id: main(),
      });
      const mr = mainOnly.data.find((r: any) => r.id === v.id);
      expect(mr).toMatchObject({ total_stock: 7, is_low_stock: false });
      expect(mr.stock_by_branch).toEqual({ [n0]: 7 });
      await db.productVariant.update({
        where: { id: v.id },
        data: { alert_quantity: 7 },
      });
      const eq: any = await inventory.getStockByVariant(cid(), {
        branch_id: main(),
      });
      expect(eq.data.find((r: any) => r.id === v.id).is_low_stock).toBe(true);
      const low: any = await inventory.getStockByVariant(cid(), {
        low_stock_only: true,
      });
      expect(low.data.map((r: any) => r.id)).toEqual([v.id]);
      expect(low.meta).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
      for (const q of ['zzsku', variant.product.name.toUpperCase(), 'rack 9']) {
        const s: any = await inventory.getStockByVariant(cid(), { search: q });
        expect(s.data.map((r: any) => r.id)).toContain(v.id);
      }
      const miss: any = await inventory.getStockByVariant(cid(), {
        search: 'no-such-thing-xyz',
      });
      expect(miss.data).toEqual([]);
      const pg: any = await inventory.getStockByVariant(cid(), {
        page: 2,
        limit: 1,
      });
      expect(pg.meta).toEqual({ total: 2, page: 2, limit: 1, totalPages: 2 });
      expect(pg.data).toHaveLength(1);
      // newest first
      expect(
        ((await inventory.getStockByVariant(cid(), { limit: 1 })) as any)
          .data[0].id,
      ).toBe(other.id);
    });

    it('[BE-INV-059] {InventoryService.getExpiringBatches} {InventoryService.getProductsForInventory} {InventoryService.getProductVariants} windows and tenant scoping', async () => {
      const day = 24 * 3600 * 1000;
      const v = await stocked(5);
      const b = await batchOf(v.id);
      await db.inventoryBatch.update({
        where: { id: b.id },
        data: { expiry_date: new Date(Date.now() + 5 * day) },
      });
      const late = await mk({
        data: {
          variant_id: v.id,
          branch_id: second(),
          batch_number: 'L',
          quantity: 1,
          cost_price: 1,
          expiry_date: new Date(Date.now() + 20 * day),
        },
      });
      await mk({
        data: {
          variant_id: v.id,
          branch_id: second(),
          batch_number: 'E',
          quantity: 0,
          cost_price: 1,
          expiry_date: new Date(Date.now() + 2 * day),
        },
      });
      await mk({
        data: {
          variant_id: v.id,
          branch_id: second(),
          batch_number: 'P',
          quantity: 1,
          cost_price: 1,
          expiry_date: new Date(Date.now() - day),
        },
      });
      const def: any = await inventory.getExpiringBatches(cid());
      expect(def.map((x: any) => x.id)).toEqual([b.id, late.id]);
      expect(def[0].branch.id).toBe(main());
      expect(def[0].variant.product.id).toEqual(expect.any(Number));
      const short: any = await inventory.getExpiringBatches(cid(), 10);
      expect(short.map((x: any) => x.id)).toEqual([b.id]);
      expect(
        await inventory.getExpiringBatches(w.bystander.consumer.id),
      ).toEqual([]);

      const prods: any = await inventory.getProductsForInventory(cid());
      const mine = await db.product.findMany({
        where: { consumer_id: cid() },
        orderBy: { name: 'asc' },
      });
      expect(prods).toEqual(mine.map((p) => ({ id: p.id, name: p.name })));
      const vs: any = await inventory.getProductVariants(mine[0].id, cid());
      expect(vs.length).toBeGreaterThan(0);
      expect(Object.keys(vs[0]).sort()).toEqual(
        ['id', 'name', 'regular_price', 'wholesale_price'].sort(),
      );
      const nf = await failure(
        inventory.getProductVariants(mine[0].id, w.bystander.consumer.id),
      );
      expect(nf).toBeInstanceOf(NotFoundException);
      expect(nf.message).toBe('Product not found');
    });

    it('[BE-INV-060] {InventoryService.getVariantStock} {InventoryService.getLowStockItems} branch scoping, shape and low-stock rules', async () => {
      const v = await stocked(10);
      const b = await batchOf(v.id);
      await db.inventoryBatch.update({
        where: { id: b.id },
        data: { reserved_quantity: 4 },
      });
      await mk({
        data: {
          variant_id: v.id,
          branch_id: second(),
          batch_number: 'S',
          quantity: 3,
          cost_price: 1,
        },
      });
      await db.productVariant.update({
        where: { id: v.id },
        data: { alert_quantity: 3 },
      });
      const n0 = w.tenant.branches[0].name;
      const n1 = w.tenant.branches[1].name;
      const all: any = await inventory.getVariantStock(v.id, cid());
      expect(all.total_stock).toBe(9);
      expect(all.is_low_stock).toBe(true);
      expect(all.stock_by_branch).toEqual({ [n0]: 6, [n1]: 3 });
      expect(all.variant).toMatchObject({
        id: v.id,
        alert_quantity: 3,
      });
      expect(all.variant.product.id).toEqual(expect.any(Number));
      expect(all.batches).toHaveLength(2);
      expect(all.batches[0].branch).toHaveProperty('is_main');
      expect(all.batches[0].created_at.getTime()).toBeGreaterThanOrEqual(
        all.batches[1].created_at.getTime(),
      );
      const m: any = await inventory.getVariantStock(v.id, cid(), main());
      expect(m).toMatchObject({ total_stock: 6, is_low_stock: false });
      expect(m.batches).toHaveLength(1);
      const s: any = await inventory.getVariantStock(v.id, cid(), second());
      expect(s).toMatchObject({ total_stock: 3, is_low_stock: true });
      const nf = await failure(
        inventory.getVariantStock(v.id, w.bystander.consumer.id),
      );
      expect(nf.message).toBe('Product variant not found');
      await db.productVariant.update({
        where: { id: v.id },
        data: { alert_quantity: 0 },
      });
      expect(
        ((await inventory.getVariantStock(v.id, cid())) as any).is_low_stock,
      ).toBe(false);

      await db.productVariant.update({
        where: { id: v.id },
        data: { alert_quantity: 6 },
      });
      const low: any[] = await inventory.getLowStockItems(cid());
      expect(low).toHaveLength(2);
      const l0 = low.find((x) => x.affected_branch_id === main());
      expect(l0).toMatchObject({
        total_stock: 6,
        shortage: 0,
        affected_branch_name: n0,
        unique_key: `${v.id}-${main()}`,
      });
      expect(l0.stock_by_branch).toEqual({ [n0]: 6, [n1]: 3 });
      const l1 = low.find((x) => x.affected_branch_id === second());
      expect(l1).toMatchObject({
        total_stock: 3,
        shortage: 3,
        affected_branch_name: n1,
      });
      const lb: any[] = await inventory.getLowStockItems(cid(), second());
      expect(lb).toHaveLength(1);
      expect(lb[0]).toMatchObject({
        total_stock: 3,
        shortage: 3,
        affected_branch_id: second(),
        affected_branch_name: n1,
      });
      expect(lb[0].stock_by_branch).toEqual({ [n1]: 3 });
      expect(lb[0].unique_key).toBeUndefined();
      await db.productVariant.update({
        where: { id: v.id },
        data: { alert_quantity: 5 },
      });
      expect(await inventory.getLowStockItems(cid(), main())).toHaveLength(0);
      expect(await inventory.getLowStockItems(cid())).toHaveLength(1);
      expect(
        await inventory.getLowStockItems(w.bystander.consumer.id),
      ).toHaveLength(0);
    });

    it('[BE-INV-061] {InventoryService.getInventoryMovementHistory} movements, labels, scoping and paging', async () => {
      const v = await stocked(20);
      const b = await batchOf(v.id);
      const a = await adj(v, b.id, -2, { notes: 'note1' });
      const t = await xfer([{ batch_id: b.id, quantity: 3 }], { notes: 'tn' });
      const n0 = w.tenant.branches[0].name;
      const n1 = w.tenant.branches[1].name;
      const hist: any = await inventory.getInventoryMovementHistory(
        v.id,
        cid(),
      );
      expect(hist.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      const byType = (ty: string) =>
        hist.data.filter((m: any) => m.type === ty);
      expect(byType('adjustment')).toHaveLength(1);
      expect(byType('adjustment')[0]).toMatchObject({
        id: a.id,
        quantity_change: -2,
        reason: 'count',
        notes: 'note1',
        batch_number: b.batch_number,
        location: n0,
      });
      expect(byType('adjustment')[0].user.id).toBe(uid());
      const out = byType('transfer_out');
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        id: t.id,
        quantity_change: -3,
        reason: `Transfer to ${n1}`,
        notes: 'tn',
        batch_number: b.batch_number,
        location: n0,
      });
      expect(out[0].user.id).toBe(uid());
      // transfersIn without branch filter matches destination undefined -> all
      const inn = byType('transfer_in');
      expect(inn).toHaveLength(1);
      expect(inn[0]).toMatchObject({
        id: t.id,
        quantity_change: 3,
        reason: `Transfer from ${n0}`,
        location: n1,
        notes: 'tn',
        batch_number: b.batch_number,
      });
      // sorted newest first
      const times = hist.data.map((m: any) => new Date(m.date).getTime());
      expect(times).toEqual([...times].sort((x, y) => y - x));
      // branch filter
      const bm: any = await inventory.getInventoryMovementHistory(v.id, cid(), {
        branch_id: main(),
      });
      expect(bm.data.map((m: any) => m.type).sort()).toEqual([
        'adjustment',
        'transfer_out',
      ]);
      const bs: any = await inventory.getInventoryMovementHistory(v.id, cid(), {
        branch_id: second(),
      });
      expect(bs.data.map((m: any) => m.type)).toEqual(['transfer_in']);
      expect(bs.meta.total).toBe(0);
      // paging: skip beyond
      const p2: any = await inventory.getInventoryMovementHistory(v.id, cid(), {
        page: 2,
        limit: 1,
      });
      expect(p2.data).toEqual([]);
      expect(p2.meta).toEqual({ total: 1, page: 2, limit: 1, totalPages: 1 });
      const nf = await failure(
        inventory.getInventoryMovementHistory(v.id, w.bystander.consumer.id),
      );
      expect(nf.message).toBe('Product variant not found');
    });
    it('[BE-INV-062] unexpected database failures surface as a generic 500 for every inventory method', async () => {
      const prisma = boot.get(PrismaService) as any;
      const cases: [string, any, string, () => Promise<unknown>, string][] = [
        [
          'inventoryAdjustment',
          adjustments,
          'productVariant',
          () =>
            adjustments.create(cid(), uid(), {
              variant_id: 1,
              batch_id: 1,
              quantity_change: 1,
              reason: 'x',
            } as any),
          'Failed to create inventory adjustment',
        ],
        [
          'inventoryAdjustment',
          adjustments,
          'inventoryAdjustment',
          () => adjustments.findAll(cid()),
          'Failed to find inventory adjustments',
        ],
        [
          'inventoryAdjustment',
          adjustments,
          'inventoryAdjustment',
          () => adjustments.findOne(1, cid()),
          'Failed to find inventory adjustment',
        ],
        [
          'transfer',
          transfers,
          'branch',
          () =>
            transfers.create(cid(), uid(), {
              source_branch_id: main(),
              destination_branch_id: second(),
              items: [],
            }),
          'Failed to create inventory transfer',
        ],
        [
          'transfer',
          transfers,
          'inventoryTransfer',
          () => transfers.findAll(cid()),
          'Failed to find all inventory transfers',
        ],
        [
          'transfer',
          transfers,
          'inventoryTransfer',
          () => transfers.findOne(1, cid()),
          'Failed to find inventory transfer',
        ],
        [
          'transfer',
          transfers,
          'inventoryTransfer',
          () => transfers.completeTransfer(1, cid()),
          'Failed to complete transfer',
        ],
        [
          'inv',
          inventory,
          'inventoryBatch',
          () => inventory.getInventorySummary(cid()),
          'Failed to get inventory summary',
        ],
        [
          'inv',
          inventory,
          'productVariant',
          () => inventory.getStockByVariant(cid()),
          'Failed to get stock by variant',
        ],
        [
          'inv',
          inventory,
          'inventoryBatch',
          () => inventory.getExpiringBatches(cid()),
          'Failed to get expiring batches',
        ],
        [
          'inv',
          inventory,
          'product',
          () => inventory.getProductsForInventory(cid()),
          'Failed to get products for inventory',
        ],
        [
          'inv',
          inventory,
          'product',
          () => inventory.getProductVariants(1, cid()),
          'Failed to get product variants',
        ],
        [
          'inv',
          inventory,
          'productVariant',
          () => inventory.getVariantStock(1, cid()),
          'Failed to get variant stock',
        ],
        [
          'inv',
          inventory,
          'productVariant',
          () => inventory.getLowStockItems(cid()),
          'Failed to fetch low stock items',
        ],
        [
          'inv',
          inventory,
          'productVariant',
          () => inventory.getInventoryMovementHistory(1, cid()),
          'Failed to find inventory movements',
        ],
      ];
      for (const [, , model, call, message] of cases) {
        const spies = ['findFirst', 'findMany', 'count', 'aggregate'].map(
          (fn) =>
            jest.spyOn(prisma[model], fn).mockRejectedValue(new Error('boom')),
        );
        const error = await failure(call());
        spies.forEach((x) => x.mockRestore());
        expect(error.message).toBe(message);
        expect(error.getStatus()).toBe(500);
      }
      const v = await stocked(5);
      const t = await xfer([
        { batch_id: (await batchOf(v.id)).id, quantity: 1 },
      ]);
      const spy = jest
        .spyOn(prisma.inventoryTransfer, 'updateMany')
        .mockRejectedValue(new Error('boom'));
      const cancel = await failure(transfers.cancelTransfer(t.id, cid()));
      spy.mockRestore();
      expect(cancel.message).toBe('Failed to cancel transfer');
      expect(cancel.getStatus()).toBe(500);
    });
  });
});
