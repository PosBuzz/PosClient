import { BadRequestException } from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createAdmin, createTenant } from '../factories';
import { UsersService as ConsumerUsers } from '../../src/consumer/users/services/users.service';
import { UsersService as AdminUsers } from '../../src/admin/users/services/users.service';

describe('consumer and super-admin user management', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let users: ConsumerUsers;
  let admins: AdminUsers;

  beforeAll(async () => {
    boot = await bootDomain();
    users = boot.get(ConsumerUsers);
    admins = boot.get(AdminUsers);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());

  const cid = () => w.tenant.consumer.id;
  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );
  const planPermissionIds = async () =>
    (
      await db.planPermission.findMany({
        where: { plan_id: w.tenant.consumer.plan_id },
      })
    ).map((p) => p.permission_id);

  describe('consumer users', () => {
    it('[BE-USR-001] {ConsumerUsersService.permissionOptions} {ConsumerUsersService.createRole} {ConsumerUsersService.getRoles} {ConsumerUsersService.updateRole} {ConsumerUsersService.deleteRole} roles are limited to the plan, scoped to the tenant, and can be renamed and deleted', async () => {
      const options: any[] = (await users.permissionOptions(
        w.tenant.consumer.plan_id,
      )) as any[];
      const ids = await planPermissionIds();
      expect(options.map((o) => o.value).sort()).toEqual([...ids].sort());
      const role: any = await users.createRole(
        { name: 'Cashier', permission_ids: ids.slice(0, 2) },
        cid(),
      );
      expect(role.name).toBe('Cashier');
      const roles: any[] = (await users.getRoles(cid())) as any[];
      const mine = roles.find((r) => r.id === role.id);
      expect(mine.permissions).toHaveLength(2);
      expect(
        ((await users.getRoles(w.bystander.consumer.id)) as any[]).map(
          (r) => r.id,
        ),
      ).not.toContain(role.id);
      await users.updateRole(
        role.id,
        { name: 'Senior cashier', permission_ids: ids.slice(0, 1) },
        cid(),
      );
      const renamed = await db.role.findUniqueOrThrow({
        where: { id: role.id },
        include: { permissions: true },
      });
      expect(renamed.name).toBe('Senior cashier');
      expect(renamed.permissions).toHaveLength(1);
      const foreignRoleError = await failure(
        users.updateRole(role.id, { name: 'Hijack' }, w.bystander.consumer.id),
      );
      expect(foreignRoleError.getStatus()).toBe(404);
      expect(foreignRoleError.message).toBe('Role not found');
      expect(
        (await db.role.findUniqueOrThrow({ where: { id: role.id } })).name,
      ).toBe('Senior cashier');
      await users.deleteRole(role.id, cid());
      expect(await db.role.count({ where: { id: role.id } })).toBe(0);
    });

    it('[BE-USR-002] {ConsumerUsersService.createRole} a role cannot grant a permission the plan does not include', async () => {
      const own = await createTenant(db, {
        permissions: ['sales' as any],
      });
      const all = await db.permission.findMany();
      const extra = all.find((p) => p.action !== 'sales')!;
      const error = await failure(
        users.createRole(
          { name: 'Too much', permission_ids: [extra.id] },
          own.consumer.id,
        ),
      );
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getStatus()).toBe(400);
      expect(error.message).toBe(
        'One or more permissions are not included in your plan',
      );
      expect(await db.role.count({ where: { name: 'Too much' } })).toBe(0);
    });

    it('[BE-USR-003] {ConsumerUsersService.createUser} {ConsumerUsersService.getUsers} {ConsumerUsersService.updateUser} {ConsumerUsersService.deleteUser} users are created with a hashed password in their own tenant, found by search, updated and deleted', async () => {
      const role = await db.role.findFirstOrThrow({
        where: { consumer_id: cid() },
      });
      const created: any = await users.createUser(
        {
          name: 'Rahim',
          email: 'rahim@example.test',
          password: 'Secret!234',
          role_id: role.id,
          branch_ids: [w.tenant.branches[0].id],
        },
        cid(),
      );
      const stored = await db.user.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(stored.consumer_id).toBe(cid());
      expect(stored.password).not.toBe('Secret!234');
      expect(await bcryptjs.compare('Secret!234', stored.password)).toBe(true);
      const found: any = await users.getUsers(cid(), 'rahim');
      expect((found.data ?? found).map((u: any) => u.id)).toEqual([created.id]);
      const none: any = await users.getUsers(cid(), 'nobody-like-this');
      expect(none.data ?? none).toEqual([]);
      await users.updateUser(created.id, { name: 'Rahim Uddin' }, cid());
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: created.id } })).name,
      ).toBe('Rahim Uddin');
      const foreignUserError = await failure(
        users.updateUser(
          created.id,
          { name: 'Hijack' },
          w.bystander.consumer.id,
        ),
      );
      expect(foreignUserError.getStatus()).toBe(404);
      expect(foreignUserError.message).toBe('User not found');
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: created.id } })).name,
      ).toBe('Rahim Uddin');
      await users.deleteUser(created.id, cid());
      expect(await db.user.count({ where: { id: created.id } })).toBe(0);
    });

    it("[BE-USR-004] {ConsumerUsersService.createUser} another tenant's role or branch cannot be assigned", async () => {
      const foreignRole = await db.role.findFirstOrThrow({
        where: { consumer_id: w.bystander.consumer.id },
      });
      const error = await failure(
        users.createUser(
          {
            name: 'Sneaky',
            email: 'sneaky@example.test',
            password: 'Secret!234',
            role_id: foreignRole.id,
          },
          cid(),
        ),
      );
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe('Role not found');
      expect(
        await db.user.count({ where: { email: 'sneaky@example.test' } }),
      ).toBe(0);
    });
  });

  describe('super-admin users', () => {
    it('[BE-USR-010] {AdminUsersService.findAllPermissions} {AdminUsersService.createRole} {AdminUsersService.findAllRoles} {AdminUsersService.findOneRole} {AdminUsersService.updateRole} {AdminUsersService.removeRole} admin roles carry permissions and can be read, changed and removed', async () => {
      await createAdmin(db);
      const permissions: any[] = (await admins.findAllPermissions()) as any[];
      const role: any = await admins.createRole({
        name: 'Support',
        permission_ids: permissions.slice(0, 2).map((p) => p.id),
      });
      const one: any = await admins.findOneRole(role.id);
      expect(one.name).toBe('Support');
      expect(one.permissions).toHaveLength(2);
      expect(
        ((await admins.findAllRoles()) as any[]).map((r) => r.id),
      ).toContain(role.id);
      await admins.updateRole(role.id, {
        name: 'Support lead',
        permission_ids: [permissions[0].id],
      });
      const changed = await db.superAdminRole.findUniqueOrThrow({
        where: { id: role.id },
        include: { permissions: true },
      });
      expect(changed.name).toBe('Support lead');
      expect(changed.permissions).toHaveLength(1);
      expect(await admins.removeRole(role.id)).toEqual({ success: true });
      expect(await db.superAdminRole.count({ where: { id: role.id } })).toBe(0);
    });

    it('[BE-USR-011] {AdminUsersService.createUser} {AdminUsersService.findAllUsers} {AdminUsersService.findOneUser} {AdminUsersService.updateUser} {AdminUsersService.changePassword} {AdminUsersService.removeUser} admin users are hashed, found, updated, and their password changes only with the old one', async () => {
      const first = await createAdmin(db);
      const roleId = first.role_id;
      const created: any = await admins.createUser({
        name: 'Ops',
        email: 'ops@example.test',
        password: 'Secret!234',
        role_id: roleId,
      });
      const stored = await db.superAdmin.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(await bcryptjs.compare('Secret!234', stored.password)).toBe(true);
      expect(
        ((await admins.findAllUsers({ search: 'ops' })) as any[]).map(
          (u) => u.id,
        ),
      ).toEqual([created.id]);
      const one: any = await admins.findOneUser(created.id);
      expect(one.email).toBe('ops@example.test');
      expect(one.password).toBeUndefined();
      await admins.updateUser(created.id, { name: 'Ops lead' });
      expect(
        (await db.superAdmin.findUniqueOrThrow({ where: { id: created.id } }))
          .name,
      ).toBe('Ops lead');
      const wrong = await failure(
        admins.changePassword(created.id, 'wrong', 'Another!234'),
      );
      expect(wrong.getStatus()).toBe(417);
      expect(wrong.message).toBe('Old password is incorrect');
      expect(
        await bcryptjs.compare(
          'Secret!234',
          (await db.superAdmin.findUniqueOrThrow({ where: { id: created.id } }))
            .password,
        ),
      ).toBe(true);
      await admins.changePassword(created.id, 'Secret!234', 'Another!234');
      const after = await db.superAdmin.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(await bcryptjs.compare('Another!234', after.password)).toBe(true);
      expect(await admins.removeUser(created.id)).toEqual({ success: true });
      expect(await db.superAdmin.count({ where: { id: created.id } })).toBe(0);
    });
  });
});
