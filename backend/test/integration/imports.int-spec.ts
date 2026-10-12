import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import {
  createBrand,
  createCategory,
  createCustomer,
  createStockedVariant,
  createUnit,
  createVendor,
} from '../factories';
import { ImportService } from '../../src/consumer/import/services/import.service';

describe('spreadsheet imports', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let importer: ImportService;

  beforeAll(async () => {
    boot = await bootDomain();
    importer = boot.get(ImportService);
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
  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );
  async function sheet(
    headers: string[],
    rows: (string | number)[][],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Data');
    ws.addRow(headers);
    rows.forEach((row) => ws.addRow(row));
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
  const run = (entity: any, file: Buffer, dryRun = false) =>
    importer.run(entity, cid(), uid(), file, dryRun);

  describe('customers', () => {
    const headers = ['Name', 'Phone', 'Email', 'Customer Type'];

    it('[BE-IMP-001] a clean file creates tenant-owned customers; a dry run writes nothing', async () => {
      const file = await sheet(headers, [
        ['Rahim', '01711111111', 'rahim@example.test', 'individual'],
        ['Karim Traders', '01722222222', '', 'business'],
      ]);
      const preview = await run('customers', file, true);
      expect(preview).toMatchObject({
        imported: false,
        totalRows: 2,
        validRows: 2,
        errors: [],
      });
      expect(await db.customer.count({ where: { consumer_id: cid() } })).toBe(
        0,
      );
      const result = await run('customers', file);
      expect(result).toMatchObject({
        imported: true,
        created: { customers: 2 },
      });
      expect(await db.customer.count({ where: { consumer_id: cid() } })).toBe(
        2,
      );
    });

    it("[BE-IMP-002] a phone that only another shop uses is not a conflict; the same shop's phone is", async () => {
      await createCustomer(db, {
        consumer_id: w.bystander.consumer.id,
        phone: '01733333333',
      });
      await createCustomer(db, { consumer_id: cid(), phone: '01744444444' });
      await w.rebaseBystander();
      const ok = await run(
        'customers',
        await sheet(headers, [['Shared Phone', '01733333333', '', '']]),
      );
      expect(ok.imported).toBe(true);
      const bad = await run(
        'customers',
        await sheet(headers, [['Dup', '01744444444', '', '']]),
      );
      expect(bad.imported).toBe(false);
      expect(bad.errors[0]).toMatchObject({ row: 2, column: 'Phone' });
      expect(bad.errors[0].message).toMatch(/already exists/);
    });

    it('[BE-IMP-003] one bad row rejects the whole file; duplicates inside the file are reported', async () => {
      const file = await sheet(headers, [
        ['Good', '01755555555', '', ''],
        ['Bad Email', '01766666666', 'not-an-email', ''],
        ['Twin', '01755555555', '', ''],
      ]);
      const result = await run('customers', file);
      expect(result.imported).toBe(false);
      expect(result.errors.map((e) => e.row).sort()).toEqual([3, 4]);
      expect(await db.customer.count({ where: { consumer_id: cid() } })).toBe(
        0,
      );
    });
  });

  describe('products', () => {
    const headers = [
      'Product Name',
      'Unit',
      'Variant Name',
      'Regular Price',
      'Category',
      'Tax %',
      'SKU',
    ];

    it('[BE-IMP-010] rows with the same product name become one product with several variants', async () => {
      await createUnit(db, { consumer_id: cid(), name: 'Piece' });
      const category = await createCategory(db, {
        consumer_id: cid(),
        name: 'Audio',
      });
      const result = await run(
        'products',
        await sheet(headers, [
          ['Headphones', 'Piece', 'Black', 2500, 'Audio', 5, 'HP-B'],
          ['Headphones', 'Piece', 'White', 2600, '', '', 'HP-W'],
          ['Cable', 'Piece', 'Default', 100, '', '', ''],
        ]),
      );
      expect(result).toMatchObject({
        imported: true,
        created: { products: 2, variants: 3 },
      });
      const product = await db.product.findFirstOrThrow({
        where: { consumer_id: cid(), name: 'Headphones' },
        include: { variants: true },
      });
      expect(product).toMatchObject({ tax: 5, category_id: category.id });
      expect(product.variants.map((v) => v.name).sort()).toEqual([
        'Black',
        'White',
      ]);
    });

    it("[BE-IMP-011] unknown units, categories and other shops' lookups are errors and nothing is written", async () => {
      await createUnit(db, { consumer_id: cid(), name: 'Piece' });
      await createCategory(db, {
        consumer_id: w.bystander.consumer.id,
        name: 'Theirs',
      });
      await createBrand(db, {
        consumer_id: w.bystander.consumer.id,
        name: 'TheirBrand',
      });
      await w.rebaseBystander();
      const result = await run(
        'products',
        await sheet(headers, [
          ['A', 'Piece', 'Default', 10, 'Theirs', '', ''],
          ['B', 'Dozen', 'Default', 10, '', '', ''],
        ]),
      );
      expect(result.imported).toBe(false);
      expect(result.errors.map((e) => e.column).sort()).toEqual([
        'Category',
        'Unit',
      ]);
      expect(await db.product.count({ where: { consumer_id: cid() } })).toBe(0);
    });

    it("[BE-IMP-012] existing names and SKUs are refused; the plan's product cap applies", async () => {
      await createUnit(db, { consumer_id: cid(), name: 'Piece' });
      const first = await run(
        'products',
        await sheet(headers, [['One', 'Piece', 'Default', 10, '', '', 'S-1']]),
      );
      expect(first.imported).toBe(true);
      const duplicate = await run(
        'products',
        await sheet(headers, [
          ['One', 'Piece', 'Default', 10, '', '', 'S-2'],
          ['Two', 'Piece', 'Default', 10, '', '', 'S-1'],
        ]),
      );
      expect(duplicate.errors.length).toBe(2);
      await db.plan.update({
        where: { id: w.tenant.plan.id },
        data: { max_products: 1 },
      });
      const capped = await run(
        'products',
        await sheet(headers, [['Three', 'Piece', 'Default', 10, '', '', '']]),
      );
      expect(capped.imported).toBe(false);
      expect(capped.errors[0].message).toMatch(/limit/i);
    });
  });

  describe('inventory', () => {
    const headers = [
      'SKU',
      'Branch',
      'Batch Number',
      'Quantity',
      'Cost Price',
      'Vendor',
    ];

    it('[BE-IMP-020] a stock intake creates batches with purchase audit rows (INV-01 holds)', async () => {
      const v = await createStockedVariant(db, w.tenant, {
        price: 10,
        batches: [],
      });
      await db.productVariant.update({
        where: { id: v.id },
        data: { sku: 'SKU-IMP' },
      });
      const vendor = await createVendor(db, {
        consumer_id: cid(),
        name: 'Acme',
      });
      const branchName = w.tenant.branches[0].name;
      const result = await run(
        'inventory',
        await sheet(headers, [
          ['SKU-IMP', branchName, 'IMP-1', 12, 30, 'Acme'],
        ]),
      );
      expect(result).toMatchObject({ imported: true });
      const batch = await db.inventoryBatch.findFirstOrThrow({
        where: { variant_id: v.id },
      });
      expect(batch).toMatchObject({
        quantity: 12,
        vendor_id: vendor.id,
        batch_number: 'IMP-1',
      });
      expect(
        await db.inventoryAuditLog.count({
          where: { batch_id: batch.id, event_type: 'PURCHASE_IN' },
        }),
      ).toBe(1);
    });

    it("[BE-IMP-021] another shop's SKU, branch or vendor and duplicate batch numbers are errors", async () => {
      const theirs = await db.productVariant.update({
        where: { id: w.theirs.id },
        data: { sku: 'THEIR-SKU' },
      });
      await createVendor(db, {
        consumer_id: w.bystander.consumer.id,
        name: 'TheirVendor',
      });
      await db.branch.update({
        where: { id: w.bystander.branches[0].id },
        data: { name: 'Their Branch' },
      });
      await w.rebaseBystander();
      const mine = await createStockedVariant(db, w.tenant, {
        price: 10,
        batches: [{ qty: 1, cost: 1 }],
      });
      await db.productVariant.update({
        where: { id: mine.id },
        data: { sku: 'MY-SKU' },
      });
      const existing = await db.inventoryBatch.findFirstOrThrow({
        where: { variant_id: mine.id },
      });
      const branch = w.tenant.branches[0].name;
      const result = await run(
        'inventory',
        await sheet(headers, [
          [theirs.sku!, branch, 'X-1', 1, 1, ''],
          ['MY-SKU', 'Their Branch', 'X-2', 1, 1, ''],
          ['MY-SKU', branch, 'X-3', 1, 1, 'TheirVendor'],
          ['MY-SKU', branch, existing.batch_number, 1, 1, ''],
        ]),
      );
      expect(result.imported).toBe(false);
      expect(result.errors.map((e) => e.row).sort()).toEqual([2, 3, 4, 5]);
      expect(
        await db.inventoryBatch.count({
          where: { variant: { product: { consumer_id: cid() } } },
        }),
      ).toBe(1);
    });
  });

  describe('file handling', () => {
    it('[BE-IMP-030] unreadable files, missing columns and empty sheets are rejected with their own message', async () => {
      const garbage = await failure(
        run('customers', Buffer.from('this is not a workbook')),
      );
      expect(garbage).toBeInstanceOf(BadRequestException);
      expect(garbage.message).toMatch(/could not be read/);
      const missing = await run('customers', await sheet(['Name'], [['x']]));
      expect(missing.errors[0]).toMatchObject({ row: 1, column: 'Phone' });
      const empty = await failure(
        run('customers', await sheet(['Name', 'Phone'], [])),
      );
      expect(empty.message).toMatch(/no data rows/);
    });

    it('[BE-IMP-031] unknown import types are refused and every template builds', async () => {
      expect(() => importer.assertKnownEntity('orders')).toThrow(
        /Unknown import type/,
      );
      for (const entity of ['products', 'inventory', 'customers'] as const) {
        const template = await importer.buildTemplate(entity);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(template);
        const header = workbook.worksheets[0].getRow(1).values as string[];
        expect(header.filter(Boolean).length).toBe(
          importer.columnsFor(entity).length,
        );
      }
    });
  });
});
