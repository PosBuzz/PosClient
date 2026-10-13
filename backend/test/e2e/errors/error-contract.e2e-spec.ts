import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { Boot, bootDomain } from '../../helpers/domain';
import { getPrisma, resetDb, disconnect } from '../../helpers/db';
import { createAdmin } from '../../factories';
import { api, dispatch } from '../../helpers/http';
import { seedTenant, SeededTenant } from '../tenancy/seed';
import { NEVER_EXECUTE, type RouteEntry } from '../security/manifest';

const manifest: RouteEntry[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../contracts/routes.json'), 'utf8'),
);
const authed = manifest.filter(
  (e) =>
    e.guards.includes('ClientAuthGuard') || e.guards.includes('AdminAuthGuard'),
);
const GARBAGE = {
  id: 'x',
  quantity: 'abc',
  items: 'nope',
  name: { a: 1 },
  amount: -1e99,
  payments: 5,
  variants: 'x',
  permission_ids: 'x',
};
const fillWith = (path: string, value: string) => path.replace(/:\w+/g, value);

interface ErrorResponse {
  route: string;
  status: number;
  body: any;
}

describe('error contract over every route', () => {
  const db = getPrisma();
  let boot: Boot;
  let a: SeededTenant;
  let admin: Awaited<ReturnType<typeof createAdmin>>;
  const errors: ErrorResponse[] = [];
  const emptyCreates: ErrorResponse[] = [];

  const session = (e: RouteEntry) =>
    e.guards.includes('AdminAuthGuard')
      ? api(boot.app).asAdmin(admin)
      : api(boot.app).as(a.tenant.adminUser);

  beforeAll(async () => {
    await resetDb();
    boot = await bootDomain();
    a = await seedTenant(db, boot, 'EEEEEE');
    admin = await createAdmin(db);
    for (const e of authed) {
      if (NEVER_EXECUTE(e)) continue;
      const path = e.path.replace('/api/v1', '');
      const attempts: Array<[string, object | undefined]> = [];
      if (e.method !== 'GET') {
        attempts.push([fillWith(path, '999999'), {}]);
        attempts.push([fillWith(path, '999999'), GARBAGE]);
      }
      if (e.path.includes(':')) {
        for (const junk of ['abc', '-1', '99999999999']) {
          attempts.push([
            fillWith(path, junk),
            e.method === 'GET' ? undefined : {},
          ]);
        }
      }
      for (const [target, body] of attempts) {
        const response = await dispatch(session(e), e.method, target, body);
        const record = {
          route: `${e.method} ${e.path}`,
          status: response.status,
          body: response.body,
        };
        if (response.status >= 400) errors.push(record);
        if (e.method === 'POST' && body && Object.keys(body).length === 0) {
          emptyCreates.push(record);
        }
      }
    }
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });

  const describeError = (item: ErrorResponse) =>
    `${item.route} -> ${item.status} ${JSON.stringify(item.body)}`;

  it('[X-ERR-020] the sweep produced error responses and each has a numeric statusCode and a string message', () => {
    expect(errors.length).toBeGreaterThan(300);
    const invalid = errors.filter(
      (item) =>
        typeof item.body?.statusCode !== 'number' ||
        typeof item.body?.message !== 'string',
    );
    expect(invalid.map(describeError)).toEqual([]);
  });

  it('[X-ERR-021] every message is readable: capitalised, short, no field paths or placeholders', () => {
    const forbidden =
      /\b\w+\.\d+\.\w+\b|Enum\b|\bP20\d\d\b|\bundefined\b|\bnull\b|\[object Object\]/;
    const offenders = errors.filter(
      (item) =>
        typeof item.body?.message === 'string' &&
        (!/^[A-Z0-9"'(]/.test(item.body.message) ||
          item.body.message.length > 200 ||
          forbidden.test(item.body.message)),
    );
    expect(offenders.map(describeError)).toEqual([]);
  });

  it('[X-ERR-022] no error body exposes Prisma, SQL, stack frames or table names', () => {
    const tables = Prisma.dmmf.datamodel.models
      .map((model) => model.dbName ?? model.name)
      .filter((name) => name.includes('_'));
    const leak = new RegExp(
      [
        'prisma',
        'PrismaClient',
        '\\bat /',
        '\\.ts:\\d+',
        '\\bSELECT\\s',
        '\\bINSERT\\s',
        '\\bUPDATE\\s+\\w+\\s+SET',
        ...tables.map((table) => `\\b${table}\\b`),
      ].join('|'),
      'i',
    );
    const offenders = errors.filter((item) =>
      leak.test(JSON.stringify(item.body)),
    );
    expect(offenders.map(describeError)).toEqual([]);
  });

  it('[X-ERR-023] an empty body on a create route is never a server error', () => {
    expect(emptyCreates.length).toBeGreaterThan(80);
    expect(
      emptyCreates.filter((item) => item.status >= 500).map(describeError),
    ).toEqual([]);
  });
});
