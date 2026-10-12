import { PrismaClient } from '@prisma/client';
import { assertTestDatabaseUrl } from '../setup/test-env';

let prisma: PrismaClient | undefined;
export function getPrisma(): PrismaClient {
  if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL) {
    throw new Error('Test environment is not loaded');
  }
  assertTestDatabaseUrl(process.env.DATABASE_URL);
  return (prisma ??= new PrismaClient());
}
export async function resetDb(): Promise<void> {
  const db = getPrisma();
  const rows = await db.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const tables = rows.map(
    (row) => `"public"."${row.tablename.replace(/"/g, '""')}"`,
  );
  if (tables.length) {
    await db.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`,
    );
  }
}
export async function disconnect(): Promise<void> {
  await prisma?.$disconnect();
  prisma = undefined;
}
