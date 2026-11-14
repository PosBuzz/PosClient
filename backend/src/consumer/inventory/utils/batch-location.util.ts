/**
 * Distinct storage locations of a variant's batches, in the order the batches
 * were given (FIFO for sale lookups), with blanks dropped.
 *
 * Location lives on the batch, so one variant in one branch can legitimately
 * sit in more than one place; callers show all of them.
 */
export function collectBatchLocations(
  batches: { location?: string | null }[] | null | undefined,
): string[] {
  if (!batches?.length) return [];

  const seen = new Set<string>();
  for (const batch of batches) {
    const location = batch.location?.trim();
    if (location) seen.add(location);
  }

  return [...seen];
}

/**
 * Units of a variant that can still be sold in a branch: each batch's stock
 * minus what pending sales have reserved, never below zero per batch.
 */
export function availableQuantity(
  batches:
    | {
        quantity: number;
        reserved_quantity?: number | null;
        expiry_date?: Date | null;
      }[]
    | null
    | undefined,
): number {
  if (!batches?.length) return 0;

  return batches.reduce(
    (sum, batch) =>
      isBatchExpired(batch)
        ? sum
        : sum + Math.max(0, batch.quantity - (batch.reserved_quantity ?? 0)),
    0,
  );
}

/** Midnight (UTC) at the start of today; expiry dates are stored as dates. */
export function startOfToday(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/**
 * A batch is expired once its expiry date is before today, so stock that
 * expires today can still be sold that day. Batches without a date never expire.
 */
export function isBatchExpired(
  batch: { expiry_date?: Date | null },
  now: Date = new Date(),
): boolean {
  return !!batch.expiry_date && batch.expiry_date < startOfToday(now);
}

/** Prisma filter that keeps only batches that are not expired. */
export function notExpiredWhere() {
  return {
    OR: [{ expiry_date: null }, { expiry_date: { gte: startOfToday() } }],
  };
}
