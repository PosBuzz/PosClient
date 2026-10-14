import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/prisma/prisma.service';
import * as passport from 'passport';
import { JwtClientStrategy } from './client.jwt.strategy';

const config = {
  jwtSecret: 'unit-secret',
  jwtAlgorithm: 'HS256',
} as unknown as ConfigService;

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    consumer_id: 9,
    name: 'Rina',
    email: 'rina@shop.test',
    password: 'hash',
    refresh_token: 'rt',
    created_at: new Date(0),
    updated_at: new Date(0),
    role: {
      name: 'Manager',
      permissions: [
        { permission: { action: 'sales.create' } },
        { permission: { action: 'sales.read' } },
      ],
    },
    consumer: {
      plan_id: 3,
      company_name: 'Rina Mart',
      email: 'owner@shop.test',
      secondary_email: 'alt@shop.test',
      phone: '017',
      address: 'Dhaka',
      logo: 'logo.png',
      subdomain: 'rinamart',
      deleted_at: null,
    },
    branches: [
      {
        branch: { id: 1, name: 'Main', is_main: true, is_warehouse: false },
      },
      {
        branch: { id: 2, name: 'Store', is_main: false, is_warehouse: true },
      },
    ],
    ...overrides,
  };
}

function setup(row: unknown) {
  const findUnique = jest.fn().mockResolvedValue(row);
  const prisma = { user: { findUnique } } as unknown as PrismaService;
  return { strategy: new JwtClientStrategy(prisma, config), findUnique };
}

describe('JwtClientStrategy', () => {
  it('[BE-MUT-140] reads the token from the client_access_token cookie only', () => {
    const { strategy } = setup(null);
    const extract = (strategy as any)._jwtFromRequest as (r: unknown) => string;
    expect(
      extract({
        cookies: { client_access_token: 'abc', admin_access_token: 'zzz' },
      }),
    ).toBe('abc');
    expect(extract({ cookies: {} })).toBeUndefined();
  });
  it('[BE-MUT-141] registers as jwt-client and verifies with the configured secret and algorithm', () => {
    const { strategy } = setup(null);
    expect((passport as any)._strategy('jwt-client')).toBeDefined();
    expect((passport as any)._strategy('')).toBeUndefined();
    const provider = (strategy as any)._secretOrKeyProvider as (
      req: unknown,
      token: string,
      done: (err: unknown, secret?: string) => void,
    ) => void;
    const done = jest.fn();
    provider({}, 'tok', done);
    expect(done).toHaveBeenCalledWith(null, 'unit-secret');
    expect((strategy as any)._verifOpts.algorithms).toEqual(['HS256']);
  });
  it('[BE-MUT-142] looks the user up by id and tenant with role, permissions, consumer and branches', async () => {
    const { strategy, findUnique } = setup(userRow());
    await strategy.validate({ email: 'x', sub: 5, consumer_id: 9 });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 5, consumer_id: 9 },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        consumer: true,
        branches: { include: { branch: true } },
      },
    });
  });
  it('[BE-MUT-143] an unknown account is a 401 with a clear message, not a 500', async () => {
    const { strategy } = setup(null);
    const call = strategy.validate({ email: 'x', sub: 1, consumer_id: 1 });
    await expect(call).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(call).rejects.toThrow('Client user not found');
  });
  it('[BE-MUT-144] a soft-deleted tenant stops working sessions too', async () => {
    const row = userRow({
      consumer: { ...userRow().consumer, deleted_at: new Date() },
    });
    const { strategy } = setup(row);
    const call = strategy.validate({ email: 'x', sub: 5, consumer_id: 9 });
    await expect(call).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(call).rejects.toThrow('This account is no longer active');
  });
  it('[BE-MUT-145] request.user carries permissions, role, tenant profile and branches but no secrets', async () => {
    const { strategy } = setup(userRow());
    const user = await strategy.validate({
      email: 'x',
      sub: 5,
      consumer_id: 9,
      consumer_subdomain: 'from-jwt',
    });
    expect(user).toEqual({
      id: 5,
      consumer_id: 9,
      name: 'Rina',
      email: 'rina@shop.test',
      role: 'Manager',
      permissions: ['sales.create', 'sales.read'],
      plan_id: 3,
      company_name: 'Rina Mart',
      company_email: 'owner@shop.test',
      secondary_email: 'alt@shop.test',
      phone: '017',
      address: 'Dhaka',
      logo: 'logo.png',
      consumer_subdomain: 'from-jwt',
      branches: [
        { id: 1, name: 'Main', is_main: true, is_warehouse: false },
        { id: 2, name: 'Store', is_main: false, is_warehouse: true },
      ],
    });
    for (const secret of [
      'password',
      'refresh_token',
      'created_at',
      'consumer',
    ]) {
      expect(user).not.toHaveProperty(secret);
    }
  });
  it('[BE-MUT-146] the subdomain falls back to the tenant record when the token has none', async () => {
    const { strategy } = setup(userRow());
    const user = await strategy.validate({
      email: 'x',
      sub: 5,
      consumer_id: 9,
    });
    expect(user.consumer_subdomain).toBe('rinamart');
  });
});
