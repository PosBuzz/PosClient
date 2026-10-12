import { PrismaClient } from '@prisma/client';
import { Boot, saleDto } from '../../helpers/domain';
import {
  createBrand,
  createCategory,
  createCustomer,
  createPromotion,
  createRewardsSettings,
  createStockedVariant,
  createTenant,
  createUnit,
  createVendor,
} from '../../factories';
import { SalesService } from '../../../src/consumer/sales/services/sales.service';
import { ReturnService } from '../../../src/consumer/returns/services/return.service';
import { InventoryTransferService } from '../../../src/consumer/inventory/services/inventory-transfer.service';
import { InventoryAdjustmentService } from '../../../src/consumer/inventory/services/inventory-adjustment.service';
import { SupportService } from '../../../src/consumer/support/services/support.service';
import { RewardsService } from '../../../src/consumer/rewards/services/rewards.service';
import { ConsumerPermission } from '../../../src/auth/enums/consumerPermissions.enum';

/** The string every field of the victim tenant carries, so a leak is a plain text search. */
export const LEAK = 'ZZLEAKB';

/** One tenant with at least one of everything a route can point at. */
export async function seedTenant(db: PrismaClient, boot: Boot, marker: string) {
  const tenant = await createTenant(db, { branches: 2, maxBranches: 3 });
  const cid = tenant.consumer.id;
  const admin = tenant.adminUser.id;
  const [branch, branch2] = tenant.branches;
  await db.branch.update({
    where: { id: branch.id },
    data: { name: `Branch ${marker}` },
  });
  await db.branch.update({
    where: { id: branch2.id },
    data: { name: `Branch2 ${marker}` },
  });

  const customer = await createCustomer(db, {
    consumer_id: cid,
    name: `Customer ${marker}`,
    email: `${marker.toLowerCase()}@x.test`,
    address: `Road ${marker}`,
  });
  const vendor = await createVendor(db, {
    consumer_id: cid,
    name: `Vendor ${marker}`,
  });
  const brand = await createBrand(db, {
    consumer_id: cid,
    name: `Brand ${marker}`,
  });
  const category = await createCategory(db, {
    consumer_id: cid,
    name: `Category ${marker}`,
  });
  const unit = await createUnit(db, {
    consumer_id: cid,
    name: `Unit ${marker}`,
  });
  const tag = await db.tag.create({
    data: { consumer_id: cid, name: `Tag ${marker}` },
  });
  const variantRow = await createStockedVariant(db, tenant, {
    price: 100,
    taxPercent: 5,
    batches: [{ qty: 50, cost: 10 }],
  });
  await db.product.update({
    where: { id: variantRow.product.id },
    data: {
      name: `Product ${marker}`,
      description: `Description ${marker}`,
      brand_id: brand.id,
      category_id: category.id,
    },
  });
  await db.productVariant.update({
    where: { id: variantRow.id },
    data: {
      name: `Variant ${marker}`,
      sku: `SKU-${marker}`,
      barcode: `BAR-${marker}`,
    },
  });
  await db.tagOnProduct.create({
    data: { product_id: variantRow.product.id, tag_id: tag.id },
  });
  const batch = await db.inventoryBatch.findFirstOrThrow({
    where: { variant_id: variantRow.id },
  });
  await db.inventoryBatch.update({
    where: { id: batch.id },
    data: {
      vendor_id: vendor.id,
      batch_number: `BATCH-${marker}`,
      location: `Shelf ${marker}`,
    },
  });
  const promotion = await createPromotion(db, tenant, {
    variants: [variantRow.id],
    overrides: { name: `Promo ${marker}`, description: `Promo text ${marker}` },
  });
  await createRewardsSettings(db, {
    consumer_id: cid,
    redemption_value: 1,
    minimum_redemption: 1,
  });
  await boot.get(RewardsService).adjustPoints(
    cid,
    {
      customer_id: customer.id,
      points: 500,
      description: `Points ${marker}`,
    },
    admin,
  );

  const sales = boot.get(SalesService);
  const sale: any = await sales.create(
    saleDto(
      tenant,
      [{ variant: { ...variantRow, id: variantRow.id }, qty: 3 }],
      {
        customer_id: customer.id,
        customer_name: `Customer ${marker}`,
        notes: `Sale note ${marker}`,
        served_by_id: admin,
      },
    ),
    cid,
    admin,
  );
  const quotation: any = await sales.create(
    saleDto(
      tenant,
      [{ variant: variantRow, qty: 1 }],
      { sale_type: 'quotation' as any, notes: `Quote note ${marker}` },
      null,
    ),
    cid,
    admin,
  );
  const saleItem = await db.saleItem.findFirstOrThrow({
    where: { sale_id: sale.id },
  });
  const payment = await db.salePayment.findFirstOrThrow({
    where: { sale_id: sale.id },
  });
  const ret: any = await boot.get(ReturnService).create(cid, admin, {
    original_sale_id: sale.id,
    branch_id: branch.id,
    reason: `Return reason ${marker}`,
    items: [
      {
        sale_item_id: saleItem.id,
        variant_id: variantRow.id,
        batch_id: batch.id,
        quantity: 1,
      },
    ],
    payments: [{ payment_method: 'CASH', amount: 105 }],
  } as any);
  const transfer: any = await boot
    .get(InventoryTransferService)
    .create(cid, admin, {
      source_branch_id: branch.id,
      destination_branch_id: branch2.id,
      notes: `Transfer note ${marker}`,
      items: [{ batch_id: batch.id, quantity: 2 }],
    });
  const adjustment: any = await boot
    .get(InventoryAdjustmentService)
    .create(cid, admin, {
      variant_id: variantRow.id,
      branch_id: branch.id,
      batch_id: batch.id,
      quantity_change: 1,
      reason: `Adjustment ${marker}`,
      notes: `Adjustment note ${marker}`,
    });
  const cost = await db.operationalCost.create({
    data: {
      consumer_id: cid,
      created_by: admin,
      name: `Cost ${marker}`,
      amount: 5,
      incurred_on: new Date(),
      notes: `Cost note ${marker}`,
    },
  });
  const ticket: any = await boot.get(SupportService).create(cid, admin, {
    subject: `Ticket ${marker}`,
    category: 'OTHER',
    message: `Ticket body ${marker}`,
  } as any);
  const user = await tenant.user([ConsumerPermission.sales]);
  await db.user.update({
    where: { id: user.id },
    data: { name: `Staff ${marker}` },
  });
  const role = await db.role.create({
    data: { consumer_id: cid, name: `Role ${marker}` },
  });
  const receiptSetting = await db.receiptPdfSetting.create({
    data: {
      consumer_id: cid,
      name: `Receipt ${marker}`,
      type: 'receipt',
      settings: { note: marker },
    },
  });

  return {
    tenant,
    marker,
    ids: {
      branch: branch.id,
      branch2: branch2.id,
      customer: customer.id,
      vendor: vendor.id,
      brand: brand.id,
      category: category.id,
      unit: unit.id,
      tag: tag.id,
      product: variantRow.product.id,
      variant: variantRow.id,
      batch: batch.id,
      promotion: promotion.id,
      sale: sale.id,
      saleNumber: sale.sale_number as string,
      saleItem: saleItem.id,
      payment: payment.id,
      quotation: quotation.id,
      return: ret.id,
      transfer: transfer.id,
      adjustment: adjustment.id,
      cost: cost.id,
      ticket: ticket.id,
      user: user.id,
      role: role.id,
      receiptSetting: receiptSetting.id,
    },
    variantRow,
  };
}
export type SeededTenant = Awaited<ReturnType<typeof seedTenant>>;
