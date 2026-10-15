import { BadRequestException, HttpException } from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { TEST_PASSWORD } from '../factories';
import { SubdomainValidationService } from '../../src/common/services/subdomain-validation.service';
import { ChangePasswordService } from '../../src/consumer/change-password/change-password.service';
import { ProfileService } from '../../src/consumer/profile/profile.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('account-level services', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let subdomains: SubdomainValidationService;
  let passwords: ChangePasswordService;
  let profiles: ProfileService;
  let prisma: PrismaService;

  beforeAll(async () => {
    boot = await bootDomain();
    subdomains = boot.get(SubdomainValidationService);
    passwords = boot.get(ChangePasswordService);
    profiles = boot.get(ProfileService);
    prisma = boot.get(PrismaService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());

  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );

  it('[BE-SUB-001] {SubdomainValidationService.validateSubdomain} a subdomain is valid only with a live billing period, and a deleted or unknown one looks the same', async () => {
    const sub = w.tenant.consumer.subdomain;
    await db.billingHistory.deleteMany({
      where: { consumer_id: w.tenant.consumer.id },
    });
    const noBilling = await subdomains.validateSubdomain(sub);
    expect(noBilling).toMatchObject({ exists: true, isActive: false });
    await db.billingHistory.create({
      data: {
        consumer_id: w.tenant.consumer.id,
        plan_id: w.tenant.consumer.plan_id,
        amount: 100,
        billing_date: new Date(),
        billing_from: new Date(Date.now() - 86_400_000),
        billing_till: new Date(Date.now() + 86_400_000),
      },
    });
    expect(
      await subdomains.validateSubdomain(` ${sub.toUpperCase()} `),
    ).toEqual({
      exists: true,
      consumerId: w.tenant.consumer.id,
      isActive: true,
      message: 'Subdomain is valid',
    });
    const unknown = await subdomains.validateSubdomain('no-such-shop');
    await db.consumer.update({
      where: { id: w.tenant.consumer.id },
      data: { deleted_at: new Date() },
    });
    const deleted = await subdomains.validateSubdomain(sub);
    expect(deleted).toEqual(unknown);
    expect(unknown).toEqual({ exists: false, message: 'Subdomain not found' });
    expect(await subdomains.validateSubdomain('  ')).toEqual({
      exists: false,
      message: 'Subdomain is required',
    });
  });

  it('[BE-SUB-002] {SubdomainValidationService.extractSubdomainFromUrl} the tenant is read from an origin or host', () => {
    expect(
      subdomains.extractSubdomainFromUrl('http://consumer1.localhost:3000'),
    ).toBe('consumer1');
    expect(
      subdomains.extractSubdomainFromUrl('http://localhost:3000'),
    ).toBeNull();
  });

  it('[BE-ACC-001] {ChangePasswordService.changePassword} a password changes only with the right old one, and the new one then verifies', async () => {
    const id = w.tenant.adminUser.id;
    const wrong = await failure(
      passwords.changePassword(id, 'not-the-password', 'NewPass!234'),
    );
    expect(wrong).toBeInstanceOf(HttpException);
    expect(wrong.getResponse().message).toBe('Old password is incorrect');
    const missing = await failure(
      passwords.changePassword(999999, TEST_PASSWORD, 'NewPass!234'),
    );
    expect(missing.getResponse().message).toBe('User not found');
    const before = (await db.user.findUniqueOrThrow({ where: { id } }))
      .password;
    const changed: any = await passwords.changePassword(
      id,
      TEST_PASSWORD,
      'NewPass!234',
    );
    expect(changed).toEqual({
      id,
      email: w.tenant.adminUser.email,
      name: w.tenant.adminUser.name,
    });
    const after = (await db.user.findUniqueOrThrow({ where: { id } })).password;
    expect(after).not.toBe(before);
    expect(await bcryptjs.compare('NewPass!234', after)).toBe(true);
    expect(await bcryptjs.compare(TEST_PASSWORD, after)).toBe(false);
  });

  it('[BE-ACC-002] {ProfileService.updateProfile} only allowed profile fields are stored and an empty update is a readable 400', async () => {
    const id = w.tenant.consumer.id;
    const updated: any = await profiles.updateProfile(id, {
      company_name: 'Profile Shop',
      subdomain: 'hijack',
      plan_id: 999,
    });
    expect(updated.company_name).toBe('Profile Shop');
    const stored = await db.consumer.findUniqueOrThrow({ where: { id } });
    expect(stored.company_name).toBe('Profile Shop');
    expect(stored.subdomain).toBe(w.tenant.consumer.subdomain);
    expect(stored.plan_id).toBe(w.tenant.consumer.plan_id);
    const empty = await failure(profiles.updateProfile(id, { subdomain: 'x' }));
    expect(empty).toBeInstanceOf(BadRequestException);
    expect(empty.message).toBe('Provide at least one profile field to update.');
  });

  it('[BE-PRS-001] {PrismaService.healthCheck} {PrismaService.getPoolMetrics} the database reports healthy with a latency and connection figures', async () => {
    const health = await prisma.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.latency).toBeGreaterThanOrEqual(0);
    expect(health.connections).toBeGreaterThanOrEqual(1);
    const metrics: any = await prisma.getPoolMetrics();
    expect(metrics).toBeTruthy();
    expect(JSON.stringify(metrics)).not.toMatch(/password|DATABASE_URL/i);
  });
});
