import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, bootDomain, newWorld } from '../helpers/domain';
import { createAdmin } from '../factories';
import { UsersService } from '../../src/admin/users/services/users.service';

describe('super-admin users and roles (detail)', () => {
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

  it('[BE-ADM-101] {AdminUsersService.createRole} a role is stored with its permissions and returned with them nested', async () => {
    await createAdmin(db);
    const ids = await permissionIds(3);
    const role: any = await admins.createRole({
      name: 'Auditor',
      permission_ids: ids,
    });
    expect(role.name).toBe('Auditor');
    expect(role.permissions).toHaveLength(3);
    expect(role.permissions.map((p: any) => p.permission_id).sort()).toEqual(
      [...ids].sort(),
    );
    for (const p of role.permissions) {
      expect(p.permission.id).toBe(p.permission_id);
      expect(typeof p.permission.action).toBe('string');
    }
    const empty: any = await admins.createRole({
      name: 'Nothing',
      permission_ids: [],
    });
    expect(empty.permissions).toEqual([]);
    expect(
      await db.superAdminRolePermission.count({ where: { role_id: empty.id } }),
    ).toBe(0);
  });

  it('[BE-ADM-102] {AdminUsersService.findAllRoles} {AdminUsersService.findOneRole} roles list in id order with permissions; a missing role is null', async () => {
    const a = await roleWith('Zeta');
    const b = await roleWith('Alpha');
    const all: any[] = (await admins.findAllRoles()) as any[];
    const ordered = all.map((r) => r.id);
    expect(ordered).toEqual([...ordered].sort((x, y) => x - y));
    expect(ordered.indexOf(a.id)).toBeLessThan(ordered.indexOf(b.id));
    const row = all.find((r) => r.id === a.id);
    expect(row.name).toBe('Zeta');
    expect(row.permissions).toHaveLength(2);
    expect(row.permissions[0].permission.action).toEqual(expect.any(String));
    const one: any = await admins.findOneRole(b.id);
    expect(one.id).toBe(b.id);
    expect(one.name).toBe('Alpha');
    expect(one.permissions).toHaveLength(2);
    expect(await admins.findOneRole(999999)).toBeNull();
  });

  it('[BE-ADM-103] {AdminUsersService.findAllPermissions} the catalogue lists every permission in id order', async () => {
    await createAdmin(db);
    const res: any[] = (await admins.findAllPermissions()) as any[];
    expect(res.length).toBe(await db.superAdminPermission.count());
    expect(res.length).toBeGreaterThan(1);
    expect(res.map((p) => p.id)).toEqual(
      [...res.map((p) => p.id)].sort((x, y) => x - y),
    );
    expect(res[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        action: expect.any(String),
      }),
    );
  });

  it('[BE-ADM-104] {AdminUsersService.createUser} the password is hashed, the shape is limited and the role is returned', async () => {
    const role = await roleWith('Ops');
    const created: any = await mkUser(role.id, {
      email: 'ops@example.test',
      name: 'Ops',
    });
    expect(Object.keys(created).sort()).toEqual([
      'email',
      'id',
      'name',
      'role',
    ]);
    expect(created).toMatchObject({ email: 'ops@example.test', name: 'Ops' });
    expect(created.role).toMatchObject({ id: role.id, name: 'Ops' });
    const stored = await db.superAdmin.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.role_id).toBe(role.id);
    expect(stored.password).not.toBe('Secret!234');
    expect(await bcryptjs.compare('Secret!234', stored.password)).toBe(true);
    expect(stored.password.startsWith('$2')).toBe(true);
  });

  it('[BE-ADM-105] {AdminUsersService.findAllUsers} {AdminUsersService.findOneUser} users list without passwords, filtered by role and by name or email search', async () => {
    const r1 = await roleWith('One');
    const r2 = await roleWith('Two');
    const a = await mkUser(r1.id, { name: 'Alice Wong', email: 'a@x.test' });
    const b = await mkUser(r2.id, { name: 'Bob', email: 'carol@x.test' });
    const c = await mkUser(r2.id, { name: 'Dave', email: 'dave@x.test' });
    const idsOf = (rows: any) => rows.map((r: any) => r.id);
    const all: any[] = (await admins.findAllUsers()) as any[];
    expect(idsOf(all)).toEqual(expect.arrayContaining([a.id, b.id, c.id]));
    expect(idsOf(all)).toEqual([...idsOf(all)].sort((x, y) => x - y));
    const row = all.find((r) => r.id === a.id);
    expect(Object.keys(row).sort()).toEqual([
      'created_at',
      'email',
      'id',
      'name',
      'role',
      'role_id',
    ]);
    expect(row.role.id).toBe(r1.id);
    expect(row.role.permissions).toHaveLength(2);
    expect(row.role.permissions[0].permission.action).toEqual(
      expect.any(String),
    );
    expect(row.created_at).toBeInstanceOf(Date);
    expect(idsOf(await admins.findAllUsers({ roleId: r2.id }))).toEqual([
      b.id,
      c.id,
    ]);
    expect(idsOf(await admins.findAllUsers({ roleId: r1.id }))).toEqual([a.id]);
    expect(idsOf(await admins.findAllUsers({ search: 'ALICE' }))).toEqual([
      a.id,
    ]);
    expect(idsOf(await admins.findAllUsers({ search: 'CAROL@' }))).toEqual([
      b.id,
    ]);
    expect(
      idsOf(await admins.findAllUsers({ search: 'o', roleId: r2.id })),
    ).toEqual([b.id]);
    expect(await admins.findAllUsers({ search: 'nobody-matches' })).toEqual([]);
    expect(idsOf(await admins.findAllUsers({ search: '' }))).toEqual(
      idsOf(all),
    );
    const one: any = await admins.findOneUser(a.id);
    expect(Object.keys(one).sort()).toEqual([
      'created_at',
      'email',
      'id',
      'name',
      'role',
    ]);
    expect(one.role.permissions).toHaveLength(2);
    expect(await admins.findOneUser(999999)).toBeNull();
  });

  it('[BE-ADM-106] {AdminUsersService.updateRole} renames and replaces the permission set; omitting permission_ids keeps them; an empty list clears them', async () => {
    const role = await roleWith('Old', 3);
    const ids = await permissionIds(4);
    const renamed: any = await admins.updateRole(role.id, {
      name: 'New',
    });
    expect(renamed.name).toBe('New');
    expect(Object.keys(renamed).sort()).toEqual(['id', 'name']);
    const count = () =>
      db.superAdminRolePermission.count({ where: { role_id: role.id } });
    expect(await count()).toBe(3);
    await admins.updateRole(role.id, {
      name: 'New',
      permission_ids: [ids[3]],
    });
    const rows = await db.superAdminRolePermission.findMany({
      where: { role_id: role.id },
    });
    expect(rows.map((r) => r.permission_id)).toEqual([ids[3]]);
    await admins.updateRole(role.id, {
      name: 'New',
      permission_ids: [],
    });
    expect(await count()).toBe(0);
    const missing = await failure(admins.updateRole(999999, { name: 'x' }));
    expect(missing).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(missing.code).toBe('P2025');
  });

  it('[BE-ADM-107] {AdminUsersService.updateUser} changes only the given fields, hashes a new password and keeps the old hash when none is given', async () => {
    const r1 = await roleWith('One');
    const r2 = await roleWith('Two');
    const u = await mkUser(r1.id, { name: 'Before', email: 'before@x.test' });
    const before = await db.superAdmin.findUniqueOrThrow({
      where: { id: u.id },
    });
    const renamed: any = await admins.updateUser(u.id, {
      name: 'After',
    });
    expect(Object.keys(renamed).sort()).toEqual([
      'email',
      'id',
      'name',
      'role',
    ]);
    expect(renamed).toMatchObject({ name: 'After', email: 'before@x.test' });
    expect(renamed.role.id).toBe(r1.id);
    let stored = await db.superAdmin.findUniqueOrThrow({ where: { id: u.id } });
    expect(stored.password).toBe(before.password);
    await admins.updateUser(u.id, {
      email: 'after@x.test',
      role_id: r2.id,
      password: 'Brand!New1',
    });
    stored = await db.superAdmin.findUniqueOrThrow({ where: { id: u.id } });
    expect(stored).toMatchObject({ email: 'after@x.test', role_id: r2.id });
    expect(await bcryptjs.compare('Brand!New1', stored.password)).toBe(true);
    // an empty password is not a password change
    await admins.updateUser(u.id, { password: '' });
    const kept = await db.superAdmin.findUniqueOrThrow({ where: { id: u.id } });
    expect(kept.password).toBe(stored.password);
    const missing = await failure(admins.updateUser(999999, { name: 'x' }));
    expect(missing.code).toBe('P2025');
  });

  it('[BE-ADM-108] {AdminUsersService.changePassword} a wrong old password or unknown user is a 417 with its message; success stores a new hash and returns id, email and name', async () => {
    const role = await roleWith('One');
    const u = await mkUser(role.id, { name: 'Pat', email: 'pat@x.test' });
    const missing = await failure(admins.changePassword(999999, 'a', 'b'));
    expect(missing).toBeInstanceOf(HttpException);
    expect(missing.getStatus()).toBe(417);
    expect(missing.getResponse()).toEqual({ message: 'User not found' });
    const wrong = await failure(
      admins.changePassword(u.id, 'nope', 'Another!234'),
    );
    expect(wrong.getStatus()).toBe(417);
    expect(wrong.getResponse()).toEqual({
      message: 'Old password is incorrect',
    });
    const unchanged = await db.superAdmin.findUniqueOrThrow({
      where: { id: u.id },
    });
    expect(await bcryptjs.compare('Secret!234', unchanged.password)).toBe(true);
    const res = await admins.changePassword(u.id, 'Secret!234', 'Another!234');
    expect(res).toEqual({ id: u.id, email: 'pat@x.test', name: 'Pat' });
    const after = await db.superAdmin.findUniqueOrThrow({
      where: { id: u.id },
    });
    expect(await bcryptjs.compare('Another!234', after.password)).toBe(true);
    expect(await bcryptjs.compare('Secret!234', after.password)).toBe(false);
  });

  it('[BE-ADM-109] {AdminUsersService.removeUser} {AdminUsersService.removeRole} deletion returns success, a role with users is refused with 409, missing ids are 404', async () => {
    const role = await roleWith('Busy');
    const u = await mkUser(role.id);
    expect(await admins.removeUser(u.id)).toEqual({ success: true });
    expect(await db.superAdmin.count({ where: { id: u.id } })).toBe(0);
    const other = await mkUser(role.id);
    // a role that still has users is refused and nothing is deleted
    const refused = await failure(admins.removeRole(role.id));
    expect(refused).toBeInstanceOf(HttpException);
    expect(refused.getStatus()).toBe(409);
    expect(refused.message).toBe(
      'Cannot delete a role that still has users assigned',
    );
    expect(await db.superAdmin.count({ where: { id: other.id } })).toBe(1);
    expect(await db.superAdminRole.count({ where: { id: role.id } })).toBe(1);
    // once the last user is gone the role (and its permission links) can go
    await admins.removeUser(other.id);
    expect(await admins.removeRole(role.id)).toEqual({ success: true });
    expect(await db.superAdminRole.count({ where: { id: role.id } })).toBe(0);
    expect(
      await db.superAdminRolePermission.count({ where: { role_id: role.id } }),
    ).toBe(0);
    const missingUser = await failure(admins.removeUser(999999));
    expect(missingUser.getStatus()).toBe(404);
    expect(missingUser.message).toBe('User not found');
    const missingRole = await failure(admins.removeRole(999999));
    expect(missingRole.getStatus()).toBe(404);
    expect(missingRole.message).toBe('Role not found');
  });

  it('[BE-ADM-110] {AdminUsersService.removeUser} {AdminUsersService.removeRole} raw database error codes without a readable meaning map to not-found and conflict responses', async () => {
    const codes: [string, string, number, string][] = [
      ['removeUser', 'P2025', 404, 'User not found'],
      ['removeRole', 'P2025', 404, 'Role not found'],
      [
        'removeRole',
        'P2003',
        409,
        'Cannot delete a role that still has users assigned',
      ],
      ['removeUser', 'X9999', 500, 'Failed to delete user'],
      ['removeRole', 'X9999', 500, 'Failed to delete role'],
    ];
    for (const [method, code, status, message] of codes) {
      const model = method === 'removeUser' ? 'superAdmin' : 'superAdminRole';
      // a plain object error with a bare code is not a client error, so the service maps it itself
      const spy = jest
        .spyOn(prisma()[model], 'delete')
        .mockRejectedValueOnce(Object.assign(new Error('raw'), { code }));
      const e = await failure((admins as any)[method](1));
      spy.mockRestore();
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(status);
      expect(e.message).toBe(message);
    }
  });

  it('[BE-ADM-111] {AdminUsersService.createRole} {AdminUsersService.findAllRoles} {AdminUsersService.findOneRole} {AdminUsersService.findAllUsers} {AdminUsersService.findOneUser} {AdminUsersService.createUser} {AdminUsersService.updateRole} {AdminUsersService.updateUser} {AdminUsersService.changePassword} {AdminUsersService.findAllPermissions} unexpected failures are wrapped as a generic 500', async () => {
    const cases: [string, string, () => Promise<unknown>, string][] = [
      [
        'superAdminRole',
        'create',
        () => admins.createRole({ name: 'x', permission_ids: [] }),
        'Failed to create super admin role',
      ],
      [
        'superAdminRole',
        'findMany',
        () => admins.findAllRoles(),
        'Failed to find super admin roles',
      ],
      [
        'superAdminRole',
        'findUnique',
        () => admins.findOneRole(1),
        'Failed to find super admin role',
      ],
      [
        'superAdmin',
        'findMany',
        () => admins.findAllUsers(),
        'Failed to find super admin users',
      ],
      [
        'superAdmin',
        'findUnique',
        () => admins.findOneUser(1),
        'Failed to find super admin user',
      ],
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
        'Failed to create super admin user',
      ],
      [
        'superAdminRole',
        'update',
        () => admins.updateRole(1, { name: 'x' }),
        'Failed to update super admin role',
      ],
      [
        'superAdmin',
        'update',
        () => admins.updateUser(1, { name: 'x' }),
        'Failed to update super admin user',
      ],
      [
        'superAdmin',
        'findUnique',
        () => admins.changePassword(1, 'a', 'b'),
        'Failed to change password',
      ],
      [
        'superAdminPermission',
        'findMany',
        () => admins.findAllPermissions(),
        'Failed to find permissions',
      ],
    ];
    for (const [model, method, call, message] of cases) {
      const spy = jest
        .spyOn(prisma()[model], method)
        .mockRejectedValueOnce(new Error('db down'));
      const e = await failure(call());
      spy.mockRestore();
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(500);
      expect(e.message).toBe(message);
    }
  });

  it('[BE-ADM-112] {AdminUsersService.createRole} {AdminUsersService.createUser} database errors with a readable meaning are passed through, not replaced by a 500', async () => {
    const role = await roleWith('Dup');
    const dup = await failure(
      admins.createRole({ name: 'Dup', permission_ids: [] }),
    );
    if (dup) {
      expect(dup).not.toMatchObject({
        message: 'Failed to create super admin role',
      });
    }
    const bad = await failure(
      admins.createUser({
        email: 'x@x.test',
        name: 'x',
        password: 'p',
        role_id: 999999,
      }),
    );
    expect(bad).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(bad.code).toBe('P2003');
    const first = await mkUser(role.id, { email: 'same@x.test' });
    const second = await failure(mkUser(role.id, { email: 'same@x.test' }));
    expect(first.id).toBeGreaterThan(0);
    expect(second).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(second.code).toBe('P2002');
  });
});
