import { Logger } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createBatch, createTenant, createVendor } from '../factories';
import { InventoryBatchService } from '../../src/consumer/inventory/services/inventory-batch.service';
import { InventoryTransferService } from '../../src/consumer/inventory/services/inventory-transfer.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('inventory transfers (extra mutation hardening)', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let batches: InventoryBatchService;
  let transfers: InventoryTransferService;

  beforeAll(async () => {
    boot = await bootDomain();
    batches = boot.get(InventoryBatchService);
    transfers = boot.get(InventoryTransferService);
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

  it('[BE-INV-070] {InventoryTransferService.create} one bad quantity among valid ones, duplicate-batch message, null notes', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    const b = await batchOf(v.id);
    const need =
      'A transfer needs at least one item and every quantity must be a positive whole number';
    for (const bad of [-1, 0, 2.5, NaN]) {
      const e = await failure(
        xfer([
          { batch_id: b.id, quantity: 1 },
          { batch_id: b.id, quantity: bad },
        ]),
      );
      expect(e.message).toBe(need);
      expect(e.getStatus()).toBe(400);
    }
    expect(
      (await failure(xfer([{ batch_id: b.id, quantity: -1 }]))).message,
    ).toBe(need);
    const dup = await failure(
      xfer([
        { batch_id: b.id, quantity: 6 },
        { batch_id: b.id, quantity: 6 },
      ]),
    );
    expect(dup.message).toBe(
      `Insufficient available quantity in batch ${b.id}. Available: 10, Requested: 6`,
    );
    expect(dup.getStatus()).toBe(400);
    expect(await db.inventoryTransfer.count()).toBe(0);
    const ok = await xfer([
      { batch_id: b.id, quantity: 5 },
      { batch_id: b.id, quantity: 5 },
    ]);
    expect(ok.notes).toBeNull();
    expect(ok.status).toBe('pending');
    expect(ok.completed_date).toBeNull();
    expect(ok.items.map((i: any) => i.quantity)).toEqual([5, 5]);
    // the batch is untouched until completion
    expect(await batchOf(v.id)).toMatchObject({
      quantity: 10,
      reserved_quantity: 0,
    });
    // returned relation selections are exactly id/name(/is_warehouse)
    expect(Object.keys(ok.source_branch).sort()).toEqual([
      'id',
      'is_warehouse',
      'name',
    ]);
    expect(Object.keys(ok.destination_branch).sort()).toEqual([
      'id',
      'is_warehouse',
      'name',
    ]);
    expect(Object.keys(ok.created_by_user).sort()).toEqual(['id', 'name']);
    expect(Object.keys(ok.items[0].batch.variant.product).sort()).toEqual([
      'id',
      'name',
    ]);
    expect(ok.created_by_user.name).toBe(w.tenant.adminUser.name);
    expect(ok.source_branch.name).toBe(w.tenant.branches[0].name);
  });

  it('[BE-INV-071] {InventoryTransferService.findAll} {InventoryTransferService.findOne} either side of a cross-tenant transfer can see it; unrelated tenants cannot', async () => {
    const theirBatch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: w.theirs.id },
    });
    const theirBranch = w.bystander.branches[0].id;
    const asSource = await db.inventoryTransfer.create({
      data: {
        source_branch_id: main(),
        destination_branch_id: theirBranch,
        created_by_user_id: uid(),
      },
    });
    const asDest = await db.inventoryTransfer.create({
      data: {
        source_branch_id: theirBranch,
        destination_branch_id: second(),
        created_by_user_id: w.bystander.adminUser.id,
      },
    });
    expect(theirBatch.id).toBeGreaterThan(0);
    const mine: any = await transfers.findAll(cid());
    expect(mine.data.map((t: any) => t.id).sort()).toEqual(
      [asSource.id, asDest.id].sort(),
    );
    expect(mine.meta.total).toBe(2);
    for (const id of [asSource.id, asDest.id]) {
      expect(((await transfers.findOne(id, cid())) as any).id).toBe(id);
      expect(
        ((await transfers.findOne(id, w.bystander.consumer.id)) as any).id,
      ).toBe(id);
    }
    // an unrelated third tenant sees neither
    const third = await createTenant(db);
    expect(
      ((await transfers.findAll(third.consumer.id)) as any).meta.total,
    ).toBe(0);
    expect(
      (await failure(transfers.findOne(asSource.id, third.consumer.id)))
        .message,
    ).toBe('Transfer not found');
    expect(
      (await failure(transfers.completeTransfer(asDest.id, third.consumer.id)))
        .message,
    ).toBe('Transfer not found');
    await w.rebaseBystander();
    await db.inventoryTransfer.deleteMany({
      where: { id: { in: [asSource.id, asDest.id] } },
    });
    await w.rebaseBystander();
  });

  it('[BE-INV-072] {InventoryTransferService.findAll} option combinations and defaults', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 100, cost: 40 }] });
    const b = await batchOf(v.id);
    const made: any[] = [];
    for (let i = 0; i < 12; i++) {
      made.push(await xfer([{ batch_id: b.id, quantity: 1 }]));
    }
    const first: any = await transfers.findAll(cid());
    expect(first.data).toHaveLength(10);
    expect(first.meta).toEqual({
      current_page: 1,
      per_page: 10,
      total: 12,
      last_page: 2,
    });
    expect(first.data[0].id).toBe(made[11].id);
    const p2: any = await transfers.findAll(cid(), { page: 2 });
    expect(p2.data.map((t: any) => t.id)).toEqual([made[1].id, made[0].id]);
    expect(p2.meta.current_page).toBe(2);
    const lim: any = await transfers.findAll(cid(), { limit: 5, page: 3 });
    expect(lim.data.map((t: any) => t.id)).toEqual([made[1].id, made[0].id]);
    expect(lim.meta).toEqual({
      current_page: 3,
      per_page: 5,
      total: 12,
      last_page: 3,
    });
    await transfers.cancelTransfer(made[3].id, cid());
    await transfers.completeTransfer(made[4].id, cid());
    const both: any = await transfers.findAll(cid(), {
      status: 'pending',
      branch_id: main(),
      limit: 50,
    });
    expect(both.meta.total).toBe(10);
    expect(both.data.every((t: any) => t.status === 'pending')).toBe(true);
    const done: any = await transfers.findAll(cid(), {
      status: 'completed',
      branch_id: second(),
    });
    expect(done.data.map((t: any) => t.id)).toEqual([made[4].id]);
    const unknown: any = await transfers.findAll(cid(), {
      status: 'no-such-status',
    });
    expect(unknown.data).toEqual([]);
    expect(unknown.meta).toEqual({
      current_page: 1,
      per_page: 10,
      total: 0,
      last_page: 0,
    });
    const item = first.data[0];
    expect(item.items[0].batch.variant.product.id).toEqual(expect.any(Number));
    expect(item.created_by_user).toEqual({
      id: uid(),
      name: w.tenant.adminUser.name,
    });
    expect(Object.keys(item.source_branch).sort()).toEqual([
      'id',
      'is_warehouse',
      'name',
    ]);
  });

  it('[BE-INV-073] {InventoryTransferService.completeTransfer} multi-item, vendor/expiry matching, null expiry merge, source reserved untouched', async () => {
    const v1 = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    const v2 = await w.stock({ price: 100, batches: [{ qty: 8, cost: 30 }] });
    const b1 = await batchOf(v1.id);
    const b2 = await batchOf(v2.id);
    const vendorA = await createVendor(db, { consumer_id: cid() });
    const vendorB = await createVendor(db, { consumer_id: cid() });
    await db.inventoryBatch.update({
      where: { id: b1.id },
      data: {
        vendor_id: vendorA.id,
        expiry_date: new Date('2032-05-05'),
        reserved_quantity: 2,
      },
    });
    const seed = async (extra: {
      quantity: number;
      vendor_id: number;
      expiry_date: string | Date;
    }) => {
      return createBatch(db, w.tenant, {
        variant_id: v1.id,
        branch_id: second(),
        batch_number: b1.batch_number,
        cost_price: b1.cost_price,
        quantity: extra.quantity,
        vendor_id: extra.vendor_id,
        expiry_date: new Date(extra.expiry_date),
      });
    };
    // a destination batch equal in every field except vendor
    await seed({
      quantity: 100,
      vendor_id: vendorB.id,
      expiry_date: '2032-05-05',
    });
    // ... and one equal except expiry
    await seed({
      quantity: 200,
      vendor_id: vendorA.id,
      expiry_date: '2033-01-01',
    });
    const t = await xfer([
      { batch_id: b1.id, quantity: 3 },
      { batch_id: b2.id, quantity: 8 },
    ]);
    const done: any = await transfers.completeTransfer(t.id, cid());
    expect(done.status).toBe('completed');
    expect(done.items).toHaveLength(2);
    const dests = await db.inventoryBatch.findMany({
      where: { branch_id: second() },
      orderBy: { id: 'asc' },
    });
    expect(dests.map((d) => d.quantity)).toEqual([100, 200, 3, 8]);
    const d1 = dests[2];
    expect(d1).toMatchObject({
      variant_id: v1.id,
      vendor_id: vendorA.id,
      reserved_quantity: 0,
    });
    expect(d1.expiry_date).toEqual(new Date('2032-05-05'));
    const link = (id: number) =>
      done.items.find((i: any) => i.id === id).dest_batch_id;
    const items = await db.inventoryTransferItem.findMany({
      where: { transfer_id: t.id },
      orderBy: { id: 'asc' },
    });
    expect(items.map((i) => i.dest_batch_id)).toEqual([d1.id, dests[3].id]);
    expect(link(items[0].id)).toBe(d1.id);
    // source: quantity down, reservation untouched; fully drained batch stays
    expect(await batchOf(v1.id)).toMatchObject({
      quantity: 7,
      reserved_quantity: 2,
    });
    expect(await batchOf(v2.id)).toMatchObject({ quantity: 0 });
    // a drained batch has nothing left to transfer
    const t2 = await xfer([{ batch_id: b2.id, quantity: 0 + 1 }]).catch(
      (e) => e,
    );
    expect(t2.message).toMatch(/Insufficient available quantity/);
    expect(
      await db.inventoryAuditLog.count({
        where: { event_type: 'TRANSFER_OUT' },
      }),
    ).toBe(2);
    expect(
      await db.inventoryAuditLog.count({
        where: { event_type: 'TRANSFER_IN' },
      }),
    ).toBe(2);
    const outs = await db.inventoryAuditLog.findMany({
      where: { event_type: 'TRANSFER_OUT' },
      orderBy: { id: 'asc' },
    });
    expect(
      outs.map((o) => [o.variant_id, o.quantity_delta, o.quantity_after]),
    ).toEqual([
      [v1.id, -3, 7],
      [v2.id, -8, 0],
    ]);
    expect(outs.map((o) => o.reference_id)).toEqual(items.map((i) => i.id));
  });

  it('[BE-INV-074] {InventoryTransferService.completeTransfer} {InventoryTransferService.cancelTransfer} status errors, returned rows and write sets', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    const b = await batchOf(v.id);
    const t = await xfer([{ batch_id: b.id, quantity: 2 }]);
    const cancelled: any = await transfers.cancelTransfer(t.id, cid());
    expect(cancelled).toMatchObject({
      id: t.id,
      status: 'cancelled',
      completed_date: null,
    });
    expect(cancelled.items).toBeUndefined();
    const c2 = await failure(transfers.cancelTransfer(t.id, cid()));
    expect(c2.getStatus()).toBe(400);
    expect(c2.message).toBe('Transfer is not in pending status');
    const c3 = await failure(transfers.completeTransfer(t.id, cid()));
    expect(c3.getStatus()).toBe(400);
    expect(c3.message).toBe('Transfer is not in pending status');
    const missing = await failure(transfers.completeTransfer(999999, cid()));
    expect(missing.getStatus()).toBe(404);
    expect(missing.message).toBe('Transfer not found');
    expect(
      (await failure(transfers.cancelTransfer(999999, cid()))).getStatus(),
    ).toBe(404);
    const t2 = await xfer([{ batch_id: b.id, quantity: 2 }]);
    const done: any = await transfers.completeTransfer(t2.id, cid());
    expect(done.status).toBe('completed');
    expect(done.completed_date.getTime()).toBeGreaterThan(Date.now() - 60000);
    const c4 = await failure(transfers.cancelTransfer(t2.id, cid()));
    expect(c4.message).toBe('Transfer is not in pending status');
    expect(
      (await db.inventoryTransfer.findUniqueOrThrow({ where: { id: t2.id } }))
        .status,
    ).toBe('completed');
    // the transfer that claim-lost (status flipped between read and claim) is a 400
    const t3 = await xfer([{ batch_id: b.id, quantity: 1 }]);
    const prisma = boot.get(PrismaService) as any;
    const spy = jest
      .spyOn(prisma.inventoryTransfer, 'updateMany')
      .mockResolvedValue({ count: 0 });
    const lostCancel = await failure(transfers.cancelTransfer(t3.id, cid()));
    spy.mockRestore();
    expect(lostCancel.getStatus()).toBe(400);
    expect(lostCancel.message).toBe('Transfer is not in pending status');
    expect(
      (await db.inventoryTransfer.findUniqueOrThrow({ where: { id: t3.id } }))
        .status,
    ).toBe('pending');
    expect(await batchOf(v.id)).toMatchObject({ quantity: 8 });
    void batches;
  });

  it('[BE-INV-075] every transfer method logs a specific error with the stack before the generic 500', async () => {
    const prisma = boot.get(PrismaService) as any;
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const cases: [string, () => Promise<unknown>, string, string][] = [
      [
        'branch',
        () =>
          transfers.create(cid(), uid(), {
            source_branch_id: 1,
            destination_branch_id: 2,
            items: [],
          }),
        `Error creating inventory transfer for consumer ${cid()}`,
        'Failed to create inventory transfer',
      ],
      [
        'inventoryTransfer',
        () => transfers.findAll(cid()),
        `Error finding all inventory transfers for consumer ${cid()}`,
        'Failed to find all inventory transfers',
      ],
      [
        'inventoryTransfer',
        () => transfers.findOne(77, cid()),
        `Error finding inventory transfer 77 for consumer ${cid()}`,
        'Failed to find inventory transfer',
      ],
      [
        'inventoryTransfer',
        () => transfers.completeTransfer(78, cid()),
        `Error completing transfer with ID 78 for consumer ${cid()}`,
        'Failed to complete transfer',
      ],
    ];
    try {
      for (const [model, call, logged, message] of cases) {
        logSpy.mockClear();
        const spies = ['findFirst', 'findMany', 'count'].map((fn) =>
          jest.spyOn(prisma[model], fn).mockRejectedValue(new Error('boom')),
        );
        const e = await failure(call());
        spies.forEach((s) => s.mockRestore());
        expect(e.message).toBe(message);
        expect(e.getStatus()).toBe(500);
        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenCalledWith(
          logged,
          expect.stringContaining('boom'),
        );
      }
      logSpy.mockClear();
      const t = await db.inventoryTransfer.create({
        data: {
          source_branch_id: main(),
          destination_branch_id: second(),
          created_by_user_id: uid(),
        },
      });
      const upd = jest
        .spyOn(prisma.inventoryTransfer, 'updateMany')
        .mockRejectedValue(new Error('boom'));
      const e = await failure(transfers.cancelTransfer(t.id, cid()));
      upd.mockRestore();
      expect(e.message).toBe('Failed to cancel transfer');
      expect(logSpy).toHaveBeenCalledWith(
        `Error cancelling transfer with ID ${t.id} for consumer ${cid()}`,
        expect.stringContaining('boom'),
      );
    } finally {
      logSpy.mockRestore();
    }
  });
});
