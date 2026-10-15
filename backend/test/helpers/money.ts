import { Prisma } from '@prisma/client';
export const dec = (value: Prisma.Decimal | number | string): string =>
  new Prisma.Decimal(value).toFixed(2);
