import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createBrand, createTenant } from '../factories';
import { BrandService } from '../../src/consumer/brand/services/brand.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('brand service detail', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let brands: BrandService;
  let prisma: PrismaService;

  beforeAll(async () => {
    boot = await bootDomain();
    brands = boot.get(BrandService);
    prisma = boot.get(PrismaService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    return w.check();
  });

  const cid = () => w.tenant.consumer.id;
  const failure = async (p: Promise<unknown>) =>
    p.then(
      () => null,
      (e: any) => e,
    );
  const boom = (model: string, method: string) =>
    jest
      .spyOn((prisma as any)[model], method)
      .mockRejectedValueOnce(new Error('db down'));

  it('[BE-BRND-101] {BrandService.create} stores every field under the caller tenant', async () => {
    const b: any = await brands.create(
      { name: 'Acme', logo: 'l.png', website: 'https://a.test' },
      cid(),
    );
    const row = await db.brand.findUniqueOrThrow({ where: { id: b.id } });
    expect(row).toMatchObject({
      consumer_id: cid(),
      name: 'Acme',
      logo: 'l.png',
      website: 'https://a.test',
    });
    expect(b.id).toBe(row.id);
  });

  it('[BE-BRND-102] {BrandService.create} a duplicate name is a client error, not a 500; unexpected failures are a generic 500', async () => {
    await brands.create({ name: 'Dup' } as any, cid());
    const dup = await failure(brands.create({ name: 'Dup' } as any, cid()));
    expect(dup.code).toBe('P2002');
    expect(
      await db.brand.count({ where: { consumer_id: cid(), name: 'Dup' } }),
    ).toBe(1);
    // same name in another tenant is fine
    const other = await createTenant(db);
    await brands.create({ name: 'Dup' } as any, other.consumer.id);

    boom('brand', 'create');
    const err = await failure(brands.create({ name: 'X' } as any, cid()));
    expect(err).toBeInstanceOf(HttpException);
    expect(err.message).toBe('Failed to create brand');
    expect(err.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('[BE-BRND-103] {BrandService.findAll} lists only the tenant brands sorted by name', async () => {
    await createBrand(db, { consumer_id: cid(), name: 'Zed' });
    await createBrand(db, { consumer_id: cid(), name: 'Alpha' });
    await createBrand(db, { consumer_id: cid(), name: 'Mid' });
    const foreign = await createBrand(db, { name: 'Aaa Foreign' });
    const list = await brands.findAll(cid());
    expect(list.map((b) => b.name)).toEqual(['Alpha', 'Mid', 'Zed']);
    expect(list.map((b) => b.id)).not.toContain(foreign.id);
    expect(await brands.findAll(foreign.consumer_id)).toHaveLength(1);

    boom('brand', 'findMany');
    const err = await failure(brands.findAll(cid()));
    expect(err.message).toBe('Failed to fetch brands');
    expect(err.getStatus()).toBe(500);
  });

  it('[BE-BRND-104] {BrandService.findOne} returns the tenant brand; missing and foreign ids are NotFound with the id in the message; failures are a 500', async () => {
    const mine = await createBrand(db, { consumer_id: cid() });
    const foreign = await createBrand(db);
    expect((await brands.findOne(mine.id, cid())).name).toBe(mine.name);
    const missing = await failure(brands.findOne(999999999, cid()));
    expect(missing).toBeInstanceOf(NotFoundException);
    expect(missing.message).toBe('Brand with ID 999999999 not found');
    const cross = await failure(brands.findOne(foreign.id, cid()));
    expect(cross).toBeInstanceOf(NotFoundException);
    expect(cross.message).toBe(`Brand with ID ${foreign.id} not found`);

    boom('brand', 'findFirst');
    const err = await failure(brands.findOne(mine.id, cid()));
    expect(err).not.toBeInstanceOf(NotFoundException);
    expect(err.message).toBe('Failed to fetch brand');
    expect(err.getStatus()).toBe(500);
  });

  it('[BE-BRND-105] {BrandService.update} changes the given fields, keeps the tenant, and leaves foreign brands alone', async () => {
    const mine = await createBrand(db, {
      consumer_id: cid(),
      name: 'Old',
      logo: 'o.png',
      website: 'o.test',
    });
    const foreign = await createBrand(db, { name: 'Foreign' });
    const updated: any = await brands.update(
      mine.id,
      { name: 'New', logo: 'n.png', website: 'n.test' },
      cid(),
    );
    expect(updated).toMatchObject({
      id: mine.id,
      name: 'New',
      logo: 'n.png',
      website: 'n.test',
      consumer_id: cid(),
    });
    // partial update keeps the rest
    await brands.update(mine.id, { name: 'Newer' }, cid());
    expect(
      await db.brand.findUniqueOrThrow({ where: { id: mine.id } }),
    ).toMatchObject({ name: 'Newer', logo: 'n.png', website: 'n.test' });

    const err = await failure(
      brands.update(foreign.id, { name: 'Hijack' }, cid()),
    );
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.message).toBe(`Brand with ID ${foreign.id} not found`);
    expect(
      (await db.brand.findUniqueOrThrow({ where: { id: foreign.id } })).name,
    ).toBe('Foreign');
  });

  it('[BE-BRND-106] {BrandService.update} a duplicate name is a client error; an unexpected failure is a generic 500', async () => {
    await createBrand(db, { consumer_id: cid(), name: 'Taken' });
    const mine = await createBrand(db, { consumer_id: cid(), name: 'Free' });
    const dup = await failure(brands.update(mine.id, { name: 'Taken' }, cid()));
    expect(dup.code).toBe('P2002');

    boom('brand', 'update');
    const err = await failure(brands.update(mine.id, { name: 'Z' }, cid()));
    expect(err.message).toBe('Failed to update brand');
    expect(err.getStatus()).toBe(500);
    expect(
      (await db.brand.findUniqueOrThrow({ where: { id: mine.id } })).name,
    ).toBe('Free');
  });

  it('[BE-BRND-107] {BrandService.remove} deletes only the tenant brand and returns success; foreign and missing ids are NotFound', async () => {
    const mine = await createBrand(db, { consumer_id: cid() });
    const other = await createBrand(db, { consumer_id: cid() });
    const foreign = await createBrand(db);
    expect(await brands.remove(mine.id, cid())).toEqual({ success: true });
    expect(await db.brand.count({ where: { id: mine.id } })).toBe(0);
    expect(await db.brand.count({ where: { id: other.id } })).toBe(1);

    const cross = await failure(brands.remove(foreign.id, cid()));
    expect(cross).toBeInstanceOf(NotFoundException);
    expect(cross.message).toBe(`Brand with ID ${foreign.id} not found`);
    expect(await db.brand.count({ where: { id: foreign.id } })).toBe(1);
    expect(await failure(brands.remove(999999999, cid()))).toBeInstanceOf(
      NotFoundException,
    );
  });

  it('[BE-BRND-108] {BrandService.remove} an unexpected failure is a generic 500 and keeps the row', async () => {
    const mine = await createBrand(db, { consumer_id: cid() });
    boom('brand', 'delete');
    const err = await failure(brands.remove(mine.id, cid()));
    expect(err.message).toBe('Failed to delete brand');
    expect(err.getStatus()).toBe(500);
    expect(await db.brand.count({ where: { id: mine.id } })).toBe(1);
  });
});
