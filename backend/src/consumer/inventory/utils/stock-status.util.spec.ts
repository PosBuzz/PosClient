import { stockStatus } from './stock-status.util';

const past = new Date('2000-01-01');
const batch = (
  branch_id: number,
  quantity: number,
  extra: { reserved_quantity?: number; expiry_date?: Date | null } = {},
) => ({ branch_id, quantity, ...extra });

describe('stock status', () => {
  it('[BE-STK-001] an alert of 0 or unset never raises anything, even with no stock', () => {
    for (const alert of [0, null, undefined]) {
      expect(stockStatus([], alert).status).toBe('ok');
      expect(stockStatus([batch(1, 0)], alert).status).toBe('ok');
    }
  });
  it('[BE-STK-002] no sellable units is out of stock, never low', () => {
    expect(stockStatus([], 5)).toMatchObject({
      status: 'out',
      lowBranchIds: [],
    });
    expect(stockStatus([batch(1, 0)], 5).status).toBe('out');
  });
  it('[BE-STK-003] 1 up to the alert quantity is low; one above is fine', () => {
    expect(stockStatus([batch(1, 1)], 5).status).toBe('low');
    expect(stockStatus([batch(1, 5)], 5).status).toBe('low');
    expect(stockStatus([batch(1, 6)], 5).status).toBe('ok');
  });
  it('[BE-STK-004] reserved and expired units do not count as sellable', () => {
    expect(stockStatus([batch(1, 9, { reserved_quantity: 9 })], 5).status).toBe(
      'out',
    );
    expect(stockStatus([batch(1, 9, { expiry_date: past })], 5).status).toBe(
      'out',
    );
    expect(
      stockStatus([batch(1, 9, { expiry_date: past }), batch(1, 2)], 5).status,
    ).toBe('low');
  });
  it('[BE-STK-005] any one low branch makes the variant low; an emptied branch beside stocked ones is not low', () => {
    expect(stockStatus([batch(1, 50), batch(2, 3)], 5)).toMatchObject({
      status: 'low',
      lowBranchIds: [2],
    });
    expect(stockStatus([batch(1, 50), batch(2, 0)], 5)).toMatchObject({
      status: 'ok',
      lowBranchIds: [],
    });
  });
});
