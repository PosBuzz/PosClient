import { validatePurchase } from './validate-purchase.util';

describe('purchase validation', () => {
  it.each([0, -1, NaN, Infinity])(
    '[BE-PURCH-001] rejects quantity %s before recording a purchase or payment',
    (quantity) => {
      expect(() =>
        validatePurchase(quantity, '10', [{ amount: 10 }]),
      ).toThrow();
    },
  );
  it.each(['-1', 'invalid', 'Infinity'])(
    '[BE-PURCH-002] rejects cost %s',
    (cost) => {
      expect(() => validatePurchase(1, cost)).toThrow();
    },
  );
  it('[BE-PURCH-003] rejects split payments exceeding the purchase cost', () => {
    expect(() =>
      validatePurchase(2, '10', [{ amount: 15 }, { amount: 6 }]),
    ).toThrow('Payments exceed');
  });
  it.each([0, -1, NaN, Infinity])(
    '[BE-PURCH-004] rejects invalid payment %s',
    (amount) => {
      expect(() => validatePurchase(1, '10', [{ amount }])).toThrow();
    },
  );
  it('[BE-PURCH-005] accepts valid partial, full and zero-cost purchases', () => {
    expect(() => validatePurchase(2, '10', [{ amount: 5 }])).not.toThrow();
    expect(() =>
      validatePurchase(3, '0.10', [{ amount: 0.1 }, { amount: 0.2 }]),
    ).not.toThrow();
    expect(() => validatePurchase(1, '0', [])).not.toThrow();
    expect(() => validatePurchase(1, 0)).not.toThrow();
    expect(() => validatePurchase(1, 10, [{ amount: 10 }])).not.toThrow();
  });
});
