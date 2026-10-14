import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createBatch, createVendor } from '../factories';
import { VendorService } from '../../src/consumer/vendor/services/vendor.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('vendor service extra (mutation hardening)', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let vendors: VendorService;
  let prisma: PrismaService;

  beforeAll(async () => {
    boot = await bootDomain();
    vendors = boot.get(VendorService);
    prisma = boot.get(PrismaService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const cid = () => w.tenant.consumer.id;
  const failure = async (p: Promise<unknown>) =>
    p.then(
      () => null,
      (e: any) => e,
    );
  const boom = (model: string, method: string) =>
    jest
      .spyOn((prisma as any)[model], method)
      .mockRejectedValueOnce(new Error('db down'));
  const logSpy = () =>
    jest.spyOn((vendors as any).logger, 'error').mockImplementation(() => {});
  const batchFor = (vendorId: number, variantId: number, extra: object = {}) =>
    createBatch(db, w.tenant, {
      variant_id: variantId,
      vendor_id: vendorId,
      ...extra,
    });

  it('[BE-VEND-201] {VendorService.create} omitted optionals are null; failures log the tenant with a stack and carry the exact 500 body', async () => {
    const v: any = await vendors.create({ name: 'Min' }, cid());
    expect(v).toMatchObject({
      name: 'Min',
      contact: null,
      phone: null,
      email: null,
      address: null,
      consumer_id: cid(),
    });
    const spy = logSpy();
    boom('vendor', 'create');
    const err = await failure(vendors.create({ name: 'N' }, cid()));
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getResponse()).toBe('Failed to create vendor');
    expect(spy).toHaveBeenCalledWith(
      `Error creating vendor for consumer ${cid()}`,
      expect.stringContaining('db down'),
    );
  });

  it('[BE-VEND-202] {VendorService.findOne} {VendorService.update} {VendorService.remove} log exact messages; NotFound is never logged; inner lookup failures pass through', async () => {
    const mine = await createVendor(db, { consumer_id: cid() });
    const spy = logSpy();
    boom('vendor', 'findFirst');
    const a = await failure(vendors.findOne(mine.id, cid()));
    expect(a.getResponse()).toBe('Failed to find vendor');
    boom('vendor', 'update');
    const b = await failure(vendors.update(mine.id, { name: 'Z' }, cid()));
    expect(b.getResponse()).toBe('Failed to update vendor');
    boom('vendor', 'delete');
    const c = await failure(vendors.remove(mine.id, cid()));
    expect(c.getResponse()).toBe('Failed to delete vendor');
    boom('inventoryBatch', 'count');
    const d = await failure(vendors.remove(mine.id, cid()));
    expect(d.getResponse()).toBe('Failed to delete vendor');
    // inner findOne failure surfaces unchanged through update/remove
    boom('vendor', 'findFirst');
    const e = await failure(vendors.update(mine.id, { name: 'Z' }, cid()));
    expect(e.getResponse()).toBe('Failed to find vendor');
    expect(spy.mock.calls.map((x) => x[0])).toEqual([
      `Error finding vendor with ID ${mine.id} for consumer ${cid()}`,
      `Error updating vendor with ID ${mine.id} for consumer ${cid()}`,
      `Error deleting vendor with ID ${mine.id} for consumer ${cid()}`,
      `Error deleting vendor with ID ${mine.id} for consumer ${cid()}`,
      `Error finding vendor with ID ${mine.id} for consumer ${cid()}`,
    ]);
    for (const call of spy.mock.calls) expect(call[1]).toContain('db down');
    spy.mockClear();
    expect(await failure(vendors.findOne(987654, cid()))).toBeInstanceOf(
      NotFoundException,
    );
    expect(await failure(vendors.update(987654, {}, cid()))).toBeInstanceOf(
      NotFoundException,
    );
    expect(await failure(vendors.remove(987654, cid()))).toBeInstanceOf(
      NotFoundException,
    );
    expect(spy).not.toHaveBeenCalled();
    expect(await db.vendor.count({ where: { id: mine.id } })).toBe(1);
  });

  it('[BE-VEND-203] {VendorService.findOne} {VendorService.findAll} return every column of the tenant rows', async () => {
    const mine = await createVendor(db, {
      consumer_id: cid(),
      contact: 'c',
      phone: 'p',
      email: 'e',
      address: 'a',
    });
    expect(await vendors.findOne(mine.id, cid())).toEqual(mine);
    expect(await vendors.findAll(cid())).toEqual([mine]);
    expect(await vendors.findAll(cid() + 987654)).toEqual([]);
  });

  it('[BE-VEND-204] {VendorService.update} an empty update keeps every column; each field updates alone', async () => {
    const mine = await createVendor(db, {
      consumer_id: cid(),
      name: 'Keep',
      contact: 'c',
      phone: 'p',
      email: 'e',
      address: 'a',
    });
    await vendors.update(mine.id, {}, cid());
    expect(await vendors.findOne(mine.id, cid())).toEqual(mine);
    for (const [k, val] of [
      ['contact', 'c9'],
      ['phone', 'p9'],
      ['email', 'e9'],
      ['address', 'a9'],
    ]) {
      const out: any = await vendors.update(mine.id, { [k]: val }, cid());
      expect(out[k]).toBe(val);
      expect(out.name).toBe('Keep');
    }
  });

  it('[BE-VEND-205] {VendorService.remove} only this vendors batches block deletion and a single batch is counted exactly', async () => {
    const busy = await createVendor(db, { consumer_id: cid() });
    const free = await createVendor(db, { consumer_id: cid() });
    const v = await w.stock({ price: 10, batches: [] });
    await batchFor(busy.id, v.id);
    const blocked = await failure(vendors.remove(busy.id, cid()));
    expect(blocked).toBeInstanceOf(BadRequestException);
    expect(blocked.message).toBe(
      'Cannot delete vendor with 1 associated batches',
    );
    expect(await vendors.remove(free.id, cid())).toEqual({ success: true });
    expect(await db.vendor.count({ where: { id: free.id } })).toBe(0);
  });

  it('[BE-VEND-206] {VendorService.findOneWithDetails} owed is computed on the purchased quantity, not what is left, and may go negative when overpaid', async () => {
    const vendor = await createVendor(db, { consumer_id: cid() });
    const v = await w.stock({ price: 10, batches: [] });
    // bought 10 at 5 = 50, 7 sold since, 20 paid
    const sold = await batchFor(vendor.id, v.id, {
      quantity: 10,
      cost_price: 5,
      paid_amount: 20,
      batch_number: 'S-1',
      created_at: new Date('2026-01-01T00:00:00Z'),
    });
    await db.inventoryBatch.update({
      where: { id: sold.id },
      data: { quantity: 3 },
    });
    // overpaid: bought 2 at 10 = 20, paid 30
    await batchFor(vendor.id, v.id, {
      quantity: 2,
      cost_price: 10,
      paid_amount: 30,
      batch_number: 'S-2',
      created_at: new Date('2026-01-02T00:00:00Z'),
    });
    // transfer-style batch without a purchase row falls back to its quantity
    const moved = await batchFor(vendor.id, v.id, {
      quantity: 4,
      cost_price: 2.5,
      paid_amount: 0,
      batch_number: 'S-3',
      created_at: new Date('2026-01-03T00:00:00Z'),
    });
    await db.inventoryAuditLog.deleteMany({ where: { batch_id: moved.id } });
    const d: any = await vendors.findOneWithDetails(vendor.id, cid());
    expect(d.batches.map((b: any) => b.batch_number)).toEqual([
      'S-3',
      'S-2',
      'S-1',
    ]);
    const byNo = Object.fromEntries(
      d.batches.map((b: any) => [b.batch_number, b]),
    );
    expect(byNo['S-1']).toMatchObject({
      quantity: 3,
      total_cost: 50,
      remaining_amount: 30,
    });
    expect(byNo['S-2']).toMatchObject({
      total_cost: 20,
      remaining_amount: -10,
    });
    expect(byNo['S-3']).toMatchObject({ total_cost: 10, remaining_amount: 10 });
    expect(d.summary).toEqual({
      totalCost: 80,
      totalPaid: 50,
      totalOwed: 30,
      totalBatches: 3,
    });
    expect(d.meta).toEqual({ page: 1, limit: 50, totalPages: 1 });
  });

  it('[BE-VEND-207] {VendorService.findOneWithDetails} pages skip (page-1)*limit, totals span all pages, and the page total rounds up', async () => {
    const vendor = await createVendor(db, { consumer_id: cid() });
    const v = await w.stock({ price: 10, batches: [] });
    for (let i = 1; i <= 5; i++) {
      await batchFor(vendor.id, v.id, {
        quantity: 1,
        cost_price: i,
        paid_amount: 0,
        batch_number: `Q-${i}`,
        created_at: new Date(Date.UTC(2026, 0, i)),
      });
    }
    const p3: any = await vendors.findOneWithDetails(vendor.id, cid(), {
      page: 3,
      limit: 2,
    });
    expect(p3.batches.map((b: any) => b.batch_number)).toEqual(['Q-1']);
    expect(p3.meta).toEqual({ page: 3, limit: 2, totalPages: 3 });
    expect(p3.summary).toEqual({
      totalCost: 1,
      totalPaid: 0,
      totalOwed: 1,
      totalBatches: 5,
    });
    const p2: any = await vendors.findOneWithDetails(vendor.id, cid(), {
      page: 2,
      limit: 2,
    });
    expect(p2.batches.map((b: any) => b.batch_number)).toEqual(['Q-3', 'Q-2']);
    const edge: any = await vendors.findOneWithDetails(vendor.id, cid(), {
      limit: 200,
    });
    expect(edge.meta.limit).toBe(200);
    const one: any = await vendors.findOneWithDetails(vendor.id, cid(), {
      limit: 1,
    });
    expect(one.meta).toEqual({ page: 1, limit: 1, totalPages: 5 });
    const empty: any = await vendors.findOneWithDetails(vendor.id, cid(), {});
    expect(empty.meta.limit).toBe(50);
    expect(empty.batches).toHaveLength(5);
  });

  it('[BE-VEND-208] {VendorService.findOneWithDetails} payments are listed per batch, newest first inside a batch, with batch and product labels', async () => {
    const vendor = await createVendor(db, { consumer_id: cid() });
    const v = await w.stock({ price: 10, batches: [] });
    const b1 = await batchFor(vendor.id, v.id, { batch_number: 'PAY-1' });
    const b2 = await batchFor(vendor.id, v.id, {
      batch_number: 'PAY-2',
      created_at: new Date(Date.now() + 60_000),
    });
    const pay = (batchId: number, amount: number, at: string) =>
      db.purchasePayment.create({
        data: {
          batch_id: batchId,
          payment_method: 'CASH',
          amount,
          created_at: new Date(at),
        } as any,
      });
    await pay(b1.id, 1, '2026-02-01T00:00:00Z');
    await pay(b1.id, 2, '2026-02-02T00:00:00Z');
    await pay(b2.id, 3, '2026-02-03T00:00:00Z');
    const d: any = await vendors.findOneWithDetails(vendor.id, cid());
    // batches newest first (PAY-2 then PAY-1); payments newest first in each
    expect(d.allPayments.map((p: any) => Number(p.amount))).toEqual([3, 2, 1]);
    expect(d.allPayments.map((p: any) => p.batch_number)).toEqual([
      'PAY-2',
      'PAY-1',
      'PAY-1',
    ]);
    expect(d.allPayments.map((p: any) => p.batch_id)).toEqual([
      b2.id,
      b1.id,
      b1.id,
    ]);
    expect(d.allPayments[0].product_name).toBe(
      d.batches[0].variant.product.name,
    );
    expect(d.allPayments[0].variant_name).toBe(d.batches[0].variant.name);
    expect(
      d.batches[1].purchasePayments.map((p: any) => Number(p.amount)),
    ).toEqual([2, 1]);
    expect(Object.keys(d.batches[0].variant).sort()).toEqual(
      ['id', 'name', 'product'].sort(),
    );
    expect(Object.keys(d.batches[0].variant.product).sort()).toEqual(
      ['id', 'name'].sort(),
    );
    expect(Object.keys(d.batches[0].branch).sort()).toEqual(['id', 'name']);
  });

  it('[BE-VEND-209] {VendorService.findOneWithDetails} failures are logged with the id and tenant; NotFound and the count query failing are handled', async () => {
    const mine = await createVendor(db, { consumer_id: cid() });
    const spy = logSpy();
    boom('inventoryBatch', 'count');
    const err = await failure(vendors.findOneWithDetails(mine.id, cid()));
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getResponse()).toBe('Failed to get vendor details');
    expect(spy).toHaveBeenCalledWith(
      `Error getting vendor details for ID ${mine.id} for consumer ${cid()}`,
      expect.stringContaining('db down'),
    );
    spy.mockClear();
    const nf = await failure(vendors.findOneWithDetails(987654, cid()));
    expect(nf).toBeInstanceOf(NotFoundException);
    expect(spy).not.toHaveBeenCalled();
  });
});
