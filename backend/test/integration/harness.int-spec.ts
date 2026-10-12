import { ConsumerPermission } from '../../src/auth/enums/consumerPermissions.enum';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTestApp } from '../helpers/app';
import { getPrisma, resetDb, disconnect } from '../helpers/db';
import {
  createTenant,
  createStockedVariant,
  buildSaleDto,
  createCustomer,
  createRewardsSettings,
  createVendor,
  createPromotion,
  createCategory,
  createBrand,
} from '../factories';
import { STATIC_TEST_ENV, assertTestDatabaseUrl } from '../setup/test-env';
import { assertSaleLineMatchesCatalog } from '../../src/consumer/sales/utils/sale-pricing.util';
import { dec } from '../helpers/money';

describe('Backend harness: real migrated database', () => {
  const db = getPrisma();
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(disconnect);
  it('[BE-HARN-001] reset empties every application table', async () => {
    await createTenant(db);
    await resetDb();
    expect(await db.consumer.count()).toBe(0);
    expect(await db.user.count()).toBe(0);
    expect(await db.branch.count()).toBe(0);
    const rows = await db.$queryRaw<
      { tablename: string }[]
    >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    for (const { tablename } of rows) {
      const result = await db.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) FROM "public"."${tablename.replace(/"/g, '""')}"`,
      );
      expect(Number(result[0].count)).toBe(0);
    }
  });
  it('[BE-HARN-002] reset restarts identities', async () => {
    await createTenant(db);
    await resetDb();
    const tenant = await createTenant(db);
    expect(tenant.consumer.id).toBe(1);
  });
  it('[BE-HARN-004] explicit test env wins over local env files', async () => {
    const { app } = await createTestApp();
    try {
      expect(process.env.JWT_SECRET_KEY).toBe(STATIC_TEST_ENV.JWT_SECRET_KEY);
    } finally {
      await app.close();
    }
  });
  it('[BE-HARN-005] stocked factory has complete purchase audit history and catalog-valid sale DTOs', async () => {
    const tenant = await createTenant(db);
    const variant = await createStockedVariant(db, tenant, {
      price: 100,
      taxPercent: 5,
      batches: [
        { qty: 5, cost: 50 },
        { qty: 3, cost: 40 },
      ],
    });
    expect(
      (
        await db.inventoryBatch.aggregate({
          where: { variant_id: variant.id },
          _sum: { quantity: true },
        })
      )._sum.quantity,
    ).toBe(8);
    const audits = await db.inventoryAuditLog.findMany({
      where: { variant_id: variant.id },
      orderBy: { id: 'asc' },
    });
    expect(audits.map((row) => row.quantity_delta)).toEqual([5, 3]);
    expect(
      audits.every(
        (row) =>
          row.event_type === 'PURCHASE_IN' &&
          row.reference_type === 'inventory_batches',
      ),
    ).toBe(true);
    const dto = buildSaleDto(tenant, [{ variant, qty: 1 }]);
    expect(dec(dto.items[0].line_total)).toBe('105.00');
    expect(() =>
      assertSaleLineMatchesCatalog(dto.items[0], variant, false),
    ).not.toThrow();
  });
  it('[BE-HARN-017] related factories build valid tenant-owned records', async () => {
    const tenant = await createTenant(db);
    const category = await createCategory(db, {
      consumer_id: tenant.consumer.id,
    });
    const brand = await createBrand(db, { consumer_id: tenant.consumer.id });
    const vendor = await createVendor(db, { consumer_id: tenant.consumer.id });
    const customer = await createCustomer(db, {
      consumer_id: tenant.consumer.id,
    });
    const settings = await createRewardsSettings(db, {
      consumer_id: tenant.consumer.id,
    });
    const variant = await createStockedVariant(db, tenant, {
      price: 100,
      batches: [
        { qty: 2, cost: 40, createdAt: new Date('2026-03-15T10:00:00Z') },
      ],
    });
    const promotion = await createPromotion(db, tenant, {
      variants: [variant.id],
      branches: [tenant.branches[0].id],
    });
    const user = await tenant.user([ConsumerPermission.customers]);
    for (const record of [
      category,
      brand,
      vendor,
      customer,
      settings,
      promotion,
      user,
    ]) {
      expect(record.consumer_id).toBe(tenant.consumer.id);
    }
    expect(
      await db.promotionProduct.count({
        where: { promotion_id: promotion.id, variant_id: variant.id },
      }),
    ).toBe(1);
    const audit = await db.inventoryAuditLog.findFirstOrThrow({
      where: { variant_id: variant.id },
    });
    expect(audit.created_at.toISOString()).toBe('2026-03-15T10:00:00.000Z');
    const roles = await db.rolePermission.findMany({
      where: { role_id: user.role_id },
      include: { permission: true },
    });
    expect(roles.map((row) => row.permission.action)).toEqual([
      ConsumerPermission.customers,
    ]);
  });
  it('[BE-HARN-006] full migration chain was applied without db push', async () => {
    const expected = readdirSync(
      resolve(__dirname, '../../prisma/migrations'),
      { withFileTypes: true },
    ).filter((entry) => entry.isDirectory()).length;
    const rows = await db.$queryRaw<
      { count: bigint }[]
    >`SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    expect(Number(rows[0].count)).toBe(expected);
    expect(expected).toBeGreaterThanOrEqual(22);
  });
  it('[BE-HARN-016] database helper rejects non-test databases before truncation', () => {
    expect(() =>
      assertTestDatabaseUrl('postgresql://user:pass@localhost/posbuzz'),
    ).toThrow('disposable');
    expect(() =>
      assertTestDatabaseUrl('postgresql://user:pass@localhost/posbuzz_test'),
    ).not.toThrow();
  });
});
