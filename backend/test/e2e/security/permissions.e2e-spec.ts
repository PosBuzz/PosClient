import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AdminPermission } from '../../../src/auth/enums/adminPermissions.enum';
import { ConsumerPermission } from '../../../src/auth/enums/consumerPermissions.enum';
import { createTestApp } from '../../helpers/app';
import { getPrisma, resetDb, disconnect } from '../../helpers/db';
import { createAdmin, createTenant } from '../../factories';
import { api, dispatch } from '../../helpers/http';
import type { RouteEntry } from './manifest';

// Cases come from the committed manifest (BE-ROUTE-003 proves it equals the live one)
const manifest: RouteEntry[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../contracts/routes.json'), 'utf8'),
);
const guarded = manifest.filter(
  (e) => e.guards.includes('PermissionsGuard') && e.permissions.length > 0,
);
// Running these would start a real database dump/restore; the guard verdict is still checked
const NEVER_EXECUTE = (e: RouteEntry) => e.path.includes('/backup-restore');
const fill = (path: string) =>
  path.replace(/:(\w+)/g, (_m, name: string) =>
    /number|code|name|entity|slug|key|reference/i.test(name) ? 'x' : '999999',
  );
const id = (e: RouteEntry) => `${e.method} ${e.path}`;

describe('permission matrix (generated from the route manifest)', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>;
  const db = getPrisma();
  let tenant: Awaited<ReturnType<typeof createTenant>>;
  const users = new Map<string, Awaited<ReturnType<typeof tenant.user>>>();
  const admins = new Map<string, Awaited<ReturnType<typeof createAdmin>>>();

  beforeAll(async () => {
    context = await createTestApp();
    await resetDb();
    tenant = await createTenant(db, { maxBranches: 3 });
  });
  afterAll(async () => {
    await context.app.close();
    await disconnect();
  });

  const clientUser = async (permissions: ConsumerPermission[]) => {
    const key = [...permissions].sort().join(',');
    if (!users.has(key)) users.set(key, await tenant.user(permissions));
    return users.get(key)!;
  };
  const adminUser = async (permissions: AdminPermission[]) => {
    const key = [...permissions].sort().join(',');
    if (!admins.has(key)) {
      admins.set(key, await createAdmin(db, {}, permissions));
    }
    return admins.get(key)!;
  };
  const call = (
    e: RouteEntry,
    session: ReturnType<ReturnType<typeof api>['anonymous']>,
  ) => {
    const path = fill(e.path.replace('/api/v1', ''));
    return dispatch(session, e.method, path, {});
  };
  const denied = (response: { status: number; body: { message?: string } }) =>
    response.status === 403 && response.body?.message === 'Forbidden resource';

  it('[BE-PERM-000] the matrix covers the guarded routes', () => {
    expect(guarded.length).toBeGreaterThan(200);
  });

  describe.each(guarded.map((e) => [id(e), e] as const))('%s', (_name, e) => {
    const isAdmin = e.guards.includes('AdminAuthGuard');

    it('[BE-PERM-a] anonymous is 401', async () => {
      const response = await call(e, api(context.app).anonymous());
      expect(response.status).toBe(401);
    });

    it('[BE-PERM-b] a user with every permission except the required ones is 403', async () => {
      const response = isAdmin
        ? await call(
            e,
            api(context.app).asAdmin(
              await adminUser(
                Object.values(AdminPermission).filter(
                  (p) => !e.permissions.includes(p),
                ),
              ),
            ),
          )
        : await call(
            e,
            api(context.app).as(
              await clientUser(
                Object.values(ConsumerPermission).filter(
                  (p) => !e.permissions.includes(p),
                ),
              ),
            ),
          );
      expect({
        status: response.status,
        message: response.body?.message,
      }).toEqual({ status: 403, message: 'Forbidden resource' });
    });

    (NEVER_EXECUTE(e) ? it.skip : it)(
      '[BE-PERM-c] a user with exactly the required permissions gets past the guards',
      async () => {
        const response = isAdmin
          ? await call(
              e,
              api(context.app).asAdmin(
                await adminUser(e.permissions as AdminPermission[]),
              ),
            )
          : await call(
              e,
              api(context.app).as(
                await clientUser(e.permissions as ConsumerPermission[]),
              ),
            );
        expect(response.status).not.toBe(401);
        expect(denied(response)).toBe(false);
      },
    );
  });
});
