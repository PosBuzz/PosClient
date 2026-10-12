import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createBrand, createCategory, createUnit } from '../factories';
import { CategoryService } from '../../src/consumer/category/services/category.service';
import { BrandService } from '../../src/consumer/brand/services/brand.service';
import { UnitService } from '../../src/consumer/unit/services/unit.service';
import { TagService } from '../../src/consumer/tag/services/tag.service';

type Lookup = {
  code: string;
  label: string;
  service: any;
  /** Prisma delegate name, used for assertions on stored rows. */
  table: 'category' | 'brand' | 'unit' | 'tag';
  duplicate: 'prisma' | 'conflict';
  make: (
    db: ReturnType<typeof getPrisma>,
    consumerId: number,
    name: string,
  ) => Promise<{ id: number }>;
};

describe('catalog lookup modules (categories, brands, units, tags)', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  const lookups: Lookup[] = [];

  beforeAll(async () => {
    boot = await bootDomain();
    lookups.push(
      {
        code: 'CAT',
        label: 'category',
        service: boot.get(CategoryService),
        table: 'category',
        duplicate: 'prisma',
        make: (d, c, n) => createCategory(d, { consumer_id: c, name: n }),
      },
      {
        code: 'BRND',
        label: 'brand',
        service: boot.get(BrandService),
        table: 'brand',
        duplicate: 'prisma',
        make: (d, c, n) => createBrand(d, { consumer_id: c, name: n }),
      },
      {
        code: 'UNIT',
        label: 'unit',
        service: boot.get(UnitService),
        table: 'unit',
        duplicate: 'conflict',
        make: (d, c, n) => createUnit(d, { consumer_id: c, name: n }),
      },
      {
        code: 'TAG',
        label: 'tag',
        service: boot.get(TagService),
        table: 'tag',
        duplicate: 'prisma',
        make: (d, c, n) => d.tag.create({ data: { consumer_id: c, name: n } }),
      },
    );
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());

  const cid = () => w.tenant.consumer.id;
  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );
  const rows = (l: Lookup) =>
    (db as any)[l.table].findMany({
      where: { consumer_id: cid() },
      orderBy: { name: 'asc' },
    }) as Promise<{ id: number; name: string }[]>;

  describe.each(['CAT', 'BRND', 'UNIT', 'TAG'])('%s', (code) => {
    const get = () => lookups.find((l) => l.code === code)!;

    it(`[BE-${code}-001] create stores a row owned by the tenant and findAll lists only the tenant's rows by name`, async () => {
      const l = get();
      await l.service.create({ name: 'Zeta' }, cid());
      await l.service.create({ name: 'Alpha' }, cid());
      await l.make(db, w.bystander.consumer.id, 'Hidden');
      await w.rebaseBystander();
      const all: { name: string }[] = await l.service.findAll(cid());
      expect(all.map((r) => r.name)).toEqual(['Alpha', 'Zeta']);
      expect(await rows(l)).toHaveLength(2);
    });

    it(`[BE-${code}-002] findOne, update and remove of another tenant's row are NotFound and change nothing`, async () => {
      const l = get();
      const foreign = await l.make(db, w.bystander.consumer.id, 'Theirs');
      await w.rebaseBystander();
      for (const call of [
        () => l.service.findOne(foreign.id, cid()),
        () => l.service.update(foreign.id, { name: 'Taken' }, cid()),
        () => l.service.remove(foreign.id, cid()),
      ]) {
        expect(await failure(call())).toBeInstanceOf(NotFoundException);
      }
      expect(
        await (db as any)[l.table].findUniqueOrThrow({
          where: { id: foreign.id },
        }),
      ).toMatchObject({ name: 'Theirs' });
    });

    it(`[BE-${code}-003] update renames and remove deletes the tenant's own row`, async () => {
      const l = get();
      const own = await l.make(db, cid(), 'Old');
      const updated = await l.service.update(own.id, { name: 'New' }, cid());
      expect(updated.name).toBe('New');
      expect(await l.service.remove(own.id, cid())).toEqual({ success: true });
      expect(await (db as any)[l.table].count({ where: { id: own.id } })).toBe(
        0,
      );
    });

    it(`[BE-${code}-004] a duplicate name is refused with a readable error, on create and on rename`, async () => {
      const l = get();
      await l.service.create({ name: 'Same' }, cid());
      const other = await l.make(db, cid(), 'Other');
      const onCreate = await failure(l.service.create({ name: 'Same' }, cid()));
      const onRename = await failure(
        l.service.update(other.id, { name: 'Same' }, cid()),
      );
      for (const error of [onCreate, onRename]) {
        if (l.duplicate === 'conflict') {
          expect(error).toBeInstanceOf(ConflictException);
          expect(error.message).toMatch(/already exists/);
        } else {
          expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
          expect(error.code).toBe('P2002');
        }
      }
      expect(
        await (db as any)[l.table].count({
          where: { consumer_id: cid(), name: 'Same' },
        }),
      ).toBe(1);
    });

    it(`[BE-${code}-005] the same name may exist in two tenants`, async () => {
      const l = get();
      await l.make(db, w.bystander.consumer.id, 'Shared');
      await w.rebaseBystander();
      const created = await l.service.create({ name: 'Shared' }, cid());
      expect(created.name).toBe('Shared');
    });
  });

  it('[BE-UNIT-006] a unit used by a variant cannot be deleted', async () => {
    const unit = lookups.find((l) => l.code === 'UNIT')!;
    const v = await w.stock({ price: 10, batches: [{ qty: 1, cost: 1 }] });
    const used = await db.productVariant.findUniqueOrThrow({
      where: { id: v.id },
    });
    const error = await failure(unit.service.remove(used.sale_unit_id, cid()));
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(error.code).toBe('P2003');
    expect(await db.unit.count({ where: { id: used.sale_unit_id } })).toBe(1);
  });
});
