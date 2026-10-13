import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describePrismaError } from '../../prisma-client-exception/prisma-error-messages';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import {
  createBrand,
  createCategory,
  createStockedVariant,
  createUnit,
  createVendor,
} from '../factories';
import { ProductService } from '../../src/consumer/product/services/product.service';

describe('products and variants', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let products: ProductService;

  beforeAll(async () => {
    boot = await bootDomain();
    products = boot.get(ProductService);
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
  const uid = () => w.tenant.adminUser.id;
  const failure = async (promise: Promise<unknown> | (() => unknown)) =>
    Promise.resolve()
      .then(() => (typeof promise === 'function' ? promise() : promise))
      .then(
        () => null,
        (e: any) => e,
      );
  let unitId: number;
  let theirUnitId: number;
  beforeEach(async () => {
    unitId = (await createUnit(db, { consumer_id: cid() })).id;
    theirUnitId = (
      await createUnit(db, { consumer_id: w.bystander.consumer.id })
    ).id;
    await w.rebaseBystander();
  });

  /** A variant of the other tenant that has never been sold, so only ownership can stop an edit. */
  const foreignFreeVariant = async () => {
    const created = await createStockedVariant(db, w.bystander, {
      price: 5,
      batches: [{ qty: 1, cost: 1 }],
    });
    await w.rebaseBystander();
    return created;
  };
  const variant = (extra: object = {}) => ({
    name: 'Default',
    regular_price: '100.00',
    sale_unit_id: unitId,
    purchase_unit_id: unitId,
    ...extra,
  });
  const create = (extra: object = {}, variants: object[] = [variant()]) =>
    products.create(cid(), uid(), {
      name: `Tea ${Math.random().toString(36).slice(2, 8)}`,
      code: `T${Math.random().toString(36).slice(2, 8)}`,
      has_variants: false,
      variants,
      ...extra,
    } as any) as Promise<any>;

  it('[BE-PROD-001] a simple product gets one default variant, price history and its tax settings', async () => {
    const product = await create({ tax: 5, tax_method: 'INCLUSIVE' });
    expect(product).toMatchObject({
      consumer_id: cid(),
      tax: 5,
      tax_method: 'INCLUSIVE',
    });
    expect(product.variants).toHaveLength(1);
    expect(product.variants[0].is_default).toBe(true);
    expect(
      await db.priceHistory.count({
        where: { variant_id: product.variants[0].id },
      }),
    ).toBe(1);
  });

  it('[BE-PROD-002] a product needs a variant, and a simple product only one', async () => {
    expect((await failure(create({}, []))).message).toMatch(
      /At least one variant is required/,
    );
    const two = await failure(create({}, [variant(), variant({ name: 'B' })]));
    expect(two).toBeInstanceOf(BadRequestException);
    expect(two.message).toMatch(/Simple products can only have one variant/);
  });

  it("[BE-PROD-003] {ProductService.getProductLimit} the plan's product cap blocks new products but keeps existing ones", async () => {
    await db.plan.update({
      where: { id: w.tenant.plan.id },
      data: { max_products: 1 },
    });
    const first = await create();
    const limit = await products.getProductLimit(cid());
    expect(limit).toMatchObject({
      max_products: 1,
      used: 1,
      remaining: 0,
      limit_reached: true,
    });
    const error = await failure(create());
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toMatch(/Product limit reached/);
    expect(await db.product.count({ where: { consumer_id: cid() } })).toBe(1);
    await db.plan.update({
      where: { id: w.tenant.plan.id },
      data: { max_products: null },
    });
    expect((await products.getProductLimit(cid())).remaining).toBeNull();
    await create();
    expect(first.id).toBeGreaterThan(0);
  });

  it('[BE-PROD-004] {ProductService.update} a duplicate product name is refused on create and on rename', async () => {
    await create({ name: 'Unique' });
    const other = await create({ name: 'Other' });
    // The Prisma filter turns the unique violation into a readable 409 over HTTP.
    const onCreate = await failure(create({ name: 'Unique' }));
    const onRename = await failure(
      products.update(other.id, { name: 'Unique' } as any, cid(), uid()),
    );
    for (const error of [onCreate, onRename]) {
      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect(error.code).toBe('P2002');
      expect(describePrismaError(error.code, error.meta)?.message).toMatch(
        /product with this name already exists/i,
      );
    }
    expect(
      await db.product.count({ where: { consumer_id: cid(), name: 'Unique' } }),
    ).toBe(1);
  });

  it('[BE-PROD-005] one batch number must keep one expiry date', async () => {
    const batch = (expiry: string) => ({
      branch_id: w.tenant.branches[0].id,
      batch_number: 'B1',
      quantity: 2,
      cost_price: '10',
      expiry_date: expiry,
    });
    const error = await failure(
      create({}, [
        variant({ batches: [batch('2027-01-01'), batch('2027-02-01')] }),
      ]),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toMatch(/different expiry dates/);
    expect(await db.product.count({ where: { consumer_id: cid() } })).toBe(0);
  });

  it('[BE-PROD-006] opening stock creates a batch and a PURCHASE_IN audit row (INV-01 holds)', async () => {
    const product = await create({}, [
      variant({
        batches: [
          {
            branch_id: w.tenant.branches[0].id,
            batch_number: 'OPEN-1',
            quantity: 7,
            cost_price: '30',
            payments: [{ payment_method: 'CASH', amount: 100 }],
          },
        ],
      }),
    ]);
    const batch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: product.variants[0].id },
    });
    expect(batch).toMatchObject({ quantity: 7, payment_status: 'partial' });
    expect(
      await db.inventoryAuditLog.count({
        where: { batch_id: batch.id, event_type: 'PURCHASE_IN' },
      }),
    ).toBe(1);
  });

  it("[BE-PROD-007] {ProductService.findOne} {ProductService.update} {ProductService.remove} another tenant's product is NotFound to read, update and delete", async () => {
    const theirs = await db.product.create({
      data: {
        consumer_id: w.bystander.consumer.id,
        name: 'Theirs',
        code: 'TH1',
      },
    });
    await w.rebaseBystander();
    for (const call of [
      () => products.findOne(theirs.id, cid()),
      () => products.update(theirs.id, { name: 'Mine' } as any, cid(), uid()),
      () => products.remove(theirs.id, cid()),
    ]) {
      expect(await failure(call)).toBeInstanceOf(NotFoundException);
    }
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: theirs.id } })).name,
    ).toBe('Theirs');
  });

  describe("references to another tenant's records are refused", () => {
    it('[BE-PROD-008] {ProductService.update} a variant id of another tenant cannot be updated through my product', async () => {
      const mine = await create();
      const theirs = await foreignFreeVariant();
      const error = await failure(
        products.update(
          mine.id,
          {
            variants: [
              { id: theirs.id, name: 'Hijacked', regular_price: '1.00' },
            ],
          } as any,
          cid(),
          uid(),
        ),
      );
      expect(error).not.toBeNull();
      expect(
        (
          await db.productVariant.findUniqueOrThrow({
            where: { id: theirs.id },
          })
        ).name,
      ).not.toBe('Hijacked');
    });

    it('[BE-PROD-009] {ProductService.update} a variant id of another tenant cannot be deleted through my product', async () => {
      const mine = await create();
      const error = await failure(
        products.update(
          mine.id,
          { variant_ids_to_delete: [w.theirs.id] } as any,
          cid(),
          uid(),
        ),
      );
      expect(error).not.toBeNull();
      expect(
        await db.productVariant.count({ where: { id: w.theirs.id } }),
      ).toBe(1);
    });

    it("[BE-PROD-010] {ProductService.update} my own other product's variant cannot be reached through this product either", async () => {
      const a = await create();
      const b = await create();
      const error = await failure(
        products.update(
          a.id,
          { variant_ids_to_delete: [b.variants[0].id] } as any,
          cid(),
          uid(),
        ),
      );
      expect(error).not.toBeNull();
      expect(
        await db.productVariant.count({ where: { id: b.variants[0].id } }),
      ).toBe(1);
    });

    it.each([
      [
        'category',
        async () => ({
          category_id: (
            await createCategory(db, { consumer_id: w.bystander.consumer.id })
          ).id,
        }),
      ],
      [
        'brand',
        async () => ({
          brand_id: (
            await createBrand(db, { consumer_id: w.bystander.consumer.id })
          ).id,
        }),
      ],
      [
        'tag',
        async () => ({
          tag_ids: [
            (
              await db.tag.create({
                data: { consumer_id: w.bystander.consumer.id, name: 'x' },
              })
            ).id,
          ],
        }),
      ],
    ])(
      '[BE-PROD-011] a %s of another tenant is refused on create',
      async (_name, make) => {
        const refs = await make();
        await w.rebaseBystander();
        const error = await failure(create(refs));
        expect(error).toBeInstanceOf(NotFoundException);
        expect(await db.product.count({ where: { consumer_id: cid() } })).toBe(
          0,
        );
      },
    );

    it('[BE-PROD-012] units, batch branches and vendors of another tenant are refused on create', async () => {
      const foreignVendor = await createVendor(db, {
        consumer_id: w.bystander.consumer.id,
      });
      await w.rebaseBystander();
      const unit = await failure(
        create({}, [variant({ sale_unit_id: theirUnitId })]),
      );
      expect(unit).toBeInstanceOf(NotFoundException);
      const batchBranch = await failure(
        create({}, [
          variant({
            batches: [
              {
                branch_id: w.bystander.branches[0].id,
                batch_number: 'X',
                quantity: 1,
                cost_price: '1',
              },
            ],
          }),
        ]),
      );
      expect(batchBranch).toBeInstanceOf(NotFoundException);
      const batchVendor = await failure(
        create({}, [
          variant({
            batches: [
              {
                branch_id: w.tenant.branches[0].id,
                batch_number: 'Y',
                quantity: 1,
                cost_price: '1',
                vendor_id: foreignVendor.id,
              },
            ],
          }),
        ]),
      );
      expect(batchVendor).toBeInstanceOf(NotFoundException);
      expect(await db.product.count({ where: { consumer_id: cid() } })).toBe(0);
    });

    it('[BE-PROD-013] {ProductService.update} a serial id of another variant cannot be rewritten through my variant', async () => {
      const mine = await create({}, [
        variant({ serials: [{ serial_number: 'MINE-1' }] }),
      ]);
      const other = await create({}, [
        variant({ serials: [{ serial_number: 'OTHER-1' }] }),
      ]);
      const otherSerial = await db.productSerial.findFirstOrThrow({
        where: { variant_id: other.variants[0].id },
      });
      await failure(
        products.update(
          mine.id,
          {
            is_edit_mode: true,
            variants: [
              {
                id: mine.variants[0].id,
                serials: [{ id: otherSerial.id, serial_number: 'HIJACKED' }],
              },
            ],
          } as any,
          cid(),
          uid(),
        ),
      );
      expect(
        (
          await db.productSerial.findUniqueOrThrow({
            where: { id: otherSerial.id },
          })
        ).serial_number,
      ).toBe('OTHER-1');
    });
  });

  it('[BE-VAR-001] {ProductService.update} changing a price records history; unchanged prices do not', async () => {
    const product = await create();
    const id = product.variants[0].id;
    await products.update(
      product.id,
      { variants: [{ id, regular_price: '100.00' }] } as any,
      cid(),
      uid(),
    );
    expect(await db.priceHistory.count({ where: { variant_id: id } })).toBe(1);
    await products.update(
      product.id,
      {
        variants: [{ id, regular_price: '120.00', wholesale_price: '90.00' }],
      } as any,
      cid(),
      uid(),
    );
    expect(await db.priceHistory.count({ where: { variant_id: id } })).toBe(2);
    expect(
      Number(
        (await db.productVariant.findUniqueOrThrow({ where: { id } }))
          .regular_price,
      ),
    ).toBe(120);
  });

  it('[BE-VAR-002] {ProductService.update} new variants need all required fields; added variants and deletions work on my own product', async () => {
    const product = await create({ has_variants: true }, [
      variant({ name: 'A' }),
      variant({ name: 'B' }),
    ]);
    const incomplete = await failure(
      products.update(
        product.id,
        { variants: [{ name: 'C' }] } as any,
        cid(),
        uid(),
      ),
    );
    expect(incomplete).toBeInstanceOf(BadRequestException);
    expect(incomplete.message).toMatch(
      /New variants require all required fields/,
    );
    await products.update(
      product.id,
      {
        variants: [variant({ name: 'C' })],
        variant_ids_to_delete: [product.variants[0].id],
      } as any,
      cid(),
      uid(),
    );
    const names = (
      await db.productVariant.findMany({
        where: { product_id: product.id },
        orderBy: { id: 'asc' },
      })
    ).map((v) => v.name);
    expect(names).toEqual(['B', 'C']);
  });

  it('[BE-PROD-014] {ProductService.remove} deleting a product removes its variants; sold variants are protected with a readable error', async () => {
    const free = await create();
    await products.remove(free.id, cid());
    expect(
      await db.productVariant.count({ where: { product_id: free.id } }),
    ).toBe(0);
    const sold = await w.stock({ price: 100, batches: [{ qty: 5, cost: 10 }] });
    await w.sell([{ variant: sold, qty: 1 }]);
    const error = await failure(products.remove(sold.product.id, cid()));
    expect(error).not.toBeNull();
    expect(await db.product.count({ where: { id: sold.product.id } })).toBe(1);
  });

  it('[BE-PROD-015] {ProductService.findAll} the product list is tenant scoped and filterable', async () => {
    const category = await createCategory(db, { consumer_id: cid() });
    await create({ name: 'Green Tea', category_id: category.id });
    await create({ name: 'Coffee' });
    const all: any = await products.findAll(cid(), {});
    expect(all.data.map((p: any) => p.name).sort()).toEqual([
      'Coffee',
      'Green Tea',
    ]);
    expect(
      (await products.findAll(cid(), { search: 'green' })).data,
    ).toHaveLength(1);
    expect(
      (await products.findAll(cid(), { categoryIds: [category.id] })).data,
    ).toHaveLength(1);
  });
});
