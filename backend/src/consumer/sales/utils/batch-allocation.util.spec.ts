import { allocateFifo, sellableBatchesFifo } from './batch-allocation.util';

const batch = (
  id: number,
  quantity: number,
  day: number,
  extra: { reserved_quantity?: number; expiry_date?: Date | null } = {},
) => ({
  id,
  quantity,
  reserved_quantity: 0,
  created_at: new Date(2026, 0, day),
  ...extra,
});

describe('batch allocation', () => {
  it('[BE-ALLOC-001] sellable batches are oldest first, without expired or fully reserved ones', () => {
    const list = [
      batch(3, 5, 3),
      batch(1, 5, 1, { expiry_date: new Date('2000-01-01') }),
      batch(2, 5, 2, { reserved_quantity: 5 }),
      batch(4, 5, 1),
    ];
    expect(sellableBatchesFifo(list).map((b) => b.id)).toEqual([4, 3]);
  });
  it('[BE-ALLOC-002] the oldest batch alone is used when it covers the quantity', () => {
    const out = allocateFifo([batch(1, 5, 1), batch(2, 5, 2)], 5);
    expect(out?.map((a) => [a.batch.id, a.quantity])).toEqual([[1, 5]]);
  });
  it('[BE-ALLOC-003] a larger quantity empties the oldest batch and continues, counting only free units', () => {
    const out = allocateFifo(
      [
        batch(1, 2, 1),
        batch(2, 6, 2, { reserved_quantity: 3 }),
        batch(3, 9, 3),
      ],
      7,
    );
    expect(out?.map((a) => [a.batch.id, a.quantity])).toEqual([
      [1, 2],
      [2, 3],
      [3, 2],
    ]);
  });
  it('[BE-ALLOC-004] too little stock overall gives null', () =>
    expect(allocateFifo([batch(1, 2, 1), batch(2, 1, 2)], 4)).toBeNull());
});
