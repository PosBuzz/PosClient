import { UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describePrismaError } from '../../prisma-client-exception/prisma-error-messages';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { snapshotTenant, findViolations } from '../helpers/invariants';
import {
  TEST_PASSWORD,
  createCustomer,
  createPromotion,
  createRewardsSettings,
  createTenant,
  createVendor,
} from '../factories';
import { PlanService } from '../../src/admin/plan/services/plan.service';
import { ConsumerService } from '../../src/admin/consumer/services/consumer.service';
import { ConsumerPurgeService } from '../../src/admin/consumer/services/consumer-purge.service';
import { ConsumerDataImportService } from '../../src/admin/consumer/services/consumer-data-import.service';
import { BillingHistoryService } from '../../src/admin/billing-invoices/billing-history.service';
import { JwtClientStrategy } from '../../src/auth/client.jwt.strategy';
import { AuthService } from '../../src/auth/services/auth.service';
import { ReturnService } from '../../src/consumer/returns/services/return.service';
import { InventoryTransferService } from '../../src/consumer/inventory/services/inventory-transfer.service';
import { SupportService } from '../../src/consumer/support/services/support.service';

describe('super-admin flows', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;

  beforeAll(async () => {
    boot = await bootDomain();
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot, { branches: 2 });
  });
  afterEach(() => w.check());

  const cid = () => w.tenant.consumer.id;
  const failure = async (promise: Promise<unknown> | (() => unknown)) =>
    Promise.resolve()
      .then(() => (typeof promise === 'function' ? promise() : promise))
      .then(
        () => null,
        (e: any) => e,
      );
  /** HTTP status of an error: HttpExceptions carry one, Prisma errors get theirs from the filter. */
  const statusOf = (error: any): number => {
    if (typeof error?.getStatus === 'function') return error.getStatus();
    const mapped = describePrismaError(error?.code, error?.meta);
    if (!mapped) throw error;
    return mapped.status;
  };
  const actionsOf = async (roleId: number) =>
    (
      await db.rolePermission.findMany({
        where: { role_id: roleId },
        include: { permission: true },
      })
    )
      .map((rp) => rp.permission.action)
      .sort();

  describe('plans and roles', () => {
    it('[BE-ADM-001] {PlanService.update} removing a permission from a plan removes it from every tenant role and from the session; adding gives it to Admin only', async () => {
      const plans = boot.get(PlanService);
      const strategy = boot.get(JwtClientStrategy);
      const planPermissions = await db.planPermission.findMany({
        where: { plan_id: w.tenant.plan.id },
      });
      const keep = planPermissions
        .map((p) => p.permission_id)
        .filter((id) => id !== planPermissions[0].permission_id);
      const removed = await db.permission.findUniqueOrThrow({
        where: { id: planPermissions[0].permission_id },
      });
      const session = (await strategy.validate({
        sub: w.tenant.adminUser.id,
        email: w.tenant.adminUser.email,
        consumer_id: cid(),
      })) as any;
      expect(session.permissions).toContain(removed.action);

      await plans.update(w.tenant.plan.id, { permission_ids: keep });

      expect(await actionsOf(w.tenant.adminRole.id)).not.toContain(
        removed.action,
      );
      const after = (await strategy.validate({
        sub: w.tenant.adminUser.id,
        email: w.tenant.adminUser.email,
        consumer_id: cid(),
      })) as any;
      expect(after.permissions).not.toContain(removed.action);

      const staff = await db.role.create({
        data: { consumer_id: cid(), name: 'Staff', is_admin: false },
      });
      await plans.update(w.tenant.plan.id, {
        permission_ids: [...keep, removed.id],
      });
      expect(await actionsOf(w.tenant.adminRole.id)).toContain(removed.action);
      expect(await actionsOf(staff.id)).toEqual([]);
    });

    it('[BE-ADM-001] {PlanService.update} a plan can be saved with no permissions at all', async () => {
      const plans = boot.get(PlanService);
      await plans.update(w.tenant.plan.id, { permission_ids: [] });
      expect(
        await db.planPermission.count({ where: { plan_id: w.tenant.plan.id } }),
      ).toBe(0);
      expect(
        await db.rolePermission.count({
          where: { role_id: w.tenant.adminRole.id },
        }),
      ).toBe(0);
    });

    it('[BE-ADM-001] a plan with subscribers cannot be deleted', async () => {
      const error = await failure(
        boot.get(PlanService).remove(w.tenant.plan.id),
      );
      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect(error.code).toBe('P2003');
    });
  });

  describe('consumers', () => {
    it('[BE-ADM-002] {ConsumerService.create} {ConsumerService.checkSubdomain} creating a consumer sets up its admin, default roles, main branch and receipt settings from the plan', async () => {
      const consumers = boot.get(ConsumerService);
      const created: any = await consumers.create({
        company_name: 'New Shop',
        name: 'Owner',
        subdomain: 'newshop',
        plan_id: w.tenant.plan.id,
        email: 'owner@newshop.test',
        password: TEST_PASSWORD,
      } as any);
      const id = created.consumer.id;
      const planActions = (
        await db.planPermission.findMany({
          where: { plan_id: w.tenant.plan.id },
          include: { permission: true },
        })
      )
        .map((p) => p.permission.action)
        .sort();
      const roles = await db.role.findMany({ where: { consumer_id: id } });
      const admin = roles.find((r) => r.is_admin)!;
      expect(await actionsOf(admin.id)).toEqual(planActions);
      const cash = roles.find((r) => r.name === 'Cash In Charge')!;
      expect(await actionsOf(cash.id)).toEqual([
        'customers',
        'quotations',
        'sales',
        'view_product',
      ]);
      const user = await db.user.findFirstOrThrow({
        where: { consumer_id: id },
        include: { branches: true },
      });
      expect(user.password).not.toBe(TEST_PASSWORD);
      expect(user.branches).toHaveLength(1);
      const branch = await db.branch.findFirstOrThrow({
        where: { consumer_id: id },
      });
      expect(branch).toMatchObject({ is_main: true, name: 'Main Branch' });
      expect(
        await db.receiptPdfSetting.count({ where: { consumer_id: id } }),
      ).toBeGreaterThan(0);
      expect(await consumers.checkSubdomain('newshop')).toEqual({
        available: false,
      });
      expect(await consumers.checkSubdomain('freeshop')).toEqual({
        available: true,
      });
    });

    it("[BE-ADM-003] {AuthService.validateUser} {ConsumerService.softDelete} {ConsumerService.checkSubdomain} {ConsumerService.restore} a soft-deleted consumer's users can no longer log in or use an existing session; the subdomain stays reserved; restore reverses it", async () => {
      const consumers = boot.get(ConsumerService);
      const strategy = boot.get(JwtClientStrategy);
      const auth = boot.get(AuthService);
      const payload = {
        sub: w.tenant.adminUser.id,
        email: w.tenant.adminUser.email,
        consumer_id: cid(),
      };
      expect(
        await auth.validateUser(
          w.tenant.adminUser.email,
          TEST_PASSWORD,
          w.tenant.consumer.subdomain,
        ),
      ).toBeTruthy();
      await consumers.softDelete(cid(), undefined, 'test');
      expect(
        await failure(
          auth.validateUser(
            w.tenant.adminUser.email,
            TEST_PASSWORD,
            w.tenant.consumer.subdomain,
          ),
        ),
      ).toBeInstanceOf(UnauthorizedException);
      const session = await failure(strategy.validate(payload));
      expect(session).toBeInstanceOf(UnauthorizedException);
      expect(
        await consumers.checkSubdomain(w.tenant.consumer.subdomain),
      ).toEqual({ available: false });
      expect(statusOf(await failure(consumers.softDelete(cid())))).toBe(404);
      await consumers.restore(cid());
      expect(await strategy.validate(payload)).toBeTruthy();
    });

    it('[BE-ADM-003] a deleted user with a valid token is a 401, not a crash', async () => {
      const strategy = boot.get(JwtClientStrategy);
      const error = await failure(
        strategy.validate({ sub: 999999, email: 'x@y.z', consumer_id: cid() }),
      );
      expect(error).toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('billing history', () => {
    const bill = (extra: object = {}) =>
      ({
        consumer_id: cid(),
        plan_id: w.tenant.plan.id,
        amount: 100,
        billing_date: '2026-03-01T00:00:00.000Z',
        billing_from: '2026-03-01T00:00:00.000Z',
        billing_till: '2026-03-31T23:59:59.999Z',
        ...extra,
      }) as any;

    it('[BE-ADM-005] {BillingHistoryService.create} periods are checked for order and overlap, including month ends and leap days', async () => {
      const billing = boot.get(BillingHistoryService);
      // The factory already holds a 2020-2040 period; clear it to test from scratch
      await db.billingHistory.deleteMany({ where: { consumer_id: cid() } });
      await billing.create(bill());
      const backwards = await failure(
        billing.create(
          bill({
            billing_date: '2026-04-01T00:00:00.000Z',
            billing_from: '2026-05-01T00:00:00.000Z',
            billing_till: '2026-04-01T00:00:00.000Z',
          }),
        ),
      );
      expect(statusOf(backwards)).toBe(400);
      const overlap = await failure(
        billing.create(
          bill({
            billing_date: '2026-03-31T00:00:00.000Z',
            billing_from: '2026-03-31T00:00:00.000Z',
            billing_till: '2026-04-30T00:00:00.000Z',
          }),
        ),
      );
      expect(statusOf(overlap)).toBe(409);
      // Mar 31 23:59:59.999 end vs Apr 1 00:00 start is adjacent, not overlapping
      await billing.create(
        bill({
          billing_date: '2026-04-01T00:00:00.000Z',
          billing_from: '2026-04-01T00:00:00.000Z',
          billing_till: '2026-04-30T23:59:59.999Z',
        }),
      );
      // Leap day: Feb 29 2028 is a valid, non-overlapping one-day period
      await billing.create(
        bill({
          billing_date: '2028-02-29T00:00:00.000Z',
          billing_from: '2028-02-29T00:00:00.000Z',
          billing_till: '2028-02-29T23:59:59.999Z',
        }),
      );
      const sameDate = await failure(
        billing.create(
          bill({
            billing_from: '2027-01-01T00:00:00.000Z',
            billing_till: '2027-01-31T00:00:00.000Z',
          }),
        ),
      );
      expect(statusOf(sameDate)).toBe(409);
    });

    it('[BE-ADM-005] {BillingHistoryService.create} {BillingHistoryService.update} {BillingHistoryService.remove} {BillingHistoryService.findAll} update re-checks the period against the other bills; unknown ids are 404', async () => {
      const billing = boot.get(BillingHistoryService);
      await db.billingHistory.deleteMany({ where: { consumer_id: cid() } });
      const first: any = await billing.create(bill());
      const second: any = await billing.create(
        bill({
          billing_date: '2026-04-01T00:00:00.000Z',
          billing_from: '2026-04-01T00:00:00.000Z',
          billing_till: '2026-04-30T00:00:00.000Z',
        }),
      );
      expect(
        statusOf(
          await failure(
            billing.update(second.id, {
              billing_from: '2026-03-15T00:00:00.000Z',
            } as any),
          ),
        ),
      ).toBe(409);
      expect(
        Number((await billing.update(first.id, { amount: 250 } as any)).amount),
      ).toBe(250);
      expect(
        statusOf(await failure(billing.update(999999, { amount: 1 } as any))),
      ).toBe(404);
      expect(statusOf(await failure(billing.remove(999999)))).toBe(404);
      expect(await billing.remove(first.id)).toEqual({ success: true });
      expect(
        (await billing.findAll({ consumerIds: [cid()] })).map((b) => b.id),
      ).toEqual([second.id]);
    });
  });

  /** A rich tenant: stock, sales, a return, rewards, a promotion, a transfer, vendor batches, a ticket. */
  async function enrich() {
    await createRewardsSettings(db, {
      consumer_id: cid(),
      redemption_value: 1,
      minimum_redemption: 1,
    });
    const customer = await createCustomer(db, { consumer_id: cid() });
    const vendor = await createVendor(db, { consumer_id: cid(), name: 'Acme' });
    const v = await w.stock({ price: 100, batches: [{ qty: 20, cost: 40 }] });
    await db.inventoryBatch.updateMany({
      where: { variant_id: v.id },
      data: { vendor_id: vendor.id },
    });
    const sale = await w.sell([{ variant: v, qty: 3 }], {
      customer_id: customer.id,
    });
    const item = await db.saleItem.findFirstOrThrow({
      where: { sale_id: sale.id },
    });
    const batch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: v.id },
    });
    await boot.get(ReturnService).create(cid(), w.tenant.adminUser.id, {
      original_sale_id: sale.id,
      branch_id: w.tenant.branches[0].id,
      items: [
        {
          sale_item_id: item.id,
          variant_id: v.id,
          batch_id: batch.id,
          quantity: 1,
        },
      ],
      payments: [{ payment_method: 'CASH', amount: 100 }],
    } as any);
    await createPromotion(db, w.tenant, { variants: [v.id] });
    const transfers = boot.get(InventoryTransferService);
    const transfer: any = await transfers.create(cid(), w.tenant.adminUser.id, {
      source_branch_id: w.tenant.branches[0].id,
      destination_branch_id: w.tenant.branches[1].id,
      items: [{ batch_id: batch.id, quantity: 2 }],
    });
    await transfers.completeTransfer(transfer.id, cid());
    await boot.get(SupportService).create(cid(), w.tenant.adminUser.id, {
      subject: 'Hi',
      category: 'OTHER',
      message: 'Help',
    } as any);
    await db.operationalCost.create({
      data: {
        consumer_id: cid(),
        created_by: w.tenant.adminUser.id,
        name: 'Rent',
        amount: 5,
        incurred_on: new Date('2026-03-01T00:00:00Z'),
      },
    });
    return { v, customer, vendor };
  }

  describe('purge', () => {
    it('[BE-ADM-004] {ConsumerPurgeService.purge} purging a consumer removes every row it owns and leaves the other tenant untouched', async () => {
      await enrich();
      const purge = boot.get(ConsumerPurgeService);
      const wrong = await failure(purge.purge(cid(), 'not-the-subdomain'));
      expect(statusOf(wrong)).toBe(400);
      expect(statusOf(await failure(purge.purge(999999, 'x')))).toBe(404);
      expect(await db.consumer.count({ where: { id: cid() } })).toBe(1);
      const result = await purge.purge(cid(), w.tenant.consumer.subdomain);
      expect(result.purged).toBe(true);
      const tables = await db.$queryRawUnsafe<{ table_name: string }[]>(
        `SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='consumer_id'`,
      );
      for (const { table_name } of tables) {
        const [{ n }] = await db.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT COUNT(*) AS n FROM "${table_name}" WHERE consumer_id = ${cid()}`,
        );
        expect({ table_name, rows: Number(n) }).toEqual({
          table_name,
          rows: 0,
        });
      }
      expect(await db.consumer.count({ where: { id: cid() } })).toBe(0);
      expect(
        await db.saleItem.count({ where: { sale: { consumer_id: cid() } } }),
      ).toBe(0);
      // w.check() in afterEach proves the bystander tenant is byte-identical
    });
  });

  describe('account data import', () => {
    it('[BE-ADM-007] {ConsumerDataImportService.run} importing one account into another copies its catalog, customers and stock with audit rows, and never touches the source or a bystander', async () => {
      await enrich();
      const target = await createTenant(db, { maxBranches: 5 });
      const importer = boot.get(ConsumerDataImportService);
      const sourceBefore = await snapshotTenant(db, cid());
      const result: any = await importer.run(
        {
          source_consumer_id: cid(),
          target_consumer_id: target.consumer.id,
          sections: [
            'BRANCHES',
            'VENDORS',
            'PRODUCTS',
            'INVENTORY',
            'CUSTOMERS',
          ],
          duplicate_strategy: 'SKIP',
          confirm_target_subdomain: target.consumer.subdomain,
        } as any,
        undefined,
      );
      expect(result.status).toBe('COMPLETED');
      expect(await snapshotTenant(db, cid())).toBe(sourceBefore);
      const mine = (table: 'customer' | 'vendor' | 'product') =>
        (db as any)[table].count({
          where: { consumer_id: target.consumer.id },
        });
      expect(await mine('customer')).toBe(1);
      expect(await mine('vendor')).toBe(1);
      expect(await mine('product')).toBe(
        await db.product.count({ where: { consumer_id: cid() } }),
      );
      const sourceStock = await db.inventoryBatch.aggregate({
        where: { branch: { consumer_id: cid() } },
        _sum: { quantity: true },
      });
      const targetStock = await db.inventoryBatch.aggregate({
        where: { branch: { consumer_id: target.consumer.id } },
        _sum: { quantity: true },
      });
      expect(targetStock._sum.quantity).toBe(sourceStock._sum.quantity);
      // Every imported batch must be explained by the audit trail (INV-01) and stay in its own tenant (INV-12)
      expect(await findViolations(db)).toEqual([]);
      // No sales, returns or rewards history is copied
      expect(
        await db.sale.count({ where: { consumer_id: target.consumer.id } }),
      ).toBe(0);
      // A repeat run reuses the mapping instead of duplicating
      await importer.run(
        {
          source_consumer_id: cid(),
          target_consumer_id: target.consumer.id,
          sections: ['PRODUCTS', 'CUSTOMERS'],
          duplicate_strategy: 'SKIP',
          confirm_target_subdomain: target.consumer.subdomain,
        } as any,
        undefined,
      );
      expect(await mine('customer')).toBe(1);
    });

    it('[BE-ADM-007] {ConsumerDataImportService.run} {ConsumerDataImportService.preview} the import refuses the same account, unknown or deleted accounts and a wrong confirmation', async () => {
      const importer = boot.get(ConsumerDataImportService);
      const dto = (extra: object) =>
        ({
          source_consumer_id: cid(),
          target_consumer_id: w.bystander.consumer.id,
          sections: ['CUSTOMERS'],
          duplicate_strategy: 'SKIP',
          confirm_target_subdomain: w.bystander.consumer.subdomain,
          ...extra,
        }) as any;
      expect(
        (await failure(importer.run(dto({ target_consumer_id: cid() }))))
          .message,
      ).toMatch(/must be different/);
      expect(
        (await failure(importer.run(dto({ source_consumer_id: 999999 }))))
          .message,
      ).toMatch(/Source account not found/);
      expect(
        (await failure(importer.run(dto({ confirm_target_subdomain: 'nope' }))))
          .message,
      ).toMatch(/Confirmation failed/);
      await db.consumer.update({
        where: { id: cid() },
        data: { deleted_at: new Date() },
      });
      expect((await failure(importer.preview(dto({})))).message).toMatch(
        /Source account not found/,
      );
      await db.consumer.update({
        where: { id: cid() },
        data: { deleted_at: null },
      });
    });
  });
});
