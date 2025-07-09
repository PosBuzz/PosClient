import { PrismaClient } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = bcryptjs.hashSync('123456', 10);

  // Super Admin permissions
  const adminPermissions = [
    'plans',
    'show_consumers',
    'add_consumers',
    'modify_consumers',
    'delete_consumers',
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
    include: {
      permissions: true,
    },
  });

  // If updating, ensure permissions are linked
  if (adminRole.permissions.length === 0) {
    await Promise.all(
      createdPermissions.map((perm) =>
        prisma.superAdminRolePermission.upsert({
          where: {
            role_id_permission_id: {
              role_id: adminRole.id,
              permission_id: perm.id,
            },
          },
          update: {},
          create: {
            role_id: adminRole.id,
            permission_id: perm.id,
          },
        }),
      ),
    );
  }

  // Super Admin user
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

  // Plans
  // Create only ONE Plan
  const enterprisePlan = await prisma.plan.upsert({
    where: { name: 'Enterprise' },
    update: { price: 50 },
    create: {
      name: 'Enterprise',
      price: 50,
    },
  });

  // Consumer permissions
  const consumerPermissions = [
    'profile',
    'users',
    'add_product',
    'edit_product',
    'view_product',
    'delete_product',
    'branches',
    'vendors',
    'inventory_batches',
    'inventory_transfer',
    'inventory_adjustment',
    'customers',
    'sales',
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

  // Map permissions for easier access
  const permissionMap = Object.fromEntries(
    permissions.map((p) => [p.action, p.id]),
  );

  // Assign ALL permissions to the ONLY plan
  await Promise.all(
    consumerPermissions.map((action) =>
      prisma.planPermission.upsert({
        where: {
          plan_id_permission_id: {
            plan_id: enterprisePlan.id,
            permission_id: permissionMap[action],
          },
        },
        update: {},
        create: {
          plan_id: enterprisePlan.id,
          permission_id: permissionMap[action],
        },
      }),
    ),
  );

  // Create Consumer assigned to the only plan
  const consumer1 = await prisma.consumer.upsert({
    where: { subdomain: 'consumer1' },
    update: {
      company_name: 'Possbuzz',
      email: 'consumer@example.com',
      plan_id: enterprisePlan.id,
    },
    create: {
      company_name: 'Possbuzz',
      subdomain: 'consumer1',
      email: 'consumer@example.com',
      plan_id: enterprisePlan.id,
    },
  });

  // Create Warehouse Branch
  const warehouseBranch = await prisma.branch.upsert({
    where: {
      consumer_id_name: {
        consumer_id: consumer1.id,
        name: 'Warehouse',
      },
    },
    update: {
      address: 'Central Warehouse Location',
      email: 'warehouse@example.com',
      phone: '+1-555-0100',
      is_main: false,
      is_warehouse: true,
    },
    create: {
      consumer_id: consumer1.id,
      name: 'Warehouse',
      address: 'Central Warehouse Location',
      email: 'warehouse@example.com',
      phone: '+1-555-0100',
      is_main: false,
      is_warehouse: true,
    },
  });

  // Create Main Branch
  const mainBranch = await prisma.branch.upsert({
    where: {
      consumer_id_name: {
        consumer_id: consumer1.id,
        name: 'Main Store',
      },
    },
    update: {
      address: '123 Main Street, Downtown',
      email: 'mainstore@example.com',
      phone: '+1-555-0200',
      is_main: true,
      is_warehouse: false,
    },
    create: {
      consumer_id: consumer1.id,
      name: 'Main Store',
      address: '123 Main Street, Downtown',
      email: 'mainstore@example.com',
      phone: '+1-555-0200',
      is_main: true,
      is_warehouse: false,
    },
  });

  // Create Admin Role for Consumer
  const adminConsumerRole = await prisma.role.upsert({
    where: {
      is_admin: true,
      consumer_id_name: {
        consumer_id: consumer1.id,
        name: 'Admin',
      },
    },
    update: {},
    create: {
      consumer_id: consumer1.id,
      name: 'Admin',
      is_admin: true,
    },
  });

  // Assign all plan permissions to the admin role
  await Promise.all(
    permissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: {
          role_id_permission_id: {
            role_id: adminConsumerRole.id,
            permission_id: permission.id,
          },
        },
        update: {},
        create: {
          role_id: adminConsumerRole.id,
          permission_id: permission.id,
        },
      }),
    ),
  );

  // Create Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: 'consumer@example.com' },
    update: {
      consumer_id: consumer1.id,
      name: 'Consumer Admin',
      password: hash,
      role_id: adminConsumerRole.id,
    },
    create: {
      consumer_id: consumer1.id,
      email: 'consumer@example.com',
      name: 'Consumer Admin',
      password: hash,
      role_id: adminConsumerRole.id,
    },
  });

  // Assign all branches to the admin user
  
  await prisma.userBranch.createMany({
    data: [
      {
        user_id: adminUser.id,
        branch_id: warehouseBranch.id,
      },
      {
        user_id: adminUser.id,
        branch_id: mainBranch.id,
      },
    ],
    skipDuplicates: true,
  });

  // Create billing history
  await prisma.billingHistory.upsert({
    where: {
      consumer_id_billing_date: {
        consumer_id: consumer1.id,
        billing_date: new Date('2025-06-01T00:00:00Z'),
      },
    },
    update: {
      amount: 100.0,
      plan_id: enterprisePlan.id,
      billing_date: new Date('2025-06-01T00:00:00Z'),
    },
    create: {
      consumer_id: consumer1.id,
      plan_id: enterprisePlan.id,
      amount: 100.0,
      reference: 'Invoice #12345',
      billing_date: new Date('2025-06-01T00:00:00Z'),
    },
  });

  await prisma.billingHistory.upsert({
    where: {
      consumer_id_billing_date: {
        consumer_id: consumer1.id,
        billing_date: new Date('2025-05-01T00:00:00Z'),
      },
    },
    update: {
      plan_id: enterprisePlan.id,
      amount: 250.0,
      billing_date: new Date('2025-05-01T00:00:00Z'),
    },
    create: {
      consumer_id: consumer1.id,
      plan_id: enterprisePlan.id,
      amount: 250.0,
      reference: 'Invoice #67890',
      billing_date: new Date('2025-05-01T00:00:00Z'),
    },
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
