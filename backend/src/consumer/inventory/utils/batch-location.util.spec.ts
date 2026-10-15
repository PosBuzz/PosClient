import {
  availableQuantity,
  collectBatchLocations,
} from './batch-location.util';
describe('batch locations', () => {
  it.each([null, undefined, []])(
    '[BE-LOC-001] absent/empty batches %s have no locations',
    (batches) => expect(collectBatchLocations(batches)).toEqual([]),
  );
  it('[BE-LOC-002] ignores missing, null and blank locations', () =>
    expect(
      collectBatchLocations([
        {},
        { location: null },
        { location: '' },
        { location: '  ' },
      ]),
    ).toEqual([]));
  it('[BE-LOC-003] trims and deduplicates while preserving FIFO order', () => {
    const batches = [{ location: ' B ' }, { location: 'A' }, { location: 'B' }];
    expect(collectBatchLocations(batches)).toEqual(['B', 'A']);
    expect(batches[0].location).toBe(' B ');
  });
});

describe('available quantity', () => {
  it.each([null, undefined, []])(
    '[BE-LOC-010] no batches (%s) means none',
    (b) => expect(availableQuantity(b)).toBe(0),
  );
  it('[BE-LOC-011] adds stock across batches minus reserved, never below zero per batch', () =>
    expect(
      availableQuantity([
        { quantity: 10, reserved_quantity: 3 },
        { quantity: 4 },
        { quantity: 2, reserved_quantity: 5 },
      ]),
    ).toBe(11));
});
