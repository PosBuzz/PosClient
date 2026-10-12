import { Prisma, PrismaClient } from '@prisma/client';
import { Tenant } from './tenant.factory';
import { seq } from './sequence';
export async function createPromotion(
  db: PrismaClient,
  tenant: Tenant,
  opts: {
    variants?: number[];
    branches?: number[];
    overrides?: Partial<Prisma.PromotionUncheckedCreateInput>;
  } = {},
) {
  const promotion = await db.promotion.create({
    data: {
      consumer_id: tenant.consumer.id,
      name: `Promotion ${seq()}`,
      discount_type: 'percentage',
      discount_value: 10,
      start_date: new Date('2020-01-01T00:00:00Z'),
      end_date: new Date('2040-01-01T00:00:00Z'),
      created_by_user_id: tenant.adminUser.id,
      ...opts.overrides,
    },
  });
  if (opts.variants?.length) {
    await db.promotionProduct.createMany({
      data: opts.variants.map((variant_id) => ({
        promotion_id: promotion.id,
        variant_id,
      })),
    });
  }
  if (opts.branches?.length) {
    await db.promotionBranch.createMany({
      data: opts.branches.map((branch_id) => ({
        promotion_id: promotion.id,
        branch_id,
      })),
    });
  }
  return promotion;
}
