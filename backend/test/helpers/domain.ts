import { PrismaClient } from '@prisma/client';
import { createTestApp } from './app';
import { resetDb } from './db';
import { snapshotTenant, assertInvariants } from './invariants';
import {
  buildSaleDto,
  createStockedVariant,
  createTenant,
  Tenant,
} from '../factories';
import { SalesService } from '../../src/consumer/sales/services/sales.service';
import {
  CreateSaleDto,
  PaymentMethod,
} from '../../src/consumer/sales/dto/create-sale.dto';

export type Stocked = Awaited<ReturnType<typeof createStockedVariant>>;
export type Boot = Awaited<ReturnType<typeof bootDomain>>;
export type World = Awaited<ReturnType<typeof newWorld>>;

/** One Nest app per spec file; services come from the real DI container. */
export async function bootDomain() {
  const { app } = await createTestApp();
  return {
    app,
    get: <T>(token: new (...args: any[]) => T): T =>
      app.get(token, { strict: false }),
  };
}

export const gross = (dto: CreateSaleDto) =>
  dto.items.reduce((s, i) => s + Number(i.line_total), 0) +
  Number(dto.shipping_cost ?? 0);

/** A sale payload paid in full by cash unless `pay` says otherwise. */
export function saleDto(
  tenant: Tenant,
  lines: Parameters<typeof buildSaleDto>[1],
  extra: Partial<CreateSaleDto> = {},
  pay: number | null | 'full' = 'full',
): CreateSaleDto {
  const dto = buildSaleDto(tenant, lines, extra);
  const amount = pay === 'full' ? gross(dto) : pay;
  if (!extra.payments) {
    dto.payments = amount
      ? [{ payment_method: PaymentMethod.CASH, amount }]
      : [];
  }
  return dto;
}

/**
 * A clean database with the tenant under test plus a bystander tenant that owns stock and a
 * sale. `check()` must run in afterEach: it asserts INV-01..12 and that the bystander is untouched.
 */
export async function newWorld(db: PrismaClient, boot: Boot) {
  await resetDb();
  const sales = boot.get(SalesService);
  const tenant = await createTenant(db);
  const bystander = await createTenant(db);
  const theirs = await createStockedVariant(db, bystander, {
    price: 50,
    batches: [{ qty: 5, cost: 20 }],
  });
  await sales.create(
    saleDto(bystander, [{ variant: theirs, qty: 1 }]),
    bystander.consumer.id,
    bystander.adminUser.id,
  );
  let before = await snapshotTenant(db, bystander.consumer.id);
  return {
    tenant,
    bystander,
    theirs,
    stock: (opts: Parameters<typeof createStockedVariant>[2]) =>
      createStockedVariant(db, tenant, opts),
    sell: (
      lines: Parameters<typeof buildSaleDto>[1],
      extra: Partial<CreateSaleDto> = {},
      pay: number | null | 'full' = 'full',
    ) =>
      sales.create(
        saleDto(tenant, lines, extra, pay),
        tenant.consumer.id,
        tenant.adminUser.id,
      ) as Promise<any>,
    /** Call after a test deliberately adds data to the bystander (e.g. a foreign customer). */
    rebaseBystander: async () => {
      before = await snapshotTenant(db, bystander.consumer.id);
    },
    check: () =>
      assertInvariants(db, {
        consumerId: bystander.consumer.id,
        before,
      }),
  };
}

export const batchOf = (db: PrismaClient, id: number) =>
  db.inventoryBatch.findUniqueOrThrow({ where: { id } });
export const auditOf = (db: PrismaClient, batchId: number) =>
  db.inventoryAuditLog.findMany({
    where: { batch_id: batchId },
    orderBy: { id: 'asc' },
  });
