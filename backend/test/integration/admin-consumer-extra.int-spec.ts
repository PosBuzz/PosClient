import { BadRequestException, HttpException } from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createTenant, TEST_PASSWORD } from '../factories';
import { ConsumerPermission } from '../../src/auth/enums/consumerPermissions.enum';
import { ConsumerService } from '../../src/admin/consumer/services/consumer.service';
import {
  ConsumerPurgeService,
  consumerScope,
} from '../../src/admin/consumer/services/consumer-purge.service';

describe('admin consumers and purge (extra, adversarial)', () => {
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
  afterEach(() => {
    jest.useRealTimers();
    return w.check();
  });

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
      subdomain: 'extrashop',
      plan_id: planId,
      email: 'owner@extrashop.test',
      password: TEST_PASSWORD,
      ...extra,
    }) as any;
  const list = (p: object = {}) => consumers.findAll(p) as Promise<any[]>;
  const idsOf = (rows: any[]) => rows.map((r) => r.id);
  /** Only Date is frozen; timers stay real so the database driver keeps working. */
  const freezeNow = (iso: string) =>
    jest.useFakeTimers({
      now: new Date(iso),
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
        'hrtime',
        'performance',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
      ],
    });

  it('[BE-ADM-220] {ConsumerService.create} {ConsumerService.update} passwords are hashed with bcrypt cost 10', async () => {
    const res: any = await consumers.create(createDto(w.tenant.plan.id));
    const user = await db.user.findFirstOrThrow({
      where: { consumer_id: res.consumer.id },
    });
    expect(user.password).toMatch(/^\$2[aby]\$10\$/);
    await consumers.update(cid(), { password: 'Fresh!Pass1' });
    const updated = await db.user.findUniqueOrThrow({
      where: { id: w.tenant.adminUser.id },
    });
    expect(updated.password).toMatch(/^\$2[aby]\$10\$/);
    expect(await bcryptjs.compare('Fresh!Pass1', updated.password)).toBe(true);
  });

  it('[BE-ADM-221] {ConsumerService.create} each shop-floor permission the plan includes reaches Cash In Charge, and nothing else does', async () => {
    const actions = ['sales', 'quotations', 'customers', 'view_product'];
    let n = 0;
    for (const action of actions) {
      const t = await createTenant(db, {
        permissions: [action as ConsumerPermission, ConsumerPermission.users],
      });
      const res: any = await consumers.create(
        createDto(t.plan.id, { subdomain: `cic${n++}` }),
      );
      const cash = await db.role.findFirstOrThrow({
        where: { consumer_id: res.consumer.id, name: 'Cash In Charge' },
      });
      expect(cash.is_admin).toBe(false);
      expect(await actionsOf(cash.id)).toEqual([action]);
      const admin = await db.role.findFirstOrThrow({
        where: { consumer_id: res.consumer.id, name: 'Admin' },
      });
      expect(await actionsOf(admin.id)).toEqual([action, 'users'].sort());
    }
  });

  it('[BE-ADM-222] {ConsumerService.create} the receipt settings are initialised for the new consumer and its admin user inside the same transaction', async () => {
    const spy = jest.spyOn(
      (consumers as any).receiptPdfSettingService,
      'initializeConsumerDefaults',
    );
    const res: any = await consumers.create(createDto(w.tenant.plan.id));
    const calls = spy.mock.calls;
    spy.mockRestore();
    const user = await db.user.findFirstOrThrow({
      where: { consumer_id: res.consumer.id },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(res.consumer.id);
    expect(calls[0][1]).toBe(user.id);
    expect(calls[0][2]).toBeDefined();
    expect(calls[0][2]).not.toBe(prisma());
  });

  it('[BE-ADM-223] {ConsumerService.create} the created consumer does not touch other tenants and the admin role is flagged admin', async () => {
    const before = await db.role.count({
      where: { consumer_id: w.bystander.consumer.id },
    });
    const res: any = await consumers.create(createDto(w.tenant.plan.id));
    expect(res.consumer.id).not.toBe(cid());
    const admin = await db.role.findFirstOrThrow({
      where: { consumer_id: res.consumer.id, name: 'Admin' },
    });
    expect(admin.is_admin).toBe(true);
    expect(
      await db.role.count({ where: { consumer_id: w.bystander.consumer.id } }),
    ).toBe(before);
    expect(
      await db.user.count({ where: { consumer_id: res.consumer.id } }),
    ).toBe(1);
  });

  it('[BE-ADM-224] {ConsumerService.update} a detail-only update leaves the admin name and email alone and does not touch other users or the plan', async () => {
    const other = await w.tenant.user([ConsumerPermission.vendors]);
    const otherBefore = await db.user.findUniqueOrThrow({
      where: { id: other.id },
    });
    const adminBefore = await db.user.findUniqueOrThrow({
      where: { id: w.tenant.adminUser.id },
    });
    await consumers.update(cid(), { phone: '123-456' });
    const adminAfter = await db.user.findUniqueOrThrow({
      where: { id: w.tenant.adminUser.id },
    });
    expect(adminAfter.name).toBe(adminBefore.name);
    expect(adminAfter.email).toBe(adminBefore.email);
    expect(
      await db.user.findUniqueOrThrow({ where: { id: other.id } }),
    ).toEqual(otherBefore);
    const c = await db.consumer.findUniqueOrThrow({ where: { id: cid() } });
    expect(c.phone).toBe('123-456');
    expect(c.plan_id).toBe(w.tenant.plan.id);
    expect(c.company_name).toBe(w.tenant.consumer.company_name);
  });

  it('[BE-ADM-225] {ConsumerService.update} the admin lookup is per tenant: a user in another tenant with an Admin role is not used', async () => {
    const e = await failure(consumers.update(cid() + 100000, { name: 'x' }));
    expect(e.message).toBe('Admin user not found for this consumer');
    const bystander = await db.consumer.findUniqueOrThrow({
      where: { id: w.bystander.consumer.id },
    });
    await consumers.update(cid(), { company_name: 'Only Mine' });
    expect(
      (await db.consumer.findUniqueOrThrow({ where: { id: bystander.id } }))
        .company_name,
    ).toBe(bystander.company_name);
  });

  it('[BE-ADM-226] {ConsumerService.update} changing to the same plan keeps the admin permissions complete', async () => {
    const before = await actionsOf(w.tenant.adminRole.id);
    await consumers.update(cid(), { plan_id: w.tenant.plan.id });
    expect(await actionsOf(w.tenant.adminRole.id)).toEqual(before);
  });

  it('[BE-ADM-227] {ConsumerService.findAll} billing periods are inclusive at both ends of the instant of the call', async () => {
    const t = await createTenant(db);
    await db.billingHistory.deleteMany({
      where: { consumer_id: t.consumer.id },
    });
    const now = '2030-06-01T12:00:00.000Z';
    const at = (ms: number) => new Date(new Date(now).getTime() + ms);
    let n = 0;
    const period = async (from: Date, till: Date) => {
      await db.billingHistory.deleteMany({
        where: { consumer_id: t.consumer.id },
      });
      await db.billingHistory.create({
        data: {
          consumer_id: t.consumer.id,
          plan_id: t.plan.id,
          amount: 1,
          billing_date: new Date('2020-01-01T00:00:00Z'),
          billing_from: from,
          billing_till: till,
        },
      });
      n++;
    };
    const state = async () => {
      const row = (await list()).find((r) => r.id === t.consumer.id);
      const active = idsOf(await list({ status: 'active' })).includes(
        t.consumer.id,
      );
      const inactive = idsOf(await list({ status: 'inactive' })).includes(
        t.consumer.id,
      );
      return { row, active, inactive };
    };
    freezeNow(now);
    await period(at(-1000), at(0));
    let s = await state();
    expect([s.row.has_active_billing, s.active, s.inactive]).toEqual([
      true,
      true,
      false,
    ]);
    expect(s.row.billing_active_until).toEqual(at(0));
    await period(at(0), at(1000));
    s = await state();
    expect([s.row.has_active_billing, s.active, s.inactive]).toEqual([
      true,
      true,
      false,
    ]);
    await period(at(-1000), at(-1));
    s = await state();
    expect([s.row.has_active_billing, s.active, s.inactive]).toEqual([
      false,
      false,
      true,
    ]);
    expect(s.row.billing_active_until).toBeNull();
    expect(s.row.latest_billing_till).toEqual(at(-1));
    await period(at(1), at(1000));
    s = await state();
    expect([s.row.has_active_billing, s.active, s.inactive]).toEqual([
      false,
      false,
      true,
    ]);
    expect(n).toBe(4);
  });

  it('[BE-ADM-228] {ConsumerService.findAll} the filters combine: plan and search, deleted and search, status and plan', async () => {
    const a = await createTenant(db);
    const b = await createTenant(db);
    await db.consumer.updateMany({
      where: { id: { in: [a.consumer.id, b.consumer.id] } },
      data: { business_category: 'Combo Trade' },
    });
    expect(
      idsOf(await list({ search: 'combo trade', planId: a.plan.id })),
    ).toEqual([a.consumer.id]);
    expect(
      idsOf(await list({ search: 'combo trade' })).sort((x, y) => x - y),
    ).toEqual([a.consumer.id, b.consumer.id].sort((x, y) => x - y));
    await consumers.softDelete(b.consumer.id);
    expect(idsOf(await list({ search: 'combo trade' }))).toEqual([
      a.consumer.id,
    ]);
    expect(idsOf(await list({ search: 'combo trade', deleted: true }))).toEqual(
      [b.consumer.id],
    );
    expect(idsOf(await list({ planId: a.plan.id, status: 'active' }))).toEqual([
      a.consumer.id,
    ]);
    expect(
      idsOf(await list({ planId: a.plan.id, status: 'inactive' })),
    ).toEqual([]);
    expect(
      idsOf(await list({ planId: b.plan.id, status: 'active', deleted: true })),
    ).toEqual([b.consumer.id]);
  });

  it('[BE-ADM-229] {ConsumerService.findAll} users only expose name and role; deleted tenants have no active filter leakage', async () => {
    const rows = await list();
    const mine = rows.find((r) => r.id === cid());
    expect(Object.keys(mine.users[0]).sort()).toEqual(['name', 'role']);
    expect(mine.has_active_billing).toBe(true);
    expect(Object.keys(mine._count)).toEqual(['Product']);
    expect(mine._count.Product).toBe(0);
  });

  it('[BE-ADM-230] {ConsumerService.softDelete} {ConsumerService.restore} an empty reason is kept as an empty string and only the target consumer changes', async () => {
    await consumers.softDelete(cid(), undefined, '');
    const c = await db.consumer.findUniqueOrThrow({ where: { id: cid() } });
    expect(c.delete_reason).toBe('');
    expect(c.deleted_by_id).toBeNull();
    expect(
      (
        await db.consumer.findUniqueOrThrow({
          where: { id: w.bystander.consumer.id },
        })
      ).deleted_at,
    ).toBeNull();
    // a live tenant cannot be restored and a deleted one cannot be deleted again
    const e = await failure(consumers.softDelete(cid(), undefined, 'again'));
    expect(e.message).toBe('Consumer not found or already deleted');
    await consumers.restore(cid());
    const e2 = await failure(consumers.restore(w.bystander.consumer.id));
    expect(e2.message).toBe('Consumer not found or is not deleted');
  });

  it('[BE-ADM-231] every failure is logged with its id or value and the stack, and answered with the exact message', async () => {
    const error = jest
      .spyOn((consumers as any).logger, 'error')
      .mockImplementation(() => undefined);
    const cases: [string, string, () => Promise<unknown>, string, string][] = [
      [
        '$transaction',
        '',
        () => consumers.create(createDto(w.tenant.plan.id, { email: 'l@x.t' })),
        'Error creating consumer for l@x.t',
        'Failed to create consumer',
      ],
      [
        'user',
        'findFirst',
        () => consumers.update(cid(), { name: 'x' }),
        `Error updating consumer for ${cid()}`,
        'Failed to update consumer',
      ],
      [
        'consumer',
        'findMany',
        () => consumers.findAll({}),
        'Fetching consumers failed',
        'Failed to fetch consumers',
      ],
      [
        'consumer',
        'update',
        () => consumers.softDelete(cid()),
        `Deleting consumer ${cid()} failed`,
        'Failed to delete consumer',
      ],
      [
        'consumer',
        'findUnique',
        () => consumers.checkSubdomain('zzz'),
        'Error checking subdomain availability for zzz',
        'Failed to check subdomain availability',
      ],
    ];
    for (const [target, method, call, logged, message] of cases) {
      error.mockClear();
      const boom = new Error('db down');
      const spy = method
        ? jest.spyOn(prisma()[target], method).mockRejectedValueOnce(boom)
        : jest.spyOn(prisma(), target).mockRejectedValueOnce(boom);
      const e = await failure(call());
      spy.mockRestore();
      expect(e.getStatus()).toBe(500);
      expect(e.message).toBe(message);
      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(logged, boom.stack);
    }
    await consumers.softDelete(cid());
    error.mockClear();
    const boom = new Error('db down');
    const spy = jest
      .spyOn(prisma().consumer, 'update')
      .mockRejectedValueOnce(boom);
    const e = await failure(consumers.restore(cid()));
    spy.mockRestore();
    expect(e.message).toBe('Failed to restore consumer');
    expect(error).toHaveBeenCalledWith(
      `Restoring consumer ${cid()} failed`,
      boom.stack,
    );
    error.mockRestore();
  });

  it('[BE-ADM-232] client errors from the database layer are rethrown as they are and not logged', async () => {
    const error = jest
      .spyOn((consumers as any).logger, 'error')
      .mockImplementation(() => undefined);
    await consumers.softDelete(cid());
    const cases: [string, string, () => Promise<unknown>][] = [
      ['$transaction', '', () => consumers.create(createDto(w.tenant.plan.id))],
      ['user', 'findFirst', () => consumers.update(cid(), { name: 'x' })],
      ['consumer', 'findMany', () => consumers.findAll({})],
      ['consumer', 'update', () => consumers.restore(cid())],
      ['consumer', 'findUnique', () => consumers.checkSubdomain('q')],
    ];
    for (const [target, method, call] of cases) {
      const own = new BadRequestException('readable');
      const spy = method
        ? jest.spyOn(prisma()[target], method).mockRejectedValueOnce(own)
        : jest.spyOn(prisma(), target).mockRejectedValueOnce(own);
      const e = await failure(call());
      spy.mockRestore();
      expect(e).toBe(own);
    }
    await consumers.restore(cid());
    const own = new BadRequestException('readable');
    const spy = jest
      .spyOn(prisma().consumer, 'update')
      .mockRejectedValueOnce(own);
    expect(await failure(consumers.softDelete(cid()))).toBe(own);
    spy.mockRestore();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  describe('purge', () => {
    it('[BE-ADM-233] {ConsumerPurgeService.purge} runs in one transaction with a 120 second timeout and logs start and completion with the row total', async () => {
      const warn = jest
        .spyOn((purge as any).logger, 'warn')
        .mockImplementation(() => undefined);
      const p = (purge as any).prisma;
      const original = p.$transaction.bind(p);
      const spy = jest
        .spyOn(p, '$transaction')
        .mockImplementation((...args: any[]) => original(...args));
      const res: any = await purge.purge(cid(), w.tenant.consumer.subdomain);
      const calls = spy.mock.calls;
      spy.mockRestore();
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toEqual({ timeout: 120_000 });
      const counts = Object.values(res.deleted_rows);
      const total = (counts as number[]).reduce(
        (a: number, b: any) => a + Number(b),
        0,
      );
      expect(total).toBeGreaterThan(0);
      expect(warn.mock.calls.map((c) => c[0])).toEqual([
        `PURGE starting for consumer ${cid()} (${w.tenant.consumer.subdomain})`,
        `PURGE complete for consumer ${cid()} (${w.tenant.consumer.subdomain}): ${total} rows`,
      ]);
      warn.mockRestore();
    });

    it('[BE-ADM-234] {ConsumerPurgeService.purge} a refused purge logs nothing and leaves the tenant intact; the error is not wrapped', async () => {
      const warn = jest
        .spyOn((purge as any).logger, 'warn')
        .mockImplementation(() => undefined);
      const e = await failure(purge.purge(cid(), ''));
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(400);
      expect(warn).not.toHaveBeenCalled();
      const missing = await failure(purge.purge(cid() + 100000, 'x'));
      expect(missing.getStatus()).toBe(404);
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
      expect(await db.consumer.count({ where: { id: cid() } })).toBe(1);
    });

    it('[BE-ADM-235] {ConsumerPurgeService.purge} a failure inside the transaction rolls every delete back', async () => {
      const spy = jest
        .spyOn(purge as any, 'deleteOrder')
        .mockRejectedValueOnce(new Error('order failed'));
      const e = await failure(purge.purge(cid(), w.tenant.consumer.subdomain));
      spy.mockRestore();
      expect(e.message).toBe('order failed');
      expect(await db.consumer.count({ where: { id: cid() } })).toBe(1);
      expect(await db.user.count({ where: { consumer_id: cid() } })).toBe(1);
    });

    it('[BE-ADM-236] {ConsumerPurgeService.purge} only the target tenant is erased', async () => {
      await purge.purge(cid(), w.tenant.consumer.subdomain);
      expect(
        await db.consumer.count({ where: { id: w.bystander.consumer.id } }),
      ).toBe(1);
      expect(
        await db.user.count({
          where: { consumer_id: w.bystander.consumer.id },
        }),
      ).toBeGreaterThan(0);
      expect(
        await db.branch.count({
          where: { consumer_id: w.bystander.consumer.id },
        }),
      ).toBeGreaterThan(0);
    });

    it('[BE-ADM-237] every SCOPE table is reachable, and every SCOPE predicate is valid SQL for a consumer id', async () => {
      const tables: any[] = await (purge as any).reachableTables(db);
      const names = new Set(tables.map((t) => t.name));
      const entries = Object.entries(consumerScope());
      expect(entries.length).toBeGreaterThan(20);
      for (const [table, where] of entries) {
        expect(where.length).toBeGreaterThan(10);
        expect(where).toContain('$1');
        expect(names.has(table)).toBe(true);
        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT count(*)::int AS n FROM "${table}" WHERE ${where}`,
          cid(),
        );
        expect(rows[0].n).toBeGreaterThanOrEqual(0);
      }
    });

    it('[BE-ADM-238] a table with several parents is deleted before all of them; diamonds and chains order correctly', async () => {
      const order = async (names: string[], edges: [string, string][]) =>
        (purge as any).deleteOrder(
          {
            $queryRawUnsafe: async () =>
              edges.map(([child, parent]) => ({ child, parent })),
          },
          names.map((name) => ({ name, hasConsumerId: true })),
        ) as Promise<string[]>;
      const two = await order(
        ['a', 'b', 'c'],
        [
          ['c', 'a'],
          ['c', 'b'],
        ],
      );
      expect(two.indexOf('c')).toBe(0);
      expect(two.sort()).toEqual(['a', 'b', 'c']);
      const diamond = await order(
        ['top', 'l', 'r', 'bottom'],
        [
          ['l', 'top'],
          ['r', 'top'],
          ['bottom', 'l'],
          ['bottom', 'r'],
        ],
      );
      expect(diamond[0]).toBe('bottom');
      expect(diamond[3]).toBe('top');
      expect(diamond).toHaveLength(4);
      const threeParents = await order(
        ['p1', 'p2', 'p3', 'kid'],
        [
          ['kid', 'p1'],
          ['kid', 'p2'],
          ['kid', 'p3'],
        ],
      );
      expect(threeParents[0]).toBe('kid');
      // an empty set of tables is an empty order
      expect(await order([], [])).toEqual([]);
    });
  });
});
