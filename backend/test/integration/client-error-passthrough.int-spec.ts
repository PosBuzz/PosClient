import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { PrismaService } from '../../src/prisma/prisma.service';
import { InventoryService } from '../../src/consumer/inventory/services/inventory.service';
import { InventoryAdjustmentService } from '../../src/consumer/inventory/services/inventory-adjustment.service';
import { InventoryTransferService } from '../../src/consumer/inventory/services/inventory-transfer.service';
import { BrandService } from '../../src/consumer/brand/services/brand.service';
import { PaymentsService } from '../../src/consumer/payments/services/payments.service';

// A failure that already means something to the client (an HTTP exception or a readable
// Prisma error) must reach the caller untouched instead of becoming a generic 500.
describe('client errors pass through service catch blocks', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let prisma: any;

  beforeAll(async () => {
    boot = await bootDomain();
    prisma = boot.get(PrismaService);
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

  it('[BE-INV-090] inventory, adjustment, brand and payment reads rethrow a client error as the very same exception', async () => {
    const inventory = boot.get(InventoryService);
    const adjustments = boot.get(InventoryAdjustmentService);
    const brands = boot.get(BrandService);
    const transfers = boot.get(InventoryTransferService);
    const payments = boot.get(PaymentsService);
    const cases: [string, string, () => Promise<unknown>][] = [
      ['inventoryBatch', 'count', () => inventory.getInventorySummary(cid())],
      ['productVariant', 'findMany', () => inventory.getStockByVariant(cid())],
      ['inventoryBatch', 'findMany', () => inventory.getExpiringBatches(cid())],
      ['product', 'findMany', () => inventory.getProductsForInventory(cid())],
      ['product', 'findFirst', () => inventory.getProductVariants(1, cid())],
      [
        'productVariant',
        'findFirst',
        () => inventory.getVariantStock(1, cid()),
      ],
      ['productVariant', 'findMany', () => inventory.getLowStockItems(cid())],
      [
        'productVariant',
        'findFirst',
        () => inventory.getInventoryMovementHistory(1, cid()),
      ],
      ['inventoryAdjustment', 'findMany', () => adjustments.findAll(cid())],
      ['inventoryAdjustment', 'findFirst', () => adjustments.findOne(1, cid())],
      ['brand', 'findMany', () => brands.findAll(cid())],
      ['inventoryTransfer', 'findMany', () => transfers.findAll(cid())],
      ['sale', 'findMany', () => payments.getPartiallyPaidSales({}, cid())],
      ['sale', 'findFirst', () => payments.getSaleForPayment(1, cid())],
      ['sale', 'findFirst', () => payments.getSalePayments(1, cid())],
    ];
    for (const [model, fn, call] of cases) {
      const thrown = new BadRequestException(`readable ${model}.${fn}`);
      const spy = jest.spyOn(prisma[model], fn).mockRejectedValueOnce(thrown);
      const error = await failure(call());
      spy.mockRestore();
      expect(error).toBe(thrown);
    }
  });

  it('[BE-INV-091] {InventoryTransferService.completeTransfer} losing the claim to a concurrent change is refused and moves no stock', async () => {
    const transfers = boot.get(InventoryTransferService);
    const v = await w.stock({ price: 100, batches: [{ qty: 8, cost: 10 }] });
    const b = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: v.id },
    });
    const t: any = await transfers.create(cid(), uid(), {
      source_branch_id: w.tenant.branches[0].id,
      destination_branch_id: w.tenant.branches[1].id,
      items: [{ batch_id: b.id, quantity: 3 }],
    });
    // the claim finds the transfer already taken: nothing may move
    const spy = jest
      .spyOn(prisma, '$transaction')
      .mockImplementationOnce((async (callback: any) =>
        callback({
          inventoryTransfer: { updateMany: async () => ({ count: 0 }) },
        })) as any);
    const error = await failure(transfers.completeTransfer(t.id, cid()));
    spy.mockRestore();
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe('Transfer is not in pending status');
    expect(
      await db.inventoryTransfer.findUniqueOrThrow({ where: { id: t.id } }),
    ).toMatchObject({ status: 'pending', completed_date: null });
    expect(
      (await db.inventoryBatch.findUniqueOrThrow({ where: { id: b.id } }))
        .quantity,
    ).toBe(8);
  });

  it('[BE-BRND-207] {BrandService.create} {BrandService.findOne} {BrandService.update} {BrandService.remove} readable database and HTTP errors reach the caller unchanged', async () => {
    const brands = boot.get(BrandService);
    const b = await db.brand.create({
      data: { consumer_id: cid(), name: 'Passthrough' },
    });
    const known = (code: string) =>
      new Prisma.PrismaClientKnownRequestError('db says no', {
        code,
        clientVersion: 'test',
      });
    const cases: [string, string, unknown, () => Promise<unknown>][] = [
      [
        'create',
        'create',
        known('P2002'),
        () => brands.create({ name: 'Dup' } as any, cid()),
      ],
      [
        'findOne',
        'findFirst',
        new BadRequestException('readable find'),
        () => brands.findOne(b.id, cid()),
      ],
      [
        'update',
        'update',
        known('P2002'),
        () => brands.update(b.id, { name: 'Dup' }, cid()),
      ],
      ['remove', 'delete', known('P2003'), () => brands.remove(b.id, cid())],
    ];
    for (const [, fn, thrown, call] of cases) {
      const spy = jest.spyOn(prisma.brand, fn).mockRejectedValueOnce(thrown);
      const error = await failure(call());
      spy.mockRestore();
      expect(error).toBe(thrown);
    }
    // a lookup that misses is the 404, not a 500
    const missing = await failure(brands.remove(b.id + 999, cid()));
    expect(missing).toBeInstanceOf(NotFoundException);
    expect(missing.message).toBe(`Brand with ID ${b.id + 999} not found`);
    expect(await db.brand.count({ where: { id: b.id } })).toBe(1);
  });
});
