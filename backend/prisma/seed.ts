import { PrismaClient } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = bcryptjs.hashSync('123456', 10);

  const adminPermissions = [
    'plans',
    'consumers',
    'billing',
    'users',
    'backup&restore',
    'profile',
  ];
  const createdPermissions = await Promise.all(
    adminPermissions.map((action) =>
      prisma.superAdminPermission.upsert({
        where: { action },
        update: {},
        create: { action },
      }),
    ),
  );

  // Create "admin" role with all permissions
  const adminRole = await prisma.superAdminRole.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      permissions: {
        create: createdPermissions.map((perm) => ({
          permission_id: perm.id,
        })),
      },
    },
  });

  await prisma.superAdmin.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Root Admin',
      email: 'admin@example.com',
      password: hash,
      role_id: adminRole.id,
    },
  });

  // Seed default permissions
  const consumerPermissions = [
    'create_invoice',
    'view_report',
    'manage_users',
    'profile',
  ];
  const permissions = await Promise.all(
    consumerPermissions.map((action) =>
      prisma.permission.upsert({
        where: { action },
        update: {},
        create: { action },
      }),
    ),
  );

  // Seed default plans
  const basicPlan = await prisma.plan.create({
    data: {
      name: 'Basic',
      price: 10,
    },
  });

  const proPlan = await prisma.plan.create({
    data: {
      name: 'Pro',
      price: 30,
    },
  });

  const enterprisePlan = await prisma.plan.create({
    data: {
      name: 'Enterprise',
      price: 50,
    },
  });

  // Seed PlanPermissions
  const permissionMap = Object.fromEntries(
    permissions.map((p) => [p.action, p.id]),
  );

  await prisma.planPermission.createMany({
    data: [
      // Basic Plan Permissions
      { plan_id: basicPlan.id, permission_id: permissionMap['view_report'] },
      { plan_id: basicPlan.id, permission_id: permissionMap['profile'] },

      // Pro Plan Permissions
      { plan_id: proPlan.id, permission_id: permissionMap['view_report'] },
      { plan_id: proPlan.id, permission_id: permissionMap['create_invoice'] },
      { plan_id: proPlan.id, permission_id: permissionMap['profile'] },

      // Enterprise Plan Permissions
      {
        plan_id: enterprisePlan.id,
        permission_id: permissionMap['view_report'],
      },
      {
        plan_id: enterprisePlan.id,
        permission_id: permissionMap['create_invoice'],
      },
      {
        plan_id: enterprisePlan.id,
        permission_id: permissionMap['manage_users'],
      },
      {
        plan_id: enterprisePlan.id,
        permission_id: permissionMap['profile'],
      },
    ],
    skipDuplicates: true,
  });

  // Create Consumer for Enterprise Plan
  const consumer1 = await prisma.consumer.create({
    data: {
      company_name: 'Possbuzz',
      subdomain: 'consumer1',
      email: 'admin@consumer1.com',
      plan_id: enterprisePlan.id,
    },
  });

  // Create Roles
  const [roleAdmin, roleUser] = await Promise.all([
    prisma.role.create({
      data: {
        consumer_id: consumer1.id,
        name: 'Admin',
      },
    }),
    prisma.role.create({
      data: {
        consumer_id: consumer1.id,
        name: 'User',
      },
    }),
  ]);

  // Create Users
  const [user1, user2] = await Promise.all([
    prisma.user.create({
      data: {
        consumer_id: consumer1.id,
        email: 'user1@consumer1.com',
        name: 'User One',
        password: hash,
        role_id: roleAdmin.id,
      },
    }),
    prisma.user.create({
      data: {
        consumer_id: consumer1.id,
        email: 'user2@consumer2.com',
        name: 'User Two',
        password: hash,
        role_id: roleUser.id,
      },
    }),
  ]);

  // Assign Permissions to Admin Role
  await prisma.rolePermission.createMany({
    data: [
      { role_id: roleAdmin.id, permission_id: permissionMap['view_report'] },
      { role_id: roleAdmin.id, permission_id: permissionMap['create_invoice'] },
      { role_id: roleAdmin.id, permission_id: permissionMap['manage_users'] },
      { role_id: roleAdmin.id, permission_id: permissionMap['profile'] },
    ],
    skipDuplicates: true,
  });

  // Assign Permissions to User Role (limited)
  await prisma.rolePermission.createMany({
    data: [
      { role_id: roleUser.id, permission_id: permissionMap['view_report'] },
      { role_id: roleAdmin.id, permission_id: permissionMap['profile'] },
    ],
    skipDuplicates: true,
  });

  // Billing History
  await prisma.billingHistory.createMany({
    data: [
      {
        consumer_id: consumer1.id,
        amount: 100.0,
        reference: 'Invoice #12345',
        billing_month: '2025-03',
      },
      {
        consumer_id: consumer1.id,
        amount: 250.0,
        reference: 'Invoice #67890',
        billing_month: '2025-04',
      },
    ],
  });

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
