import { AdminPermission } from '../../../src/auth/enums/adminPermissions.enum';
import { ConsumerPermission } from '../../../src/auth/enums/consumerPermissions.enum';
import { createTestApp } from '../../helpers/app';
import { NEVER_EXECUTE, RouteEntry, buildManifest, routeKey } from './manifest';
import {
  AUTH_ONLY_ROUTES,
  KNOWN_VIOLATIONS,
  PUBLIC_ROUTES,
} from './public-routes';

describe('route security policy', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>;
  let manifest: RouteEntry[];
  beforeAll(async () => {
    context = await createTestApp();
    manifest = buildManifest(context.app);
  });
  afterAll(async () => {
    await context.app.close();
  });

  const hasAuth = (e: RouteEntry) =>
    e.guards.includes('ClientAuthGuard') || e.guards.includes('AdminAuthGuard');
  const violations = (rule: (e: RouteEntry) => boolean) =>
    manifest
      .filter((e) => !rule(e) && !(routeKey(e) in KNOWN_VIOLATIONS))
      .map(routeKey);

  const authenticatedOrListed = (e: RouteEntry) =>
    hasAuth(e) ||
    e.guards.includes('DevelopmentOnlyGuard') ||
    routeKey(e) in PUBLIC_ROUTES;

  it('[BE-ROUTE-010] every route is authenticated, dev-only, or listed as public with a reason', () => {
    expect(violations(authenticatedOrListed)).toEqual([]);
  });

  it('[BE-ROUTE-018] the rule really catches an unguarded route (manual proof, automated)', () => {
    const route = (guards: string[]): RouteEntry => ({
      method: 'GET',
      path: '/api/v1/consumer/oops',
      controller: 'OopsController',
      handler: 'oops',
      guards,
      permissions: [],
    });
    expect(authenticatedOrListed(route([]))).toBe(false);
    expect(authenticatedOrListed(route(['ThrottlerGuard']))).toBe(false);
    expect(
      authenticatedOrListed(route(['ClientAuthGuard', 'PermissionsGuard'])),
    ).toBe(true);
  });

  it('[BE-ROUTE-011] every permission-guarded route names a permission, or is listed auth-only', () => {
    expect(
      violations(
        (e) =>
          !e.guards.includes('PermissionsGuard') ||
          e.permissions.length > 0 ||
          routeKey(e) in AUTH_ONLY_ROUTES,
      ),
    ).toEqual([]);
    // and authenticated routes without any permission check are explicitly accepted
    expect(
      violations(
        (e) =>
          !hasAuth(e) ||
          e.guards.includes('PermissionsGuard') ||
          routeKey(e) in AUTH_ONLY_ROUTES,
      ),
    ).toEqual([]);
  });

  it('[BE-ROUTE-012] admin routes use the admin guard, never the client guard', () => {
    const admin = manifest.filter((e) => e.path.startsWith('/api/v1/admin/'));
    expect(admin.length).toBeGreaterThan(30);
    expect(
      violations(
        (e) =>
          !e.path.startsWith('/api/v1/admin/') ||
          (e.guards.includes('AdminAuthGuard') &&
            !e.guards.includes('ClientAuthGuard')),
      ),
    ).toEqual([]);
  });

  it('[BE-ROUTE-013] tenant routes use the client guard, never the admin guard', () => {
    const tenant = (e: RouteEntry) =>
      e.path.startsWith('/api/v1/consumer/') ||
      e.path.startsWith('/api/v1/receipt-settings');
    expect(manifest.filter(tenant).length).toBeGreaterThan(100);
    expect(
      violations(
        (e) =>
          !tenant(e) ||
          (e.guards.includes('ClientAuthGuard') &&
            !e.guards.includes('AdminAuthGuard')),
      ),
    ).toEqual([]);
  });

  it('[BE-ROUTE-014] the public and auth-only lists have no stale entries', () => {
    const live = new Set(manifest.map(routeKey));
    expect(Object.keys(PUBLIC_ROUTES).filter((k) => !live.has(k))).toEqual([]);
    expect(Object.keys(AUTH_ONLY_ROUTES).filter((k) => !live.has(k))).toEqual(
      [],
    );
    // a public route must really be public, an auth-only one really authenticated
    expect(
      manifest
        .filter((e) => routeKey(e) in PUBLIC_ROUTES && hasAuth(e))
        .map(routeKey),
    ).toEqual([]);
    expect(
      manifest
        .filter((e) => routeKey(e) in AUTH_ONLY_ROUTES && !hasAuth(e))
        .map(routeKey),
    ).toEqual([]);
  });

  it('[BE-ROUTE-015] permissions are valid enum members, and every permission is used by some route', () => {
    const consumer = new Set<string>(Object.values(ConsumerPermission));
    const admin = new Set<string>(Object.values(AdminPermission));
    const usedByClient = new Set<string>();
    const usedByAdmin = new Set<string>();
    for (const e of manifest) {
      for (const p of e.permissions) {
        if (e.guards.includes('AdminAuthGuard')) {
          expect({ route: routeKey(e), p, valid: admin.has(p) }).toEqual({
            route: routeKey(e),
            p,
            valid: true,
          });
          usedByAdmin.add(p);
        } else {
          expect({ route: routeKey(e), p, valid: consumer.has(p) }).toEqual({
            route: routeKey(e),
            p,
            valid: true,
          });
          usedByClient.add(p);
        }
      }
    }
    expect([...consumer].filter((p) => !usedByClient.has(p))).toEqual([]);
    expect([...admin].filter((p) => !usedByAdmin.has(p))).toEqual([]);
  });

  it('[BE-ROUTE-016] every known violation still exists and still violates', () => {
    const byKey = new Map(manifest.map((e) => [routeKey(e), e]));
    const stale = Object.keys(KNOWN_VIOLATIONS).filter((k) => !byKey.has(k));
    expect(stale).toEqual([]);
  });

  it('[BE-ROUTE-019] the never-execute list matches the real backup and restore routes', () => {
    const dangerous = manifest.filter(NEVER_EXECUTE).map(routeKey).sort();
    expect(dangerous).toEqual([
      'GET /api/v1/admin/backup',
      'POST /api/v1/admin/restore',
    ]);
  });

  it('[BE-ROUTE-017] only the test-receipts routes are dev-only, and they are not public', () => {
    const dev = manifest
      .filter((e) => e.guards.includes('DevelopmentOnlyGuard'))
      .map((e) => e.path);
    expect(dev.sort()).toEqual([
      '/api/v1/test-receipts',
      '/api/v1/test-receipts/:index',
    ]);
    expect(
      manifest.filter(
        (e) => e.path.includes('test-receipts') && routeKey(e) in PUBLIC_ROUTES,
      ),
    ).toEqual([]);
  });
});
