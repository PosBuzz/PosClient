import {
  Prisma,
  PrismaClient,
  Plan,
  Consumer,
  Branch,
  Role,
  User,
} from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { ConsumerPermission } from '../../src/auth/enums/consumerPermissions.enum';
import { seq, TEST_PASSWORD } from './sequence';

const password = hashSync(TEST_PASSWORD, 4);
export interface Tenant {
  plan: Plan;
  consumer: Consumer;
  branches: Branch[];
  adminRole: Role;
  adminUser: User;
  user: (permissions: ConsumerPermission[]) => Promise<User>;
}
export async function createTenant(
  db: PrismaClient,
  opts: {
    permissions?: ConsumerPermission[];
    subdomain?: string;
    branches?: number;
    maxBranches?: number;
  } = {},
): Promise<Tenant> {
  const suffix = seq();
  const permissions = await Promise.all(
    (opts.permissions ?? Object.values(ConsumerPermission)).map((action) =>
      db.permission.upsert({
        where: { action },
        update: {},
        create: { action },
      }),
    ),
  );
  const plan = await db.plan.create({
    data: {
      name: `Plan ${suffix}`,
      price: 100,
      permissions: {
        create: permissions.map((permission) => ({
          permission_id: permission.id,
        })),
      },
    },
  });
  const consumer = await db.consumer.create({
    data: {
      company_name: `Shop ${suffix}`,
      email: `tenant${suffix}@example.test`,
      subdomain: opts.subdomain ?? `tenant${suffix}`,
      plan_id: plan.id,
      max_branch: opts.maxBranches ?? opts.branches ?? 1,
    },
  });
  const branches = [];
  for (let index = 0; index < (opts.branches ?? 1); index++) {
    branches.push(
      await db.branch.create({
        data: {
          consumer_id: consumer.id,
          name: `Branch ${index + 1}`,
          is_main: index === 0,
        },
      }),
    );
  }
  const adminRole = await db.role.create({
    data: {
      consumer_id: consumer.id,
      name: 'Admin',
      is_admin: true,
      permissions: {
        create: permissions.map((permission) => ({
          permission_id: permission.id,
        })),
      },
    },
  });
  const adminUser = await db.user.create({
    data: {
      consumer_id: consumer.id,
      role_id: adminRole.id,
      email: `admin${suffix}@example.test`,
      name: 'Tenant Admin',
      password,
      branches: {
        create: branches.map((branch) => ({ branch_id: branch.id })),
      },
    },
  });
  await db.billingHistory.create({
    data: {
      consumer_id: consumer.id,
      plan_id: plan.id,
      amount: 100,
      billing_date: new Date('2026-01-01T00:00:00Z'),
      billing_from: new Date('2020-01-01T00:00:00Z'),
      billing_till: new Date('2040-01-01T00:00:00Z'),
    },
  });
  const tenant = { plan, consumer, branches, adminRole, adminUser };
  return {
    ...tenant,
    user: (actions: ConsumerPermission[]) =>
      createUserWithPermissions(db, tenant, actions),
  };
}
type TenantBase = Pick<Tenant, 'consumer' | 'branches'>;
export async function createUserWithPermissions(
  db: PrismaClient,
  tenant: TenantBase,
  permissions: ConsumerPermission[],
  overrides: Partial<Prisma.UserUncheckedCreateInput> = {},
) {
  const suffix = seq();
  const rows = await Promise.all(
    permissions.map((action) =>
      db.permission.upsert({
        where: { action },
        update: {},
        create: { action },
      }),
    ),
  );
  const role = await db.role.create({
    data: {
      consumer_id: tenant.consumer.id,
      name: `Role ${suffix}`,
      permissions: { create: rows.map((row) => ({ permission_id: row.id })) },
    },
  });
  const user = await db.user.create({
    data: {
      consumer_id: tenant.consumer.id,
      role_id: role.id,
      name: `User ${suffix}`,
      email: `user${suffix}@example.test`,
      password,
      ...overrides,
    },
  });
  await db.userBranch.createMany({
    data: tenant.branches.map((branch) => ({
      user_id: user.id,
      branch_id: branch.id,
    })),
  });
  return user;
}
