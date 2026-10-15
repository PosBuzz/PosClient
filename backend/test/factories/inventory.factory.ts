import { Prisma, PrismaClient, TaxMethod } from '@prisma/client';
import { createTenant, Tenant } from './tenant.factory';
import { createVariant } from './catalog.factory';
import { seq } from './sequence';
export async function createVendor(
  db: PrismaClient,
  overrides: Partial<Prisma.VendorUncheckedCreateInput> = {},
) {
  return db.vendor.create({
    data: {
      consumer_id:
        overrides.consumer_id ?? (await createTenant(db)).consumer.id,
      name: `Vendor ${seq()}`,
      ...overrides,
    },
  });
}
export async function createBatch(
  db: PrismaClient,
  tenant: Tenant,
  overrides: Partial<Prisma.InventoryBatchUncheckedCreateInput> = {},
) {
  const variantId =
    overrides.variant_id ?? (await createVariant(db, tenant)).id;
  return db.$transaction(async (tx) => {
    const batch = await tx.inventoryBatch.create({
      data: {
        variant_id: variantId,
        branch_id: tenant.branches[0].id,
        batch_number: `BATCH${seq()}`,
        quantity: 10,
        cost_price: 50,
        paid_amount:
          (overrides.quantity ?? 10) * Number(overrides.cost_price ?? 50),
        ...overrides,
      },
    });
    if (batch.quantity > 0) {
      await tx.inventoryAuditLog.create({
        data: {
          consumer_id: tenant.consumer.id,
          branch_id: batch.branch_id,
          variant_id: batch.variant_id,
          batch_id: batch.id,
          inventoryBatchId: batch.id,
          event_type: 'PURCHASE_IN',
          quantity_delta: batch.quantity,
          quantity_after: batch.quantity,
          reference_id: batch.id,
          reference_type: 'inventory_batches',
          notes: `Purchase batch ${batch.batch_number} - Qty: ${batch.quantity}`,
          created_by_user_id: tenant.adminUser.id,
          created_at: batch.created_at,
        },
      });
    }
    return batch;
  });
}
export async function createStockedVariant(
  db: PrismaClient,
  tenant: Tenant,
  opts: {
    price: number;
    taxPercent?: number;
    taxMethod?: TaxMethod;
    batches: { qty: number; cost: number; createdAt?: Date }[];
  },
) {
  const variant = await createVariant(
    db,
    tenant,
    { regular_price: opts.price },
    {
      tax: opts.taxPercent ?? 0,
      tax_method: opts.taxMethod ?? TaxMethod.EXCLUSIVE,
    },
  );
  const batches = [];
  for (const batch of opts.batches) {
    batches.push(
      await createBatch(db, tenant, {
        variant_id: variant.id,
        quantity: batch.qty,
        cost_price: batch.cost,
        paid_amount: batch.qty * batch.cost,
        created_at: batch.createdAt,
      }),
    );
  }
  return { ...variant, batches };
}
