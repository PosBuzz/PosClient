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
      password: '123456', // make sure to hash it before production
    },
  });

  console.log({ basicPlan, proPlan, enterprisePlan, superAdmin });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
