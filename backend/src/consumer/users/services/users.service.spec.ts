import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { expectGenericWrapping } from '../../../../test/helpers/error-wrapping';
import { UsersService } from './users.service';

jest.mock('bcryptjs', () => ({ hash: jest.fn(async () => 'HASHED') }));

function setup() {
  const mk = (...names: string[]) =>
    Object.fromEntries(names.map((n) => [n, jest.fn()]));
  const tx: any = {
    user: mk('create', 'update', 'findUnique'),
    userBranch: mk('createMany', 'deleteMany'),
    role: mk('findUnique'),
    branch: mk('findMany'),
  };
  const prisma: any = {
    planPermission: mk('findMany', 'count'),
    role: mk(
      'findMany',
      'findFirst',
      'findUnique',
      'create',
      'update',
      'delete',
    ),
    rolePermission: mk('deleteMany', 'createMany'),
    branch: mk('count'),
    consumer: mk('findUnique'),
    user: mk('findMany', 'findFirst', 'delete'),
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
  };
  return { prisma, tx, service: new UsersService(prisma) };
}

describe('UsersService (unit)', () => {
  beforeEach(() => (bcryptjs.hash as jest.Mock).mockClear());

  it('[BE-MUT-370] permissionOptions maps the plan permissions to label/value pairs', async () => {
    const { prisma, service } = setup();
    prisma.planPermission.findMany.mockResolvedValue([
      { permission: { action: 'sales.create', id: 4 } },
    ]);
    await expect(service.permissionOptions(2)).resolves.toEqual([
      { label: 'sales.create', value: 4 },
    ]);
    expect(prisma.planPermission.findMany).toHaveBeenCalledWith({
      where: { plan_id: 2 },
      include: { permission: true },
    });
  });

  it('[BE-MUT-371] getRoles and createRole load role permissions; createRole checks the plan first', async () => {
    const { prisma, service } = setup();
    prisma.role.findMany.mockResolvedValue([{ id: 1 }]);
    await expect(service.getRoles(5)).resolves.toEqual([{ id: 1 }]);
    expect(prisma.role.findMany).toHaveBeenCalledWith({
      where: { consumer_id: 5 },
      include: { permissions: { include: { permission: true } } },
    });
    prisma.consumer.findUnique.mockResolvedValue({ plan_id: 9 });
    prisma.planPermission.count.mockResolvedValue(2);
    prisma.role.create.mockResolvedValue({ id: 3 });
    await expect(
      service.createRole(
        { name: 'Cashier', permission_ids: [1, 2, 2] } as any,
        5,
      ),
    ).resolves.toEqual({ id: 3 });
    expect(prisma.consumer.findUnique).toHaveBeenCalledWith({
      where: { id: 5 },
      select: { plan_id: true },
    });
    expect(prisma.planPermission.count).toHaveBeenCalledWith({
      where: { plan_id: 9, permission_id: { in: [1, 2] } },
    });
    expect(prisma.role.create).toHaveBeenCalledWith({
      data: {
        consumer_id: 5,
        name: 'Cashier',
        permissions: {
          create: [
            { permission_id: 1 },
            { permission_id: 2 },
            { permission_id: 2 },
          ],
        },
      },
      include: { permissions: { include: { permission: true } } },
    });
  });

  it('[BE-MUT-372] a role with a permission outside the plan is a 400 and is not created; no permissions skips the plan lookup', async () => {
    const { prisma, service } = setup();
    prisma.consumer.findUnique.mockResolvedValue({ plan_id: 9 });
    prisma.planPermission.count.mockResolvedValue(1);
    const error = await service
      .createRole({ name: 'X', permission_ids: [1, 2] } as any, 5)
      .catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe(
      'One or more permissions are not included in your plan',
    );
    expect(prisma.role.create).not.toHaveBeenCalled();
    const none = setup();
    none.prisma.role.create.mockResolvedValue({});
    await none.service.createRole({ name: 'X', permission_ids: [] }, 5);
    expect(none.prisma.consumer.findUnique).not.toHaveBeenCalled();
  });

  it('[BE-MUT-373] a plan-less consumer cannot grant anything', async () => {
    const { prisma, service } = setup();
    prisma.consumer.findUnique.mockResolvedValue(null);
    prisma.planPermission.count.mockResolvedValue(0);
    await expect(
      service.createRole({ name: 'X', permission_ids: [1] } as any, 5),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.planPermission.count).toHaveBeenCalledWith({
      where: { plan_id: undefined, permission_id: { in: [1] } },
    });
  });

  it('[BE-MUT-374] deleteRole and deleteUser are tenant scoped', async () => {
    const { prisma, service } = setup();
    prisma.role.findFirst.mockResolvedValue({
      is_admin: false,
      _count: { users: 0 },
    });
    prisma.role.delete.mockResolvedValue({ id: 1 });
    prisma.user.delete.mockResolvedValue({ id: 2 });
    await expect(service.deleteRole(1, 5)).resolves.toEqual({ id: 1 });
    await expect(service.deleteUser(2, 5)).resolves.toEqual({ id: 2 });
    expect(prisma.role.delete).toHaveBeenCalledWith({
      where: { consumer_id: 5, id: 1 },
    });
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { consumer_id: 5, id: 2 },
    });
  });

  it('[BE-USR-012] a role that still has users, the Admin role, or a role of another shop is never deleted', async () => {
    const { prisma, service } = setup();
    prisma.role.findFirst.mockResolvedValue({
      is_admin: false,
      _count: { users: 2 },
    });
    await expect(service.deleteRole(1, 5)).rejects.toThrow(
      'This role is still assigned to 2 user(s). Move them to another role first.',
    );
    prisma.role.findFirst.mockResolvedValue({
      is_admin: true,
      _count: { users: 0 },
    });
    await expect(service.deleteRole(1, 5)).rejects.toThrow(
      'The Admin role cannot be deleted',
    );
    prisma.role.findFirst.mockResolvedValue(null);
    await expect(service.deleteRole(9, 5)).rejects.toThrow('Role not found');
    expect(prisma.role.findFirst).toHaveBeenLastCalledWith({
      where: { consumer_id: 5, id: 9 },
      select: { is_admin: true, _count: { select: { users: true } } },
    });
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  describe('getUsers', () => {
    const user = { id: 1, password: 'h', refresh_token: 'r', name: 'A' };

    it('[BE-MUT-375] users never leave with their password or refresh token', async () => {
      const { prisma, service } = setup();
      prisma.user.findMany.mockResolvedValue([user]);
      await expect(service.getUsers(5)).resolves.toEqual([
        { id: 1, name: 'A' },
      ]);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { consumer_id: 5 },
        include: { role: true, branches: { include: { branch: true } } },
      });
    });

    it('[BE-MUT-376] search matches name or email case-insensitively; role and branch filters are added when given', async () => {
      const { prisma, service } = setup();
      prisma.user.findMany.mockResolvedValue([]);
      await service.getUsers(5, 'ann', 2, 3);
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({
        consumer_id: 5,
        OR: [
          { name: { contains: 'ann', mode: 'insensitive' } },
          { email: { contains: 'ann', mode: 'insensitive' } },
        ],
        role_id: 2,
        branches: { some: { branch_id: 3 } },
      });
      await service.getUsers(5, null);
      expect(prisma.user.findMany.mock.lastCall![0].where).toEqual({
        consumer_id: 5,
      });
    });
  });

  describe('createUser', () => {
    const dto = {
      email: 'a@x.io',
      name: 'Ann',
      password: 'pw',
      role_id: 3,
    };
    const arrange = () => {
      const ctx = setup();
      ctx.prisma.role.findFirst.mockResolvedValue({ id: 3 });
      ctx.prisma.branch.count.mockResolvedValue(2);
      ctx.tx.user.create.mockResolvedValue({ id: 50 });
      ctx.tx.user.findUnique.mockResolvedValue({
        id: 50,
        password: 'h',
        refresh_token: 'r',
      });
      return ctx;
    };

    it('[BE-MUT-377] the user is created with a hashed password and returned with branches but without secrets', async () => {
      const { prisma, tx, service } = arrange();
      await expect(
        service.createUser({ ...dto, branch_ids: [7, 8] } as any, 5),
      ).resolves.toEqual({ id: 50 });
      expect(bcryptjs.hash).toHaveBeenCalledWith('pw', 10);
      expect(prisma.role.findFirst).toHaveBeenCalledWith({
        where: { id: 3, consumer_id: 5 },
        select: { id: true },
      });
      expect(prisma.branch.count).toHaveBeenCalledWith({
        where: { id: { in: [7, 8] }, consumer_id: 5 },
      });
      expect(tx.user.create).toHaveBeenCalledWith({
        data: {
          consumer_id: 5,
          email: 'a@x.io',
          name: 'Ann',
          password: 'HASHED',
          role_id: 3,
        },
        include: { role: true },
      });
      expect(tx.userBranch.createMany).toHaveBeenCalledWith({
        data: [
          { user_id: 50, branch_id: 7 },
          { user_id: 50, branch_id: 8 },
        ],
      });
      expect(tx.user.findUnique).toHaveBeenCalledWith({
        where: { id: 50 },
        include: { role: true, branches: { include: { branch: true } } },
      });
      expect(tx.role.findUnique).not.toHaveBeenCalled();
    });

    it('[BE-MUT-378] without branches an admin user gets every branch of the shop; a non-admin gets none', async () => {
      const admin = arrange();
      admin.tx.role.findUnique.mockResolvedValue({ is_admin: true });
      admin.tx.branch.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      await admin.service.createUser({ ...dto, branch_ids: [] }, 5);
      expect(admin.tx.role.findUnique).toHaveBeenCalledWith({
        where: { id: 3 },
        select: { is_admin: true },
      });
      expect(admin.tx.branch.findMany).toHaveBeenCalledWith({
        where: { consumer_id: 5 },
        select: { id: true },
      });
      expect(admin.tx.userBranch.createMany).toHaveBeenCalledWith({
        data: [
          { user_id: 50, branch_id: 1 },
          { user_id: 50, branch_id: 2 },
        ],
      });
      const staff = arrange();
      staff.tx.role.findUnique.mockResolvedValue({ is_admin: false });
      await staff.service.createUser(dto, 5);
      expect(staff.tx.branch.findMany).not.toHaveBeenCalled();
      expect(staff.tx.userBranch.createMany).not.toHaveBeenCalled();
      const noBranches = arrange();
      noBranches.tx.role.findUnique.mockResolvedValue({ is_admin: true });
      noBranches.tx.branch.findMany.mockResolvedValue([]);
      await noBranches.service.createUser(dto, 5);
      expect(noBranches.tx.userBranch.createMany).not.toHaveBeenCalled();
    });

    it('[BE-MUT-379] a role or branch from another shop is a 404 before anything is hashed or written', async () => {
      const foreignRole = arrange();
      foreignRole.prisma.role.findFirst.mockResolvedValue(null);
      await expect(
        foreignRole.service.createUser(dto as any, 5),
      ).rejects.toThrow(new NotFoundException('Role not found'));
      const foreignBranch = arrange();
      foreignBranch.prisma.branch.count.mockResolvedValue(1);
      await expect(
        foreignBranch.service.createUser(
          { ...dto, branch_ids: [7, 8] } as any,
          5,
        ),
      ).rejects.toThrow(new NotFoundException('Branch not found'));
      expect(bcryptjs.hash).not.toHaveBeenCalled();
      expect(foreignBranch.prisma.$transaction).not.toHaveBeenCalled();
    });

    it('[BE-MUT-380] a missing role id skips the role check; duplicate branch ids are counted once', async () => {
      const ctx = arrange();
      ctx.prisma.branch.count.mockResolvedValue(1);
      await ctx.service.createUser(
        { ...dto, role_id: undefined, branch_ids: [7, 7] } as any,
        5,
      );
      expect(ctx.prisma.role.findFirst).not.toHaveBeenCalled();
      expect(ctx.prisma.branch.count).toHaveBeenCalledWith({
        where: { id: { in: [7] }, consumer_id: 5 },
      });
      const none = arrange();
      await none.service.createUser({ ...dto, branch_ids: [] }, 5);
      expect(none.prisma.branch.count).not.toHaveBeenCalled();
    });

    it('[BE-MUT-381] a user that vanishes before the final read yields null', async () => {
      const ctx = arrange();
      ctx.tx.user.findUnique.mockResolvedValue(null);
      await expect(ctx.service.createUser(dto as any, 5)).resolves.toBeNull();
    });
  });

  describe('updateRole', () => {
    it('[BE-MUT-382] updating a role checks ownership and plan, renames it and replaces its permissions', async () => {
      const { prisma, service } = setup();
      prisma.role.findFirst.mockResolvedValue({ id: 3 });
      prisma.consumer.findUnique.mockResolvedValue({ plan_id: 9 });
      prisma.planPermission.count.mockResolvedValue(2);
      prisma.role.update.mockResolvedValue({ id: 3, name: 'New' });
      await expect(
        service.updateRole(
          3,
          { name: 'New', permission_ids: [1, 2] } as any,
          5,
        ),
      ).resolves.toEqual({ id: 3, name: 'New' });
      expect(prisma.role.findFirst).toHaveBeenCalledWith({
        where: { id: 3, consumer_id: 5 },
        select: { id: true },
      });
      expect(prisma.role.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { name: 'New' },
      });
      expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { role_id: 3 },
      });
      expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
        data: [
          { role_id: 3, permission_id: 1 },
          { role_id: 3, permission_id: 2 },
        ],
      });
    });

    it('[BE-MUT-383] without permission ids the permissions are left alone; a foreign role is a 404', async () => {
      const { prisma, service } = setup();
      prisma.role.findFirst.mockResolvedValue({ id: 3 });
      prisma.role.update.mockResolvedValue({ id: 3 });
      await service.updateRole(3, { name: 'New' }, 5);
      expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
      expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
      prisma.role.findFirst.mockResolvedValue(null);
      await expect(
        service.updateRole(3, { name: 'x' } as any, 5),
      ).rejects.toThrow(new NotFoundException('Role not found'));
      expect(prisma.role.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateUser', () => {
    const arrange = () => {
      const ctx = setup();
      ctx.prisma.user.findFirst.mockResolvedValue({ id: 6 });
      ctx.prisma.role.findFirst.mockResolvedValue({ id: 3 });
      ctx.prisma.branch.count.mockResolvedValue(1);
      ctx.tx.user.update.mockResolvedValue({
        id: 6,
        consumer_id: 5,
        role: { id: 2 },
      });
      ctx.tx.user.findUnique.mockResolvedValue({
        id: 6,
        password: 'h',
        refresh_token: 'r',
      });
      return ctx;
    };

    it('[BE-MUT-384] an unknown or foreign user is a 404 before anything else happens', async () => {
      const { prisma, service } = arrange();
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.updateUser(6, {} as any, 5)).rejects.toThrow(
        new NotFoundException('User not found'),
      );
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 6, consumer_id: 5 },
        select: { id: true },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('[BE-MUT-385] the update hashes a given password, selects only safe columns and returns the user without secrets', async () => {
      const { tx, service } = arrange();
      await expect(
        service.updateUser(
          6,
          {
            email: 'n@x.io',
            name: 'N',
            password: 'pw',
            role_id: 3,
            branch_ids: [],
          } as any,
          5,
        ),
      ).resolves.toEqual({ id: 6 });
      expect(bcryptjs.hash).toHaveBeenCalledWith('pw', 10);
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 6 },
        data: { email: 'n@x.io', name: 'N', password: 'HASHED', role_id: 3 },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          consumer_id: true,
        },
      });
      expect(tx.user.findUnique).toHaveBeenCalledWith({
        where: { id: 6 },
        include: { role: true, branches: { include: { branch: true } } },
      });
      const keep = arrange();
      await keep.service.updateUser(6, { name: 'N', branch_ids: [] }, 5);
      expect(bcryptjs.hash).toHaveBeenCalledTimes(1);
      expect(
        keep.tx.user.update.mock.calls[0][0].data.password,
      ).toBeUndefined();
    });

    it('[BE-MUT-386] explicit branch ids replace the assignments; an empty list only clears them', async () => {
      const set = arrange();
      set.prisma.branch.count.mockResolvedValue(2);
      await set.service.updateUser(6, { branch_ids: [7, 8] }, 5);
      expect(set.tx.userBranch.deleteMany).toHaveBeenCalledWith({
        where: { user_id: 6 },
      });
      expect(set.tx.userBranch.createMany).toHaveBeenCalledWith({
        data: [
          { user_id: 6, branch_id: 7 },
          { user_id: 6, branch_id: 8 },
        ],
      });
      expect(set.tx.role.findUnique).not.toHaveBeenCalled();
      const clear = arrange();
      await clear.service.updateUser(6, { branch_ids: [] }, 5);
      expect(clear.tx.userBranch.deleteMany).toHaveBeenCalledTimes(1);
      expect(clear.tx.userBranch.createMany).not.toHaveBeenCalled();
    });

    it('[BE-MUT-387] without branch ids an admin role re-gets every shop branch (role from the dto, else the current one); other roles are untouched', async () => {
      const admin = arrange();
      admin.tx.role.findUnique.mockResolvedValue({ is_admin: true });
      admin.tx.branch.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      await admin.service.updateUser(6, { role_id: 3 }, 5);
      expect(admin.tx.role.findUnique).toHaveBeenCalledWith({
        where: { id: 3 },
        select: { is_admin: true },
      });
      expect(admin.tx.userBranch.deleteMany).toHaveBeenCalledWith({
        where: { user_id: 6 },
      });
      expect(admin.tx.branch.findMany).toHaveBeenCalledWith({
        where: { consumer_id: 5 },
        select: { id: true },
      });
      expect(admin.tx.userBranch.createMany).toHaveBeenCalledWith({
        data: [
          { user_id: 6, branch_id: 1 },
          { user_id: 6, branch_id: 2 },
        ],
      });
      const current = arrange();
      current.tx.role.findUnique.mockResolvedValue({ is_admin: false });
      await current.service.updateUser(6, { name: 'x' }, 5);
      expect(current.tx.role.findUnique).toHaveBeenCalledWith({
        where: { id: 2 },
        select: { is_admin: true },
      });
      expect(current.tx.userBranch.deleteMany).not.toHaveBeenCalled();
      expect(current.tx.branch.findMany).not.toHaveBeenCalled();
      const empty = arrange();
      empty.tx.role.findUnique.mockResolvedValue({ is_admin: true });
      empty.tx.branch.findMany.mockResolvedValue([]);
      await empty.service.updateUser(6, { name: 'x' }, 5);
      expect(empty.tx.userBranch.createMany).not.toHaveBeenCalled();
    });

    it('[BE-MUT-388] a user that vanishes before the final read yields null', async () => {
      const ctx = arrange();
      ctx.tx.user.findUnique.mockResolvedValue(null);
      await expect(
        ctx.service.updateUser(6, { branch_ids: [] } as any, 5),
      ).resolves.toBeNull();
    });
  });

  it('[BE-MUT-389] unexpected failures are logged with their ids and hidden behind generic 500s', async () => {
    const wrap = (
      arrange: (c: ReturnType<typeof setup>, f: unknown) => void,
      call: (s: UsersService) => Promise<unknown>,
      message: string,
      logged: string,
      notFound = false,
    ) =>
      expectGenericWrapping({
        run: (f) => {
          const c = setup();
          arrange(c, f);
          return call(c.service);
        },
        message,
        logged: [logged],
        notFoundPassesThrough: notFound,
      });
    await wrap(
      (c, f) => c.prisma.planPermission.findMany.mockRejectedValue(f),
      (s) => s.permissionOptions(2),
      'Failed to fetch permission options',
      'Error fetching permission options for plan 2',
    );
    await wrap(
      (c, f) => c.prisma.role.findMany.mockRejectedValue(f),
      (s) => s.getRoles(5),
      'Failed to fetch roles',
      'Error fetching roles for consumer 5',
    );
    await wrap(
      (c, f) => {
        c.prisma.role.findFirst.mockResolvedValue({
          is_admin: false,
          _count: { users: 0 },
        });
        c.prisma.role.delete.mockRejectedValue(f);
      },
      (s) => s.deleteRole(1, 5),
      'Failed to delete role',
      'Error deleting role with ID 1 for consumer 5',
    );
    await wrap(
      (c, f) => c.prisma.role.create.mockRejectedValue(f),
      (s) => s.createRole({ name: 'x', permission_ids: [] }, 5),
      'Failed to create role',
      'Error creating role for consumer 5',
    );
    await wrap(
      (c, f) => c.prisma.user.findMany.mockRejectedValue(f),
      (s) => s.getUsers(5),
      'Failed to fetch users',
      'Error fetching users for consumer 5',
    );
    await wrap(
      (c, f) => c.prisma.user.delete.mockRejectedValue(f),
      (s) => s.deleteUser(2, 5),
      'Failed to delete user',
      'Error deleting user with ID 2 for consumer 5',
    );
    await wrap(
      (c, f) => c.prisma.$transaction.mockRejectedValue(f),
      (s) => s.createUser({ email: 'a', name: 'b', password: 'p' } as any, 5),
      'Failed to create user',
      'Error creating user for consumer 5',
      true,
    );
    await wrap(
      (c, f) => {
        c.prisma.role.findFirst.mockResolvedValue({ id: 3 });
        c.prisma.role.update.mockRejectedValue(f);
      },
      (s) => s.updateRole(3, { name: 'x' }, 5),
      'Failed to update role',
      'Error updating role with ID 3',
    );
    await wrap(
      (c, f) => {
        c.prisma.user.findFirst.mockResolvedValue({ id: 6 });
        c.prisma.$transaction.mockRejectedValue(f);
      },
      (s) => s.updateUser(6, { name: 'x' }, 5),
      'Failed to update user',
      'Error updating user with ID 6',
      true,
    );
  });
});
