import { Prisma } from '@prisma/client';
import { priceChanged } from './price.util';

describe('priceChanged', () => {
  it.each([
    ['BE-PRICE-001', '100.00', new Prisma.Decimal(100), false],
    ['BE-PRICE-002', '100', '100.00', false],
    ['BE-PRICE-003', '120.00', new Prisma.Decimal(100), true],
    ['BE-PRICE-004', '90.50', new Prisma.Decimal('90.5'), false],
    ['BE-PRICE-005', undefined, new Prisma.Decimal(100), false],
    ['BE-PRICE-006', '', new Prisma.Decimal(100), false],
    ['BE-PRICE-007', '50.00', null, true],
    ['BE-PRICE-008', null, null, false],
  ])('[%s] %s vs %s => %s', (_id, next, current, expected) => {
    expect(priceChanged(next as any, current as any)).toBe(expected);
  });
});
