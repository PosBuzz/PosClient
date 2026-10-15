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
    | { quantity: number; reserved_quantity?: number | null }[]
    | null
    | undefined,
): number {
  if (!batches?.length) return 0;

  return batches.reduce(
    (sum, batch) =>
      sum + Math.max(0, batch.quantity - (batch.reserved_quantity ?? 0)),
    0,
  );
}
