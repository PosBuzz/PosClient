import { NotFoundException } from '@nestjs/common';
import { ProductService } from '../../src/consumer/product/services/product.service';
import { ProductVariantService } from '../../src/consumer/product/services/product-variant.service';
import { CustomerService } from '../../src/consumer/customer/services/customer.service';
import { createCustomer, createUnit } from '../factories';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';

describe('catalog service write subjects', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  beforeAll(async () => {
    boot = await bootDomain();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  const cid = () => w.tenant.consumer.id;

  it('[BE-PROD-100] {ProductService.create} (cross-tenant) persists a priced variant and refuses a foreign unit before any product is written', async () => {
    const unit = await createUnit(db, { consumer_id: cid() });
    const foreign = await createUnit(db, {
      consumer_id: w.bystander.consumer.id,
    });
    await w.rebaseBystander();
    const dto = {
      name: 'Catalog tea',
      code: 'CAT-100',
      has_variants: false,
      tax: 5,
      tax_method: 'EXCLUSIVE',
      variants: [
        {
          name: 'Default',
          regular_price: '123.45',
          sale_unit_id: unit.id,
          purchase_unit_id: unit.id,
        },
      ],
    };
    const service = boot.get(ProductService);
    const result: any = await service.create(
      cid(),
      w.tenant.adminUser.id,
      dto as any,
    );
    expect(result).toMatchObject({
      consumer_id: cid(),
      name: 'Catalog tea',
      tax: 5,
      variants: [{ is_default: true }],
    });
    const stored = await db.product.findUniqueOrThrow({
      where: { id: result.id },
      include: { variants: true },
    });
    expect(stored.variants[0].regular_price.toFixed(2)).toBe('123.45');
    expect(
      await db.priceHistory.count({
        where: { variant_id: stored.variants[0].id },
      }),
    ).toBe(1);
    const count = await db.product.count();
    const error = await service
      .create(cid(), w.tenant.adminUser.id, {
        ...dto,
        name: 'Foreign tea',
        code: 'CAT-FOREIGN',
        variants: [{ ...dto.variants[0], sale_unit_id: foreign.id }],
      } as any)
      .catch((e) => e);
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.getStatus()).toBe(404);
    expect(error.message).toBe('Unit not found');
    expect(await db.product.count()).toBe(count);
  });

  it('[BE-VAR-100] {ProductVariantService.create} {ProductVariantService.update} {ProductVariantService.remove} creates owned attributes and records a changed price before deleting an unused variant', async () => {
    const own = await w.stock({ price: 100, batches: [] });
    const unit = await createUnit(db, { consumer_id: cid() });
    const service = boot.get(ProductVariantService);
    const variant: any = await service.create(
      own.product_id,
      w.tenant.adminUser.id,
      {
        name: 'Large',
        sku: 'VAR-100',
        regular_price: '123.45',
        wholesale_price: '100.25',
        sale_unit_id: unit.id,
        purchase_unit_id: unit.id,
        attributes: [{ name: 'Size', value: 'Large' }],
      },
    );
    const stored = await db.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
    });
    expect(stored).toMatchObject({
      name: 'Large',
      sku: 'VAR-100',
      product_id: own.product_id,
    });
    expect(stored.regular_price.toFixed(2)).toBe('123.45');
    expect(
      await db.variantAttribute.findMany({ where: { variant_id: variant.id } }),
    ).toMatchObject([{ consumer_id: cid(), name: 'Size', value: 'Large' }]);
    await service.update(variant.id, {
      name: 'Extra large',
      regular_price: '130.00',
    });
    expect(
      await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } }),
    ).toMatchObject({ name: 'Extra large' });
    expect(
      await db.priceHistory.count({ where: { variant_id: variant.id } }),
    ).toBe(2);
    expect(await service.remove(variant.id)).toEqual({
      success: true,
      message: 'Variant deleted successfully',
    });
    expect(await db.productVariant.count({ where: { id: variant.id } })).toBe(
      0,
    );
    expect(
      await db.variantAttribute.count({ where: { variant_id: variant.id } }),
    ).toBe(0);
  });

  it('[BE-VAR-101] {ProductVariantService.update} {ProductVariantService.remove} missing variants reject with 404 and the stable message', async () => {
    const service = boot.get(ProductVariantService);
    const count = await db.productVariant.count();
    for (const action of [
      () => service.update(-1, { name: 'Missing' }),
      () => service.remove(-1),
    ]) {
      const error = await action().catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe('Product variant with ID -1 not found');
      expect(await db.productVariant.count()).toBe(count);
    }
  });

  it('[BE-CUST-100] {CustomerService.create} (cross-tenant) ignores a supplied owner id and permits a phone used only by another shop', async () => {
    await createCustomer(db, {
      consumer_id: w.bystander.consumer.id,
      phone: '01799999999',
    });
    await w.rebaseBystander();
    const dto = {
      name: 'Owned customer',
      phone: '01799999999',
      email: 'owned@example.test',
      customer_type: 'regular',
      birthday: '1990-03-15',
      consumer_id: w.bystander.consumer.id,
    };
    const service = boot.get(CustomerService);
    const created = await service.create(dto as any, cid());
    expect(created).toMatchObject({
      consumer_id: cid(),
      name: 'Owned customer',
      phone: dto.phone,
      birthday: new Date('1990-03-15T00:00:00Z'),
    });
    expect(
      await db.customer.findUniqueOrThrow({ where: { id: created.id } }),
    ).toMatchObject({ consumer_id: cid(), email: dto.email });
    const count = await db.customer.count();
    const error = await service.create(dto as any, cid()).catch((e) => e);
    expect(error.code).toBe('P2002'); // Service preserves the Prisma conflict for the HTTP filter.
    expect(await db.customer.count()).toBe(count);
  });
});
