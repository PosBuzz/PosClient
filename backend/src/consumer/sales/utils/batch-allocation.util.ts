import { isBatchExpired } from '../../inventory/utils/batch-location.util';

type AllocatableBatch = {
  quantity: number;
  reserved_quantity: number;
  created_at: Date;
  expiry_date?: Date | null;
};

/** Batches a sale can draw from, oldest first: not expired and with free units. */
export function sellableBatchesFifo<B extends AllocatableBatch>(
  batches: B[],
): B[] {
  return batches
    .filter((batch) => !isBatchExpired(batch))
    .filter((batch) => batch.quantity - batch.reserved_quantity > 0)
    .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
}

/**
 * Takes `quantity` units from the oldest batches first, emptying one before
 * moving to the next. Returns null when the batches together cannot cover it.
 */
export function allocateFifo<B extends AllocatableBatch>(
  batches: B[],
  quantity: number,
): { batch: B; quantity: number }[] | null {
  const allocations: { batch: B; quantity: number }[] = [];
  let remaining = quantity;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.quantity - batch.reserved_quantity);
    if (take > 0) {
      allocations.push({ batch, quantity: take });
      remaining -= take;
    }
  }
  return remaining > 0 ? null : allocations;
}
