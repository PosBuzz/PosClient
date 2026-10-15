import { HttpException } from '@nestjs/common';
import { expectGenericWrapping } from '../../../../test/helpers/error-wrapping';
import { PlanService } from './plan.service';

function setup() {
  const tx: any = {
    planPermission: { findMany: jest.fn(), deleteMany: jest.fn() },
    consumer: { findMany: jest.fn() },
    rolePermission: {
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    plan: { update: jest.fn() },
  };
  const prisma: any = {
    plan: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    permission: { findMany: jest.fn() },
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
  };
  return { prisma, tx, service: new PlanService(prisma) };
}

const permissionsInclude = {
  permissions: { include: { permission: true } },
};

describe('PlanService (unit)', () => {
  it('[BE-MUT-270] create connects each permission id and defaults the product cap to null', async () => {
    const { prisma, service } = setup();
    prisma.plan.create.mockResolvedValue({ id: 1 });
    await expect(
      service.create({ name: 'P', price: 10, permission_ids: [3, 4] } as any),
    ).resolves.toEqual({ id: 1 });
    expect(prisma.plan.create).toHaveBeenCalledWith({
      data: {
        name: 'P',
        price: 10,
        max_products: null,
        permissions: {
          create: [
            { permission: { connect: { id: 3 } } },
            { permission: { connect: { id: 4 } } },
          ],
        },
      },
    });
    await service.create({
      name: 'P',
      price: 10,
      max_products: 50,
      permission_ids: [],
    });
    expect(prisma.plan.create.mock.lastCall![0].data.max_products).toBe(50);
    await service.create({
      name: 'P',
      price: 10,
      max_products: 0,
      permission_ids: [],
    });
    expect(prisma.plan.create.mock.lastCall![0].data.max_products).toBe(0);
  });

  it('[BE-MUT-271] findAll and findOne load permissions; findAll is ordered by id', async () => {
    const { prisma, service } = setup();
    prisma.plan.findMany.mockResolvedValue([{ id: 1 }]);
    await expect(service.findAll()).resolves.toEqual([{ id: 1 }]);
    expect(prisma.plan.findMany).toHaveBeenCalledWith({
      include: permissionsInclude,
      orderBy: { id: 'asc' },
    });
    prisma.plan.findUnique.mockResolvedValue({ id: 2 });
    await expect(service.findOne(2)).resolves.toEqual({ id: 2 });
    expect(prisma.plan.findUnique).toHaveBeenCalledWith({
      where: { id: 2 },
      include: permissionsInclude,
    });
  });

  it('[BE-MUT-272] findOne of a missing plan is a plain 404 and the permission catalogue is ordered by id', async () => {
    const { prisma, service } = setup();
    prisma.plan.findUnique.mockResolvedValue(null);
    const error = await service.findOne(2).catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(404);
    expect(error.message).toBe('Plan not found');
    prisma.permission.findMany.mockResolvedValue([{ id: 1 }]);
    await expect(service.findAllPermissions()).resolves.toEqual([{ id: 1 }]);
    expect(prisma.permission.findMany).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
    });
  });

  it('[BE-MUT-273] remove deletes only that plan and reports success', async () => {
    const { prisma, service } = setup();
    prisma.plan.delete.mockResolvedValue({});
    await expect(service.remove(4)).resolves.toEqual({ success: true });
    expect(prisma.plan.delete).toHaveBeenCalledWith({ where: { id: 4 } });
  });

  it('[BE-MUT-274] unexpected failures are logged with the plan and hidden behind generic 500s; client errors pass through', async () => {
    const wrap = (
      arrange: (ctx: ReturnType<typeof setup>, f: unknown) => void,
      call: (s: PlanService) => Promise<unknown>,
      message: string,
      logged: string,
    ) =>
      expectGenericWrapping({
        run: (f) => {
          const ctx = setup();
          arrange(ctx, f);
          return call(ctx.service);
        },
        message,
        logged: [logged],
      });
    await wrap(
      (c, f) => c.prisma.plan.create.mockRejectedValue(f),
      (s) => s.create({ name: 'P', price: 1, permission_ids: [] }),
      'Failed to create plan',
      'Plan creation failed',
    );
    await wrap(
      (c, f) => c.prisma.plan.findMany.mockRejectedValue(f),
      (s) => s.findAll(),
      'Failed to fetch plans',
      'Fetching plans failed',
    );
    await wrap(
      (c, f) => c.prisma.plan.findUnique.mockRejectedValue(f),
      (s) => s.findOne(7),
      'Failed to fetch plan',
      'Fetching plan 7 failed',
    );
    await wrap(
      (c, f) => c.prisma.$transaction.mockRejectedValue(f),
      (s) => s.update(7, { name: 'x' }),
      'Failed to update plan',
      'Updating plan 7 failed',
    );
    await wrap(
      (c, f) => c.prisma.permission.findMany.mockRejectedValue(f),
      (s) => s.findAllPermissions(),
      'Failed to fetch permissions',
      'Fetching permissions failed',
    );
    await wrap(
      (c, f) => c.prisma.plan.delete.mockRejectedValue(f),
      (s) => s.remove(7),
      'Failed to delete plan',
      'Deleting plan 7 failed',
    );
  });

  describe('update', () => {
    it('[BE-MUT-275] without permission ids only the basic fields are updated and no permission work happens', async () => {
      const { tx, service } = setup();
      tx.plan.update.mockResolvedValue({ id: 5 });
      await expect(
        service.update(5, { name: 'Renamed', price: 20 } as any),
      ).resolves.toEqual({ id: 5 });
      expect(tx.plan.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { name: 'Renamed', price: 20 },
      });
      expect(tx.planPermission.findMany).not.toHaveBeenCalled();
      expect(tx.planPermission.deleteMany).not.toHaveBeenCalled();
    });

    it('[BE-MUT-276] an empty permission list is a real request: every plan permission is removed from tenant roles', async () => {
      const { tx, service } = setup();
      tx.planPermission.findMany.mockResolvedValue([
        { permission_id: 1 },
        { permission_id: 2 },
      ]);
      tx.consumer.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }]);
      tx.plan.update.mockResolvedValue({ id: 5 });
      await service.update(5, { permission_ids: [] });
      expect(tx.planPermission.findMany).toHaveBeenCalledWith({
        where: { plan_id: 5 },
        select: { permission_id: true },
      });
      expect(tx.planPermission.deleteMany).toHaveBeenCalledWith({
        where: { plan_id: 5 },
      });
      expect(tx.consumer.findMany).toHaveBeenCalledWith({
        where: { plan_id: 5 },
        select: { id: true },
      });
      expect(tx.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: {
          permission_id: { in: [1, 2] },
          role: { consumer_id: { in: [10, 11] } },
        },
      });
      expect(tx.plan.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { permissions: { create: [] } },
      });
    });

    it('[BE-MUT-277] only permissions that left the plan are revoked, and nothing is revoked when none left or no tenant uses the plan', async () => {
      const unchanged = setup();
      unchanged.tx.planPermission.findMany.mockResolvedValue([
        { permission_id: 1 },
      ]);
      await unchanged.service.update(5, { permission_ids: [1] });
      expect(unchanged.tx.consumer.findMany).not.toHaveBeenCalled();
      expect(unchanged.tx.rolePermission.deleteMany).not.toHaveBeenCalled();

      const noTenants = setup();
      noTenants.tx.planPermission.findMany.mockResolvedValue([
        { permission_id: 1 },
        { permission_id: 2 },
      ]);
      noTenants.tx.consumer.findMany.mockResolvedValue([]);
      await noTenants.service.update(5, { permission_ids: [2] });
      expect(noTenants.tx.rolePermission.deleteMany).not.toHaveBeenCalled();

      const partial = setup();
      partial.tx.planPermission.findMany.mockResolvedValue([
        { permission_id: 1 },
        { permission_id: 2 },
      ]);
      partial.tx.consumer.findMany.mockResolvedValue([{ id: 10, roles: [] }]);
      await partial.service.update(5, { permission_ids: [2, 3] });
      expect(partial.tx.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: {
          permission_id: { in: [1] },
          role: { consumer_id: { in: [10] } },
        },
      });
    });

    it('[BE-MUT-278] new permissions are granted to each tenant Admin role once, skipping ones it already has and tenants without an Admin role', async () => {
      const { tx, service } = setup();
      tx.planPermission.findMany.mockResolvedValue([{ permission_id: 1 }]);
      tx.consumer.findMany.mockResolvedValue([
        { id: 10, roles: [{ id: 100 }] },
        { id: 11, roles: [] },
      ]);
      tx.rolePermission.findFirst.mockImplementation(async ({ where }: any) =>
        where.permission_id === 3 ? { id: 1 } : null,
      );
      await service.update(5, {
        name: 'n',
        permission_ids: [1, 2, 3],
      });
      expect(tx.consumer.findMany).toHaveBeenCalledWith({
        where: { plan_id: 5 },
        include: {
          roles: {
            where: { name: 'Admin', is_admin: true },
            select: { id: true },
          },
        },
      });
      expect(tx.rolePermission.findFirst).toHaveBeenCalledTimes(2);
      expect(tx.rolePermission.findFirst).toHaveBeenCalledWith({
        where: { role_id: 100, permission_id: 2 },
      });
      expect(tx.rolePermission.create).toHaveBeenCalledTimes(1);
      expect(tx.rolePermission.create).toHaveBeenCalledWith({
        data: { role_id: 100, permission_id: 2 },
      });
      expect(tx.rolePermission.deleteMany).not.toHaveBeenCalled();
      expect(tx.plan.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: {
          name: 'n',
          permissions: {
            create: [1, 2, 3].map((id) => ({
              permission: { connect: { id } },
            })),
          },
        },
      });
    });

    it('[BE-MUT-279] an unchanged permission list never loads tenants for granting', async () => {
      const { tx, service } = setup();
      tx.planPermission.findMany.mockResolvedValue([
        { permission_id: 1 },
        { permission_id: 2 },
      ]);
      await service.update(5, { permission_ids: [2, 1] });
      expect(tx.consumer.findMany).not.toHaveBeenCalled();
      expect(tx.rolePermission.create).not.toHaveBeenCalled();
    });
  });
});
