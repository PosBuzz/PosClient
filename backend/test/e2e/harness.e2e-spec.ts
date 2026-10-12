import * as request from 'supertest';
import { createTestApp } from '../helpers/app';
import { getPrisma, resetDb, disconnect } from '../helpers/db';
import { createTenant, createAdmin } from '../factories';
import { api } from '../helpers/http';
import { getCsrf, authHeaders, clientToken } from '../helpers/auth';

describe('Backend harness: shared production middleware and auth', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>;
  const db = getPrisma();
  beforeAll(async () => {
    context = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await context?.app.close();
    await disconnect();
  });
  it('[BE-HARN-003] API prefix and root route work', async () => {
    const response = await api(context.app).anonymous().get('');
    expect(response.status).toBe(200);
    expect(response.text).toBe('Hello World!');
  });
  it('[BE-HARN-007] manually forwarded secure cookie authenticates a real tenant user', async () => {
    const tenant = await createTenant(db);
    const response = await api(context.app)
      .as(tenant.adminUser)
      .get('/auth/client');
    expect(response.status).toBe(200);
    const body = response.body as { user: { consumer_id: number; id: number } };
    expect(body.user.consumer_id).toBe(tenant.consumer.id);
    expect(body.user.id).toBe(tenant.adminUser.id);
  });
  it('[BE-HARN-008] CSRF middleware rejects missing header and accepts a signed token/cookie pair', async () => {
    const tenant = await createTenant(db, { maxBranches: 2 });
    const denied = await api(context.app)
      .as(tenant.adminUser, { csrf: false })
      .post('/consumer/branches', { name: 'Missing CSRF' });
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ message: 'invalid csrf token' });
    const allowed = await api(context.app)
      .as(tenant.adminUser)
      .post('/consumer/branches', { name: 'With CSRF' });
    expect(allowed.status).toBe(201);
    expect(
      await db.branch.count({
        where: { consumer_id: tenant.consumer.id, name: 'With CSRF' },
      }),
    ).toBe(1);
    const csrf = await getCsrf(context.app);
    const tampered = await request(context.app.getHttpServer())
      .post('/api/v1/consumer/branches')
      .set('Host', 'localhost')
      .set(
        authHeaders({
          client: clientToken(tenant.adminUser, tenant.consumer),
          csrf: { ...csrf, token: 'tampered' },
        }),
      )
      .send({ name: 'Tampered' });
    expect(tampered.status).toBe(403);
  });
  it('[BE-HARN-009] Helmet headers and powered-by removal match production', async () => {
    const response = await api(context.app).anonymous().get('');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
  it('[BE-HARN-010] health reaches real Postgres without Redis', async () => {
    const response = await api(context.app).anonymous().get('/health');
    expect(response.status).toBe(200);
    const body = response.body as {
      status: string;
      services: { database: { status: string }; redis: { status: string } };
    };
    expect(body.status).toBe('ok');
    expect(body.services.database.status).toBe('healthy');
    expect(body.services.redis.status).toBe('disabled');
  });
  it('[BE-HARN-015] admin cookie and explicit tenant origin are supported', async () => {
    const admin = await createAdmin(db);
    expect(
      (await api(context.app).asAdmin(admin).get('/auth/admin')).status,
    ).toBe(200);
    const tenant = await createTenant(db);
    expect(
      (
        await api(context.app)
          .as(tenant.adminUser, {
            origin: `http://${tenant.consumer.subdomain}.localhost:3000`,
          })
          .get('/auth/client')
      ).status,
    ).toBe(200);
    expect(
      (
        await api(context.app)
          .as(tenant.adminUser, { origin: 'http://other.localhost:3000' })
          .get('/auth/client')
      ).status,
    ).toBe(401);
  });
  it('[BE-HARN-018] direct-IP requests authenticate without inventing an IP subdomain', async () => {
    const tenant = await createTenant(db);
    const response = await api(context.app)
      .as(tenant.adminUser, { headers: { Host: '127.0.0.1' } })
      .get('/auth/client');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      user: { consumer_id: tenant.consumer.id },
    });
  });
});
