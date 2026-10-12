import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as request from 'supertest';
import { createTestApp } from '../helpers/app';
import { getPrisma, resetDb, disconnect } from '../helpers/db';
import { getCsrf, authHeaders } from '../helpers/auth';

const backend = resolve(__dirname, '../..');
const migrations = resolve(backend, 'prisma/migrations');
const cli = (args: string[], env: Record<string, string> = {}) =>
  execFileSync(resolve(backend, 'node_modules/.bin', args[0]), args.slice(1), {
    cwd: backend,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

describe('schema and migrations', () => {
  const db = getPrisma();
  afterAll(disconnect);

  it('[BE-SCHEMA-001] the migrations applied to an empty database (global setup) leave every table in place', async () => {
    const [{ n }] = await db.$queryRaw<
      { n: bigint }[]
    >`SELECT COUNT(*) AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    expect(Number(n)).toBe(
      readdirSync(migrations).filter((f) => /^\d{14}/.test(f)).length,
    );
  });

  it('[BE-SCHEMA-002] the migrated database has no drift from schema.prisma', () => {
    const sql = cli([
      'prisma',
      'migrate',
      'diff',
      '--from-url',
      process.env.DATABASE_URL!,
      '--to-schema-datamodel',
      'prisma/schema.prisma',
      '--script',
    ]);
    const statements = sql
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('--'));
    expect({ drift: statements.join('\n') }).toEqual({ drift: '' });
  }, 120000);

  it('[BE-SCHEMA-008] the drift check really reports a difference when the database changes', async () => {
    await db.$executeRawUnsafe(
      'ALTER TABLE "tags" ADD COLUMN "zz_drift_probe" integer',
    );
    try {
      const sql = cli([
        'prisma',
        'migrate',
        'diff',
        '--from-url',
        process.env.DATABASE_URL!,
        '--to-schema-datamodel',
        'prisma/schema.prisma',
        '--script',
      ]);
      expect(sql).toMatch(/zz_drift_probe/);
    } finally {
      await db.$executeRawUnsafe(
        'ALTER TABLE "tags" DROP COLUMN "zz_drift_probe"',
      );
    }
  }, 120000);

  it('[BE-SCHEMA-003] every migration folder is named like a timestamp and holds a migration.sql', () => {
    const folders = readdirSync(migrations, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    expect(folders.length).toBeGreaterThan(20);
    expect(folders.filter((f) => !/^\d{14}_[a-z0-9_]*$/.test(f))).toEqual([]);
    expect(
      folders.filter(
        (f) => !existsSync(resolve(migrations, f, 'migration.sql')),
      ),
    ).toEqual([]);
    expect([...folders].sort()).toEqual(folders.sort());
  });

  it('[BE-SCHEMA-005] the migration lock names PostgreSQL', () => {
    expect(
      readFileSync(resolve(migrations, 'migration_lock.toml'), 'utf8'),
    ).toMatch(/provider\s*=\s*"postgresql"/);
  });

  it('[BE-SCHEMA-006] the seed script runs on a migrated database and the seeded accounts can log in', async () => {
    await resetDb();
    cli(['tsx', 'prisma/seed.ts'], { DATABASE_URL: process.env.DATABASE_URL! });
    const { app } = await createTestApp();
    try {
      const login = async (path: string, body: object, origin?: string) => {
        const csrf = await getCsrf(app);
        const test = request(app.getHttpServer())
          .post(`/api/v1${path}`)
          .set('Host', 'localhost')
          .set(authHeaders({ csrf }))
          .send(body);
        return origin ? test.set('Origin', origin) : test;
      };
      const admin = await login('/auth/login-superadmin', {
        email: 'superadmin@posbuzz.cloud',
        password: 'PosBuzz!234',
      });
      expect(admin.status).toBe(201);
      const consumer = await db.consumer.findUniqueOrThrow({
        where: { subdomain: 'consumer1' },
      });
      const user = await db.user.findFirstOrThrow({
        where: { consumer_id: consumer.id, role: { is_admin: true } },
      });
      const tenant = await login(
        '/auth/login-user',
        { email: user.email, password: 'PosBuzz!234' },
        `http://${consumer.subdomain}.localhost:3000`,
      );
      expect({
        status: tenant.status,
        body: tenant.body?.message,
      }).toMatchObject({ status: 201 });
    } finally {
      await app.close();
      await resetDb();
    }
  }, 180000);

  it('[BE-SCHEMA-007] tenant-owned tables lead an index with consumer_id (known exceptions are listed)', async () => {
    const rows = await db.$queryRaw<{ tbl: string }[]>`
      SELECT c.table_name AS tbl
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.column_name = 'consumer_id'
        AND NOT EXISTS (
          SELECT 1 FROM pg_index i
          JOIN pg_class t ON t.oid = i.indrelid
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
          WHERE t.relname = c.table_name AND a.attname = 'consumer_id')`;
    // Every tenant-scoped table has an index that starts with consumer_id today. A new table that
    // does not is a per-tenant scan waiting to happen: add the index, or list the table here with a reason.
    const KNOWN_WITHOUT_INDEX: Record<string, string> = {};
    expect(
      rows.map((r) => r.tbl).filter((t) => !(t in KNOWN_WITHOUT_INDEX)),
    ).toEqual([]);
  });
});
