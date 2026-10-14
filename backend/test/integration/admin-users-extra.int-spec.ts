import { BadRequestException, HttpException } from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, bootDomain, newWorld } from '../helpers/domain';
import { createAdmin } from '../factories';
import { UsersService } from '../../src/admin/users/services/users.service';

describe('super-admin users and roles (extra, adversarial)', () => {
  const db = getPrisma();
  let boot: Boot;
  let admins: UsersService;

  beforeAll(async () => {
    boot = await bootDomain();
    admins = boot.get(UsersService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  let w: Awaited<ReturnType<typeof newWorld>>;
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());

  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );
  const prisma = () => (admins as any).prisma;
  const permissionIds = async (n: number) =>
    (await db.superAdminPermission.findMany({ orderBy: { id: 'asc' } }))
      .slice(0, n)
      .map((p) => p.id);
  const roleWith = async (name: string, n = 2) => {
    await createAdmin(db);
    return db.superAdminRole.create({
      data: {
        name,
        permissions: {
          create: (await permissionIds(n)).map((permission_id) => ({
            permission_id,
          })),
        },
      },
    });
  };
  const mkUser = (role_id: number, extra: object = {}) =>
    admins.createUser({
      email: `u${Math.random().toString(36).slice(2)}@example.test`,
      name: 'Someone',
      password: 'Secret!234',
      role_id,
      ...extra,
    }) as Promise<any>;
  const COST_10 = /^\$2[aby]\$10\$/;

  it('[BE-ADM-201] {AdminUsersService.createUser} {AdminUsersService.updateUser} {AdminUsersService.changePassword} passwords are hashed with bcrypt cost 10', async () => {
    const role = await roleWith('Cost');
    const u = await mkUser(role.id);
    const read = async () =>
      (await db.superAdmin.findUniqueOrThrow({ where: { id: u.id } })).password;
    expect(await read()).toMatch(COST_10);
    await admins.updateUser(u.id, { password: 'Another!234' });
    const afterUpdate = await read();
    expect(afterUpdate).toMatch(COST_10);
    expect(afterUpdate).not.toContain('Another!234');
    await admins.changePassword(u.id, 'Another!234', 'Third!2345');
    const afterChange = await read();
    expect(afterChange).toMatch(COST_10);
    expect(afterChange).not.toBe(afterUpdate);
    expect(await bcryptjs.compare('Third!2345', afterChange)).toBe(true);
  });

  it('[BE-ADM-202] {AdminUsersService.updateRole} only the target role permissions are replaced, each new link belongs to that role', async () => {
    const a = await roleWith('A', 2);
    const b = await roleWith('B', 3);
    const ids = await permissionIds(5);
    await admins.updateRole(a.id, {
      name: 'A2',
      permission_ids: [ids[3], ids[4]],
    });
    const rowsA = await db.superAdminRolePermission.findMany({
      where: { role_id: a.id },
    });
    expect(rowsA.map((r) => r.permission_id).sort((x, y) => x - y)).toEqual([
      ids[3],
      ids[4],
    ]);
    expect(
      await db.superAdminRolePermission.count({ where: { role_id: b.id } }),
    ).toBe(3);
    const untouched = await db.superAdminRole.findUniqueOrThrow({
      where: { id: b.id },
    });
    expect(untouched.name).toBe('B');
    expect(
      (await db.superAdminRole.findUniqueOrThrow({ where: { id: a.id } })).name,
    ).toBe('A2');
  });

  it('[BE-ADM-203] {AdminUsersService.updateRole} a failure while replacing permissions is a generic 500', async () => {
    const role = await roleWith('Fail');
    for (const method of ['deleteMany', 'createMany'] as const) {
      const spy = jest
        .spyOn(prisma().superAdminRolePermission, method)
        .mockRejectedValueOnce(new Error('db down'));
      const e = await failure(
        admins.updateRole(role.id, { name: 'x', permission_ids: [] }),
      );
      spy.mockRestore();
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(500);
      expect(e.message).toBe('Failed to update super admin role');
    }
  });

  it('[BE-ADM-204] {AdminUsersService.updateUser} only the target user changes and untouched fields keep their value', async () => {
    const r1 = await roleWith('One');
    const r2 = await roleWith('Two');
    const target = await mkUser(r1.id, { name: 'T', email: 't@x.test' });
    const other = await mkUser(r1.id, { name: 'O', email: 'o@x.test' });
    const otherBefore = await db.superAdmin.findUniqueOrThrow({
      where: { id: other.id },
    });
    const res: any = await admins.updateUser(target.id, { role_id: r2.id });
    expect(res).toMatchObject({ id: target.id, name: 'T', email: 't@x.test' });
    expect(res.role.id).toBe(r2.id);
    expect(res.role.name).toBe('Two');
    await admins.updateUser(target.id, { email: 'new@x.test' });
    const t = await db.superAdmin.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(t).toMatchObject({
      email: 'new@x.test',
      name: 'T',
      role_id: r2.id,
    });
    expect(
      await db.superAdmin.findUniqueOrThrow({ where: { id: other.id } }),
    ).toEqual(otherBefore);
  });

  it('[BE-ADM-205] {AdminUsersService.changePassword} only the given user password changes and an empty old password is refused', async () => {
    const role = await roleWith('One');
    const a = await mkUser(role.id);
    const b = await mkUser(role.id);
    const bBefore = (
      await db.superAdmin.findUniqueOrThrow({ where: { id: b.id } })
    ).password;
    const e = await failure(admins.changePassword(a.id, '', 'Zzz!12345'));
    expect(e.getStatus()).toBe(417);
    expect(e.getResponse()).toEqual({ message: 'Old password is incorrect' });
    await admins.changePassword(a.id, 'Secret!234', 'Zzz!12345');
    expect(
      (await db.superAdmin.findUniqueOrThrow({ where: { id: b.id } })).password,
    ).toBe(bBefore);
  });

  it('[BE-ADM-206] {AdminUsersService.findAllUsers} a role id of 0 or an undefined filter does not narrow the list; filters combine with AND', async () => {
    const r1 = await roleWith('One');
    const r2 = await roleWith('Two');
    const a = await mkUser(r1.id, { name: 'Zed Match', email: 'zed@x.test' });
    const b = await mkUser(r2.id, { name: 'Zed Other', email: 'zed2@x.test' });
    const ids = (rows: any) => rows.map((r: any) => r.id);
    expect(ids(await admins.findAllUsers({ roleId: 0 }))).toEqual(
      expect.arrayContaining([a.id, b.id]),
    );
    expect(
      ids(await admins.findAllUsers({ search: 'zed', roleId: r1.id })),
    ).toEqual([a.id]);
    expect(
      ids(await admins.findAllUsers({ search: 'zed2', roleId: r1.id })),
    ).toEqual([]);
    expect(ids(await admins.findAllUsers({ search: 'ZED' }))).toEqual([
      a.id,
      b.id,
    ]);
    expect(ids(await admins.findAllUsers({ search: 'x.test' }))).toEqual([
      a.id,
      b.id,
    ]);
  });

  it('[BE-ADM-207] {AdminUsersService.removeUser} {AdminUsersService.removeRole} only the target row goes; other users, roles and permission links stay', async () => {
    const r1 = await roleWith('One', 2);
    const r2 = await roleWith('Two', 3);
    const u1 = await mkUser(r1.id);
    const u2 = await mkUser(r2.id);
    await admins.removeUser(u1.id);
    expect(await db.superAdmin.count({ where: { id: u2.id } })).toBe(1);
    await admins.removeRole(r1.id);
    expect(await db.superAdminRole.count({ where: { id: r2.id } })).toBe(1);
    expect(
      await db.superAdminRolePermission.count({ where: { role_id: r2.id } }),
    ).toBe(3);
  });

  it('[BE-ADM-208] every method logs its failure with the id or email, the stack, and answers with the exact message', async () => {
    const error = jest
      .spyOn((admins as any).logger, 'error')
      .mockImplementation(() => undefined);
    const cases: [string, string, () => Promise<unknown>, string, string][] = [
      [
        'superAdminRole',
        'create',
        () => admins.createRole({ name: 'x', permission_ids: [] }),
        'Error creating super admin role',
        'Failed to create super admin role',
      ],
      [
        'superAdminRole',
        'findMany',
        () => admins.findAllRoles(),
        'Error finding all super admin roles',
        'Failed to find super admin roles',
      ],
      [
        'superAdminRole',
        'findUnique',
        () => admins.findOneRole(41),
        'Error finding super admin role 41',
        'Failed to find super admin role',
      ],
      [
        'superAdmin',
        'findMany',
        () => admins.findAllUsers(),
        'Error finding all super admin users',
        'Failed to find super admin users',
      ],
      [
        'superAdmin',
        'findUnique',
        () => admins.findOneUser(42),
        'Error finding super admin user 42',
        'Failed to find super admin user',
      ],
      [
        'superAdmin',
        'create',
        () =>
          admins.createUser({
            email: 'log@x.test',
            name: 'n',
            password: 'p',
            role_id: 1,
          }),
        'Error creating super admin user for log@x.test',
        'Failed to create super admin user',
      ],
      [
        'superAdminRole',
        'update',
        () => admins.updateRole(43, { name: 'x' }),
        'Error updating super admin role 43',
        'Failed to update super admin role',
      ],
      [
        'superAdmin',
        'update',
        () => admins.updateUser(44, { name: 'x' }),
        'Error updating super admin user 44',
        'Failed to update super admin user',
      ],
      [
        'superAdmin',
        'findUnique',
        () => admins.changePassword(45, 'a', 'b'),
        'Error changing password for user 45',
        'Failed to change password',
      ],
      [
        'superAdminPermission',
        'findMany',
        () => admins.findAllPermissions(),
        'Error finding super admin permissions',
        'Failed to find permissions',
      ],
      [
        'superAdmin',
        'delete',
        () => admins.removeUser(46),
        'Error deleting super admin user 46',
        'Failed to delete user',
      ],
      [
        'superAdminRole',
        'delete',
        () => admins.removeRole(47),
        'Error deleting super admin role 47',
        'Failed to delete role',
      ],
    ];
    for (const [model, method, call, logged, message] of cases) {
      error.mockClear();
      const boom = new Error('db down');
      const spy = jest
        .spyOn(prisma()[model], method)
        .mockRejectedValueOnce(boom);
      const e = await failure(call());
      spy.mockRestore();
      expect(e.message).toBe(message);
      expect(e.getStatus()).toBe(500);
      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(logged, boom.stack);
    }
    error.mockRestore();
  });

  it('[BE-ADM-209] client errors are rethrown untouched and not logged', async () => {
    const error = jest
      .spyOn((admins as any).logger, 'error')
      .mockImplementation(() => undefined);
    const cases: [string, string, () => Promise<unknown>][] = [
      [
        'superAdminRole',
        'create',
        () => admins.createRole({ name: 'x', permission_ids: [] }),
      ],
      ['superAdminRole', 'findMany', () => admins.findAllRoles()],
      ['superAdminRole', 'findUnique', () => admins.findOneRole(1)],
      ['superAdmin', 'findMany', () => admins.findAllUsers()],
      ['superAdmin', 'findUnique', () => admins.findOneUser(1)],
      [
        'superAdmin',
        'create',
        () =>
          admins.createUser({
            email: 'a@a.a',
            name: 'n',
            password: 'p',
            role_id: 1,
          }),
      ],
      ['superAdminRole', 'update', () => admins.updateRole(1, { name: 'x' })],
      ['superAdmin', 'update', () => admins.updateUser(1, { name: 'x' })],
      ['superAdmin', 'findUnique', () => admins.changePassword(1, 'a', 'b')],
      ['superAdminPermission', 'findMany', () => admins.findAllPermissions()],
      ['superAdmin', 'delete', () => admins.removeUser(1)],
      ['superAdminRole', 'delete', () => admins.removeRole(1)],
    ];
    for (const [model, method, call] of cases) {
      const own = new BadRequestException('already readable');
      const spy = jest
        .spyOn(prisma()[model], method)
        .mockRejectedValueOnce(own);
      const e = await failure(call());
      spy.mockRestore();
      expect(e).toBe(own);
    }
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('[BE-ADM-210] {AdminUsersService.findAllRoles} {AdminUsersService.findOneRole} {AdminUsersService.findAllUsers} the nested permission shape is exactly permission link plus permission row', async () => {
    const role = await roleWith('Shape', 1);
    const u = await mkUser(role.id);
    const one: any = await admins.findOneRole(role.id);
    expect(Object.keys(one.permissions[0]).sort()).toEqual(
      Object.keys(
        (await db.superAdminRolePermission.findFirstOrThrow({
          where: { role_id: role.id },
        })) as object,
      )
        .concat('permission')
        .sort(),
    );
    const all: any[] = (await admins.findAllRoles()) as any[];
    expect(
      Object.keys(all.find((r) => r.id === role.id).permissions[0]).sort(),
    ).toEqual(Object.keys(one.permissions[0]).sort());
    const user: any = await admins.findOneUser(u.id);
    expect(Object.keys(user.role.permissions[0].permission).sort()).toEqual(
      Object.keys(one.permissions[0].permission).sort(),
    );
    expect(user.role.name).toBe('Shape');
    const created: any = await admins.createRole({
      name: 'Shape2',
      permission_ids: await permissionIds(2),
    });
    expect(created.permissions[0].permission).toBeDefined();
    expect(created.permissions[0].role_id).toBe(created.id);
  });
});
