import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createVendor } from '../factories';
import { VendorService } from '../../src/consumer/vendor/services/vendor.service';
import { InventoryBatchService } from '../../src/consumer/inventory/services/inventory-batch.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('vendor service detail', () => {
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
    return w.check();
  });

  const cid = () => w.tenant.consumer.id;
  const uid = () => w.tenant.adminUser.id;
  const failure = async (p: Promise<unknown>) =>
    p.then(
      () => null,
      (e: any) => e,
    );
  const boom = (model: string, method: string) =>
    jest
      .spyOn((prisma as any)[model], method)
      .mockRejectedValueOnce(new Error('db down'));

  const buy = async (
    vendorId: number,
    variantId: number,
    batch_number: string,
    quantity: number,
    cost: string,
    extra: object = {},
  ) =>
    boot.get(InventoryBatchService).create(cid(), uid(), {
      variant_id: variantId,
      branch_id: w.tenant.branches[0].id,
      batch_number,
      quantity,
      cost_price: cost,
      vendor_id: vendorId,
      ...extra,
    });

  it('[BE-VEND-101] {VendorService.create} stores every field under the caller tenant; duplicates are rethrown, other failures are a 500', async () => {
    const v: any = await vendors.create(
      {
        name: 'Supply Co',
        contact: 'Rina',
        phone: '017',
        email: 'a@b.test',
        address: 'Dhaka',
      },
      cid(),
    );
    expect(
      await db.vendor.findUniqueOrThrow({ where: { id: v.id } }),
    ).toMatchObject({
      consumer_id: cid(),
      name: 'Supply Co',
      contact: 'Rina',
      phone: '017',
      email: 'a@b.test',
      address: 'Dhaka',
    });
    const dup = await failure(vendors.create({ name: 'Supply Co' }, cid()));
    expect(dup.code).toBe('P2002');
    boom('vendor', 'create');
    const err = await failure(vendors.create({ name: 'N' }, cid()));
    expect(err).toBeInstanceOf(HttpException);
    expect(err.message).toBe('Failed to create vendor');
    expect(err.getStatus()).toBe(500);
  });

  it('[BE-VEND-102] {VendorService.findAll} lists only tenant vendors sorted by name', async () => {
    await createVendor(db, { consumer_id: cid(), name: 'Zed' });
    await createVendor(db, { consumer_id: cid(), name: 'Alpha' });
    const foreign = await createVendor(db, { name: 'Aaa Foreign' });
    const list = await vendors.findAll(cid());
    expect(list.map((v) => v.name)).toEqual(['Alpha', 'Zed']);
    expect(list.map((v) => v.id)).not.toContain(foreign.id);
  });

  it('[BE-VEND-103] {VendorService.findOne} returns the vendor; missing/foreign ids are NotFound with the id; failures are a 500', async () => {
    const mine = await createVendor(db, { consumer_id: cid() });
    const foreign = await createVendor(db);
    expect((await vendors.findOne(mine.id, cid())).id).toBe(mine.id);
    const cross = await failure(vendors.findOne(foreign.id, cid()));
    expect(cross).toBeInstanceOf(NotFoundException);
    expect(cross.message).toBe(`Vendor with ID ${foreign.id} not found`);
    boom('vendor', 'findFirst');
    const err = await failure(vendors.findOne(mine.id, cid()));
    expect(err).not.toBeInstanceOf(NotFoundException);
    expect(err.message).toBe('Failed to find vendor');
    expect(err.getStatus()).toBe(500);
  });

  it('[BE-VEND-104] {VendorService.update} writes each field, keeps unspecified ones, and rejects foreign vendors', async () => {
    const mine = await createVendor(db, {
      consumer_id: cid(),
      name: 'Old',
      contact: 'c',
      phone: 'p',
      email: 'e',
      address: 'a',
    });
    const foreign = await createVendor(db, { name: 'Foreign' });
    const updated: any = await vendors.update(
      mine.id,
      {
        name: 'New',
        contact: 'c2',
        phone: 'p2',
        email: 'e2',
        address: 'a2',
      },
      cid(),
    );
    expect(updated).toMatchObject({
      id: mine.id,
      name: 'New',
      contact: 'c2',
      phone: 'p2',
      email: 'e2',
      address: 'a2',
    });
    await vendors.update(mine.id, { name: 'Newer' }, cid());
    expect(
      await db.vendor.findUniqueOrThrow({ where: { id: mine.id } }),
    ).toMatchObject({ name: 'Newer', contact: 'c2', address: 'a2' });
    const err = await failure(
      vendors.update(foreign.id, { name: 'Hijack' }, cid()),
    );
    expect(err).toBeInstanceOf(NotFoundException);
    expect(
      (await db.vendor.findUniqueOrThrow({ where: { id: foreign.id } })).name,
    ).toBe('Foreign');
  });

  it('[BE-VEND-105] {VendorService.update} duplicates are rethrown; an unexpected failure is a generic 500', async () => {
    await createVendor(db, { consumer_id: cid(), name: 'Taken' });
    const mine = await createVendor(db, { consumer_id: cid(), name: 'Free' });
    const dup = await failure(
      vendors.update(mine.id, { name: 'Taken' }, cid()),
    );
    expect(dup.code).toBe('P2002');
    boom('vendor', 'update');
    const err = await failure(vendors.update(mine.id, { name: 'Z' }, cid()));
    expect(err.message).toBe('Failed to update vendor');
    expect(err.getStatus()).toBe(500);
  });

  it('[BE-VEND-106] {VendorService.remove} deletes only the tenant vendor; foreign is NotFound; batch message counts batches; failures are a 500', async () => {
    const mine = await createVendor(db, { consumer_id: cid() });
    const other = await createVendor(db, { consumer_id: cid() });
    const foreign = await createVendor(db);
    expect(await vendors.remove(mine.id, cid())).toEqual({ success: true });
    expect(await db.vendor.count({ where: { id: mine.id } })).toBe(0);
    expect(await db.vendor.count({ where: { id: other.id } })).toBe(1);
    const cross = await failure(vendors.remove(foreign.id, cid()));
    expect(cross).toBeInstanceOf(NotFoundException);
    expect(await db.vendor.count({ where: { id: foreign.id } })).toBe(1);

    const busy = await createVendor(db, { consumer_id: cid() });
    const v = await w.stock({ price: 10, batches: [] });
    await buy(busy.id, v.id, 'B-1', 5, '1');
    await buy(busy.id, v.id, 'B-2', 5, '1');
    const blocked = await failure(vendors.remove(busy.id, cid()));
    expect(blocked).toBeInstanceOf(BadRequestException);
    expect(blocked.message).toBe(
      'Cannot delete vendor with 2 associated batches',
    );
    expect(await db.vendor.count({ where: { id: busy.id } })).toBe(1);

    boom('vendor', 'delete');
    const err = await failure(vendors.remove(other.id, cid()));
    expect(err.message).toBe('Failed to delete vendor');
    expect(err.getStatus()).toBe(500);
    expect(await db.vendor.count({ where: { id: other.id } })).toBe(1);
  });

  it('[BE-VEND-107] {VendorService.findOneWithDetails} empty vendor: zero summary, empty lists, default paging meta', async () => {
    const vendor = await createVendor(db, { consumer_id: cid() });
    const d: any = await vendors.findOneWithDetails(vendor.id, cid());
    expect(d.vendor.id).toBe(vendor.id);
    expect(d.batches).toEqual([]);
    expect(d.allPayments).toEqual([]);
    expect(d.summary).toEqual({
      totalCost: 0,
      totalPaid: 0,
      totalOwed: 0,
      totalBatches: 0,
    });
    expect(d.meta).toEqual({ page: 1, limit: 50, totalPages: 0 });
  });

  it('[BE-VEND-108] {VendorService.findOneWithDetails} batches, payments and totals are computed per batch; other vendors batches are excluded', async () => {
    const vendor = await createVendor(db, { consumer_id: cid() });
    const otherVendor = await createVendor(db, { consumer_id: cid() });
    const v = await w.stock({ price: 100, batches: [] });
    await buy(vendor.id, v.id, 'D-1', 10, '5', {
      payments: [{ payment_method: 'CASH', amount: 20 }],
    });
    await buy(vendor.id, v.id, 'D-2', 4, '10');
    await buy(otherVendor.id, v.id, 'D-3', 99, '99');
    // a batch bought without payments may be recorded as settled; pin it unpaid
    await db.inventoryBatch.updateMany({
      where: { batch_number: 'D-2' },
      data: { paid_amount: 0 },
    });
    const d: any = await vendors.findOneWithDetails(vendor.id, cid());
    expect(d.batches).toHaveLength(2);
    expect(d.summary).toEqual({
      totalCost: 90,
      totalPaid: 20,
      totalOwed: 70,
      totalBatches: 2,
    });
    // newest first
    expect(d.batches.map((b: any) => b.batch_number)).toEqual(['D-2', 'D-1']);
    const first = d.batches[1];
    expect(first).toMatchObject({ total_cost: 50, remaining_amount: 30 });
    expect(d.batches[0]).toMatchObject({
      total_cost: 40,
      remaining_amount: 40,
    });
    expect(first.variant.id).toBe(v.id);
    expect(first.variant.product.id).toBeDefined();
    expect(first.branch.id).toBe(w.tenant.branches[0].id);
    expect(d.allPayments).toHaveLength(1);
    expect(d.allPayments[0]).toMatchObject({
      batch_id: first.id,
      batch_number: 'D-1',
      product_name: first.variant.product.name,
      variant_name: first.variant.name,
    });
    expect(Number(d.allPayments[0].amount)).toBe(20);
  });

  it('[BE-VEND-109] {VendorService.findOneWithDetails} paging: text page/limit are coerced, bad values fall back, limit is clamped to 1..200, totals cover all pages', async () => {
    const vendor = await createVendor(db, { consumer_id: cid() });
    const v = await w.stock({ price: 100, batches: [] });
    for (let i = 1; i <= 3; i++) await buy(vendor.id, v.id, `P-${i}`, 1, '10');
    const p1: any = await vendors.findOneWithDetails(vendor.id, cid(), {
      page: '1' as any,
      limit: '2' as any,
    });
    expect(p1.batches.map((b: any) => b.batch_number)).toEqual(['P-3', 'P-2']);
    expect(p1.meta).toEqual({ page: 1, limit: 2, totalPages: 2 });
    expect(p1.summary.totalBatches).toBe(3);
    const p2: any = await vendors.findOneWithDetails(vendor.id, cid(), {
      page: 2,
      limit: 2,
    });
    expect(p2.batches.map((b: any) => b.batch_number)).toEqual(['P-1']);
    expect(p2.meta.page).toBe(2);
    const bad: any = await vendors.findOneWithDetails(vendor.id, cid(), {
      page: -4,
      limit: 0,
    });
    expect(bad.meta).toMatchObject({ page: 1, limit: 50 });
    const neg: any = await vendors.findOneWithDetails(vendor.id, cid(), {
      limit: -5,
    });
    expect(neg.meta.limit).toBe(1);
    expect(neg.batches).toHaveLength(1);
    const big: any = await vendors.findOneWithDetails(vendor.id, cid(), {
      limit: 5000,
    });
    expect(big.meta.limit).toBe(200);
    const nan: any = await vendors.findOneWithDetails(vendor.id, cid(), {
      page: 'abc' as any,
      limit: 'x' as any,
    });
    expect(nan.meta).toMatchObject({ page: 1, limit: 50 });
  });

  it('[BE-VEND-110] {VendorService.findOneWithDetails} NotFound keeps its message; unexpected failure is a generic 500', async () => {
    const mine = await createVendor(db, { consumer_id: cid() });
    const foreign = await createVendor(db);
    const cross = await failure(vendors.findOneWithDetails(foreign.id, cid()));
    expect(cross).toBeInstanceOf(NotFoundException);
    expect(cross.message).toBe(`Vendor with ID ${foreign.id} not found`);
    boom('inventoryBatch', 'findMany');
    const err = await failure(vendors.findOneWithDetails(mine.id, cid()));
    expect(err.message).toBe('Failed to get vendor details');
    expect(err.getStatus()).toBe(500);
  });
});
