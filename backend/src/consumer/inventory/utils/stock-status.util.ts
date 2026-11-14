import { availableQuantity } from './batch-location.util';

export type StockStatus = 'ok' | 'low' | 'out';

type StatusBatch = {
  branch_id: number;
  quantity: number;
  reserved_quantity?: number | null;
  expiry_date?: Date | null;
};

/**
 * Stock that can still be sold, per branch: batch stock minus reservations,
 * leaving out expired batches.
 */
export function availableByBranch(batches: StatusBatch[]): Map<number, number> {
  const byBranch = new Map<number, number>();
  for (const batch of batches) {
    byBranch.set(
      batch.branch_id,
      (byBranch.get(batch.branch_id) ?? 0) + availableQuantity([batch]),
    );
  }
  return byBranch;
}

/**
 * Stock alert for one variant over the batches given (already narrowed to one
 * branch when a branch is selected).
 *
 * - alert quantity 0 (or unset): the product is not tracked for restocking, so
 *   it never raises an alert.
 * - nothing sellable at all: 'out' (this is not "low").
 * - some branch holds between 1 and the alert quantity: 'low'.
 *
 * `lowBranchIds` lists those low branches; `available` is the total.
 */
export function stockStatus(
  batches: StatusBatch[],
  alertQuantity: number | null | undefined,
) {
  const byBranch = availableByBranch(batches);
  const available = [...byBranch.values()].reduce((a, b) => a + b, 0);
  const alert = alertQuantity ?? 0;
  if (alert <= 0) {
    return { status: 'ok' as StockStatus, available, lowBranchIds: [] };
  }
  if (available <= 0) {
    return { status: 'out' as StockStatus, available, lowBranchIds: [] };
  }
  const lowBranchIds = [...byBranch]
    .filter(([, qty]) => qty > 0 && qty <= alert)
    .map(([id]) => id);
  return {
    status: (lowBranchIds.length ? 'low' : 'ok') as StockStatus,
    available,
    lowBranchIds,
  };
}
