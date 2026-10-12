import { Prisma, PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { AdminPermission } from '../../src/auth/enums/adminPermissions.enum';
import { seq, TEST_PASSWORD } from './sequence';
const password = hashSync(TEST_PASSWORD, 4);
export async function createAdmin(
  db: PrismaClient,
  overrides: Partial<Prisma.SuperAdminUncheckedCreateInput> = {},
  /** Defaults to every admin permission */
  actions: AdminPermission[] = Object.values(AdminPermission),
) {
  const permissions = await Promise.all(
    actions.map((action) =>
      db.superAdminPermission.upsert({
        where: { action },
        update: {},
        create: { action },
      }),
    ),
  );
  const role = await db.superAdminRole.create({
    data: {
      name: `Admin role ${seq()}`,
      permissions: {
        create: permissions.map((permission) => ({
          permission_id: permission.id,
        })),
      },
    },
  });
  return db.superAdmin.create({
    data: {
      role_id: role.id,
      name: 'Super Admin',
      email: `super${seq()}@example.test`,
      password,
      ...overrides,
    },
  });
}
