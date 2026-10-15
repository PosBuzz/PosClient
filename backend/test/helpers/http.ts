import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import {
  adminToken,
  authHeaders,
  clientToken,
  getCsrf,
  AdminIdentity,
  ClientIdentity,
} from './auth';
import { getPrisma } from './db';

type Options = {
  origin?: string;
  csrf?: boolean;
  headers?: Record<string, string>;
};
type Identity =
  | { client: ClientIdentity }
  | { admin: AdminIdentity }
  | undefined;
export function api(app: NestExpressApplication) {
  const session = (identity?: Identity, opts: Options = {}) => {
    const run = async (
      method: 'get' | 'post' | 'patch' | 'put' | 'delete',
      path: string,
      body?: object,
    ) => {
      let client: string | undefined;
      let admin: string | undefined;
      if (identity && 'client' in identity) {
        const consumer = await getPrisma().consumer.findUniqueOrThrow({
          where: { id: identity.client.consumer_id },
        });
        client = clientToken(identity.client, consumer);
      } else if (identity && 'admin' in identity) {
        admin = adminToken(identity.admin);
      }
      const csrf =
        method !== 'get' && opts.csrf !== false
          ? await getCsrf(app)
          : undefined;
      const test = request(app.getHttpServer())
        [method](`/api/v1${path}`)
        .set('Host', 'localhost')
        .set(authHeaders({ client, admin, csrf }));
      if (opts.origin) test.set('Origin', opts.origin);
      if (opts.headers) test.set(opts.headers);
      if (body) test.send(body);
      return test;
    };
    return {
      get: (path: string) => run('get', path),
      post: (path: string, body?: object) => run('post', path, body),
      patch: (path: string, body?: object) => run('patch', path, body),
      put: (path: string, body?: object) => run('put', path, body),
      delete: (path: string) => run('delete', path),
    };
  };
  return {
    as: (user: ClientIdentity, opts?: Options) =>
      session({ client: user }, opts),
    asAdmin: (admin: AdminIdentity, opts?: Options) => session({ admin }, opts),
    anonymous: (opts?: Options) => session(undefined, opts),
  };
}

type Session = ReturnType<ReturnType<typeof api>['anonymous']>;
/** Calls `session.<method>(path, body)` for a method name taken from the route manifest. */
export function dispatch(
  session: Session,
  method: string,
  path: string,
  body?: object,
) {
  switch (method.toUpperCase()) {
    case 'GET':
      return session.get(path);
    case 'POST':
      return session.post(path, body);
    case 'PATCH':
      return session.patch(path, body);
    case 'PUT':
      return session.put(path, body);
    case 'DELETE':
      return session.delete(path);
    default:
      throw new Error(`Unsupported method ${method}`);
  }
}
