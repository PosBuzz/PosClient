import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { parse } from 'cookie';
import * as request from 'supertest';

export interface Csrf {
  token: string;
  signature: string;
}
export interface ClientIdentity {
  id: number;
  email: string;
  consumer_id: number;
}
export interface AdminIdentity {
  id: number;
  email: string;
}

function sign(payload: object): string {
  if (!process.env.JWT_SECRET_KEY) {
    throw new Error('Test JWT secret is not loaded');
  }
  return new JwtService().sign(payload, {
    secret: process.env.JWT_SECRET_KEY,
    expiresIn: '15m',
  });
}
export const clientToken = (
  user: ClientIdentity,
  consumer: { subdomain: string },
): string =>
  sign({
    sub: user.id,
    email: user.email,
    consumer_id: user.consumer_id,
    consumer_subdomain: consumer.subdomain,
  });
export const adminToken = (admin: AdminIdentity): string =>
  sign({ email: admin.email, sub: admin.id });
export async function getCsrf(app: NestExpressApplication): Promise<Csrf> {
  const response = await request(app.getHttpServer())
    .get('/api/v1/auth/csrf-token')
    .set('Host', 'localhost')
    .expect(200);
  const body = response.body as { csrfToken: string };
  const cookies = response.headers['set-cookie'] as unknown as string[];
  const signature = cookies
    .flatMap((value) => Object.entries(parse(value.split(';')[0])))
    .find(([name]) => name === 'csrf_signature')?.[1];
  if (!body.csrfToken || !signature) {
    throw new Error('CSRF endpoint did not return token and signature');
  }
  return { token: body.csrfToken, signature };
}
export function authHeaders(opts: {
  client?: string;
  admin?: string;
  csrf?: Csrf;
}): Record<string, string> {
  const cookies: string[] = [];
  if (opts.client) cookies.push(`client_access_token=${opts.client}`);
  if (opts.admin) cookies.push(`admin_access_token=${opts.admin}`);
  if (opts.csrf) cookies.push(`csrf_signature=${opts.csrf.signature}`);
  return {
    ...(cookies.length ? { Cookie: cookies.join('; ') } : {}),
    ...(opts.csrf ? { 'x-csrf-token': opts.csrf.token } : {}),
  };
}
