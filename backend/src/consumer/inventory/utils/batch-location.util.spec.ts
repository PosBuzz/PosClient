import {
  availableQuantity,
  collectBatchLocations,
  isBatchExpired,
  notExpiredWhere,
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

describe('expired batches', () => {
  const now = new Date('2026-11-14T15:30:00Z');
  it('[BE-LOC-020] a batch is expired once its date is before today; today and no date are fine', () => {
    expect(isBatchExpired({ expiry_date: new Date('2026-11-13') }, now)).toBe(
      true,
    );
    expect(isBatchExpired({ expiry_date: new Date('2026-11-14') }, now)).toBe(
      false,
    );
    expect(isBatchExpired({ expiry_date: new Date('2026-12-01') }, now)).toBe(
      false,
    );
    expect(isBatchExpired({ expiry_date: null }, now)).toBe(false);
    expect(isBatchExpired({}, now)).toBe(false);
  });
  it('[BE-LOC-021] expired batches add nothing to the available quantity', () =>
    expect(
      availableQuantity([
        { quantity: 10, expiry_date: new Date('2000-01-01') },
        { quantity: 4, expiry_date: null },
        { quantity: 3, expiry_date: new Date('2999-01-01') },
      ]),
    ).toBe(7));
  it('[BE-LOC-022] the Prisma filter keeps undated and today-or-later batches', () => {
    const where = notExpiredWhere();
    expect(where.OR[0]).toEqual({ expiry_date: null });
    expect(where.OR[1].expiry_date).toEqual({ gte: expect.any(Date) });
  });
});
