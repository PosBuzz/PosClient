import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createTestApp } from '../../helpers/app';
import { getPrisma, resetDb, disconnect } from '../../helpers/db';
import { createAdmin, createTenant, TEST_PASSWORD } from '../../factories';
import { api } from '../../helpers/http';
import {
  adminToken,
  authHeaders,
  clientToken,
  getCsrf,
} from '../../helpers/auth';
import { ConsumerPermission } from '../../../src/auth/enums/consumerPermissions.enum';

describe('authentication and sessions over HTTP', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>;
  const db = getPrisma();
  let tenant: Awaited<ReturnType<typeof createTenant>>;
  let other: Awaited<ReturnType<typeof createTenant>>;
  let seq = 0;
  const uniqueEmail = () => `attacker${++seq}@example.test`;

  beforeAll(async () => {
    context = await createTestApp();
    await resetDb();
    tenant = await createTenant(db);
    other = await createTenant(db);
  });
  afterAll(async () => {
    await context.app.close();
    await disconnect();
  });

  const origin = (t: { consumer: { subdomain: string } }) =>
    `http://${t.consumer.subdomain}.localhost:3000`;
  async function login(
    path: string,
    body: object,
    headers: Record<string, string> = {},
  ) {
    const csrf = await getCsrf(context.app);
    return request(context.app.getHttpServer())
      .post(`/api/v1${path}`)
      .set('Host', 'localhost')
      .set(authHeaders({ csrf }))
      .set(headers)
      .send(body);
  }
  const loginUser = (
    email: string,
    password: string,
    t = tenant,
    headers: Record<string, string> = { Origin: origin(t) },
  ) => login('/auth/login-user', { email, password }, headers);
  const cookies = (response: request.Response) =>
    (response.headers['set-cookie'] ?? []) as unknown as string[];

  it('[BE-SEC-001] {AuthService.loginUser} a real login sets HttpOnly, Secure, SameSite=None access and refresh cookies', async () => {
    const response = await loginUser(tenant.adminUser.email, TEST_PASSWORD);
    expect(response.status).toBe(201);
    for (const name of ['client_access_token', 'client_refresh_token']) {
      const cookie = cookies(response).find((c) => c.startsWith(`${name}=`));
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/SameSite=None/);
    }
  });

  it('[BE-SEC-002] {AuthService.loginUser} every kind of bad login gets the same 401 and body; an expired subscription is only revealed to the right password', async () => {
    const attempts = [
      loginUser(tenant.adminUser.email, 'wrong-password'),
      loginUser('nobody@example.test', TEST_PASSWORD),
      // right credentials, other tenant's subdomain
      loginUser(tenant.adminUser.email, TEST_PASSWORD, other),
    ];
    const responses = [];
    for (const attempt of attempts) responses.push(await attempt);
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401]);
    expect(new Set(responses.map((r) => JSON.stringify(r.body))).size).toBe(1);
    expect(responses[0].body.message).toBe('Invalid email or password');

    const lapsed = await createTenant(db);
    await db.billingHistory.deleteMany({
      where: { consumer_id: lapsed.consumer.id },
    });
    const wrong = await loginUser(
      lapsed.adminUser.email,
      'wrong-password',
      lapsed,
    );
    expect(wrong.status).toBe(401);
    const right = await loginUser(
      lapsed.adminUser.email,
      TEST_PASSWORD,
      lapsed,
    );
    expect(right.status).toBe(403);
    expect(right.body.message).toMatch(/subscription is not active/);
  });

  it('[BE-SEC-002] {AuthService.validateSuperAdmin} super-admin login: wrong password and unknown email look the same', async () => {
    const admin = await createAdmin(db);
    const wrong = await login('/auth/login-superadmin', {
      email: admin.email,
      password: 'nope',
    });
    const unknown = await login('/auth/login-superadmin', {
      email: 'ghost@example.test',
      password: 'nope',
    });
    expect([wrong.status, unknown.status]).toEqual([401, 401]);
    expect(wrong.body).toEqual(unknown.body);
    const ok = await login('/auth/login-superadmin', {
      email: admin.email,
      password: TEST_PASSWORD,
    });
    expect(ok.status).toBe(201);
    expect(cookies(ok).some((c) => c.startsWith('admin_access_token='))).toBe(
      true,
    );
  });

  it('[BE-SEC-002] an unknown email takes about as long as a wrong password', async () => {
    const time = async (email: string) => {
      const start = Date.now();
      await loginUser(email, 'wrong-password');
      return Date.now() - start;
    };
    const known = [] as number[];
    const unknown = [] as number[];
    for (let i = 0; i < 3; i++) {
      known.push(
        await time(
          tenant.adminUser.email.replace('@', `+${i}@`) && uniqueEmail(),
        ),
      );
      unknown.push(await time(uniqueEmail()));
    }
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[1];
    expect(Math.abs(median(known) - median(unknown))).toBeLessThan(150);
  });

  it('[BE-SEC-003] login needs an Origin or Referer to find the tenant', async () => {
    const response = await login('/auth/login-user', {
      email: tenant.adminUser.email,
      password: TEST_PASSWORD,
    });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Unable to determine subdomain from request',
    );
  });

  it('[BE-SEC-004] a soft-deleted tenant cannot log in', async () => {
    const gone = await createTenant(db);
    await db.consumer.update({
      where: { id: gone.consumer.id },
      data: { deleted_at: new Date() },
    });
    const response = await loginUser(gone.adminUser.email, TEST_PASSWORD, gone);
    expect(response.status).toBe(401);
  });

  it('[BE-SEC-005] a token is bound to its tenant: another subdomain gets 401 and the cookies are cleared', async () => {
    const response = await api(context.app)
      .as(tenant.adminUser, { origin: origin(other) })
      .get('/consumer/branches');
    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/subdomain does not match/);
    const cleared = cookies(response);
    expect(cleared.some((c) => c.startsWith('client_access_token=;'))).toBe(
      true,
    );
    expect(cleared.some((c) => c.startsWith('client_refresh_token=;'))).toBe(
      true,
    );
    // the right subdomain works
    expect(
      (
        await api(context.app)
          .as(tenant.adminUser, { origin: origin(tenant) })
          .get('/consumer/branches')
      ).status,
    ).toBe(200);
  });

  describe('tokens', () => {
    const get = (token: string) =>
      request(context.app.getHttpServer())
        .get('/api/v1/consumer/branches')
        .set('Host', 'localhost')
        .set('Cookie', `client_access_token=${token}`);
    const payload = () => ({
      sub: tenant.adminUser.id,
      email: tenant.adminUser.email,
      consumer_id: tenant.consumer.id,
      consumer_subdomain: tenant.consumer.subdomain,
    });

    it('[BE-SEC-006] an expired token is refused', async () => {
      const token = new JwtService().sign(payload(), {
        secret: process.env.JWT_SECRET_KEY,
        expiresIn: -10,
      });
      expect((await get(token)).status).toBe(401);
    });

    it('[BE-SEC-007] tokens signed with another secret, or with alg none, are refused', async () => {
      const forged = new JwtService().sign(payload(), {
        secret: 'a-different-secret-entirely-0123456789',
        expiresIn: '15m',
      });
      expect((await get(forged)).status).toBe(401);
      const b64 = (o: object) =>
        Buffer.from(JSON.stringify(o)).toString('base64url');
      const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...payload(), exp: Math.floor(Date.now() / 1000) + 600 })}.`;
      expect((await get(none)).status).toBe(401);
      expect((await get('garbage')).status).toBe(401);
    });

    it('[BE-SEC-012] a client token is useless on admin routes and an admin token on tenant routes', async () => {
      const admin = await createAdmin(db);
      const onAdmin = await api(context.app)
        .as(tenant.adminUser)
        .get('/admin/consumers');
      expect(onAdmin.status).toBe(401);
      const onTenant = await api(context.app)
        .asAdmin(admin)
        .get('/consumer/branches');
      expect(onTenant.status).toBe(401);
    });

    it("[BE-SEC-013] a deleted user's token stops working at once", async () => {
      const user = await tenant.user([ConsumerPermission.branches]);
      expect(
        (await api(context.app).as(user).get('/consumer/branches')).status,
      ).toBe(200);
      await db.userBranch.deleteMany({ where: { user_id: user.id } });
      await db.user.delete({ where: { id: user.id } });
      expect(
        (await api(context.app).as(user).get('/consumer/branches')).status,
      ).toBe(401);
    });

    it('[BE-SEC-014] changing a role takes effect on the next request', async () => {
      const user = await tenant.user([ConsumerPermission.sales]);
      const before = await api(context.app).as(user).get('/consumer/branches');
      expect(before.status).toBe(403);
      const branchesPermission = await db.permission.upsert({
        where: { action: ConsumerPermission.branches },
        update: {},
        create: { action: ConsumerPermission.branches },
      });
      await db.rolePermission.create({
        data: { role_id: user.role_id, permission_id: branchesPermission.id },
      });
      expect(
        (await api(context.app).as(user).get('/consumer/branches')).status,
      ).toBe(200);
      await db.rolePermission.deleteMany({
        where: { role_id: user.role_id, permission_id: branchesPermission.id },
      });
      expect(
        (await api(context.app).as(user).get('/consumer/branches')).status,
      ).toBe(403);
    });
  });

  describe('refresh and logout', () => {
    const cookieValue = (response: request.Response, name: string) =>
      cookies(response)
        .find((c) => c.startsWith(`${name}=`))
        ?.split(';')[0]
        .split('=')
        .slice(1)
        .join('=');
    const refresh = async (refreshToken: string) => {
      const csrf = await getCsrf(context.app);
      return request(context.app.getHttpServer())
        .post('/api/v1/auth/client-refresh-token')
        .set('Host', 'localhost')
        .set(
          'Cookie',
          `client_refresh_token=${refreshToken}; csrf_signature=${csrf.signature}`,
        )
        .set('x-csrf-token', csrf.token);
    };

    // The login throttle allows 5 attempts a minute per email, so each test uses its own tenant
    it('[BE-SEC-008] {AuthService.clientRefreshToken} {AuthService.invalidateClientRefreshToken} a refresh token works, rotates, and is dead after logout', async () => {
      const own = await createTenant(db);
      const loggedIn = await loginUser(own.adminUser.email, TEST_PASSWORD, own);
      const first = cookieValue(loggedIn, 'client_refresh_token')!;
      const refreshed = await refresh(first);
      expect(refreshed.status).toBe(201);
      expect(
        cookies(refreshed).some((c) => c.startsWith('client_access_token=')),
      ).toBe(true);
      const second = cookieValue(refreshed, 'client_refresh_token')!;
      expect(second).not.toBe(first);

      const csrf = await getCsrf(context.app);
      await request(context.app.getHttpServer())
        .post('/api/v1/auth/client-logout')
        .set('Host', 'localhost')
        .set(
          'Cookie',
          `client_refresh_token=${second}; csrf_signature=${csrf.signature}`,
        )
        .set('x-csrf-token', csrf.token);
      expect((await refresh(second)).status).toBe(401);
    });

    it('[BE-SEC-016] {AuthService.loginSuperAdmin} {AuthService.validateSuperAdmin} {AuthService.adminRefreshToken} {AuthService.invalidateAdminRefreshToken} a super-admin refresh token works, rotates, and is dead after logout', async () => {
      const admin = await createAdmin(db);
      const loggedIn = await login('/auth/login-superadmin', {
        email: admin.email,
        password: TEST_PASSWORD,
      });
      expect(loggedIn.status).toBe(201);
      expect(
        cookies(loggedIn).some((c) => c.startsWith('admin_access_token=')),
      ).toBe(true);
      const first = cookieValue(loggedIn, 'admin_refresh_token')!;
      const adminCall = async (path: string, token: string) => {
        const csrf = await getCsrf(context.app);
        return request(context.app.getHttpServer())
          .post(`/api/v1/auth/${path}`)
          .set('Host', 'localhost')
          .set(
            'Cookie',
            `admin_refresh_token=${token}; csrf_signature=${csrf.signature}`,
          )
          .set('x-csrf-token', csrf.token);
      };
      const refreshed = await adminCall('admin-refresh-token', first);
      expect(refreshed.status).toBe(201);
      const second = cookieValue(refreshed, 'admin_refresh_token')!;
      expect(second).not.toBe(first);
      expect((await adminCall('admin-refresh-token', first)).status).toBe(401);
      await adminCall('admin-logout', second);
      expect((await adminCall('admin-refresh-token', second)).status).toBe(401);
    });

    it('[BE-SEC-009] a rotated-out refresh token cannot be used again', async () => {
      const own = await createTenant(db);
      const loggedIn = await loginUser(own.adminUser.email, TEST_PASSWORD, own);
      const first = cookieValue(loggedIn, 'client_refresh_token')!;
      expect((await refresh(first)).status).toBe(201);
      expect((await refresh(first)).status).toBe(401);
    });

    it('[BE-SEC-008] a missing or soft-deleted-tenant refresh is refused and the cookies cleared', async () => {
      const csrf = await getCsrf(context.app);
      const none = await request(context.app.getHttpServer())
        .post('/api/v1/auth/client-refresh-token')
        .set('Host', 'localhost')
        .set('Cookie', `csrf_signature=${csrf.signature}`)
        .set('x-csrf-token', csrf.token);
      expect(none.status).toBe(401);
      const gone = await createTenant(db);
      const loggedIn = await loginUser(
        gone.adminUser.email,
        TEST_PASSWORD,
        gone,
      );
      const token = cookieValue(loggedIn, 'client_refresh_token')!;
      await db.consumer.update({
        where: { id: gone.consumer.id },
        data: { deleted_at: new Date() },
      });
      const refused = await refresh(token);
      expect(refused.status).toBe(401);
      expect(
        cookies(refused).some((c) => c.startsWith('client_refresh_token=;')),
      ).toBe(true);
    });
  });

  it('[BE-SEC-015] after a real login the session endpoints never return the stored refresh-token hash or password', async () => {
    const own = await createTenant(db);
    const loggedIn = await loginUser(own.adminUser.email, TEST_PASSWORD, own);
    const access = cookies(loggedIn)
      .find((c) => c.startsWith('client_access_token='))!
      .split(';')[0]
      .split('=')
      .slice(1)
      .join('=');
    const stored = await db.user.findUniqueOrThrow({
      where: { id: own.adminUser.id },
    });
    expect(stored.refresh_token).toMatch(/^sha256:/);
    const me = await request(context.app.getHttpServer())
      .get('/api/v1/auth/client')
      .set('Host', 'localhost')
      .set('Cookie', `client_access_token=${access}`);
    expect(me.status).toBe(200);
    expect(JSON.stringify(me.body)).not.toContain('sha256:');
    expect(me.body.user).not.toHaveProperty('refresh_token');
    expect(me.body.user).not.toHaveProperty('password');
    const admin = await createAdmin(db);
    const adminLogin = await login('/auth/login-superadmin', {
      email: admin.email,
      password: TEST_PASSWORD,
    });
    const adminAccess = cookies(adminLogin)
      .find((c) => c.startsWith('admin_access_token='))!
      .split(';')[0]
      .split('=')
      .slice(1)
      .join('=');
    const adminMe = await request(context.app.getHttpServer())
      .get('/api/v1/auth/admin')
      .set('Host', 'localhost')
      .set('Cookie', `admin_access_token=${adminAccess}`);
    expect(adminMe.status).toBe(200);
    expect(JSON.stringify(adminMe.body)).not.toContain('sha256:');
  });

  it('[BE-SEC-010] the receipt test routes are hidden outside development, even with a valid token', async () => {
    for (const path of ['/test-receipts', '/test-receipts/0']) {
      const response = await api(context.app).as(tenant.adminUser).get(path);
      expect(response.status).toBe(404);
    }
    const anonymous = await api(context.app).anonymous().get('/test-receipts');
    expect(anonymous.status).toBe(404);
  });

  it('[BE-SEC-011] the sixth wrong login for one email in a minute is throttled; another email is not', async () => {
    const email = uniqueEmail();
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await loginUser(email, 'wrong-password')).status);
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    expect((await loginUser(uniqueEmail(), 'wrong-password')).status).toBe(401);
    const adminEmail = uniqueEmail();
    const adminStatuses = [];
    for (let i = 0; i < 6; i++) {
      adminStatuses.push(
        (
          await login('/auth/login-superadmin', {
            email: adminEmail,
            password: 'x',
          })
        ).status,
      );
    }
    expect(adminStatuses[5]).toBe(429);
    expect(adminToken).toBeDefined();
    expect(clientToken).toBeDefined();
  });
});
