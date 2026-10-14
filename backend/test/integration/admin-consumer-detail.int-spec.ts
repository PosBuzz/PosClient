import { HttpException, NotFoundException } from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createAdmin, createTenant, TEST_PASSWORD } from '../factories';
import { ConsumerPermission } from '../../src/auth/enums/consumerPermissions.enum';
import { ConsumerService } from '../../src/admin/consumer/services/consumer.service';
import { ConsumerPurgeService } from '../../src/admin/consumer/services/consumer-purge.service';

describe('admin consumers and purge (detail)', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let consumers: ConsumerService;
  let purge: ConsumerPurgeService;

  beforeAll(async () => {
    boot = await bootDomain();
    consumers = boot.get(ConsumerService);
    purge = boot.get(ConsumerPurgeService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());

  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );
  const prisma = () => (consumers as any).prisma;
  const cid = () => w.tenant.consumer.id;
  const actionsOf = async (roleId: number) =>
    (
      await db.rolePermission.findMany({
        where: { role_id: roleId },
        include: { permission: true },
      })
    )
      .map((r) => r.permission.action)
      .sort();
  const createDto = (planId: number, extra: object = {}) =>
    ({
      company_name: 'New Shop',
      name: 'Owner',
      subdomain: 'newshop',
      plan_id: planId,
      email: 'owner@newshop.test',
      password: TEST_PASSWORD,
      ...extra,
    }) as any;

  describe('create', () => {
    it('[BE-ADM-120] {ConsumerService.create} the consumer, admin role, admin user and main branch are linked and carry the given details', async () => {
      const res: any = await consumers.create(
        createDto(w.tenant.plan.id, {
          address: '1 High St',
          phone: '555-0100',
          secondary_email: 'second@newshop.test',
          business_category: 'Grocery',
          max_branch: 3,
        }),
      );
      expect(res.message).toBe(
        'Consumer, admin user, and permissions created successfully',
      );
      expect(Object.keys(res).sort()).toEqual(['consumer', 'message']);
      const c = res.consumer;
      expect(c).toMatchObject({
        company_name: 'New Shop',
        subdomain: 'newshop',
        email: 'owner@newshop.test',
        plan_id: w.tenant.plan.id,
        address: '1 High St',
        phone: '555-0100',
        secondary_email: 'second@newshop.test',
        business_category: 'Grocery',
        max_branch: 3,
      });
      // user fields never leak onto the consumer row
      expect(c.password).toBeUndefined();
      expect(c.name).toBeUndefined();
      const admin = await db.role.findFirstOrThrow({
        where: { consumer_id: c.id, is_admin: true },
      });
      expect(admin.name).toBe('Admin');
      const user = await db.user.findFirstOrThrow({
        where: { consumer_id: c.id },
        include: { branches: true },
      });
      expect(user).toMatchObject({
        email: 'owner@newshop.test',
        name: 'Owner',
        role_id: admin.id,
        consumer_id: c.id,
      });
      expect(await bcryptjs.compare(TEST_PASSWORD, user.password)).toBe(true);
      const branch = await db.branch.findFirstOrThrow({
        where: { consumer_id: c.id },
      });
      expect(branch).toMatchObject({
        name: 'Main Branch',
        address: 'Main Branch',
        email: 'owner@newshop.test',
        phone: '555-0100',
        is_main: true,
        is_warehouse: false,
      });
      expect(user.branches.map((b) => b.branch_id)).toEqual([branch.id]);
      expect(await db.role.count({ where: { consumer_id: c.id } })).toBe(2);
      expect(await db.branch.count({ where: { consumer_id: c.id } })).toBe(1);
      expect(
        await db.receiptPdfSetting.count({ where: { consumer_id: c.id } }),
      ).toBeGreaterThan(0);
    });

    it('[BE-ADM-121] {ConsumerService.create} the admin role gets exactly the plan permissions, Cash In Charge only the shop-floor ones the plan includes', async () => {
      const narrow = await createTenant(db, {
        permissions: [
          ConsumerPermission.sales,
          ConsumerPermission.customers,
          ConsumerPermission.users,
        ],
      });
      const res: any = await consumers.create(
        createDto(narrow.plan.id, { subdomain: 'narrow' }),
      );
      const roles = await db.role.findMany({
        where: { consumer_id: res.consumer.id },
      });
      const admin = roles.find((r) => r.is_admin)!;
      const cash = roles.find((r) => r.name === 'Cash In Charge')!;
      expect(await actionsOf(admin.id)).toEqual([
        'customers',
        'sales',
        'users',
      ]);
      expect(cash.is_admin).toBe(false);
      expect(await actionsOf(cash.id)).toEqual(['customers', 'sales']);
    });

    it('[BE-ADM-122] {ConsumerService.create} a plan with none of the shop-floor permissions gets no Cash In Charge role', async () => {
      const plain = await createTenant(db, {
        permissions: [ConsumerPermission.users, ConsumerPermission.branches],
      });
      const res: any = await consumers.create(
        createDto(plain.plan.id, { subdomain: 'plain' }),
      );
      const roles = await db.role.findMany({
        where: { consumer_id: res.consumer.id },
      });
      expect(roles.map((r) => r.name)).toEqual(['Admin']);
      expect(await actionsOf(roles[0].id)).toEqual(['branches', 'users']);
    });

    it('[BE-ADM-123] {ConsumerService.create} a failure part way rolls everything back; the response is a generic 500', async () => {
      const before = await db.consumer.count();
      const spy = jest
        .spyOn(prisma(), '$transaction')
        .mockRejectedValueOnce(new Error('db down'));
      const e = await failure(consumers.create(createDto(w.tenant.plan.id)));
      spy.mockRestore();
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(500);
      expect(e.message).toBe('Failed to create consumer');
      // a real failure inside the transaction leaves no rows behind
      const roleSpy = jest
        .spyOn(
          (consumers as any).receiptPdfSettingService,
          'initializeConsumerDefaults',
        )
        .mockRejectedValueOnce(new Error('settings down'));
      const e2 = await failure(
        consumers.create(createDto(w.tenant.plan.id, { subdomain: 'rolled' })),
      );
      roleSpy.mockRestore();
      expect(e2.message).toBe('Failed to create consumer');
      expect(await db.consumer.count()).toBe(before);
      expect(await db.consumer.count({ where: { subdomain: 'rolled' } })).toBe(
        0,
      );
    });

    it('[BE-ADM-124] {ConsumerService.create} a duplicate subdomain is passed through as a readable client error, not a 500', async () => {
      const e = await failure(
        consumers.create(
          createDto(w.tenant.plan.id, {
            subdomain: w.tenant.consumer.subdomain,
          }),
        ),
      );
      expect(e).toBeTruthy();
      expect(e.message).not.toBe('Failed to create consumer');
      expect(e.code).toBe('P2002');
    });
  });

  describe('update', () => {
    it('[BE-ADM-125] {ConsumerService.update} details go to the consumer, name and email to the admin user, and the permissions stay when the plan does not change', async () => {
      const permsBefore = await actionsOf(w.tenant.adminRole.id);
      const hashBefore = w.tenant.adminUser.password;
      const res = await consumers.update(cid(), {
        company_name: 'Renamed',
        name: 'New Owner',
        email: 'renamed@x.test',
        phone: '999',
      });
      expect(res).toEqual({
        message: 'Consumer, admin user, and permissions updated successfully',
      });
      const c = await db.consumer.findUniqueOrThrow({ where: { id: cid() } });
      expect(c).toMatchObject({
        company_name: 'Renamed',
        email: 'renamed@x.test',
        phone: '999',
        plan_id: w.tenant.plan.id,
      });
      const u = await db.user.findUniqueOrThrow({
        where: { id: w.tenant.adminUser.id },
      });
      expect(u).toMatchObject({ name: 'New Owner', email: 'renamed@x.test' });
      expect(u.password).toBe(hashBefore);
      expect(await actionsOf(w.tenant.adminRole.id)).toEqual(permsBefore);
    });

    it('[BE-ADM-126] {ConsumerService.update} a new password is hashed; an empty one is ignored', async () => {
      await consumers.update(cid(), { password: '' });
      expect(
        (
          await db.user.findUniqueOrThrow({
            where: { id: w.tenant.adminUser.id },
          })
        ).password,
      ).toBe(w.tenant.adminUser.password);
      await consumers.update(cid(), { password: 'Fresh!Pass1' });
      const u = await db.user.findUniqueOrThrow({
        where: { id: w.tenant.adminUser.id },
      });
      expect(u.password).not.toBe('Fresh!Pass1');
      expect(await bcryptjs.compare('Fresh!Pass1', u.password)).toBe(true);
    });

    it('[BE-ADM-127] {ConsumerService.update} changing the plan swaps the admin role permissions for the new plan and leaves other roles alone', async () => {
      const other = await w.tenant.user([ConsumerPermission.vendors]);
      const otherRole = await db.rolePermission.count({
        where: { role_id: other.role_id },
      });
      const smaller = await createTenant(db, {
        permissions: [ConsumerPermission.sales, ConsumerPermission.support],
      });
      await consumers.update(cid(), { plan_id: smaller.plan.id });
      expect(
        (await db.consumer.findUniqueOrThrow({ where: { id: cid() } })).plan_id,
      ).toBe(smaller.plan.id);
      expect(await actionsOf(w.tenant.adminRole.id)).toEqual([
        'sales',
        'support',
      ]);
      expect(
        await db.rolePermission.count({ where: { role_id: other.role_id } }),
      ).toBe(otherRole);
      // the other tenant's admin role is untouched (w.check also proves this)
      expect(
        (await actionsOf(w.bystander.adminRole.id)).length,
      ).toBeGreaterThan(2);
    });

    it('[BE-ADM-128] {ConsumerService.update} a consumer without an Admin role user is a 404', async () => {
      const e = await failure(consumers.update(999999, { name: 'x' }));
      expect(e).toBeInstanceOf(NotFoundException);
      expect(e.getStatus()).toBe(404);
      expect(e.message).toBe('Admin user not found for this consumer');
      // a role that is named Admin but not flagged admin does not count
      await db.role.update({
        where: { id: w.tenant.adminRole.id },
        data: { is_admin: false },
      });
      const e2 = await failure(consumers.update(cid(), { name: 'x' }));
      expect(e2.message).toBe('Admin user not found for this consumer');
      await db.role.update({
        where: { id: w.tenant.adminRole.id },
        data: { is_admin: true, name: 'Manager' },
      });
      const e3 = await failure(consumers.update(cid(), { name: 'x' }));
      expect(e3.message).toBe('Admin user not found for this consumer');
      await db.role.update({
        where: { id: w.tenant.adminRole.id },
        data: { name: 'Admin' },
      });
      expect(
        (await db.consumer.findUniqueOrThrow({ where: { id: cid() } }))
          .company_name,
      ).toBe(w.tenant.consumer.company_name);
    });

    it('[BE-ADM-129] {ConsumerService.update} unexpected failures are wrapped as a generic 500', async () => {
      const spy = jest
        .spyOn(prisma().user, 'findFirst')
        .mockRejectedValueOnce(new Error('db down'));
      const e = await failure(consumers.update(cid(), { name: 'x' }));
      spy.mockRestore();
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(500);
      expect(e.message).toBe('Failed to update consumer');
    });
  });

  describe('findAll', () => {
    const idsOf = (rows: any) => rows.map((r: any) => r.id);
    const list = (p: object = {}) => consumers.findAll(p) as Promise<any[]>;

    it('[BE-ADM-130] {ConsumerService.findAll} rows carry users, plan, billing logs, product count and billing summary, in id order', async () => {
      await w.stock({ price: 10, batches: [{ qty: 1, cost: 1 }] });
      const rows = await list();
      expect(idsOf(rows)).toEqual(
        [...idsOf(rows)].sort((a: number, b: number) => a - b),
      );
      const mine = rows.find((r) => r.id === cid());
      expect(mine.plan.id).toBe(w.tenant.plan.id);
      expect(mine.users).toEqual([
        {
          name: 'Tenant Admin',
          role: expect.objectContaining({
            id: w.tenant.adminRole.id,
            name: 'Admin',
          }),
        },
      ]);
      expect(mine._count).toEqual({ Product: 1 });
      expect(mine.billing_logs).toHaveLength(1);
      expect(mine.has_active_billing).toBe(true);
      expect(mine.billing_active_until).toEqual(
        new Date('2040-01-01T00:00:00Z'),
      );
      expect(mine.latest_billing_till).toEqual(
        new Date('2040-01-01T00:00:00Z'),
      );
    });

    it('[BE-ADM-131] {ConsumerService.findAll} billing summary: expired, future and overlapping periods', async () => {
      const t = await createTenant(db);
      await db.billingHistory.deleteMany({
        where: { consumer_id: t.consumer.id },
      });
      const mk = (day: number, from: string, till: string) =>
        db.billingHistory.create({
          data: {
            consumer_id: t.consumer.id,
            plan_id: t.plan.id,
            amount: 1,
            billing_date: new Date(`2020-01-0${day}T00:00:00Z`),
            billing_from: new Date(from),
            billing_till: new Date(till),
          },
        });
      await mk(1, '2020-01-01T00:00:00Z', '2020-12-31T00:00:00Z');
      await mk(2, '2021-01-01T00:00:00Z', '2021-12-31T00:00:00Z');
      const find = async () =>
        (await list()).find((r) => r.id === t.consumer.id);
      let row = await find();
      expect(row.has_active_billing).toBe(false);
      expect(row.billing_active_until).toBeNull();
      expect(row.latest_billing_till).toEqual(new Date('2021-12-31T00:00:00Z'));
      // a future period is not active
      await mk(3, '2090-01-01T00:00:00Z', '2091-01-01T00:00:00Z');
      row = await find();
      expect(row.has_active_billing).toBe(false);
      expect(row.billing_active_until).toBeNull();
      expect(row.latest_billing_till).toEqual(new Date('2091-01-01T00:00:00Z'));
      // two active periods: the one ending latest wins
      await mk(4, '2020-01-01T00:00:00Z', '2050-01-01T00:00:00Z');
      await mk(5, '2020-01-01T00:00:00Z', '2045-01-01T00:00:00Z');
      row = await find();
      expect(row.has_active_billing).toBe(true);
      expect(row.billing_active_until).toEqual(
        new Date('2050-01-01T00:00:00Z'),
      );
      expect(row.latest_billing_till).toEqual(new Date('2091-01-01T00:00:00Z'));
      // no billing at all
      await db.billingHistory.deleteMany({
        where: { consumer_id: t.consumer.id },
      });
      row = await find();
      expect(row.has_active_billing).toBe(false);
      expect(row.latest_billing_till).toBeNull();
      expect(row.billing_active_until).toBeNull();
    });

    it('[BE-ADM-132] {ConsumerService.findAll} status filter: active has a covering billing period, inactive has none', async () => {
      const lapsed = await createTenant(db);
      await db.billingHistory.deleteMany({
        where: { consumer_id: lapsed.consumer.id },
      });
      await db.billingHistory.create({
        data: {
          consumer_id: lapsed.consumer.id,
          plan_id: lapsed.plan.id,
          amount: 1,
          billing_date: new Date('2020-01-01T00:00:00Z'),
          billing_from: new Date('2020-01-01T00:00:00Z'),
          billing_till: new Date('2020-02-01T00:00:00Z'),
        },
      });
      const active = idsOf(await list({ status: 'active' }));
      expect(active).toEqual(
        expect.arrayContaining([cid(), w.bystander.consumer.id]),
      );
      expect(active).not.toContain(lapsed.consumer.id);
      expect(idsOf(await list({ status: 'inactive' }))).toEqual([
        lapsed.consumer.id,
      ]);
      expect(idsOf(await list())).toContain(lapsed.consumer.id);
    });

    it('[BE-ADM-133] {ConsumerService.findAll} plan, deleted and search filters', async () => {
      const other = await createTenant(db);
      expect(idsOf(await list({ planId: other.plan.id }))).toEqual([
        other.consumer.id,
      ]);
      await consumers.softDelete(other.consumer.id);
      expect(idsOf(await list())).not.toContain(other.consumer.id);
      expect(idsOf(await list({ deleted: false }))).not.toContain(
        other.consumer.id,
      );
      expect(idsOf(await list({ deleted: true }))).toEqual([other.consumer.id]);
      expect(await list({ planId: other.plan.id })).toEqual([]);
      // each searchable column on its own
      const fields: [string, string][] = [
        ['company_name', 'Needle Co'],
        ['email', 'needle-mail@x.test'],
        ['secondary_email', 'needle-second@x.test'],
        ['phone', '0777-needle'],
        ['subdomain', 'needlesub'],
        ['business_category', 'Needle Trade'],
      ];
      for (const [field, value] of fields) {
        const t = await createTenant(db);
        await db.consumer.update({
          where: { id: t.consumer.id },
          data: { [field]: value },
        });
        const hits = idsOf(await list({ search: value.toUpperCase() }));
        expect(hits).toEqual([t.consumer.id]);
        await db.consumer.delete({ where: { id: t.consumer.id } }).catch(() => {
          /* tenant owns rows; leave it */
        });
      }
      expect(await list({ search: 'zzz-no-match' })).toEqual([]);
      expect(idsOf(await list({ search: '' }))).toContain(cid());
    });

    it('[BE-ADM-134] {ConsumerService.findAll} unexpected failures are wrapped as a generic 500', async () => {
      const spy = jest
        .spyOn(prisma().consumer, 'findMany')
        .mockRejectedValueOnce(new Error('db down'));
      const e = await failure(list());
      spy.mockRestore();
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(500);
      expect(e.message).toBe('Failed to fetch consumers');
    });
  });

  describe('soft delete, restore and subdomain', () => {
    it('[BE-ADM-135] {ConsumerService.softDelete} records who, why and when; deleting twice or an unknown id is a 404', async () => {
      const admin = await createAdmin(db);
      const res = await consumers.softDelete(cid(), admin.id, 'unpaid');
      expect(res).toEqual({ success: true, soft_deleted: true });
      const c = await db.consumer.findUniqueOrThrow({ where: { id: cid() } });
      expect(c.deleted_by_id).toBe(admin.id);
      expect(c.delete_reason).toBe('unpaid');
      expect(Math.abs(Date.now() - c.deleted_at!.getTime())).toBeLessThan(
        60_000,
      );
      const again = await failure(consumers.softDelete(cid()));
      expect(again).toBeInstanceOf(NotFoundException);
      expect(again.message).toBe('Consumer not found or already deleted');
      const none = await failure(consumers.softDelete(999999));
      expect(none.getStatus()).toBe(404);
      // no user or reason stores null
      await consumers.restore(cid());
      await consumers.softDelete(cid());
      const bare = await db.consumer.findUniqueOrThrow({
        where: { id: cid() },
      });
      expect(bare.deleted_by_id).toBeNull();
      expect(bare.delete_reason).toBeNull();
      expect(bare.deleted_at).not.toBeNull();
    });

    it('[BE-ADM-136] {ConsumerService.restore} clears the deletion details; a live or unknown consumer is a 404', async () => {
      const admin = await createAdmin(db);
      const live = await failure(consumers.restore(cid()));
      expect(live).toBeInstanceOf(NotFoundException);
      expect(live.message).toBe('Consumer not found or is not deleted');
      await consumers.softDelete(cid(), admin.id, 'why');
      expect(await consumers.restore(cid())).toEqual({
        success: true,
        restored: true,
      });
      const c = await db.consumer.findUniqueOrThrow({ where: { id: cid() } });
      expect(c.deleted_at).toBeNull();
      expect(c.deleted_by_id).toBeNull();
      expect(c.delete_reason).toBeNull();
      expect((await failure(consumers.restore(999999))).getStatus()).toBe(404);
    });

    it('[BE-ADM-137] {ConsumerService.softDelete} {ConsumerService.restore} {ConsumerService.checkSubdomain} unexpected failures are wrapped as a generic 500', async () => {
      const cases: [string, string, () => Promise<unknown>, string][] = [
        [
          'update',
          'consumer',
          () => consumers.softDelete(cid()),
          'Failed to delete consumer',
        ],
        [
          'findUnique',
          'consumer',
          () => consumers.checkSubdomain('x'),
          'Failed to check subdomain availability',
        ],
      ];
      for (const [method, model, call, message] of cases) {
        const spy = jest
          .spyOn(prisma()[model], method)
          .mockRejectedValueOnce(new Error('db down'));
        const e = await failure(call());
        spy.mockRestore();
        expect(e).toBeInstanceOf(HttpException);
        expect(e.getStatus()).toBe(500);
        expect(e.message).toBe(message);
      }
      await consumers.softDelete(cid());
      const spy = jest
        .spyOn(prisma().consumer, 'update')
        .mockRejectedValueOnce(new Error('db down'));
      const e = await failure(consumers.restore(cid()));
      spy.mockRestore();
      expect(e.getStatus()).toBe(500);
      expect(e.message).toBe('Failed to restore consumer');
      expect(
        (await db.consumer.findUniqueOrThrow({ where: { id: cid() } }))
          .deleted_at,
      ).not.toBeNull();
    });

    it('[BE-ADM-138] {ConsumerService.checkSubdomain} a taken subdomain is unavailable, a free one is available, a deleted tenant keeps its subdomain', async () => {
      const sub = w.tenant.consumer.subdomain;
      expect(await consumers.checkSubdomain(sub)).toEqual({ available: false });
      expect(await consumers.checkSubdomain(`${sub}-free`)).toEqual({
        available: true,
      });
      await consumers.softDelete(cid());
      expect(await consumers.checkSubdomain(sub)).toEqual({ available: false });
    });
  });

  describe('purge', () => {
    it('[BE-ADM-139] {ConsumerPurgeService.purge} an unknown id is a 404 and a wrong confirmation is a 400 naming the expected subdomain; nothing is deleted', async () => {
      const missing = await failure(purge.purge(999999, 'x'));
      expect(missing).toBeInstanceOf(HttpException);
      expect(missing.getStatus()).toBe(404);
      expect(missing.message).toBe('Consumer not found');
      const wrong = await failure(purge.purge(cid(), 'nope'));
      expect(wrong.getStatus()).toBe(400);
      expect(wrong.message).toBe(
        `Confirmation failed: expected the subdomain '${w.tenant.consumer.subdomain}'`,
      );
      const upper = await failure(
        purge.purge(cid(), w.tenant.consumer.subdomain.toUpperCase()),
      );
      expect(upper.getStatus()).toBe(400);
      expect(await db.consumer.count({ where: { id: cid() } })).toBe(1);
      expect(await db.user.count({ where: { consumer_id: cid() } })).toBe(1);
    });

    it('[BE-ADM-140] {ConsumerPurgeService.purge} returns the consumer and the exact per-table counts, leaving out tables with no rows', async () => {
      const res: any = await purge.purge(cid(), w.tenant.consumer.subdomain);
      expect(res.success).toBe(true);
      expect(res.purged).toBe(true);
      expect(res.consumer).toEqual({
        id: cid(),
        subdomain: w.tenant.consumer.subdomain,
      });
      expect(Object.keys(res).sort()).toEqual([
        'consumer',
        'deleted_rows',
        'purged',
        'success',
      ]);
      const rows = res.deleted_rows;
      expect(rows.branches).toBe(1);
      expect(rows.users).toBe(1);
      expect(rows.roles).toBe(1);
      expect(rows.user_branches).toBe(1);
      expect(rows.billing_histories ?? rows.billing_history).toBe(1);
      expect(rows.role_permissions).toBe(
        Object.values(ConsumerPermission).length,
      );
      for (const count of Object.values(rows)) {
        expect(count).toBeGreaterThan(0);
      }
      expect(rows.sales).toBeUndefined();
      expect(rows.sale_items).toBeUndefined();
      expect(await db.consumer.count({ where: { id: cid() } })).toBe(0);
      // the plan is shared reference data, not tenant data
      expect(await db.plan.count({ where: { id: w.tenant.plan.id } })).toBe(1);
    });

    it('[BE-ADM-141] {ConsumerPurgeService.purge} rows of every scoped child table go, counted per table', async () => {
      const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 5 }] });
      await w.sell([{ variant: v, qty: 2 }]);
      const res: any = await purge.purge(cid(), w.tenant.consumer.subdomain);
      const rows = res.deleted_rows;
      expect(rows.sales).toBe(1);
      expect(rows.sale_items).toBe(1);
      expect(rows.sale_payments).toBe(1);
      expect(rows.product_variants).toBe(1);
      expect(rows.inventory_batches).toBe(1);
      expect(rows.products).toBe(1);
      expect(
        await db.saleItem.count({ where: { sale: { consumer_id: cid() } } }),
      ).toBe(0);
      expect(
        await db.inventoryBatch.count({
          where: { branch: { consumer_id: cid() } },
        }),
      ).toBe(0);
    });

    it('[BE-ADM-142] {ConsumerPurgeService.purge} a reachable table with no consumer scope stops the purge before anything is deleted', async () => {
      const spy = jest
        .spyOn(purge as any, 'reachableTables')
        .mockResolvedValueOnce([
          { name: 'branches', hasConsumerId: true },
          { name: 'mystery_a', hasConsumerId: false },
          { name: 'mystery_b', hasConsumerId: false },
          { name: 'product_variants', hasConsumerId: false },
        ]);
      const e = await failure(purge.purge(cid(), w.tenant.consumer.subdomain));
      spy.mockRestore();
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(500);
      expect(e.message).toBe(
        'Cannot purge safely: no consumer scope defined for mystery_a, mystery_b. ' +
          'Add them to SCOPE in consumer-purge.service.ts.',
      );
      expect(await db.consumer.count({ where: { id: cid() } })).toBe(1);
      expect(await db.branch.count({ where: { consumer_id: cid() } })).toBe(1);
    });

    it('[BE-ADM-143] {ConsumerPurgeService.reachableTables} finds tables that point at consumers, directly or through another table, and flags the ones with a consumer_id column', async () => {
      const tables: any[] = await (purge as any).reachableTables(db);
      const byName = new Map(tables.map((t) => [t.name, t.hasConsumerId]));
      expect(byName.get('branches')).toBe(true);
      expect(byName.get('users')).toBe(true);
      expect(byName.get('product_variants')).toBe(false);
      expect(byName.get('sale_items')).toBe(false);
      expect(byName.has('plans')).toBe(false);
      expect(byName.has('consumers')).toBe(false);
      // every table the purge cannot scope by consumer_id has a SCOPE entry
      const { SCOPE } = await import(
        '../../src/admin/consumer/services/consumer-purge.service'
      );
      for (const t of tables) {
        if (!t.hasConsumerId) expect(SCOPE[t.name]).toBeDefined();
      }
    });

    it('[BE-ADM-144] {ConsumerPurgeService.deleteOrder} children are deleted before their parents, unrelated and duplicate edges are ignored, and a cycle is refused', async () => {
      const order = async (names: string[], edges: [string, string][]) =>
        (purge as any).deleteOrder(
          {
            $queryRawUnsafe: async () =>
              edges.map(([child, parent]) => ({ child, parent })),
          },
          names.map((name) => ({ name, hasConsumerId: true })),
        ) as Promise<string[]>;
      // grandparent a <- b <- c: c goes first
      expect(
        await order(
          ['a', 'b', 'c'],
          [
            ['b', 'a'],
            ['c', 'b'],
          ],
        ),
      ).toEqual(['c', 'b', 'a']);
      // a duplicate edge must not leave a table waiting forever
      expect(
        await order(
          ['a', 'b'],
          [
            ['b', 'a'],
            ['b', 'a'],
          ],
        ),
      ).toEqual(['b', 'a']);
      // edges to tables outside the purge set are ignored
      expect(
        await order(
          ['a', 'b'],
          [
            ['b', 'a'],
            ['b', 'outside'],
            ['outside', 'a'],
          ],
        ),
      ).toEqual(['b', 'a']);
      // independent tables are all returned
      expect((await order(['x', 'y'], [])).sort()).toEqual(['x', 'y']);
      const cycle = await failure(
        order(
          ['a', 'b', 'c'],
          [
            ['b', 'a'],
            ['a', 'b'],
          ],
        ),
      );
      expect(cycle).toBeInstanceOf(HttpException);
      expect(cycle.getStatus()).toBe(500);
      expect(cycle.message).toBe(
        'Cannot purge: foreign key cycle involving a, b',
      );
    });
  });
});
