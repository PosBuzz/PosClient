import * as request from 'supertest';
import { createTestApp } from '../../helpers/app';
import { disconnect } from '../../helpers/db';
import { getCsrf } from '../../helpers/auth';

describe('CSRF and CORS', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    context = await createTestApp();
  });
  afterAll(async () => {
    await context.app.close();
    await disconnect();
  });
  const server = () => request(context.app.getHttpServer());

  describe('CSRF', () => {
    // POST to a protected route with no login: a valid CSRF pair gets past the CSRF check and
    // is then stopped by authentication (401), never by CSRF (403)
    const post = (headers: Record<string, string>) =>
      server()
        .post('/api/v1/consumer/branches')
        .set('Host', 'localhost')
        .set(headers)
        .send({ name: 'x' });

    it('[BE-CSRF-001] a valid token and signature pass the CSRF check', async () => {
      const csrf = await getCsrf(context.app);
      const response = await post({
        Cookie: `csrf_signature=${csrf.signature}`,
        'x-csrf-token': csrf.token,
      });
      expect(response.status).toBe(401);
    });

    it('[BE-CSRF-002] a missing header, a missing cookie and a mismatched pair are all 403', async () => {
      const a = await getCsrf(context.app);
      const b = await getCsrf(context.app);
      const cases: Record<string, string>[] = [
        { Cookie: `csrf_signature=${a.signature}` },
        { 'x-csrf-token': a.token },
        { Cookie: `csrf_signature=${a.signature}`, 'x-csrf-token': b.token },
        { Cookie: `csrf_signature=forged`, 'x-csrf-token': a.token },
        {},
      ];
      for (const headers of cases) {
        const response = await post(headers);
        expect({ status: response.status, body: response.body }).toEqual({
          status: 403,
          body: { message: 'invalid csrf token' },
        });
      }
    });

    it('[BE-CSRF-003] GET, HEAD and OPTIONS need no CSRF token', async () => {
      expect(
        (await server().get('/api/v1/health').set('Host', 'localhost')).status,
      ).toBe(200);
      expect(
        (await server().head('/api/v1/health').set('Host', 'localhost')).status,
      ).toBe(200);
      expect(
        (
          await server()
            .options('/api/v1/consumer/branches')
            .set('Host', 'localhost')
        ).status,
      ).toBeLessThan(500);
    });

    it('[BE-CSRF-004] public endpoints take POST without a CSRF token', async () => {
      const response = await server()
        .post('/api/v1/public/portfolio/leads')
        .set('Host', 'localhost')
        .send({});
      expect(response.status).not.toBe(403);
    });

    it('[BE-CSRF-005] the signature cookie is HttpOnly, Secure and SameSite=None', async () => {
      const response = await server()
        .get('/api/v1/auth/csrf-token')
        .set('Host', 'localhost');
      const cookie = (
        response.headers['set-cookie'] as unknown as string[]
      ).find((c) => c.startsWith('csrf_signature='))!;
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/SameSite=None/);
    });
  });

  describe('CORS (allowed: http://*.localhost:3000 and http://localhost:3001)', () => {
    const get = (origin: string) =>
      server()
        .get('/api/v1/health')
        .set('Host', 'localhost')
        .set('Origin', origin);

    it('[BE-CORS-001] a tenant origin is echoed back with credentials allowed', async () => {
      const response = await get('http://acme.localhost:3000');
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://acme.localhost:3000',
      );
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      const exact = await get('http://localhost:3001');
      expect(exact.headers['access-control-allow-origin']).toBe(
        'http://localhost:3001',
      );
    });

    it('[BE-CORS-002] an unknown origin is never echoed and gets a clean 403 in the standard error shape', async () => {
      const response = await get('http://evil.com');
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        statusCode: 403,
        message: 'Origin not allowed.',
        error: 'Forbidden',
      });
    });

    it('[BE-CORS-006] a preflight from an unknown origin is refused with the same 403, and no CORS headers', async () => {
      const response = await server()
        .options('/api/v1/auth/login-user')
        .set('Host', 'localhost')
        .set('Origin', 'http://evil.com')
        .set('Access-Control-Request-Method', 'POST');
      expect(response.status).toBe(403);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(response.body.message).toBe('Origin not allowed.');
    });

    it('[BE-CORS-007] a request without an Origin header (curl, mobile apps) is not affected', async () => {
      const response = await server()
        .get('/api/v1/health')
        .set('Host', 'localhost');
      expect(response.status).not.toBe(403);
    });

    it('[BE-CORS-003] the wildcard matches exactly one label', async () => {
      const response = await get('http://a.b.localhost:3000');
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('[BE-CORS-004] the pattern is anchored: a lookalike host is refused', async () => {
      for (const origin of [
        'http://acme.localhost:3000.evil.com',
        'http://evil.com/http://acme.localhost:3000',
        'https://acme.localhost:3000',
      ]) {
        const response = await get(origin);
        expect({
          origin,
          header: response.headers['access-control-allow-origin'],
        }).toEqual({ origin, header: undefined });
      }
    });

    it('[BE-CORS-005] a preflight from an allowed origin lists the methods and the CSRF header', async () => {
      const response = await server()
        .options('/api/v1/consumer/sales')
        .set('Host', 'localhost')
        .set('Origin', 'http://acme.localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'x-csrf-token,content-type');
      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-methods']).toContain(
        'POST',
      );
      expect(response.headers['access-control-allow-headers']).toMatch(
        /X-CSRF-TOKEN/i,
      );
    });
  });
});
