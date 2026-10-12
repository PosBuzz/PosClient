import fc from 'fast-check';
import { PromotionDiscountType as Type } from './dto/create-promotion.dto';
import {
  calculateDiscount as discount,
  calculateEffectiveQuantity as quantity,
  calculateBaseWithQuantityLimit as base,
} from './promotion-math';

const items = [
  { quantity: 2, subtotal: 100 },
  { quantity: 3, subtotal: 60 },
];
const options = { seed: 12345, numRuns: 1000 };
const money = fc.integer({ min: 0, max: 100000000 }).map((n) => n / 100);
const cart = fc
  .array(
    fc.record({
      quantity: fc.integer({ min: 1, max: 100 }),
      price: fc.integer({ min: 0, max: 100000 }),
    }),
    { maxLength: 20 },
  )
  .map((rows) =>
    rows.map((row) => ({
      quantity: row.quantity,
      subtotal: row.quantity * row.price,
    })),
  );

describe('promotion math', () => {
  it('[BE-PROMO-001] percentage applies to the base', () =>
    expect(discount(Type.PERCENTAGE, 10, 200, 2)).toBe(20));
  it('[BE-PROMO-002] fixed amount applies per eligible unit', () =>
    expect(discount(Type.FIXED_AMOUNT, 15, 1000, 3)).toBe(45));
  it('[BE-PROMO-003] fixed amount cannot exceed the base', () =>
    expect(discount(Type.FIXED_AMOUNT, 50, 100, 3)).toBe(100));
  it('[BE-PROMO-004] positive cap limits the discount', () =>
    expect(discount(Type.PERCENTAGE, 50, 400, 2, 100)).toBe(100));
  it.each([0, null, undefined])('[BE-PROMO-005] cap %s is ignored', (cap) =>
    expect(discount(Type.PERCENTAGE, 50, 400, 2, cap)).toBe(200),
  );
  it.each([
    [0, 2],
    [-1, 2],
    [100, 0],
    [100, -1],
  ])(
    '[BE-PROMO-006] nonpositive base/quantity %s/%s discounts nothing',
    (b, q) => expect(discount(Type.PERCENTAGE, 10, b, q)).toBe(0),
  );
  it.each([null, undefined, 0, -1])(
    '[BE-PROMO-007] quantity limit %s is ignored',
    (limit) => expect(quantity(items, limit)).toBe(5),
  );
  it('[BE-PROMO-008] caps eligible quantity', () => {
    expect(quantity([{ quantity: 7, subtotal: 100 }], 5)).toBe(5);
    expect(quantity(items, 8)).toBe(5);
  });
  it('[BE-PROMO-009] full base when quantity fits; absent/nonpositive limits are ignored', () => {
    for (const limit of [5, 6, null, undefined, 0, -1]) {
      expect(base(items, limit)).toBe(160);
    }
    expect(base([], 1)).toBe(0);
  });
  it('[BE-PROMO-010] takes the most expensive units first without mutating input', () => {
    const reversed = [...items].reverse();
    expect(base(reversed, 3)).toBe(120);
    expect(reversed).toEqual([...items].reverse());
  });
  it('[BE-PROMO-011] zero quantities do not divide by zero', () => {
    expect(
      base(
        [{ quantity: 0, subtotal: 0 }, ...items, { quantity: 0, subtotal: 0 }],
        3,
      ),
    ).toBe(120);
    expect(
      base(
        [
          { quantity: 0, subtotal: 0 },
          { quantity: 2, subtotal: 0 },
          { quantity: 0, subtotal: 0 },
        ],
        1,
      ),
    ).toBe(0);
  });
  it('[BE-PROMO-P01] valid discounts stay within the base', () =>
    fc.assert(
      fc.property(
        fc.constantFrom(Type.PERCENTAGE, Type.FIXED_AMOUNT),
        money,
        money,
        fc.integer({ min: 0, max: 1000 }),
        fc.option(money, { nil: null }),
        (t, value, b, q, cap) => {
          const d = discount(t, value, b, q, cap);
          return d >= 0 && d <= b;
        },
      ),
      options,
    ));
  it('[BE-PROMO-P02] positive caps are respected', () =>
    fc.assert(
      fc.property(
        fc.constantFrom(Type.PERCENTAGE, Type.FIXED_AMOUNT),
        money,
        money,
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 1, max: 1000000 }).map((n) => n / 100),
        (t, value, b, q, cap) => discount(t, value, b, q, cap) <= cap,
      ),
      options,
    ));
  it('[BE-PROMO-P03] capped base is bounded and monotonic in quantity limit', () =>
    fc.assert(
      fc.property(
        cart,
        fc.integer({ min: 1, max: 2000 }),
        fc.integer({ min: 1, max: 2000 }),
        (rows, a, b) => {
          const low = base(rows, Math.min(a, b));
          const high = base(rows, Math.max(a, b));
          return (
            low >= 0 &&
            low <= high &&
            high <= rows.reduce((sum, row) => sum + row.subtotal, 0)
          );
        },
      ),
      options,
    ));
  it('[BE-PROMO-P04] percentage discount is monotonic in value', () =>
    fc.assert(
      fc.property(
        money,
        money,
        money,
        fc.integer({ min: 0, max: 1000 }),
        (a, b, total, q) =>
          discount(Type.PERCENTAGE, Math.min(a, b), total, q) <=
          discount(Type.PERCENTAGE, Math.max(a, b), total, q),
      ),
      options,
    ));
});
