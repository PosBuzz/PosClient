import { validatePurchase } from './validate-purchase.util';

describe('purchase validation', () => {
  it.each([0, -1, NaN, Infinity])(
    'rejects quantity %s before recording a purchase or payment',
    (quantity) => {
      expect(() =>
        validatePurchase(quantity, '10', [{ amount: 10 }]),
      ).toThrow();
    },
  );
  it.each(['-1', 'invalid', 'Infinity'])('rejects cost %s', (cost) => {
    expect(() => validatePurchase(1, cost)).toThrow();
  });
  it('rejects split payments exceeding the purchase cost', () => {
    expect(() =>
      validatePurchase(2, '10', [{ amount: 15 }, { amount: 6 }]),
    ).toThrow('Payments exceed');
  });
  it.each([0, -1, NaN, Infinity])('rejects invalid payment %s', (amount) => {
    expect(() => validatePurchase(1, '10', [{ amount }])).toThrow();
  });
  it('accepts valid partial, full and zero-cost purchases', () => {
    expect(() => validatePurchase(2, '10', [{ amount: 5 }])).not.toThrow();
    expect(() =>
      validatePurchase(3, '0.10', [{ amount: 0.1 }, { amount: 0.2 }]),
    ).not.toThrow();
    expect(() => validatePurchase(1, '0', [])).not.toThrow();
  });
});
