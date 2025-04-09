import { PrismaClient } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = bcryptjs.hashSync('123456', 10);

  // Seed default plans
  const basicPlan = await prisma.plan.create({
    data: {
      name: 'Basic',
      price: 10,
      features: JSON.stringify(['Feature1', 'Feature2']),
    },
  });

  const proPlan = await prisma.plan.create({
    data: {
      name: 'Pro',
      price: 30,
      features: JSON.stringify(['Feature1', 'Feature2', 'Feature3']),
    },
  });

  const enterprisePlan = await prisma.plan.create({
    data: {
      name: 'Enterprise',
      price: 50,
      features: JSON.stringify([
        'Feature1',
        'Feature2',
        'Feature3',
        'Feature4',
      ]),
    },
  });

  // Seed SuperAdmin
  const superAdmin = await prisma.superAdmin.create({
    data: {
      email: 'admin@example.com',
      password: hash, // make sure to hash it before production
    },
  });

  // Create a Consumer for each plan
  const consumer1 = await prisma.consumer.create({
    data: {
      name: 'Consumer 1',
      subdomain: 'consumer1',
      plan_id: enterprisePlan.id,
    },
  });

  // Create Users for Consumers
  const user1 = await prisma.user.create({
    data: {
      consumer_id: consumer1.id,
      email: 'user1@consumer1.com',
      name: 'User One',
      password: hash, // You should hash the password in production
    },
  });

  const user2 = await prisma.user.create({
    data: {
      consumer_id: consumer1.id,
      email: 'user2@consumer2.com',
      name: 'User Two',
      password: hash, // You should hash the password in production
    },
  });

  // Create Roles for Consumers
  const roleAdmin = await prisma.role.create({
    data: {
      consumer_id: consumer1.id,
      name: 'Admin',
    },
  });

  const roleUser = await prisma.role.create({
    data: {
      consumer_id: consumer1.id,
      name: 'User',
    },
  });

  // Create Permissions for Roles
  await prisma.permission.create({
    data: {
      role_id: roleAdmin.id,
      action: 'create_invoice',
    },
  });

  await prisma.permission.create({
    data: {
      role_id: roleUser.id,
      action: 'view_report',
    },
  });

  // Assign Roles to Users
  await prisma.userRole.create({
    data: {
      user_id: user1.id,
      role_id: roleAdmin.id,
    },
  });

  await prisma.userRole.create({
    data: {
      user_id: user2.id,
      role_id: roleUser.id,
    },
  });

  // Create Billing History for Consumers
  await prisma.billingHistory.create({
    data: {
      consumer_id: consumer1.id,
      amount: 100.0,
      reference: 'Invoice #12345',
    },
  });

  await prisma.billingHistory.create({
    data: {
      consumer_id: consumer1.id,
      amount: 250.0,
      reference: 'Invoice #67890',
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
