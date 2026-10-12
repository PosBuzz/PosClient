import { Prisma, PrismaClient } from '@prisma/client';

type Client = PrismaClient | Prisma.TransactionClient;

/**
 * What a vendor invoice covers is the quantity bought, not what is left on the
 * shelf: stock that has since been sold, returned or adjusted is still owed.
 * Batches created by a transfer have no purchase row; they fall back to their
 * current quantity.
 */
export async function purchasedQuantities(
  client: Client,
  batches: { id: number; quantity: number }[],
): Promise<Map<number, number>> {
  const purchased = new Map<number, number>();
  if (!batches.length) return purchased;
  const rows = await client.inventoryAuditLog.groupBy({
    by: ['batch_id'],
    where: {
      batch_id: { in: batches.map((batch) => batch.id) },
      event_type: 'PURCHASE_IN',
    },
    _sum: { quantity_delta: true },
  });
  for (const row of rows) {
    if (row.batch_id !== null && row._sum.quantity_delta) {
      purchased.set(row.batch_id, row._sum.quantity_delta);
    }
  }
  for (const batch of batches) {
    if (!purchased.has(batch.id)) purchased.set(batch.id, batch.quantity);
  }
  return purchased;
}
