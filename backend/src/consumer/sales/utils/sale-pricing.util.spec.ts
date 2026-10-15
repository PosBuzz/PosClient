import { BadRequestException } from '@nestjs/common';
import { assertSaleLineMatchesCatalog } from './sale-pricing.util';
const variant = {
  regular_price: '100.00',
  wholesale_price: '80.00',
  product: { tax: 10, tax_method: 'EXCLUSIVE' },
};
const line = {
  variant_id: 17,
  quantity: 2,
  unit_price: 100,
  tax_amount: 20,
  line_total: 205,
  average_discount_amount: 5,
  special_discount_amount: 4,
  promotion_discount_amount: 6,
};
describe('sale catalog price validation', () => {
  it('[BE-PRICE-101] accepts catalog prices, tax and three independently allocated discounts', () => {
    expect(() =>
      assertSaleLineMatchesCatalog(line, variant, false),
    ).not.toThrow();
    expect(() =>
      assertSaleLineMatchesCatalog(
        { ...line, unit_price: 80, tax_amount: 16, line_total: 161 },
        variant,
        true,
      ),
    ).not.toThrow();
  });
  it.each([
    [
      'price',
      { unit_price: 99 },
      'Price of variant 17 has changed (now 100.00). Refresh the product list and try again.',
    ],
    [
      'tax',
      { tax_amount: 19 },
      'Line total or tax for variant 17 does not match its catalog price and tax. Refresh the product list and try again.',
    ],
    [
      'total',
      { line_total: 204 },
      'Line total or tax for variant 17 does not match its catalog price and tax. Refresh the product list and try again.',
    ],
    [
      'omitted tax',
      { tax_amount: undefined },
      'Line total or tax for variant 17 does not match its catalog price and tax. Refresh the product list and try again.',
    ],
    [
      'excess discount',
      { line_total: -1, average_discount_amount: 211 },
      'Discounts on variant 17 exceed its line total',
    ],
  ])(
    '[BE-PRICE-102] rejects changed %s with a readable 400 error',
    (_name, changes, message) => {
      let caught: unknown;
      try {
        assertSaleLineMatchesCatalog({ ...line, ...changes }, variant, false);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(BadRequestException);
      expect((caught as BadRequestException).getStatus()).toBe(400);
      expect((caught as Error).message).toBe(message);
    },
  );
  it('[BE-PRICE-103] accepts rounded pennies within tolerance and rejects a price outside tolerance', () => {
    expect(() =>
      assertSaleLineMatchesCatalog(
        { ...line, tax_amount: 20.01, line_total: 205.01 },
        variant,
        false,
      ),
    ).not.toThrow();
    expect(() =>
      assertSaleLineMatchesCatalog(
        { ...line, unit_price: 100.004 },
        variant,
        false,
      ),
    ).not.toThrow();
    expect(() =>
      assertSaleLineMatchesCatalog(
        { ...line, unit_price: 100.006 },
        variant,
        false,
      ),
    ).toThrow('Price of variant 17 has changed');
  });
  it('[BE-PRICE-104] accepts absent optional discounts on an undiscounted line', () => {
    expect(() =>
      assertSaleLineMatchesCatalog(
        {
          variant_id: 17,
          quantity: 2,
          unit_price: 100,
          tax_amount: 20,
          line_total: 220,
        },
        variant,
        false,
      ),
    ).not.toThrow();
  });
});
