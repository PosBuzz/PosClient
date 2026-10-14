import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { InventoryAdjustmentService } from '../../src/consumer/inventory/services/inventory-adjustment.service';

describe('inventory adjustments (extra, boundaries)', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let adjustments: InventoryAdjustmentService;

  beforeAll(async () => {
    boot = await bootDomain();
    adjustments = boot.get(InventoryAdjustmentService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot, { branches: 2 });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    return w.check();
  });

  const cid = () => w.tenant.consumer.id;
  const uid = () => w.tenant.adminUser.id;
  const main = () => w.tenant.branches[0].id;
  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );
  const stocked = (qty = 10) =>
    w.stock({ price: 100, batches: [{ qty, cost: 40 }] });
  const batchOf = (variantId: number) =>
    db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: variantId, branch_id: main() },
    });
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

  it('[BE-INV-260] {InventoryAdjustmentService.create} a positive change succeeds although reserved stock exceeds availability', async () => {
    const v = await stocked(5);
    const b = await batchOf(v.id);
    await db.inventoryBatch.update({
      where: { id: b.id },
      data: { reserved_quantity: 5 },
    });
    const refused = await failure(adj(v, b.id, -1));
    expect(refused.message).toBe(
      'Insufficient available quantity in batch. Available: 0, Requested: 1',
    );
    const done = await adj(v, b.id, 3);
    expect(done.quantity_change).toBe(3);
    const after = await batchOf(v.id);
    expect(after.quantity).toBe(8);
    expect(after.reserved_quantity).toBe(5);
    const audit = await db.inventoryAuditLog.findFirstOrThrow({
      where: { reference_id: done.id, event_type: 'ADJUSTMENT' },
    });
    expect(audit.quantity_delta).toBe(3);
    expect(audit.quantity_after).toBe(8);
  });

  it('[BE-INV-261] {InventoryAdjustmentService.create} one past availability is refused with nothing written; exactly available leaves reserved alone', async () => {
    const v = await stocked(7);
    const b = await batchOf(v.id);
    await db.inventoryBatch.update({
      where: { id: b.id },
      data: { reserved_quantity: 3 },
    });
    const e = await failure(adj(v, b.id, -5));
    expect(e).toBeInstanceOf(BadRequestException);
    expect(e.message).toBe(
      'Insufficient available quantity in batch. Available: 4, Requested: 5',
    );
    expect(await db.inventoryAdjustment.count()).toBe(0);
    await adj(v, b.id, -4);
    const done = await batchOf(v.id);
    expect(done.quantity).toBe(3);
    expect(done.reserved_quantity).toBe(3);
  });

  it('[BE-INV-262] {InventoryAdjustmentService.create} a batch of another variant, an unknown branch and an unknown batch each fail with their own message', async () => {
    const v = await stocked(5);
    const v2 = await stocked(5);
    const b = await batchOf(v.id);
    const e1 = await failure(adj(v2, b.id, 1));
    expect(e1).toBeInstanceOf(NotFoundException);
    expect(e1.message).toBe(
      'Batch not found for the specified variant and branch',
    );
    const e2 = await failure(adj(v, b.id, 1, { branch_id: 9999999 }));
    expect(e2).toBeInstanceOf(NotFoundException);
    expect(e2.message).toBe('Branch not found');
    const e3 = await failure(adj(v, 9999999, 1));
    expect(e3.message).toBe(
      'Batch not found for the specified variant and branch',
    );
    expect(await db.inventoryAdjustment.count()).toBe(0);
  });

  it('[BE-INV-263] {InventoryAdjustmentService.create} reason, notes and actor are stored; the audit row links the batch twice', async () => {
    const v = await stocked(5);
    const b = await batchOf(v.id);
    const done = await adj(v, b.id, -1, { reason: 'damaged', notes: 'n-1' });
    expect(
      await db.inventoryAdjustment.findUniqueOrThrow({
        where: { id: done.id },
      }),
    ).toMatchObject({
      variant_id: v.id,
      branch_id: main(),
      batch_id: b.id,
      quantity_change: -1,
      reason: 'damaged',
      notes: 'n-1',
      created_by_user_id: uid(),
    });
    const audit = await db.inventoryAuditLog.findFirstOrThrow({
      where: { reference_id: done.id, event_type: 'ADJUSTMENT' },
    });
    expect(audit).toMatchObject({
      consumer_id: cid(),
      batch_id: b.id,
      inventoryBatchId: b.id,
      notes: 'n-1',
      reference_type: 'inventory_adjustments',
    });
  });

  it('[BE-INV-264] {InventoryAdjustmentService.findAll} the default page size is 10', async () => {
    const v = await stocked(100);
    const b = await batchOf(v.id);
    const made: any[] = [];
    for (let i = 1; i <= 11; i++) made.push(await adj(v, b.id, i));
    const page: any = await adjustments.findAll(cid());
    expect(page.data).toHaveLength(10);
    expect(page.meta).toEqual({ total: 11, page: 1, limit: 10, totalPages: 2 });
    const second: any = await adjustments.findAll(cid(), { page: 2 });
    expect(second.data.map((a: any) => a.id)).toEqual([made[0].id]);
  });
});
