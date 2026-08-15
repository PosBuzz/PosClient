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
