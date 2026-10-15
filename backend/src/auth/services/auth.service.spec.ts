import { HttpException, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHmac } from 'crypto';
import { expectGenericWrapping } from '../../../test/helpers/error-wrapping';
import { AuthService } from './auth.service';

const SECRET = 'unit-test-secret-0123456789';
const config: any = {
  jwtSecret: SECRET,
  jwtAlgorithm: 'HS256',
  jwtExpiration: '15m',
  jwtRefreshExpiration: '7d',
};

const hashOf = (token: string) =>
  `sha256:${createHmac('sha256', SECRET).update(token).digest('base64url')}`;

function setup() {
  const mk = (...names: string[]) =>
    Object.fromEntries(names.map((n) => [n, jest.fn()]));
  const prisma: any = {
    superAdmin: mk('update', 'findUnique', 'findFirst', 'updateMany'),
    user: mk('update', 'findFirst', 'updateMany'),
  };
  const jwt = new JwtService({ secret: SECRET });
  return { prisma, jwt, service: new AuthService(jwt, prisma, config) };
}

describe('AuthService (unit)', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('login', () => {
    const user = {
      email: 'a@x.io',
      id: 4,
      consumer_id: 9,
      consumer_subdomain: 'acme',
    };

    it('[BE-MUT-430] loginUser issues a 15 minute access token and a 7 day refresh token with the tenant claims and stores only the refresh hash', async () => {
      const { prisma, jwt, service } = setup();
      const result = await service.loginUser(user);
      const access: any = jwt.verify(result.access_token, {
        algorithms: ['HS256'],
      });
      const refresh: any = jwt.verify(result.refresh_token, {
        algorithms: ['HS256'],
      });
      expect(access).toMatchObject({
        email: 'a@x.io',
        sub: 4,
        consumer_id: 9,
        consumer_subdomain: 'acme',
      });
      expect(access.exp - access.iat).toBe(15 * 60);
      expect(refresh.exp - refresh.iat).toBe(7 * 24 * 3600);
      expect(refresh).toMatchObject({ sub: 4, consumer_id: 9 });
      expect(access.jti).toBeTruthy();
      expect(refresh.jti).toBeTruthy();
      expect(access.jti).not.toBe(refresh.jti);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { refresh_token: hashOf(result.refresh_token) },
      });
      expect(JSON.stringify(prisma.user.update.mock.calls)).not.toContain(
        result.refresh_token,
      );
    });

    it('[BE-MUT-431] two logins in the same second still get different refresh tokens', async () => {
      const { service } = setup();
      const a = await service.loginUser(user);
      const b = await service.loginUser(user);
      expect(a.refresh_token).not.toBe(b.refresh_token);
    });

    it('[BE-MUT-432] loginSuperAdmin issues tokens carrying only email and id and stores the refresh hash', async () => {
      const { prisma, jwt, service } = setup();
      const result = await service.loginSuperAdmin({ email: 's@x.io', id: 2 });
      const access: any = jwt.verify(result.access_token);
      expect(access).toMatchObject({ email: 's@x.io', sub: 2 });
      expect(access.consumer_id).toBeUndefined();
      expect(access.exp - access.iat).toBe(15 * 60);
      const refresh: any = jwt.verify(result.refresh_token);
      expect(refresh.exp - refresh.iat).toBe(7 * 24 * 3600);
      expect(prisma.superAdmin.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { refresh_token: hashOf(result.refresh_token) },
      });
    });

    it('[BE-MUT-433] login failures are logged with the email and hidden behind generic 500s', async () => {
      await expectGenericWrapping({
        run: (f) => {
          const { prisma, service } = setup();
          prisma.user.update.mockRejectedValue(f);
          return service.loginUser(user);
        },
        message: 'Failed to login user',
        logged: ['Error occurred while logging in user for a@x.io'],
      });
      await expectGenericWrapping({
        run: (f) => {
          const { prisma, service } = setup();
          prisma.superAdmin.update.mockRejectedValue(f);
          return service.loginSuperAdmin({ email: 's@x.io', id: 2 });
        },
        message: 'Failed to login super admin',
        logged: ['Error occurred while logging in super admin for s@x.io'],
      });
    });
  });

  describe('validateSuperAdmin', () => {
    const row = () => ({
      id: 2,
      email: 's@x.io',
      password: bcrypt.hashSync('right', 4),
    });

    it('[BE-MUT-434] the right password returns the account', async () => {
      const { prisma, service } = setup();
      prisma.superAdmin.findUnique.mockResolvedValue(row());
      await expect(
        service.validateSuperAdmin('s@x.io', 'right'),
      ).resolves.toMatchObject({
        id: 2,
      });
      expect(prisma.superAdmin.findUnique).toHaveBeenCalledWith({
        where: { email: 's@x.io' },
      });
    });

    it('[BE-MUT-435] a wrong password and an unknown email give the same 401, and the unknown email still runs a password comparison', async () => {
      const { prisma, service } = setup();
      const compare = jest.spyOn(bcrypt, 'compare');
      prisma.superAdmin.findUnique.mockResolvedValue(row());
      const wrong = await service
        .validateSuperAdmin('s@x.io', 'nope')
        .catch((e) => e);
      prisma.superAdmin.findUnique.mockResolvedValue(null);
      compare.mockClear();
      const unknown = await service
        .validateSuperAdmin('who@x.io', 'right')
        .catch((e) => e);
      for (const error of [wrong, unknown]) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe('Invalid email or password');
      }
      expect(compare).toHaveBeenCalledTimes(1);
      expect(compare.mock.calls[0][0]).toBe('right');
      expect(compare.mock.calls[0][1]).toMatch(/^\$2[aby]\$10\$/);
      compare.mockRestore();
    });

    it('[BE-MUT-436] an unknown email can never authenticate, even with the timing-equalizer password', async () => {
      const { prisma, service } = setup();
      prisma.superAdmin.findUnique.mockResolvedValue(null);
      await expect(
        service.validateSuperAdmin('who@x.io', 'posbuzz-timing-equalizer'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('[BE-MUT-437] lookup failures are logged with the email and hidden behind a generic 500', async () => {
      await expectGenericWrapping({
        run: (f) => {
          const { prisma, service } = setup();
          prisma.superAdmin.findUnique.mockRejectedValue(f);
          return service.validateSuperAdmin('s@x.io', 'x');
        },
        message: 'Failed to validate super admin',
        logged: ['Error occurred while validating super admin for s@x.io'],
      });
    });
  });

  describe('validateUser', () => {
    const NOW = new Date('2026-05-05T10:00:00.000Z');
    const row = (billing: object[] = [{ id: 1 }]) => ({
      id: 4,
      password: bcrypt.hashSync('right', 4),
      consumer: { subdomain: 'acme', billing_logs: billing },
    });

    it('[BE-MUT-438] the lookup is scoped to the tenant, excludes deleted tenants and loads only the billing period covering now', async () => {
      jest.useFakeTimers().setSystemTime(NOW);
      const { prisma, service } = setup();
      prisma.user.findFirst.mockResolvedValue(row());
      await expect(
        service.validateUser('a@x.io', 'right', 'acme'),
      ).resolves.toMatchObject({
        id: 4,
      });
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'a@x.io',
          consumer: { subdomain: 'acme', deleted_at: null },
        },
        include: {
          consumer: {
            select: {
              subdomain: true,
              billing_logs: {
                where: {
                  billing_from: { lte: NOW },
                  billing_till: { gte: NOW },
                },
              },
            },
          },
        },
      });
    });

    it('[BE-MUT-439] wrong password and unknown account give the same 401', async () => {
      const { prisma, service } = setup();
      prisma.user.findFirst.mockResolvedValue(row());
      const wrong = await service
        .validateUser('a@x.io', 'nope', 'acme')
        .catch((e) => e);
      prisma.user.findFirst.mockResolvedValue(null);
      const unknown = await service
        .validateUser('z@x.io', 'right', 'acme')
        .catch((e) => e);
      for (const error of [wrong, unknown]) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe('Invalid email or password');
      }
    });

    it('[BE-MUT-440] an inactive subscription is a 403 only revealed after the password is right', async () => {
      const { prisma, service } = setup();
      prisma.user.findFirst.mockResolvedValue(row([]));
      const error = await service
        .validateUser('a@x.io', 'right', 'acme')
        .catch((e) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(403);
      expect(error.message).toBe(
        'Your subscription is not active. Please renew it or contact support to continue.',
      );
      const wrong = await service
        .validateUser('a@x.io', 'nope', 'acme')
        .catch((e) => e);
      expect(wrong).toBeInstanceOf(UnauthorizedException);
    });

    it('[BE-MUT-441] lookup failures are logged with the email and hidden behind a generic 500', async () => {
      await expectGenericWrapping({
        run: (f) => {
          const { prisma, service } = setup();
          prisma.user.findFirst.mockRejectedValue(f);
          return service.validateUser('a@x.io', 'x', 'acme');
        },
        message: 'Failed to validate user',
        logged: ['Error occurred while validating user for a@x.io'],
      });
    });
  });

  describe('clientRefreshToken', () => {
    const issue = (jwt: JwtService, extra: object = {}) =>
      jwt.sign(
        {
          email: 'a@x.io',
          sub: 4,
          consumer_id: 9,
          consumer_subdomain: 'old',
          ...extra,
        },
        { expiresIn: '7d', algorithm: 'HS256' },
      );

    it('[BE-MUT-442] a valid refresh token is rotated atomically and the new pair carries the current subdomain', async () => {
      const { prisma, jwt, service } = setup();
      const old = issue(jwt);
      prisma.user.findFirst.mockResolvedValue({
        id: 4,
        refresh_token: hashOf(old),
        consumer: { subdomain: 'acme', deleted_at: null },
      });
      prisma.user.updateMany.mockResolvedValue({ count: 1 });
      const result = await service.clientRefreshToken(old);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 4,
          OR: [{ refresh_token: hashOf(old) }, { refresh_token: old }],
        },
        include: {
          consumer: { select: { subdomain: true, deleted_at: true } },
        },
      });
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 4, refresh_token: hashOf(old) },
        data: { refresh_token: hashOf(result.refresh_token) },
      });
      const access: any = jwt.verify(result.access_token);
      expect(access).toMatchObject({
        email: 'a@x.io',
        sub: 4,
        consumer_id: 9,
        consumer_subdomain: 'acme',
      });
      expect(access.exp - access.iat).toBe(15 * 60);
      const refresh: any = jwt.verify(result.refresh_token);
      expect(refresh.exp - refresh.iat).toBe(7 * 24 * 3600);
      expect(result.refresh_token).not.toBe(old);
    });

    it('[BE-MUT-443] an unknown token is a 401; a soft-deleted tenant is a 401 and nothing is rotated', async () => {
      const { prisma, jwt, service } = setup();
      const old = issue(jwt);
      prisma.user.findFirst.mockResolvedValue(null);
      const unknown = await service.clientRefreshToken(old).catch((e) => e);
      expect(unknown.getStatus()).toBe(401);
      expect(unknown.message).toBe('Invalid refresh token');
      prisma.user.findFirst.mockResolvedValue({
        id: 4,
        refresh_token: hashOf(old),
        consumer: { subdomain: 'acme', deleted_at: new Date() },
      });
      const deleted = await service.clientRefreshToken(old).catch((e) => e);
      expect(deleted.getStatus()).toBe(401);
      expect(deleted.message).toBe('This account is no longer active');
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('[BE-MUT-444] losing the rotation race is a 401 and no access token is issued', async () => {
      const { prisma, jwt, service } = setup();
      const old = issue(jwt);
      prisma.user.findFirst.mockResolvedValue({
        id: 4,
        refresh_token: hashOf(old),
        consumer: { subdomain: 'acme', deleted_at: null },
      });
      for (const count of [0, 2]) {
        prisma.user.updateMany.mockResolvedValue({ count });
        const error = await service.clientRefreshToken(old).catch((e) => e);
        expect(error.getStatus()).toBe(401);
        expect(error.message).toBe('Refresh token already rotated');
      }
    });

    it('[BE-MUT-445] a token signed with another key or algorithm is rejected without touching the database', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const { prisma, service } = setup();
      const forged = new JwtService({ secret: 'other-secret' }).sign(
        { email: 'a@x.io', sub: 4 },
        { expiresIn: '7d' },
      );
      const error = await service.clientRefreshToken(forged).catch((e) => e);
      expect(error.getStatus()).toBe(500);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      const none = new JwtService({ secret: SECRET }).sign(
        { email: 'a@x.io', sub: 4 },
        { expiresIn: '7d', algorithm: 'HS512' },
      );
      await service.clientRefreshToken(none).catch(() => undefined);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('[BE-MUT-446] unexpected failures are logged and hidden behind a generic 500', async () => {
      await expectGenericWrapping({
        run: (f) => {
          const { prisma, jwt, service } = setup();
          prisma.user.findFirst.mockRejectedValue(f);
          return service.clientRefreshToken(issue(jwt));
        },
        message: 'Failed to refresh client token',
        logged: ['Error occurred while refreshing client token'],
      });
    });
  });

  describe('adminRefreshToken', () => {
    const issue = (jwt: JwtService) =>
      jwt.sign(
        { email: 's@x.io', sub: 2 },
        { expiresIn: '7d', algorithm: 'HS256' },
      );

    it('[BE-MUT-447] a valid admin refresh token is rotated atomically with email and id only', async () => {
      const { prisma, jwt, service } = setup();
      const old = issue(jwt);
      prisma.superAdmin.findFirst.mockResolvedValue({
        id: 2,
        refresh_token: old,
      });
      prisma.superAdmin.updateMany.mockResolvedValue({ count: 1 });
      const result = await service.adminRefreshToken(old);
      expect(prisma.superAdmin.findFirst).toHaveBeenCalledWith({
        where: {
          id: 2,
          OR: [{ refresh_token: hashOf(old) }, { refresh_token: old }],
        },
      });
      expect(prisma.superAdmin.updateMany).toHaveBeenCalledWith({
        where: { id: 2, refresh_token: old },
        data: { refresh_token: hashOf(result.refresh_token) },
      });
      const access: any = jwt.verify(result.access_token);
      expect(access).toMatchObject({ email: 's@x.io', sub: 2 });
      expect(access.exp - access.iat).toBe(15 * 60);
      const refresh: any = jwt.verify(result.refresh_token);
      expect(refresh.exp - refresh.iat).toBe(7 * 24 * 3600);
    });

    it('[BE-MUT-448] an unknown token and a lost rotation race are 401s; failures are hidden behind a generic 500', async () => {
      const { prisma, jwt, service } = setup();
      const old = issue(jwt);
      prisma.superAdmin.findFirst.mockResolvedValue(null);
      const unknown = await service.adminRefreshToken(old).catch((e) => e);
      expect(unknown.getStatus()).toBe(401);
      expect(unknown.message).toBe('Invalid refresh token');
      prisma.superAdmin.findFirst.mockResolvedValue({
        id: 2,
        refresh_token: old,
      });
      for (const count of [0, 2]) {
        prisma.superAdmin.updateMany.mockResolvedValue({ count });
        const raced = await service.adminRefreshToken(old).catch((e) => e);
        expect(raced.getStatus()).toBe(401);
        expect(raced.message).toBe('Refresh token already rotated');
      }
      await expectGenericWrapping({
        run: (f) => {
          const ctx = setup();
          ctx.prisma.superAdmin.findFirst.mockRejectedValue(f);
          return ctx.service.adminRefreshToken(issue(ctx.jwt));
        },
        message: 'Failed to refresh admin token',
        logged: ['Error occurred while refreshing admin token'],
      });
    });
  });

  describe('invalidate', () => {
    it('[BE-MUT-449] logging out clears the stored token for the token owner, matching the hash or the legacy raw value', async () => {
      const { prisma, jwt, service } = setup();
      const token = jwt.sign({ email: 'a@x.io', sub: 4 }, { expiresIn: '7d' });
      await expect(
        service.invalidateClientRefreshToken(token),
      ).resolves.toBeUndefined();
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: 4,
          OR: [{ refresh_token: hashOf(token) }, { refresh_token: token }],
        },
        data: { refresh_token: null },
      });
      await expect(
        service.invalidateAdminRefreshToken(token),
      ).resolves.toBeUndefined();
      expect(prisma.superAdmin.updateMany).toHaveBeenCalledWith({
        where: {
          id: 4,
          OR: [{ refresh_token: hashOf(token) }, { refresh_token: token }],
        },
        data: { refresh_token: null },
      });
    });

    it('[BE-MUT-450] an undecodable token is logged and reported as a generic 500 without touching the database', async () => {
      const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const { prisma, service } = setup();
      for (const [call, message, logged] of [
        [
          (t: string) => service.invalidateClientRefreshToken(t),
          'Failed to invalidate client refresh token',
          'Error occurred while invalidating client refresh token',
        ],
        [
          (t: string) => service.invalidateAdminRefreshToken(t),
          'Failed to invalidate admin refresh token',
          'Error occurred while invalidating admin refresh token',
        ],
      ] as const) {
        log.mockClear();
        const error = await call('not-a-jwt').catch((e: any) => e);
        expect(error.getStatus()).toBe(500);
        expect(error.message).toBe(message);
        expect(log).toHaveBeenCalledWith(logged, expect.any(String));
      }
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
      expect(prisma.superAdmin.updateMany).not.toHaveBeenCalled();
    });

    it('[BE-MUT-451] database failures while invalidating are hidden behind generic 500s', async () => {
      const token = (jwt: JwtService) => jwt.sign({ email: 'a@x.io', sub: 4 });
      await expectGenericWrapping({
        run: (f) => {
          const { prisma, jwt, service } = setup();
          prisma.user.updateMany.mockRejectedValue(f);
          return service.invalidateClientRefreshToken(token(jwt));
        },
        message: 'Failed to invalidate client refresh token',
        logged: ['Error occurred while invalidating client refresh token'],
      });
      await expectGenericWrapping({
        run: (f) => {
          const { prisma, jwt, service } = setup();
          prisma.superAdmin.updateMany.mockRejectedValue(f);
          return service.invalidateAdminRefreshToken(token(jwt));
        },
        message: 'Failed to invalidate admin refresh token',
        logged: ['Error occurred while invalidating admin refresh token'],
      });
    });
  });
});
