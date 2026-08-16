import { PrismaClient } from '@prisma/client';
import { seedPortfolio } from './portfolio-seed';

/**
 * Production-safe entry point: loads only the marketing-site CMS content.
 * `prisma/seed.ts` also creates demo tenants, users and sales, so it must not
 * be run against a live database — use this instead.
 *
 *   npm run seed:portfolio
 */
const prisma = new PrismaClient();

seedPortfolio(prisma)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
