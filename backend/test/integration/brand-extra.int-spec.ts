import { HttpException, NotFoundException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createBrand } from '../factories';
import { BrandService } from '../../src/consumer/brand/services/brand.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('brand service extra (mutation hardening)', () => {
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
  const logSpy = () =>
    jest.spyOn((brands as any).logger, 'error').mockImplementation(() => {});

  it('[BE-BRND-201] {BrandService.create} omitted optional fields are stored as null and the full row is returned', async () => {
    const b: any = await brands.create({ name: 'Bare' } as any, cid());
    expect(b).toMatchObject({
      name: 'Bare',
      logo: null,
      website: null,
      consumer_id: cid(),
    });
    expect(b.created_at).toBeInstanceOf(Date);
  });

  it('[BE-BRND-202] {BrandService.create} an unexpected failure is logged with the tenant and a stack, and surfaces as an HttpException 500 with the exact body', async () => {
    const spy = logSpy();
    boom('brand', 'create');
    const err = await failure(brands.create({ name: 'X' } as any, cid()));
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getResponse()).toBe('Failed to create brand');
    expect(err.getStatus()).toBe(500);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      `Failed to create brand for consumer ${cid()}`,
      expect.stringContaining('db down'),
    );
  });

  it('[BE-BRND-203] {BrandService.findAll} {BrandService.findOne} failures are logged with exact messages and do not leak the cause', async () => {
    const mine = await createBrand(db, { consumer_id: cid() });
    const spy = logSpy();
    boom('brand', 'findMany');
    const a = await failure(brands.findAll(cid()));
    expect(a.getResponse()).toBe('Failed to fetch brands');
    boom('brand', 'findFirst');
    const b = await failure(brands.findOne(mine.id, cid()));
    expect(b.getResponse()).toBe('Failed to fetch brand');
    expect(spy.mock.calls.map((c) => c[0])).toEqual([
      `Failed to fetch brands for consumer ${cid()}`,
      `Failed to fetch brand ${mine.id} for consumer ${cid()}`,
    ]);
    for (const c of spy.mock.calls) expect(c[1]).toContain('db down');
  });

  it('[BE-BRND-204] {BrandService.findOne} {BrandService.findAll} return every column of the tenant rows', async () => {
    const mine = await createBrand(db, {
      consumer_id: cid(),
      name: 'Cols',
      logo: 'l',
      website: 'w',
    });
    expect(await brands.findOne(mine.id, cid())).toEqual(mine);
    expect(await brands.findAll(cid())).toEqual([mine]);
    expect(await brands.findAll(cid() + 987654)).toEqual([]);
  });

  it('[BE-BRND-205] {BrandService.update} {BrandService.remove} log with the id and tenant when the write fails and when the lookup itself breaks', async () => {
    const mine = await createBrand(db, { consumer_id: cid() });
    const spy = logSpy();
    boom('brand', 'update');
    const u = await failure(brands.update(mine.id, { name: 'Z' }, cid()));
    expect(u.getResponse()).toBe('Failed to update brand');
    boom('brand', 'delete');
    const r = await failure(brands.remove(mine.id, cid()));
    expect(r.getResponse()).toBe('Failed to delete brand');
    // the inner findOne breaks: its HttpException passes through untouched
    boom('brand', 'findFirst');
    const u2 = await failure(brands.update(mine.id, { name: 'Z' }, cid()));
    expect(u2).not.toBeInstanceOf(NotFoundException);
    expect(u2.getResponse()).toBe('Failed to fetch brand');
    boom('brand', 'findFirst');
    const r2 = await failure(brands.remove(mine.id, cid()));
    expect(r2.getResponse()).toBe('Failed to fetch brand');
    const msgs = spy.mock.calls.map((c) => c[0]);
    expect(msgs).toEqual([
      `Failed to update brand ${mine.id} for consumer ${cid()}`,
      `Failed to delete brand ${mine.id} for consumer ${cid()}`,
      `Failed to fetch brand ${mine.id} for consumer ${cid()}`,
      `Failed to fetch brand ${mine.id} for consumer ${cid()}`,
    ]);
    expect(await db.brand.count({ where: { id: mine.id } })).toBe(1);
  });

  it('[BE-BRND-206] {BrandService.update} NotFound is not logged as an error and an empty update keeps every column', async () => {
    const mine = await createBrand(db, {
      consumer_id: cid(),
      name: 'Keep',
      logo: 'l',
      website: 'w',
    });
    const spy = logSpy();
    const err = await failure(brands.update(987654321, { name: 'n' }, cid()));
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.message).toBe('Brand with ID 987654321 not found');
    const rm = await failure(brands.remove(987654321, cid()));
    expect(rm).toBeInstanceOf(NotFoundException);
    expect(spy).not.toHaveBeenCalled();
    const same: any = await brands.update(mine.id, {}, cid());
    expect(same).toMatchObject({ name: 'Keep', logo: 'l', website: 'w' });
    // each field is independently updatable
    expect((await brands.update(mine.id, { logo: 'x' }, cid())).logo).toBe('x');
    expect(
      (await brands.update(mine.id, { website: 'y' }, cid())).website,
    ).toBe('y');
    expect(
      await db.brand.findUniqueOrThrow({ where: { id: mine.id } }),
    ).toMatchObject({ name: 'Keep', logo: 'x', website: 'y' });
  });
});
