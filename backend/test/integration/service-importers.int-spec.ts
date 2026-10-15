import { CustomerImportService } from '../../src/consumer/import/services/customer-import.service';
import { ProductImportService } from '../../src/consumer/import/services/product-import.service';
import { InventoryImportService } from '../../src/consumer/import/services/inventory-import.service';
import { createCustomer, createUnit } from '../factories';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';

describe('prepared spreadsheet rows and persistence', () => {
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

  it('[BE-IMP-100] {CustomerImportService.prepare} {CustomerImportService.write} (cross-tenant) validates against this shop only and inserts its prepared rows', async () => {
    const service = boot.get(CustomerImportService);
    await createCustomer(db, {
      consumer_id: w.bystander.consumer.id,
      phone: '01711111111',
    });
    await w.rebaseBystander();
    const rows = [
      {
        rowNumber: 2,
        values: {
          name: 'Ali',
          phone: '01711111111',
          email: 'ali@example.test',
          'customer type': 'individual',
        },
      },
    ];
    const prepared = await service.prepare(cid(), rows);
    expect(prepared).toMatchObject({
      errors: [],
      prepared: [
        { name: 'Ali', phone: '01711111111', customer_type: 'individual' },
      ],
    });
    expect(await db.customer.count({ where: { consumer_id: cid() } })).toBe(0);
    expect(await service.write(cid(), prepared.prepared)).toEqual({
      customers: 1,
    });
    expect(
      await db.customer.findFirstOrThrow({ where: { consumer_id: cid() } }),
    ).toMatchObject({
      name: 'Ali',
      phone: '01711111111',
      email: 'ali@example.test',
    });
    const rejected = await service.prepare(cid(), rows);
    expect(rejected.prepared).toEqual([]);
    expect(rejected.errors).toEqual([
      {
        row: 2,
        column: 'Phone',
        message: 'A customer with phone 01711111111 already exists',
      },
    ]);
    expect(await service.write(w.bystander.consumer.id, [])).toEqual({
      customers: 0,
    });
    expect(await db.customer.count({ where: { consumer_id: cid() } })).toBe(1);
  });

  it('[BE-IMP-101] {ProductImportService.prepare} {ProductImportService.write} {ProductImportService.checkProductLimit} (cross-tenant) resolves owned units, pins prices and rejects foreign lookups and plan overflow', async () => {
    const service = boot.get(ProductImportService);
    const unit = await createUnit(db, {
      consumer_id: cid(),
      name: 'Owned piece',
    });
    const foreign = await createUnit(db, {
      consumer_id: w.bystander.consumer.id,
      name: 'Foreign piece',
    });
    await w.rebaseBystander();
    const values = {
      'product name': 'Imported tea',
      unit: unit.name,
      'variant name': 'Default',
      'regular price': '123.45',
      'wholesale price': '100.25',
      'tax %': '5',
      sku: 'IMP-TEA',
    };
    const result = await service.prepare(cid(), [{ rowNumber: 2, values }]);
    expect(result.errors).toEqual([]);
    expect(result.prepared).toMatchObject([
      {
        name: 'Imported tea',
        tax: 5,
        variants: [
          {
            name: 'Default',
            regular_price: 123.45,
            wholesale_price: 100.25,
            sale_unit_id: unit.id,
            purchase_unit_id: unit.id,
          },
        ],
      },
    ]);
    expect(
      await db.$transaction((tx) => service.write(cid(), result.prepared, tx)),
    ).toEqual({ products: 1, variants: 1 });
    const product = await db.product.findFirstOrThrow({
      where: { consumer_id: cid(), name: 'Imported tea' },
      include: { variants: true },
    });
    expect(product.tax).toBe(5);
    expect(product.variants[0].regular_price.toFixed(2)).toBe('123.45');
    expect(product.variants[0].wholesale_price!.toFixed(2)).toBe('100.25');
    const bad = await service.prepare(cid(), [
      {
        rowNumber: 2,
        values: {
          ...values,
          'product name': 'Other tea',
          sku: 'IMP-OTHER',
          unit: foreign.name,
        },
      },
    ]);
    expect(bad.prepared).toEqual([]);
    expect(bad.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          column: 'Unit',
          message: expect.stringContaining('Foreign piece'),
        }),
      ]),
    );
    expect(
      await db.$transaction((tx) =>
        service.write(w.bystander.consumer.id, [], tx),
      ),
    ).toEqual({ products: 0, variants: 0 });
    const used = await db.product.count({ where: { consumer_id: cid() } });
    await db.plan.update({
      where: { id: w.tenant.plan.id },
      data: { max_products: used + 1 },
    });
    expect(await service.checkProductLimit(cid(), 1)).toBeNull();
    expect(await service.checkProductLimit(cid(), 2)).toContain('would exceed');
  });

  it('[BE-IMP-102] {InventoryImportService.prepare} {InventoryImportService.write} (cross-tenant) imports owned stock with purchase audit and refuses another shop SKU', async () => {
    const service = boot.get(InventoryImportService);
    const own = await w.stock({ price: 100, batches: [] });
    await db.productVariant.update({
      where: { id: own.id },
      data: { sku: 'OWN-IMP' },
    });
    await db.productVariant.update({
      where: { id: w.theirs.id },
      data: { sku: 'FOREIGN-IMP' },
    });
    await w.rebaseBystander();
    const values = {
      sku: 'OWN-IMP',
      branch: w.tenant.branches[0].name,
      'batch number': 'IMP-100',
      quantity: '3',
      'cost price': '12.34',
      location: 'A-1',
    };
    const result = await service.prepare(cid(), [{ rowNumber: 2, values }]);
    expect(result.errors).toEqual([]);
    expect(result.prepared).toMatchObject([
      {
        variant_id: own.id,
        branch_id: w.tenant.branches[0].id,
        quantity: 3,
        cost_price: 12.34,
      },
    ]);
    expect(
      await db.$transaction((tx) =>
        service.write(cid(), w.tenant.adminUser.id, result.prepared, tx),
      ),
    ).toEqual({ batches: 1 });
    const batch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: own.id },
    });
    expect(batch).toMatchObject({
      batch_number: 'IMP-100',
      quantity: 3,
      location: 'A-1',
      payment_status: 'due',
    });
    expect(batch.cost_price.toFixed(2)).toBe('12.34');
    expect(
      await db.inventoryAuditLog.findMany({ where: { batch_id: batch.id } }),
    ).toMatchObject([
      {
        consumer_id: cid(),
        event_type: 'PURCHASE_IN',
        quantity_delta: 3,
        quantity_after: 3,
      },
    ]);
    const bad = await service.prepare(cid(), [
      { rowNumber: 2, values: { ...values, sku: 'FOREIGN-IMP' } },
    ]);
    expect(bad.prepared).toEqual([]);
    expect(bad.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          column: 'SKU',
          message: expect.stringContaining('FOREIGN-IMP'),
        }),
      ]),
    );
    expect(
      await db.$transaction((tx) =>
        service.write(
          w.bystander.consumer.id,
          w.bystander.adminUser.id,
          [],
          tx,
        ),
      ),
    ).toEqual({ batches: 0 });
    expect(
      await db.inventoryBatch.count({ where: { variant_id: own.id } }),
    ).toBe(1);
  });
});
