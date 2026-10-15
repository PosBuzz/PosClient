import { NotFoundException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createBatch } from '../factories';
import { SalesService } from '../../src/consumer/sales/services/sales.service';
import { InventoryService } from '../../src/consumer/inventory/services/inventory.service';
import { InventoryAdjustmentService } from '../../src/consumer/inventory/services/inventory-adjustment.service';

/** Inventory and sales lookups and summaries: values for the owning tenant, nothing for another. */
describe('inventory and sales lookups', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let sales: SalesService;
  let inventory: InventoryService;
  let adjustments: InventoryAdjustmentService;

  beforeAll(async () => {
    boot = await bootDomain();
    sales = boot.get(SalesService);
    inventory = boot.get(InventoryService);
    adjustments = boot.get(InventoryAdjustmentService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());

  const cid = () => w.tenant.consumer.id;
  const other = () => w.bystander.consumer.id;
  const branch = () => w.tenant.branches[0].id;
  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );
  // Business days follow the process time zone (UTC, Dhaka, New York in the matrix); en-CA prints YYYY-MM-DD.
  const today = () => new Intl.DateTimeFormat('en-CA').format(new Date());

  it('[BE-INV-070] {InventoryService.getStockByVariant} stock by variant shows the remaining quantity to its tenant only', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    await w.sell([{ variant: v, qty: 2 }]);
    const mine: any = await inventory.getStockByVariant(cid(), {});
    const row = mine.data.find((r: any) => r.id === v.id);
    expect(row.inventory_items[0].quantity).toBe(8);
    const theirs: any = await inventory.getStockByVariant(other(), {});
    expect(theirs.data.map((r: any) => r.id)).not.toContain(v.id);
    expect(theirs.data.map((r: any) => r.id)).toContain(w.theirs.id);
  });

  it('[BE-INV-071] {InventoryService.getExpiringBatches} only batches expiring inside the window are listed, for the owning tenant', async () => {
    const soon = await w.stock({ price: 10, batches: [{ qty: 5, cost: 4 }] });
    const later = await w.stock({ price: 10, batches: [{ qty: 5, cost: 4 }] });
    const day = 24 * 60 * 60 * 1000;
    await db.inventoryBatch.updateMany({
      where: { variant_id: soon.id },
      data: { expiry_date: new Date(Date.now() + 10 * day) },
    });
    await db.inventoryBatch.updateMany({
      where: { variant_id: later.id },
      data: { expiry_date: new Date(Date.now() + 90 * day) },
    });
    await createBatch(db, w.bystander, {
      variant_id: w.theirs.id,
      expiry_date: new Date(Date.now() + 5 * day),
    });
    await w.rebaseBystander();
    const found: any[] = (await inventory.getExpiringBatches(cid(), 30)) as any;
    expect(found.map((b) => b.variant_id)).toEqual([soon.id]);
    const wide: any[] = (await inventory.getExpiringBatches(cid(), 120)) as any;
    expect(wide.map((b) => b.variant_id).sort()).toEqual(
      [soon.id, later.id].sort(),
    );
  });

  it('[BE-INV-072] {InventoryService.getProductsForInventory} {InventoryService.getProductVariants} product pickers are scoped to the tenant', async () => {
    const v = await w.stock({ price: 25, batches: [{ qty: 1, cost: 1 }] });
    const productId = (
      await db.productVariant.findUniqueOrThrow({ where: { id: v.id } })
    ).product_id;
    const products: any[] = (await inventory.getProductsForInventory(
      cid(),
    )) as any;
    expect(products.map((p) => p.id)).toEqual([productId]);
    const variants: any[] = (await inventory.getProductVariants(
      productId,
      cid(),
    )) as any;
    expect(variants.map((x) => [x.id, Number(x.regular_price)])).toEqual([
      [v.id, 25],
    ]);
    expect(
      await failure(inventory.getProductVariants(productId, other())),
    ).toBeInstanceOf(NotFoundException);
  });

  it('[BE-INV-073] {InventoryService.getInventoryMovementHistory} an adjustment appears in the variant movement history', async () => {
    const v = await w.stock({ price: 10, batches: [{ qty: 6, cost: 4 }] });
    const batch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: v.id },
    });
    await adjustments.create(cid(), w.tenant.adminUser.id, {
      variant_id: v.id,
      branch_id: branch(),
      batch_id: batch.id,
      quantity_change: -2,
      reason: 'count',
    });
    const history: any = await inventory.getInventoryMovementHistory(
      v.id,
      cid(),
      {},
    );
    expect(history.meta.total).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(history.data)).toContain('-2');
    const foreign: any = await inventory
      .getInventoryMovementHistory(v.id, other(), {})
      .catch((e: any) => e);
    expect(
      foreign instanceof NotFoundException || foreign.data?.length === 0,
    ).toBe(true);
  });

  it('[BE-SALE-071] {SalesService.getProductsForSale} {SalesService.getProductByBarcode} the POS catalog lists in-stock variants with their price and finds one by barcode', async () => {
    const v = await w.stock({
      price: 100,
      taxPercent: 5,
      batches: [{ qty: 4, cost: 40 }],
    });
    const barcode = (
      await db.productVariant.findUniqueOrThrow({ where: { id: v.id } })
    ).barcode as string;
    const list: any[] = (await sales.getProductsForSale(
      cid(),
      branch(),
    )) as any;
    const row = list.find((r) => r.id === v.id);
    expect(Number(row.regular_price)).toBe(100);
    expect(row.tax_percentage).toBe(5);
    expect(list.map((r) => r.id)).not.toContain(w.theirs.id);
    const hit: any = await sales.getProductByBarcode(cid(), branch(), barcode);
    expect(hit.id).toBe(v.id);
    const miss = await sales
      .getProductByBarcode(cid(), branch(), 'NO-SUCH-CODE')
      .catch((e: any) => e);
    expect(miss === null || miss instanceof NotFoundException).toBe(true);
    const foreign = await sales
      .getProductByBarcode(other(), w.bystander.branches[0].id, barcode)
      .catch((e: any) => e);
    expect(foreign === null || foreign instanceof NotFoundException).toBe(true);
  });

  it('[BE-SALE-072] {SalesService.getSalesStats} today figures count the sale and its top product, and another tenant sees none of it', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    await w.sell([{ variant: v, qty: 2 }]);
    const stats: any = await sales.getSalesStats(cid());
    expect(stats.today_sales).toBe(1);
    expect(stats.today_amount).toBe(200);
    expect(stats.today_refund).toBe(0);
    expect(stats.today_net_amount).toBe(200);
    expect(stats.top_products[0]).toMatchObject({
      variant_id: v.id,
      total_quantity: 2,
    });
    const theirs: any = await sales.getSalesStats(other());
    expect(theirs.top_products.map((p: any) => p.variant_id)).not.toContain(
      v.id,
    );
  });

  it('[BE-SALE-073] {SalesService.findAllQuotations} {SalesService.findOneQuotation} quotations are listed apart from sales and read back by their own tenant only', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    const sale = await w.sell([{ variant: v, qty: 1 }]);
    const quote = await w.sell(
      [{ variant: v, qty: 1 }],
      { sale_type: 'quotation' as any },
      null,
    );
    const list: any = await sales.findAllQuotations({}, cid());
    expect(list.data.map((r: any) => r.id)).toEqual([quote.id]);
    const one: any = await sales.findOneQuotation(quote.id, cid());
    expect(one.sale_type).toBe('quotation');
    expect(
      await failure(sales.findOneQuotation(sale.id, cid())),
    ).toBeInstanceOf(NotFoundException);
    expect(
      await failure(sales.findOneQuotation(quote.id, other())),
    ).toBeInstanceOf(NotFoundException);
    expect(
      ((await sales.findAllQuotations({} as any, other())) as any).data,
    ).toEqual([]);
  });

  it('[BE-SALE-074] {SalesService.getPendingDeliveries} {SalesService.findAllOnlineOrders} {SalesService.getOnlineOrderStats} delivery-later and online orders are listed and counted for their tenant', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    const later = await w.sell(
      [{ variant: v, qty: 1 }],
      { is_delivery_later: true },
      null,
    );
    const online = await w.sell(
      [{ variant: v, qty: 1 }],
      { is_online_order: true },
      null,
    );
    const pending: any = await sales.getPendingDeliveries(cid(), {});
    expect(pending.data.map((r: any) => r.id)).toEqual([later.id]);
    const orders: any = await sales.findAllOnlineOrders({}, cid());
    expect(orders.data.map((r: any) => r.id)).toEqual([online.id]);
    const stats: any = await sales.getOnlineOrderStats(cid());
    expect(stats.by_status.pending).toEqual({ count: 1, total: 100 });
    expect(stats.today.count).toBe(1);
    expect(
      ((await sales.getPendingDeliveries(other(), {})) as any).data,
    ).toEqual([]);
    expect(
      ((await sales.findAllOnlineOrders({}, other())) as any).data,
    ).toEqual([]);
  });

  it('[BE-RPT-120] {SalesService.getDailyTargetReport} {SalesService.getVariantSalesDetail} {SalesService.getUserSalesDetail} the target report and the per-variant and per-user details agree with the sale', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    await w.sell([{ variant: v, qty: 3 }], {
      served_by_id: w.tenant.adminUser.id,
    });
    const target: any = await sales.getDailyTargetReport(cid(), {});
    expect(target.date).toBe(today());
    expect(target.summary.total_target).toBe(0);
    const detail: any = await sales.getVariantSalesDetail(
      cid(),
      v.id,
      today(),
      today(),
    );
    expect(detail.summary).toMatchObject({
      total_qty: 3,
      total_sales: 1,
      total_amount: 300,
      net_amount: 300,
    });
    const byUser: any = await sales.getUserSalesDetail(
      cid(),
      w.tenant.adminUser.id,
      today(),
      today(),
    );
    expect(byUser.user.id).toBe(w.tenant.adminUser.id);
    expect(byUser.meta.total_amount).toBe(300);
    const foreign: any = await sales
      .getVariantSalesDetail(other(), v.id, today(), today())
      .catch((e: any) => e);
    expect(
      foreign instanceof NotFoundException || foreign.summary?.total_qty === 0,
    ).toBe(true);
  });
});
