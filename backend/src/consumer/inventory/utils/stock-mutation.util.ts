import { Prisma } from '@prisma/client';

type BatchStock = { quantity: number; reserved_quantity: number };
type Db = Prisma.TransactionClient;

// Each helper is a single conditional UPDATE, so the availability check and the
// stock change happen atomically. A read-then-update (even inside a transaction
// at READ COMMITTED) lets two concurrent requests both see the last unit and
// both take it. A null result means the batch did not have enough stock.

/** Removes `qty` from on-hand stock, never dipping into reserved units. */
export async function takeAvailableStock(
  db: Db,
  batchId: number,
  qty: number,
): Promise<BatchStock | null> {
  const rows = await db.$queryRaw<BatchStock[]>`
    UPDATE "inventory_batches"
    SET "quantity" = "quantity" - ${qty}, "updated_at" = NOW()
    WHERE "id" = ${batchId} AND "quantity" - "reserved_quantity" >= ${qty}
    RETURNING "quantity", "reserved_quantity"`;
  return rows[0] ?? null;
}

/** Sets aside `qty` unreserved units for a later delivery. */
export async function reserveAvailableStock(
  db: Db,
  batchId: number,
  qty: number,
): Promise<BatchStock | null> {
  const rows = await db.$queryRaw<BatchStock[]>`
    UPDATE "inventory_batches"
    SET "reserved_quantity" = "reserved_quantity" + ${qty}, "updated_at" = NOW()
    WHERE "id" = ${batchId} AND "quantity" - "reserved_quantity" >= ${qty}
    RETURNING "quantity", "reserved_quantity"`;
  return rows[0] ?? null;
}

/** Ships `qty` previously reserved units: drops both on-hand and reserved. */
export async function takeReservedStock(
  db: Db,
  batchId: number,
  qty: number,
): Promise<BatchStock | null> {
  const rows = await db.$queryRaw<BatchStock[]>`
    UPDATE "inventory_batches"
    SET "quantity" = "quantity" - ${qty},
        "reserved_quantity" = "reserved_quantity" - ${qty},
        "updated_at" = NOW()
    WHERE "id" = ${batchId}
      AND "reserved_quantity" >= ${qty}
      AND "quantity" >= ${qty}
    RETURNING "quantity", "reserved_quantity"`;
  return rows[0] ?? null;
}
