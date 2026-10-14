import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createVariant, createVendor } from '../factories';
import { InventoryBatchService } from '../../src/consumer/inventory/services/inventory-batch.service';
import { InventoryAdjustmentService } from '../../src/consumer/inventory/services/inventory-adjustment.service';
import { InventoryTransferService } from '../../src/consumer/inventory/services/inventory-transfer.service';
import { InventoryService } from '../../src/consumer/inventory/services/inventory.service';

describe('inventory reads (extra mutation hardening)', () => {
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

  const day = 24 * 3600 * 1000;
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
  // Batches get their PURCHASE_IN audit row through the service (INV-01)
  let n = 0;
  const mk = async (data: {
    variant_id: number;
    branch_id: number;
    quantity: number;
    location?: string;
    expiry_date?: Date | null;
    vendor_id?: number;
    created_at?: Date;
  }) => {
    const { location, expiry_date, created_at, ...rest } = data;
    const base = {
      ...rest,
      batch_number: `X-${++n}`,
      cost_price: '1',
    };
    if (data.quantity === 0) {
      return db.inventoryBatch.create({
        data: {
          ...rest,
          batch_number: base.batch_number,
          cost_price: 1,
          location,
          expiry_date,
          created_at,
        },
      });
    }
    const made: any = await batches.create(cid(), uid(), base);
    return db.inventoryBatch.update({
      where: { id: made.id },
      data: { location, expiry_date, created_at },
    });
  };

  it('[BE-INV-080] {InventoryService.getStockByVariant} each search column matches on its own, case-insensitively, and never crosses tenants', async () => {
    const a = await w.stock({ price: 100, batches: [{ qty: 4, cost: 10 }] });
    const b = await w.stock({ price: 100, batches: [{ qty: 4, cost: 10 }] });
    await db.productVariant.update({
      where: { id: a.id },
      data: { name: 'VarNameQQ', sku: 'SkuQQ1', barcode: 'BarQQ1' },
    });
    await db.product.update({
      where: { id: a.product_id },
      data: { name: 'ProdNameQQ', code: 'ProdCodeQQ' },
    });
    await db.inventoryBatch.update({
      where: { id: (await batchOf(a.id)).id },
      data: { location: 'LocQQ' },
    });
    // The other tenant's variant carries the same tokens everywhere
    await db.productVariant.update({
      where: { id: w.theirs.id },
      data: { name: 'VarNameQQ', sku: 'SkuQQ2', barcode: 'BarQQ2' },
    });
    for (const q of [
      'varnameqq',
      'PRODNAMEQQ',
      'prodcodeqq',
      'SKUQQ1',
      'barqq1',
      'locqq',
    ]) {
      const res: any = await inventory.getStockByVariant(cid(), { search: q });
      expect(res.data.map((r: any) => r.id)).toEqual([a.id]);
      expect(res.meta).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
    }
    // an empty search is no search at all
    const all: any = await inventory.getStockByVariant(cid(), { search: '' });
    expect(all.data.map((r: any) => r.id).sort()).toEqual([a.id, b.id].sort());
    expect(all.meta.total).toBe(2);
    // the other tenant sees only its own variant for the shared token
    const theirs: any = await inventory.getStockByVariant(
      w.bystander.consumer.id,
      { search: 'varnameqq' },
    );
    expect(theirs.data.map((r: any) => r.id)).toEqual([w.theirs.id]);
  });

  it('[BE-INV-081] {InventoryService.getStockByVariant} a variant without stock still lists, with empty maps and the branch-filtered low-stock rule', async () => {
    const v = await w.stock({ price: 100, batches: [] });
    await db.productVariant.update({
      where: { id: v.id },
      data: { alert_quantity: 3 },
    });
    const none: any = await inventory.getStockByVariant(cid());
    const row = none.data.find((r: any) => r.id === v.id);
    expect(row).toMatchObject({
      total_stock: 0,
      pending_delivery: 0,
      is_low_stock: false, // no branch holds it, so no branch is low
      locations: [],
      locations_by_branch: {},
      stock_by_branch: {},
    });
    expect(row.inventory_items).toEqual([]);
    // asking about one branch treats the empty stock as low
    const branch: any = await inventory.getStockByVariant(cid(), {
      branch_id: main(),
    });
    expect(branch.data.find((r: any) => r.id === v.id).is_low_stock).toBe(true);
    // without an alert level it is never low
    await db.productVariant.update({
      where: { id: v.id },
      data: { alert_quantity: 0 },
    });
    const off: any = await inventory.getStockByVariant(cid(), {
      branch_id: main(),
    });
    expect(off.data.find((r: any) => r.id === v.id).is_low_stock).toBe(false);
    // stock exactly one above the alert is fine, exactly at it is low
    await db.productVariant.update({
      where: { id: v.id },
      data: { alert_quantity: 3 },
    });
    await mk({ variant_id: v.id, branch_id: main(), quantity: 4 });
    const above: any = await inventory.getStockByVariant(cid(), {
      branch_id: main(),
    });
    expect(above.data.find((r: any) => r.id === v.id).is_low_stock).toBe(false);
    await adjustments.create(cid(), uid(), {
      variant_id: v.id,
      branch_id: main(),
      batch_id: (await batchOf(v.id)).id,
      quantity_change: -1,
      reason: 'count',
    });
    const at: any = await inventory.getStockByVariant(cid(), {
      branch_id: main(),
    });
    expect(at.data.find((r: any) => r.id === v.id).is_low_stock).toBe(true);
    // the branch filter hides stock held elsewhere
    const other: any = await inventory.getStockByVariant(cid(), {
      branch_id: second(),
    });
    expect(other.data.find((r: any) => r.id === v.id).inventory_items).toEqual(
      [],
    );
  });

  it('[BE-INV-082] {InventoryService.getInventorySummary} the 30-day expiry window, branch low-stock counting and empty tenants', async () => {
    const v = await w.stock({ price: 100, batches: [] });
    await mk({
      variant_id: v.id,
      branch_id: main(),
      quantity: 2,
      expiry_date: new Date(Date.now() + 29 * day),
    });
    await mk({
      variant_id: v.id,
      branch_id: main(),
      quantity: 2,
      expiry_date: new Date(Date.now() + 31 * day),
    });
    await mk({
      variant_id: v.id,
      branch_id: main(),
      quantity: 2,
      expiry_date: new Date(Date.now() - 2 * day),
    });
    await mk({ variant_id: v.id, branch_id: main(), quantity: 2 });
    const res: any = await inventory.getInventorySummary(cid());
    expect(res).toEqual({
      total_batches: 4,
      total_quantity: 8,
      physical_quantity: 8,
      reserved_quantity: 0,
      low_stock_variants: 0, // no alert level set
      expiring_soon: 1,
    });
    // an alert level counts the branch that holds the stock, not the empty one
    await db.productVariant.update({
      where: { id: v.id },
      data: { alert_quantity: 8 },
    });
    expect(
      (await inventory.getInventorySummary(cid())).low_stock_variants,
    ).toBe(1);
    expect(
      (await inventory.getInventorySummary(cid(), main())).low_stock_variants,
    ).toBe(1);
    // the second branch holds nothing, which the branch view counts as low
    const empty: any = await inventory.getInventorySummary(cid(), second());
    expect(empty).toEqual({
      total_batches: 0,
      total_quantity: 0,
      physical_quantity: 0,
      reserved_quantity: 0,
      low_stock_variants: 1,
      expiring_soon: 0,
    });
    // one above the alert is not low
    await db.productVariant.update({
      where: { id: v.id },
      data: { alert_quantity: 7 },
    });
    expect(
      (await inventory.getInventorySummary(cid())).low_stock_variants,
    ).toBe(0);
    // another tenant sees none of it
    const theirs: any = await inventory.getInventorySummary(
      w.bystander.consumer.id,
    );
    expect(theirs.total_batches).toBe(1);
    expect(theirs.low_stock_variants).toBe(0);
  });

  it('[BE-INV-083] {InventoryService.getExpiringBatches} window edges, reserved stock, no-expiry batches and the returned shapes', async () => {
    const v = await w.stock({ price: 100, batches: [] });
    const reserved = await mk({
      variant_id: v.id,
      branch_id: main(),
      quantity: 3,
      expiry_date: new Date(Date.now() + 2 * day),
    });
    await db.inventoryBatch.update({
      where: { id: reserved.id },
      data: { reserved_quantity: 3 }, // fully reserved but still on the shelf
    });
    const edge = await mk({
      variant_id: v.id,
      branch_id: second(),
      quantity: 1,
      expiry_date: new Date(Date.now() + 7 * day - 60 * 1000),
    });
    await mk({
      variant_id: v.id,
      branch_id: second(),
      quantity: 1,
      expiry_date: new Date(Date.now() + 7 * day + 60 * 60 * 1000),
    });
    await mk({ variant_id: v.id, branch_id: second(), quantity: 1 });
    const week: any = await inventory.getExpiringBatches(cid(), 7);
    expect(week.map((x: any) => x.id)).toEqual([reserved.id, edge.id]);
    expect(Object.keys(week[0].branch).sort()).toEqual(['id', 'name']);
    expect(Object.keys(week[0].variant.product).sort()).toEqual(['id', 'name']);
    expect(week[0].variant.id).toBe(v.id);
    expect(week[1].branch.id).toBe(second());
    // zero days means only what has not expired yet and expires immediately
    expect(await inventory.getExpiringBatches(cid(), 0)).toEqual([]);
    expect(
      (await inventory.getExpiringBatches(cid(), 1)).map((x: any) => x.id),
    ).toEqual([]);
    expect(
      (await inventory.getExpiringBatches(cid(), 3)).map((x: any) => x.id),
    ).toEqual([reserved.id]);
  });

  it('[BE-INV-084] {InventoryService.getProductsForInventory} {InventoryService.getProductVariants} sorted by name, shop-scoped and select-only', async () => {
    const first = await w.stock({ price: 100, batches: [] });
    await db.product.update({
      where: { id: first.product_id },
      data: { name: 'Zulu product' },
    });
    const alpha = await w.stock({ price: 100, batches: [] });
    await db.product.update({
      where: { id: alpha.product_id },
      data: { name: 'Alpha product' },
    });
    const prods: any[] = await inventory.getProductsForInventory(cid());
    expect(prods.map((p) => p.name)).toEqual(['Alpha product', 'Zulu product']);
    expect(Object.keys(prods[0]).sort()).toEqual(['id', 'name']);
    expect(
      (await inventory.getProductsForInventory(w.bystander.consumer.id)).map(
        (p: any) => p.id,
      ),
    ).not.toContain(first.product_id);

    // a second, alphabetically earlier variant of the same product
    const early = await createVariant(
      db,
      w.tenant,
      {
        product_id: first.product_id,
        name: 'Aardvark',
        regular_price: 55,
        wholesale_price: 44,
        sale_unit_id: first.sale_unit_id,
        purchase_unit_id: first.purchase_unit_id,
        is_default: false,
      },
      {},
    );
    const vs: any[] = await inventory.getProductVariants(
      first.product_id,
      cid(),
    );
    expect(vs.map((x) => x.name)).toEqual(['Aardvark', 'Default']);
    expect(vs[0].id).toBe(early.id);
    expect(Number(vs[0].regular_price)).toBe(55);
    expect(Number(vs[0].wholesale_price)).toBe(44);
    expect(Object.keys(vs[0]).sort()).toEqual(
      ['id', 'name', 'regular_price', 'wholesale_price'].sort(),
    );
    // another product's variants are not mixed in
    const others: any[] = await inventory.getProductVariants(
      alpha.product_id,
      cid(),
    );
    expect(others.map((x) => x.id)).toEqual([alpha.id]);
  });

  it('[BE-INV-085] {InventoryService.getVariantStock} batch relations, newest-first order and the low-stock edge', async () => {
    const vendor = await createVendor(db, { consumer_id: cid() });
    const v = await w.stock({ price: 100, batches: [] });
    const older = await mk({
      variant_id: v.id,
      branch_id: main(),
      quantity: 5,
      vendor_id: vendor.id,
      created_at: new Date(Date.now() - 3 * day),
    });
    const newer = await mk({
      variant_id: v.id,
      branch_id: second(),
      quantity: 2,
      created_at: new Date(Date.now() - 1 * day),
    });
    await db.productVariant.update({
      where: { id: v.id },
      data: { alert_quantity: null },
    });
    const res: any = await inventory.getVariantStock(v.id, cid());
    expect(res.batches.map((x: any) => x.id)).toEqual([newer.id, older.id]);
    expect(Object.keys(res.batches[1].vendor).sort()).toEqual(['id', 'name']);
    expect(res.batches[1].vendor.id).toBe(vendor.id);
    expect(res.batches[0].vendor).toBeNull();
    expect(Object.keys(res.batches[0].branch).sort()).toEqual([
      'id',
      'is_main',
      'name',
    ]);
    expect(Object.keys(res.variant).sort()).toEqual([
      'alert_quantity',
      'id',
      'name',
      'product',
      'sku',
    ]);
    expect(Object.keys(res.variant.product).sort()).toEqual(['id', 'name']);
    expect(res.variant.alert_quantity).toBeNull();
    expect(res.variant.sku).toBe(v.sku);
    expect(res.is_low_stock).toBe(false); // no alert level
    // the lowest branch decides: second holds 2
    await db.productVariant.update({
      where: { id: v.id },
      data: { alert_quantity: 2 },
    });
    expect(
      ((await inventory.getVariantStock(v.id, cid())) as any).is_low_stock,
    ).toBe(true);
    await db.productVariant.update({
      where: { id: v.id },
      data: { alert_quantity: 1 },
    });
    expect(
      ((await inventory.getVariantStock(v.id, cid())) as any).is_low_stock,
    ).toBe(false);
    // the branch view looks only at that branch: main holds 5
    await db.productVariant.update({
      where: { id: v.id },
      data: { alert_quantity: 5 },
    });
    const m: any = await inventory.getVariantStock(v.id, cid(), main());
    expect(m.is_low_stock).toBe(true);
    expect(m.batches.map((x: any) => x.id)).toEqual([older.id]);
    await db.productVariant.update({
      where: { id: v.id },
      data: { alert_quantity: 4 },
    });
    expect(
      ((await inventory.getVariantStock(v.id, cid(), main())) as any)
        .is_low_stock,
    ).toBe(false);
  });

  it('[BE-INV-086] {InventoryService.getLowStockItems} reserved stock lowers availability, empty branches and tenant scope', async () => {
    const v = await w.stock({ price: 100, batches: [] });
    const b = await mk({ variant_id: v.id, branch_id: main(), quantity: 6 });
    await db.inventoryBatch.update({
      where: { id: b.id },
      data: { reserved_quantity: 2 },
    });
    await db.productVariant.update({
      where: { id: v.id },
      data: { alert_quantity: 4 },
    });
    const n0 = w.tenant.branches[0].name;
    // available 4 equals the alert, so it is listed with no shortage
    const all: any[] = await inventory.getLowStockItems(cid());
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      id: v.id,
      total_stock: 4,
      shortage: 0,
      affected_branch_id: main(),
      affected_branch_name: n0,
      unique_key: `${v.id}-${main()}`,
    });
    expect(all[0].stock_by_branch).toEqual({ [n0]: 4 });
    expect(all[0].product).toEqual({
      id: v.product_id,
      name: expect.any(String),
    });
    // a variant that no branch holds is not listed without a branch filter...
    const none = await w.stock({ price: 100, batches: [] });
    await db.productVariant.update({
      where: { id: none.id },
      data: { alert_quantity: 1 },
    });
    expect(
      (await inventory.getLowStockItems(cid())).map((x: any) => x.id),
    ).toEqual([v.id]);
    // ...but a branch filter lists it, falling back to the Central label
    const branch: any[] = await inventory.getLowStockItems(cid(), second());
    const missing = branch.find((x) => x.id === none.id);
    expect(missing).toMatchObject({
      total_stock: 0,
      shortage: 1,
      affected_branch_id: second(),
      affected_branch_name: 'Central',
      stock_by_branch: {},
    });
    // an alert of zero never lists
    await db.productVariant.update({
      where: { id: none.id },
      data: { alert_quantity: 0 },
    });
    expect(
      (await inventory.getLowStockItems(cid(), second())).map((x: any) => x.id),
    ).toEqual([v.id]);
    // one above the available stock is not low
    await db.productVariant.update({
      where: { id: v.id },
      data: { alert_quantity: 3 },
    });
    expect(await inventory.getLowStockItems(cid(), main())).toEqual([]);
  });

  it('[BE-INV-087] {InventoryService.getInventoryMovementHistory} page and limit slice the history, other variants are left out and the totals follow adjustments', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 30, cost: 5 }] });
    const other = await w.stock({
      price: 100,
      batches: [{ qty: 30, cost: 5 }],
    });
    const b = await batchOf(v.id);
    const ob = await batchOf(other.id);
    const adjust = (
      variant: { id: number },
      batchId: number,
      change: number,
      branch = main(),
    ) =>
      adjustments.create(cid(), uid(), {
        variant_id: variant.id,
        branch_id: branch,
        batch_id: batchId,
        quantity_change: change,
        reason: `r${change}`,
      }) as Promise<any>;
    const a1 = await adjust(v, b.id, -1);
    const a2 = await adjust(v, b.id, -2);
    const a3 = await adjust(v, b.id, -3);
    await adjust(other, ob.id, -4);
    await transfers.create(cid(), uid(), {
      source_branch_id: main(),
      destination_branch_id: second(),
      items: [{ batch_id: ob.id, quantity: 2 }],
    });
    // pin the order explicitly: a1 oldest, a3 newest
    const t0 = Date.now();
    await db.inventoryAdjustment.update({
      where: { id: a1.id },
      data: { created_at: new Date(t0 - 3 * day) },
    });
    await db.inventoryAdjustment.update({
      where: { id: a2.id },
      data: { created_at: new Date(t0 - 2 * day) },
    });
    await db.inventoryAdjustment.update({
      where: { id: a3.id },
      data: { created_at: new Date(t0 - 1 * day) },
    });

    const full: any = await inventory.getInventoryMovementHistory(v.id, cid());
    expect(full.data.map((m: any) => m.id)).toEqual([a3.id, a2.id, a1.id]);
    expect(full.meta).toEqual({ total: 3, page: 1, limit: 20, totalPages: 1 });
    expect(full.data.every((m: any) => m.type === 'adjustment')).toBe(true);
    expect(Object.keys(full.data[0].user).sort()).toEqual(['id', 'name']);
    expect(full.data[0].date).toEqual(new Date(t0 - 1 * day));

    const p1: any = await inventory.getInventoryMovementHistory(v.id, cid(), {
      page: 1,
      limit: 2,
    });
    expect(p1.data.map((m: any) => m.id)).toEqual([a3.id, a2.id]);
    expect(p1.meta).toEqual({ total: 3, page: 1, limit: 2, totalPages: 2 });
    const p2: any = await inventory.getInventoryMovementHistory(v.id, cid(), {
      page: 2,
      limit: 2,
    });
    expect(p2.data.map((m: any) => m.id)).toEqual([a1.id]);
    expect(p2.meta).toEqual({ total: 3, page: 2, limit: 2, totalPages: 2 });

    // the other variant's history carries its own adjustment and the transfer pair
    const theirs: any = await inventory.getInventoryMovementHistory(
      other.id,
      cid(),
    );
    expect(theirs.data.map((m: any) => m.type).sort()).toEqual([
      'adjustment',
      'transfer_in',
      'transfer_out',
    ]);
    expect(theirs.meta.total).toBe(1);

    // the branch filter drops adjustments from other branches
    const wrong: any = await inventory.getInventoryMovementHistory(
      v.id,
      cid(),
      { branch_id: second() },
    );
    expect(wrong.data).toEqual([]);
    expect(wrong.meta).toEqual({
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
  });

  it('[BE-INV-088] {InventoryService.getStockByVariant} {InventoryService.getVariantStock} tenant isolation of another shop variant', async () => {
    const mine = await w.stock({ price: 100, batches: [{ qty: 3, cost: 5 }] });
    const res: any = await inventory.getStockByVariant(cid());
    expect(res.data.map((r: any) => r.id)).toEqual([mine.id]);
    const theirs: any = await inventory.getStockByVariant(
      w.bystander.consumer.id,
    );
    expect(theirs.data.map((r: any) => r.id)).toEqual([w.theirs.id]);
    const nf = await failure(inventory.getVariantStock(w.theirs.id, cid()));
    expect(nf.getStatus()).toBe(404);
    expect(nf.message).toBe('Product variant not found');
    const hist = await failure(
      inventory.getInventoryMovementHistory(w.theirs.id, cid()),
    );
    expect(hist.getStatus()).toBe(404);
    expect(hist.message).toBe('Product variant not found');
  });
});
