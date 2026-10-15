import { Prisma, PrismaClient } from '@prisma/client';
import { createTenant } from './tenant.factory';
import { seq } from './sequence';
export async function createCustomer(
  db: PrismaClient,
  overrides: Partial<Prisma.CustomerUncheckedCreateInput> = {},
) {
  return db.customer.create({
    data: {
      consumer_id:
        overrides.consumer_id ?? (await createTenant(db)).consumer.id,
      name: `Customer ${seq()}`,
      phone: `017${String(seq()).padStart(8, '0')}`,
      customer_type: 'regular',
      ...overrides,
    },
  });
}
export async function createRewardsSettings(
  db: PrismaClient,
  overrides: Partial<Prisma.RewardsSettingsUncheckedCreateInput> = {},
) {
  return db.rewardsSettings.create({
    data: {
      consumer_id:
        overrides.consumer_id ?? (await createTenant(db)).consumer.id,
      is_enabled: true,
      minimum_redemption: 1,
      ...overrides,
    },
  });
}
