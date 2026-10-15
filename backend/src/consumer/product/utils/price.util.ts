import { Prisma } from '@prisma/client';

/**
 * True when `next` is a price that differs from the stored one. Prices arrive
 * as "100.00" strings while Decimal columns print "100", so comparing strings
 * would record a price-history row on every save.
 */
export function priceChanged(
  next: string | undefined | null,
  current: Prisma.Decimal | string | null | undefined,
): boolean {
  if (next === undefined || next === null || next === '') return false;
  if (current === undefined || current === null) return true;
  return !new Prisma.Decimal(next).equals(new Prisma.Decimal(current));
}
