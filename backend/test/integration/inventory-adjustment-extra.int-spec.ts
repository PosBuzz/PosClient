import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { InventoryAdjustmentService } from '../../src/consumer/inventory/services/inventory-adjustment.service';
import * as stockUtil from '../../src/consumer/inventory/utils/stock-mutation.util';

// Second, adversarial pass over InventoryAdjustmentService (mutation hardening).
describe('inventory adjustments (extra)', () => {
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
  const loggerOf = () => (adjustments as any).logger;

  it('[BE-INV-201] {InventoryAdjustmentService.create} returned row and includes carry exact selected fields', async () => {
    const v = await stocked(10);
    const b = await batchOf(v.id);
    const res = await adj(v, b.id, 4, { reason: 'found', notes: undefined });
    expect(res).toMatchObject({
      variant_id: v.id,
      branch_id: main(),
      batch_id: b.id,
      quantity_change: 4,
      reason: 'found',
      notes: null,
      created_by_user_id: uid(),
    });
    expect(res.branch).toEqual({ id: main(), name: expect.any(String) });
    expect(res.created_by_user).toEqual({
      id: uid(),
      name: expect.any(String),
    });
    expect(res.batch.id).toBe(b.id);
    expect(res.batch.variant.id).toBe(v.id);
    expect(res.batch.variant.product).toEqual({
      id: expect.any(Number),
      name: expect.any(String),
    });
    // positive adjustments are an increment of the stored quantity
    expect(Number((await batchOf(v.id)).quantity)).toBe(14);
    const stored = await db.inventoryAdjustment.findUniqueOrThrow({
      where: { id: res.id },
    });
    expect(stored).toMatchObject({
      reason: 'found',
      notes: null,
      quantity_change: 4,
    });
    const audit = await db.inventoryAuditLog.findFirstOrThrow({
      where: { reference_id: res.id, event_type: 'ADJUSTMENT' },
    });
    expect(audit).toMatchObject({
      quantity_delta: 4,
      quantity_after: 14,
      notes: 'found',
      batch_id: b.id,
      inventoryBatchId: b.id,
    });
  });

  it('[BE-INV-202] {InventoryAdjustmentService.create} a batch of another variant is not found, nothing is written', async () => {
    const v1 = await stocked(5);
    const v2 = await stocked(5);
    const b2 = await batchOf(v2.id);
    const e = await failure(adj(v1, b2.id, -1));
    expect(e).toBeInstanceOf(NotFoundException);
    expect(e.message).toBe(
      'Batch not found for the specified variant and branch',
    );
    expect(await db.inventoryAdjustment.count()).toBe(0);
    expect(Number((await batchOf(v2.id)).quantity)).toBe(5);
    const audits = await db.inventoryAuditLog.count({
      where: { event_type: 'ADJUSTMENT' },
    });
    expect(audits).toBe(0);
  });

  it('[BE-INV-203] {InventoryAdjustmentService.create} removal calls the atomic helper with the absolute amount; additions never do', async () => {
    const v = await stocked(10);
    const b = await batchOf(v.id);
    const spy = jest.spyOn(stockUtil, 'takeAvailableStock');
    await adj(v, b.id, 3);
    expect(spy).not.toHaveBeenCalled();
    await adj(v, b.id, -6);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.anything(), b.id, 6);
    expect(Number((await batchOf(v.id)).quantity)).toBe(7);
  });

  it('[BE-INV-204] {InventoryAdjustmentService.create} a removal that loses the race is a 400 and rolls the adjustment back', async () => {
    const v = await stocked(10);
    const b = await batchOf(v.id);
    jest.spyOn(stockUtil, 'takeAvailableStock').mockResolvedValueOnce(null);
    const e = await failure(adj(v, b.id, -4));
    expect(e).toBeInstanceOf(BadRequestException);
    expect(e.message).toBe(
      'Insufficient available quantity in batch. Requested: 4',
    );
    expect(await db.inventoryAdjustment.count()).toBe(0);
    expect(
      await db.inventoryAuditLog.count({ where: { event_type: 'ADJUSTMENT' } }),
    ).toBe(0);
    expect(Number((await batchOf(v.id)).quantity)).toBe(10);
  });

  it('[BE-INV-205] {InventoryAdjustmentService.create} a zero change is not a removal even when reservations exceed stock', async () => {
    const v = await stocked(5);
    const b = await batchOf(v.id);
    await db.inventoryBatch.update({
      where: { id: b.id },
      data: { reserved_quantity: 5 },
    });
    const ok = await adj(v, b.id, 0);
    expect(ok.quantity_change).toBe(0);
    expect(Number((await batchOf(v.id)).quantity)).toBe(5);
    // one unit over the available amount is refused, exactly the available amount is not
    const e = await failure(adj(v, b.id, -1));
    expect(e.message).toBe(
      'Insufficient available quantity in batch. Available: 0, Requested: 1',
    );
  });

  it('[BE-INV-206] unexpected failures are a logged generic 500 for create, findAll and findOne', async () => {
    const v = await stocked(5);
    const b = await batchOf(v.id);
    const prisma: any = (adjustments as any).prisma;
    const logSpy = jest.spyOn(loggerOf(), 'error').mockImplementation(() => {});
    const boom = new Error('boom');

    jest.spyOn(prisma.productVariant, 'findFirst').mockRejectedValueOnce(boom);
    const c = await failure(adj(v, b.id, 1));
    expect(c).toBeInstanceOf(HttpException);
    expect(c.getStatus()).toBe(500);
    expect(c.message).toBe('Failed to create inventory adjustment');
    expect(logSpy).toHaveBeenLastCalledWith(
      `Error creating inventory adjustment for consumer ${cid()}`,
      boom.stack,
    );

    jest.spyOn(prisma.inventoryAdjustment, 'count').mockRejectedValueOnce(boom);
    const l = await failure(adjustments.findAll(cid()));
    expect(l.getStatus()).toBe(500);
    expect(l.message).toBe('Failed to find inventory adjustments');
    expect(logSpy).toHaveBeenLastCalledWith(
      `Error finding all inventory adjustments for ${cid()}`,
      boom.stack,
    );

    jest
      .spyOn(prisma.inventoryAdjustment, 'findFirst')
      .mockRejectedValueOnce(boom);
    const o = await failure(adjustments.findOne(77, cid()));
    expect(o.getStatus()).toBe(500);
    expect(o.message).toBe('Failed to find inventory adjustment');
    expect(logSpy).toHaveBeenLastCalledWith(
      `Error finding inventory adjustment 77 for consumer ${cid()}`,
      boom.stack,
    );
    expect(logSpy).toHaveBeenCalledTimes(3);

    // client errors are rethrown unlogged
    logSpy.mockClear();
    expect(await failure(adjustments.findOne(999999, cid()))).toBeInstanceOf(
      NotFoundException,
    );
    expect(logSpy).not.toHaveBeenCalled();
    // a transaction failure is wrapped, not leaked
    jest
      .spyOn(prisma, '$transaction')
      .mockRejectedValueOnce(new Error('tx failed'));
    const t = await failure(adj(v, b.id, 1));
    expect(t.getStatus()).toBe(500);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('[BE-INV-207] {InventoryAdjustmentService.findAll} {InventoryAdjustmentService.findOne} include exact relation fields, default paging and tenant scope', async () => {
    const v = await stocked(50);
    const b = await batchOf(v.id);
    const made: any[] = [];
    for (let i = 1; i <= 12; i++) made.push(await adj(v, b.id, i));
    const first: any = await adjustments.findAll(cid());
    expect(first.data).toHaveLength(10);
    expect(first.meta).toEqual({
      total: 12,
      page: 1,
      limit: 10,
      totalPages: 2,
    });
    const row = first.data[0];
    expect(row.id).toBe(made[11].id);
    expect(row.branch).toEqual({ id: main(), name: expect.any(String) });
    expect(row.created_by_user).toEqual({
      id: uid(),
      name: expect.any(String),
    });
    expect(row.batch.variant.product).toEqual({
      id: expect.any(Number),
      name: expect.any(String),
    });
    const second: any = await adjustments.findAll(cid(), { page: 2 });
    expect(second.data.map((a: any) => a.id)).toEqual([made[1].id, made[0].id]);
    expect(second.meta.page).toBe(2);

    const one: any = await adjustments.findOne(made[4].id, cid());
    expect(one.branch).toEqual({ id: main(), name: expect.any(String) });
    expect(one.created_by_user).toEqual({
      id: uid(),
      name: expect.any(String),
    });
    expect(one.batch.variant.product).toEqual({
      id: expect.any(Number),
      name: expect.any(String),
    });
    expect(one.batch_id).toBe(b.id);
    // a different id of the same tenant is not returned for the wrong id
    const e = await failure(adjustments.findOne(made[4].id + 5000, cid()));
    expect(e).toBeInstanceOf(NotFoundException);
    expect(e.message).toBe(`Adjustment with ID ${made[4].id + 5000} not found`);
  });
});
