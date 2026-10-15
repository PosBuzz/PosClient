import { Prisma, PrismaClient } from '@prisma/client';
import { createTenant, Tenant } from './tenant.factory';
import { seq } from './sequence';
export async function createUnit(
  db: PrismaClient,
  overrides: Partial<Prisma.UnitUncheckedCreateInput> = {},
) {
  const consumerId =
    overrides.consumer_id ?? (await createTenant(db)).consumer.id;
  return db.unit.create({
    data: { consumer_id: consumerId, name: `Unit ${seq()}`, ...overrides },
  });
}
export async function createCategory(
  db: PrismaClient,
  overrides: Partial<Prisma.CategoryUncheckedCreateInput> = {},
) {
  return db.category.create({
    data: {
      consumer_id:
        overrides.consumer_id ?? (await createTenant(db)).consumer.id,
      name: `Category ${seq()}`,
      ...overrides,
    },
  });
}
export async function createBrand(
  db: PrismaClient,
  overrides: Partial<Prisma.BrandUncheckedCreateInput> = {},
) {
  return db.brand.create({
    data: {
      consumer_id:
        overrides.consumer_id ?? (await createTenant(db)).consumer.id,
      name: `Brand ${seq()}`,
      ...overrides,
    },
  });
}
export async function createProduct(
  db: PrismaClient,
  overrides: Partial<Prisma.ProductUncheckedCreateInput> = {},
) {
  return db.product.create({
    data: {
      consumer_id:
        overrides.consumer_id ?? (await createTenant(db)).consumer.id,
      name: `Product ${seq()}`,
      code: `PROD${seq()}`,
      ...overrides,
    },
  });
}
export async function createVariant(
  db: PrismaClient,
  tenant?: Tenant,
  overrides: Partial<Prisma.ProductVariantUncheckedCreateInput> = {},
  productOverrides: Partial<Prisma.ProductUncheckedCreateInput> = {},
) {
  const consumerId = tenant?.consumer.id ?? productOverrides.consumer_id;
  const product = overrides.product_id
    ? await db.product.findUniqueOrThrow({
        where: { id: overrides.product_id },
      })
    : await createProduct(db, {
        ...productOverrides,
        ...(consumerId ? { consumer_id: consumerId } : {}),
      });
  const unit =
    !overrides.sale_unit_id || !overrides.purchase_unit_id
      ? await createUnit(db, { consumer_id: product.consumer_id })
      : undefined;
  const variant = await db.productVariant.create({
    data: {
      product_id: product.id,
      name: 'Default',
      regular_price: 100,
      sale_unit_id: overrides.sale_unit_id ?? unit!.id,
      purchase_unit_id: overrides.purchase_unit_id ?? unit!.id,
      sku: `SKU${seq()}`,
      barcode: `BAR${seq()}`,
      is_default: true,
      ...overrides,
    },
  });
  return { ...variant, product };
}
