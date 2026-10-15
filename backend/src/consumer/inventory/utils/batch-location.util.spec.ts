import { collectBatchLocations } from './batch-location.util';
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
