import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FakeTable } from '../../../../test/helpers/fake-tables';
import {
  ConsumerImportDuplicateStrategy as Strategy,
  ConsumerImportSection as Section,
} from '../dto/consumer-data-import.dto';
import { ConsumerDataImportService } from './consumer-data-import.service';

const created = new Date('2025-01-01T00:00:00Z');
const ALL = [
  Section.BRANCHES,
  Section.VENDORS,
  Section.CUSTOMERS,
  Section.PRODUCTS,
  Section.INVENTORY,
];

function world(
  options: { maxProducts?: number | null; maxBranch?: number } = {},
) {
  const t: Record<string, FakeTable> = {};
  const table = (name: string, relations = {}, includes = {}, firstId = 1000) =>
    (t[name] = new FakeTable(name, t, relations, includes, firstId));
  table('consumer');
  table('branch');
  table('vendor');
  table('customer');
  table('unit');
  table('category');
  table('brand');
  table('tag');
  table('tagOnProduct');
  table('variantAttribute');
  table('productVariant', {
    product: (row: any) => t.product.rows.find((p) => p.id === row.product_id),
  });
  table(
    'product',
    {},
    {
      tags: (row: any) =>
        t.tagOnProduct.rows.filter((r) => r.product_id === row.id),
      variants: (row: any) =>
        t.productVariant.rows
          .filter((v) => v.product_id === row.id)
          .map((v) => ({
            ...v,
            VariantAttribute: t.variantAttribute.rows.filter(
              (a) => a.variant_id === v.id,
            ),
          })),
    },
  );
  table('inventoryBatch', {
    branch: (row: any) => t.branch.rows.find((b) => b.id === row.branch_id),
  });
  table('inventoryAuditLog');
  table('consumerImportMapping');
  table('consumerDataImport', {}, {}, 1);

  t.consumer.seed(
    { id: 1, company_name: 'Source', subdomain: 'source', deleted_at: null },
    {
      id: 2,
      company_name: 'Target',
      subdomain: 'target',
      deleted_at: null,
      max_branch: options.maxBranch ?? 5,
      plan: { name: 'Pro', max_products: options.maxProducts ?? null },
    },
  );
  t.branch.seed(
    {
      id: 1,
      consumer_id: 1,
      name: 'Main',
      address: 'A1',
      email: 'm@s.io',
      phone: '1',
      vat_registration_number: 'V1',
      is_main: true,
      is_warehouse: false,
      created_at: created,
    },
    {
      id: 2,
      consumer_id: 1,
      name: 'Mirpur',
      address: 'A2',
      email: 'x@s.io',
      phone: '2',
      vat_registration_number: null,
      is_main: false,
      is_warehouse: true,
      created_at: created,
    },
    {
      id: 50,
      consumer_id: 2,
      name: 'Main',
      address: 'T',
      email: null,
      phone: null,
      vat_registration_number: null,
      is_main: true,
      is_warehouse: false,
      created_at: created,
    },
  );
  t.vendor.seed({
    id: 1,
    consumer_id: 1,
    name: 'Acme',
    contact: 'c',
    phone: 'p',
    email: 'e',
    address: 'a',
    created_at: created,
  });
  t.customer.seed(
    {
      id: 1,
      consumer_id: 1,
      name: 'Ada',
      email: 'a@s.io',
      phone: '01700',
      address: 'D',
      birthday: null,
      customer_type: 'individual',
      created_at: created,
    },
    {
      id: 2,
      consumer_id: 1,
      name: 'Bob',
      email: null,
      phone: '01800',
      address: null,
      birthday: created,
      customer_type: 'business',
      created_at: created,
    },
  );
  t.unit.seed({ id: 1, consumer_id: 1, name: 'Piece', created_at: created });
  t.category.seed({
    id: 1,
    consumer_id: 1,
    name: 'Shirts',
    created_at: created,
  });
  t.brand.seed({
    id: 1,
    consumer_id: 1,
    name: 'Nike',
    logo: 'l.png',
    website: 'w.io',
    created_at: created,
  });
  t.tag.seed({ id: 1, consumer_id: 1, name: 'Hot', created_at: created });
  t.product.seed({
    id: 1,
    consumer_id: 1,
    name: 'Shirt',
    code: 'SH1',
    description: 'd',
    category_id: 1,
    brand_id: 1,
    has_variants: true,
    tax_method: 'EXCLUSIVE',
    tax: 5,
    created_at: created,
  });
  t.tagOnProduct.seed({ product_id: 1, tag_id: 1 });
  t.productVariant.seed({
    id: 1,
    product_id: 1,
    name: 'Small',
    sku: 'SH1-S',
    barcode: 'B1',
    regular_price: 10,
    wholesale_price: 8,
    sale_unit_id: 1,
    purchase_unit_id: 1,
    warranty_period: 12,
    image: 'i.png',
    is_default: true,
    alert_quantity: 2,
    daily_sale_objective: 3,
    created_at: created,
  });
  t.variantAttribute.seed({
    id: 1,
    consumer_id: 1,
    variant_id: 1,
    name: 'Size',
    value: 'S',
  });
  t.inventoryBatch.seed({
    id: 1,
    variant_id: 1,
    branch_id: 2,
    batch_number: 'BN-1',
    quantity: 5,
    reserved_quantity: 1,
    cost_price: 4,
    vendor_id: 1,
    location: 'A-1',
    expiry_date: null,
    payment_status: 'paid',
    paid_amount: 20,
    created_at: created,
  });

  const prisma: any = {
    ...t,
    $transaction: jest.fn(
      async (fn: (tx: unknown) => unknown, options: unknown) => {
        prisma.lastTransactionOptions = options;
        return fn({ ...t, $executeRaw: prisma.$executeRaw });
      },
    ),
    $executeRaw: jest.fn(),
  };
  return { t, prisma, service: new ConsumerDataImportService(prisma) };
}

const dto = (
  sections: Section[],
  strategy = Strategy.SKIP,
  extra: object = {},
): any => ({
  source_consumer_id: 1,
  target_consumer_id: 2,
  sections,
  duplicate_strategy: strategy,
  confirm_target_subdomain: 'target',
  ...extra,
});

const importTx = (ctx: ReturnType<typeof world>, d: any) =>
  (ctx.service as any).importWithinTransaction(
    { ...ctx.t, $executeRaw: ctx.prisma.$executeRaw },
    d,
  );

const counts = (created = 0, updated = 0, skipped = 0, conflicts = 0) => ({
  created,
  updated,
  skipped,
  conflicts,
});

afterEach(() => jest.restoreAllMocks());

describe('ConsumerDataImportService validation, preview and history (unit)', () => {
  it('[BE-MUT-620] source and destination must differ and both must be live accounts', async () => {
    const ctx = world();
    await expect(
      ctx.service.preview({
        source_consumer_id: 1,
        target_consumer_id: 1,
        sections: ALL,
      }),
    ).rejects.toThrow('Source and destination accounts must be different');
    ctx.t.consumer.rows[0].deleted_at = new Date();
    await expect(
      ctx.service.preview({
        source_consumer_id: 1,
        target_consumer_id: 2,
        sections: ALL,
      }),
    ).rejects.toThrow(new NotFoundException('Source account not found'));
    ctx.t.consumer.rows[0].deleted_at = null;
    ctx.t.consumer.rows[1].deleted_at = new Date();
    await expect(
      ctx.service.preview({
        source_consumer_id: 1,
        target_consumer_id: 2,
        sections: ALL,
      }),
    ).rejects.toThrow(new NotFoundException('Destination account not found'));
    expect(ctx.t.consumer.findFirst).toHaveBeenCalledWith({
      where: { id: 1, deleted_at: null },
      select: { id: true, company_name: true, subdomain: true },
    });
    expect(ctx.t.consumer.findFirst).toHaveBeenCalledWith({
      where: { id: 2, deleted_at: null },
      select: {
        id: true,
        company_name: true,
        subdomain: true,
        max_branch: true,
        plan: { select: { name: true, max_products: true } },
      },
    });
  });

  it('[BE-MUT-621] the preview counts only the selected sections, from the source account, and states the rules', async () => {
    const ctx = world();
    const all = await ctx.service.preview({
      source_consumer_id: 1,
      target_consumer_id: 2,
      sections: ALL,
    });
    expect(all.counts).toEqual({
      branches: 2,
      vendors: 1,
      customers: 2,
      products: 1,
      product_variants: 1,
      units: 1,
      categories: 1,
      brands: 1,
      tags: 1,
      inventory_batches: 1,
    });
    expect(all.source).toMatchObject({ id: 1 });
    expect(all.target).toMatchObject({ id: 2 });
    expect(all.sections).toEqual(ALL);
    expect(all.rules).toEqual({
      direction: 'ONE_WAY_SNAPSHOT',
      repeated_imports: 'Previously mapped records are reused',
      products:
        'Includes catalog dependencies, variants, tags and attributes; excludes stock and transaction history',
      inventory:
        'Includes inventory batches and current stock; requires Products and Branches to be selected in the same import',
      customers:
        'Includes customer profiles; excludes sales and rewards history',
      branches:
        'The destination main branch is preserved; imported branches never become the main branch',
    });
    expect(ctx.t.productVariant.count).toHaveBeenCalledWith({
      where: { product: { consumer_id: 1 } },
    });
    expect(ctx.t.inventoryBatch.count).toHaveBeenCalledWith({
      where: { branch: { consumer_id: 1 } },
    });
    for (const [section, key] of [
      [Section.BRANCHES, 'branches'],
      [Section.VENDORS, 'vendors'],
      [Section.CUSTOMERS, 'customers'],
      [Section.INVENTORY, 'inventory_batches'],
    ] as const) {
      const one = await ctx.service.preview({
        source_consumer_id: 1,
        target_consumer_id: 2,
        sections: [section],
      });
      expect(Object.keys(one.counts)).toEqual([key]);
    }
    const products = await ctx.service.preview({
      source_consumer_id: 1,
      target_consumer_id: 2,
      sections: [Section.PRODUCTS],
    });
    expect(Object.keys(products.counts).sort()).toEqual([
      'brands',
      'categories',
      'product_variants',
      'products',
      'tags',
      'units',
    ]);
  });

  it('[BE-MUT-622] history is newest first, clamped to 1-100 rows with 50 as the default, and names the parties', async () => {
    const ctx = world();
    for (const [input, expected] of [
      [undefined, 50],
      [Number.NaN, 50],
      [Number.POSITIVE_INFINITY, 50],
      [0, 1],
      [-5, 1],
      [7, 7],
      [100, 100],
      [101, 100],
    ] as const) {
      await ctx.service.history(input);
      expect(ctx.t.consumerDataImport.findMany.mock.lastCall![0].take).toBe(
        expected,
      );
    }
    expect(ctx.t.consumerDataImport.findMany).toHaveBeenLastCalledWith({
      take: 100,
      orderBy: { created_at: 'desc' },
      include: {
        source: { select: { id: true, company_name: true, subdomain: true } },
        target: { select: { id: true, company_name: true, subdomain: true } },
        requested_by: { select: { id: true, name: true, email: true } },
      },
    });
  });
});

describe('ConsumerDataImportService.run (unit)', () => {
  it('[BE-MUT-623] a successful run is audited, executed in one repeatable-read transaction and marked completed with its summary', async () => {
    const ctx = world();
    const result: any = await ctx.service.run(dto([Section.VENDORS]), 9);
    expect(ctx.t.consumerDataImport.create).toHaveBeenCalledWith({
      data: {
        source_consumer_id: 1,
        target_consumer_id: 2,
        requested_by_id: 9,
        sections: [Section.VENDORS],
        duplicate_strategy: Strategy.SKIP,
      },
    });
    expect(ctx.prisma.lastTransactionOptions).toEqual({
      timeout: 120_000,
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    expect(ctx.t.consumerDataImport.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'COMPLETED',
        summary: { vendors: counts(1) },
        completed_at: expect.any(Date),
      },
      include: {
        source: { select: { id: true, company_name: true, subdomain: true } },
        target: { select: { id: true, company_name: true, subdomain: true } },
      },
    });
    expect(result.status).toBe('COMPLETED');
    await ctx.service.run(dto([Section.VENDORS]));
    expect(
      ctx.t.consumerDataImport.create.mock.lastCall![0].data.requested_by_id,
    ).toBeNull();
  });

  it('[BE-MUT-624] a wrong destination confirmation is refused before an audit row exists', async () => {
    const ctx = world();
    await expect(
      ctx.service.run(
        dto([Section.VENDORS], Strategy.SKIP, {
          confirm_target_subdomain: 'oops',
        }),
      ),
    ).rejects.toThrow(
      "Confirmation failed: expected destination subdomain 'target'",
    );
    expect(ctx.t.consumerDataImport.create).not.toHaveBeenCalled();
  });

  it('[BE-MUT-625] a failing import is recorded as FAILED with a trimmed message; business errors pass through, others are wrapped', async () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const wrapped = world();
    wrapped.prisma.$transaction.mockRejectedValue(new Error('x'.repeat(5000)));
    const error = await wrapped.service
      .run(dto([Section.VENDORS]))
      .catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe(
      `Import failed without changing destination data: ${'x'.repeat(5000)}`,
    );
    const failed = wrapped.t.consumerDataImport.update.mock.calls[0][0];
    expect(failed.data.status).toBe('FAILED');
    expect(failed.data.error_message).toHaveLength(4000);
    expect(failed.data.completed_at).toBeInstanceOf(Date);
    expect(log).toHaveBeenCalledWith(
      'Account data import 1 failed',
      expect.any(String),
    );
    const passthrough = world();
    const client = new BadRequestException('business rule');
    passthrough.prisma.$transaction.mockRejectedValue(client);
    await expect(passthrough.service.run(dto([Section.VENDORS]))).rejects.toBe(
      client,
    );
  });
});

describe('ConsumerDataImportService branches (unit)', () => {
  it('[BE-MUT-626] new source branches are created non-main with their details; the destination main branch is reused by name and never replaced', async () => {
    const ctx = world();
    const summary = await importTx(ctx, dto([Section.BRANCHES]));
    expect(summary).toEqual({ branches: counts(1, 0, 1) });
    expect(ctx.prisma.$executeRaw).toHaveBeenCalledTimes(1);
    const mirpur = ctx.t.branch.rows.find(
      (b) => b.name === 'Mirpur' && b.consumer_id === 2,
    )!;
    expect(mirpur).toMatchObject({
      consumer_id: 2,
      address: 'A2',
      email: 'x@s.io',
      phone: '2',
      vat_registration_number: null,
      is_main: false,
      is_warehouse: true,
      created_at: created,
    });
    expect(ctx.t.branch.rows.find((b) => b.id === 50)!.address).toBe('T');
    const maps = ctx.t.consumerImportMapping.rows.map((m) => [
      m.entity_type,
      m.source_record_id,
      m.target_record_id,
    ]);
    expect(maps).toEqual([
      ['branch', 1, 50],
      ['branch', 2, mirpur.id],
    ]);
    expect(ctx.t.consumerImportMapping.findMany).toHaveBeenCalledWith({
      where: { source_consumer_id: 1, target_consumer_id: 2 },
    });
  });

  it('[BE-MUT-627] with UPDATE a matched branch takes the source details but stays what it was (main flag) and is counted as updated', async () => {
    const ctx = world();
    const summary = await importTx(
      ctx,
      dto([Section.BRANCHES], Strategy.UPDATE),
    );
    expect(summary).toEqual({ branches: counts(1, 1) });
    expect(ctx.t.branch.rows.find((b) => b.id === 50)).toMatchObject({
      name: 'Main',
      address: 'A1',
      email: 'm@s.io',
      phone: '1',
      vat_registration_number: 'V1',
      is_warehouse: false,
      is_main: true,
    });
  });

  it('[BE-MUT-628] a repeat import reuses the saved mapping even after the destination branch was renamed', async () => {
    const ctx = world();
    await importTx(ctx, dto([Section.BRANCHES]));
    const mirpurId = ctx.t.consumerImportMapping.rows.find(
      (m) => m.source_record_id === 2,
    )!.target_record_id;
    ctx.t.branch.rows.find((b) => b.id === mirpurId)!.name = 'Renamed';
    const summary = await importTx(
      ctx,
      dto([Section.BRANCHES], Strategy.UPDATE),
    );
    expect(summary).toEqual({ branches: counts(0, 2) });
    expect(ctx.t.branch.rows.filter((b) => b.consumer_id === 2)).toHaveLength(
      2,
    );
    expect(ctx.t.branch.rows.find((b) => b.id === mirpurId)!.name).toBe(
      'Mirpur',
    );
  });

  it('[BE-MUT-629] a mapped branch whose name now belongs to another destination branch is a conflict and is left alone', async () => {
    const ctx = world();
    await importTx(ctx, dto([Section.BRANCHES]));
    const mirpurId = ctx.t.consumerImportMapping.rows.find(
      (m) => m.source_record_id === 2,
    )!.target_record_id;
    ctx.t.branch.rows.find((b) => b.id === mirpurId)!.name = 'Elsewhere';
    ctx.t.branch.seed({
      id: 60,
      consumer_id: 2,
      name: 'Mirpur',
      is_main: false,
    });
    const summary = await importTx(
      ctx,
      dto([Section.BRANCHES], Strategy.UPDATE),
    );
    expect(summary.branches.conflicts).toBe(1);
    expect(ctx.t.branch.rows.find((b) => b.id === mirpurId)!.name).toBe(
      'Elsewhere',
    );
  });

  it('[BE-MUT-630] the destination branch limit counts only branches that would really be created', async () => {
    const full = world({ maxBranch: 1 });
    await expect(importTx(full, dto([Section.BRANCHES]))).rejects.toThrow(
      'Branch limit exceeded: destination allows 1, has 1, and this import needs 1 more',
    );
    const exact = world({ maxBranch: 2 });
    await expect(
      importTx(exact, dto([Section.BRANCHES])),
    ).resolves.toBeDefined();
    expect(exact.t.consumer.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 2 },
      select: { max_branch: true },
    });
  });

  it('[BE-MUT-631] two source branches cannot be merged into one destination branch', async () => {
    const ctx = world();
    ctx.t.branch.seed({ id: 3, consumer_id: 1, name: 'main', is_main: false });
    ctx.t.branch.rows.find((b) => b.id === 3)!.name = 'Main';
    ctx.t.branch.rows.find((b) => b.id === 3)!.consumer_id = 1;
    await expect(importTx(ctx, dto([Section.BRANCHES]))).rejects.toThrow(
      'Cannot safely merge two source branch records into destination record 50',
    );
  });
});

describe('ConsumerDataImportService vendors and customers (unit)', () => {
  it('[BE-MUT-632] vendors are created with all details, skipped on repeat, updated on request, and conflicts are counted', async () => {
    const ctx = world();
    expect(await importTx(ctx, dto([Section.VENDORS]))).toEqual({
      vendors: counts(1),
    });
    expect(ctx.t.vendor.rows.find((v) => v.consumer_id === 2)).toMatchObject({
      name: 'Acme',
      contact: 'c',
      phone: 'p',
      email: 'e',
      address: 'a',
      created_at: created,
    });
    expect(await importTx(ctx, dto([Section.VENDORS]))).toEqual({
      vendors: counts(0, 0, 1),
    });
    ctx.t.vendor.rows[0].phone = 'new';
    expect(
      await importTx(ctx, dto([Section.VENDORS], Strategy.UPDATE)),
    ).toEqual({
      vendors: counts(0, 1),
    });
    expect(ctx.t.vendor.rows.find((v) => v.consumer_id === 2)!.phone).toBe(
      'new',
    );
    const mapped = ctx.t.consumerImportMapping.rows.find(
      (m) => m.entity_type === 'vendor',
    )!;
    ctx.t.vendor.rows.find((v) => v.id === mapped.target_record_id)!.name =
      'Gone';
    ctx.t.vendor.seed({ id: 70, consumer_id: 2, name: 'Acme' });
    expect(await importTx(ctx, dto([Section.VENDORS]))).toEqual({
      vendors: counts(0, 0, 0, 1),
    });
  });

  it('[BE-MUT-633] customers match by phone inside the destination only, copy every field and report conflicts', async () => {
    const ctx = world();
    ctx.t.customer.seed({
      id: 80,
      consumer_id: 3,
      name: 'Other shop',
      phone: '01700',
    });
    expect(await importTx(ctx, dto([Section.CUSTOMERS]))).toEqual({
      customers: counts(2),
    });
    const copies = ctx.t.customer.rows.filter((c) => c.consumer_id === 2);
    expect(copies).toHaveLength(2);
    expect(copies[1]).toMatchObject({
      name: 'Bob',
      email: null,
      phone: '01800',
      address: null,
      birthday: created,
      customer_type: 'business',
      created_at: created,
    });
    ctx.t.customer.rows[0].name = 'Ada Lovelace';
    expect(
      await importTx(ctx, dto([Section.CUSTOMERS], Strategy.UPDATE)),
    ).toEqual({
      customers: counts(0, 2),
    });
    expect(
      ctx.t.customer.rows.find(
        (c) => c.consumer_id === 2 && c.phone === '01700',
      )!.name,
    ).toBe('Ada Lovelace');
    expect(await importTx(ctx, dto([Section.CUSTOMERS]))).toEqual({
      customers: counts(0, 0, 2),
    });
    const mapped = ctx.t.consumerImportMapping.rows.find(
      (m) => m.entity_type === 'customer' && m.source_record_id === 1,
    )!;
    ctx.t.customer.rows.find((c) => c.id === mapped.target_record_id)!.phone =
      'moved';
    ctx.t.customer.seed({
      id: 90,
      consumer_id: 2,
      name: 'Squatter',
      phone: '01700',
    });
    expect(await importTx(ctx, dto([Section.CUSTOMERS]))).toEqual({
      customers: counts(0, 0, 1, 1),
    });
  });
});

describe('ConsumerDataImportService products and inventory (unit)', () => {
  it('[BE-MUT-634] products arrive with their units, categories, brands, tags, variants and attributes, wired to the new ids', async () => {
    const ctx = world();
    const summary = await importTx(ctx, dto([Section.PRODUCTS]));
    expect(summary).toEqual({
      units: counts(1),
      categories: counts(1),
      brands: counts(1),
      tags: counts(1),
      products: counts(1),
      product_variants: counts(1),
      variant_attributes: counts(1),
    });
    const brand = ctx.t.brand.rows.find((b) => b.consumer_id === 2)!;
    expect(brand).toMatchObject({
      name: 'Nike',
      logo: 'l.png',
      website: 'w.io',
      created_at: created,
    });
    const unit = ctx.t.unit.rows.find((u) => u.consumer_id === 2)!;
    const category = ctx.t.category.rows.find((c) => c.consumer_id === 2)!;
    const tag = ctx.t.tag.rows.find((c) => c.consumer_id === 2)!;
    const product = ctx.t.product.rows.find((p) => p.consumer_id === 2)!;
    expect(product).toMatchObject({
      name: 'Shirt',
      code: 'SH1',
      description: 'd',
      category_id: category.id,
      brand_id: brand.id,
      has_variants: true,
      tax_method: 'EXCLUSIVE',
      tax: 5,
      created_at: created,
    });
    const variant = ctx.t.productVariant.rows.find(
      (v) => v.product_id === product.id,
    )!;
    expect(variant).toMatchObject({
      name: 'Small',
      sku: 'SH1-S',
      barcode: 'B1',
      regular_price: 10,
      wholesale_price: 8,
      sale_unit_id: unit.id,
      purchase_unit_id: unit.id,
      warranty_period: 12,
      image: 'i.png',
      is_default: true,
      alert_quantity: 2,
      daily_sale_objective: 3,
      created_at: created,
    });
    expect(
      ctx.t.variantAttribute.rows.find((a) => a.variant_id === variant.id),
    ).toMatchObject({
      consumer_id: 2,
      name: 'Size',
      value: 'S',
    });
    expect(
      ctx.t.tagOnProduct.rows.filter((r) => r.product_id === product.id),
    ).toEqual([
      expect.objectContaining({ product_id: product.id, tag_id: tag.id }),
    ]);
    expect(
      ctx.t.consumerImportMapping.rows.map((m) => m.entity_type).sort(),
    ).toEqual([
      'brand',
      'category',
      'product',
      'product_variant',
      'tag',
      'unit',
      'variant_attribute',
    ]);
  });

  it('[BE-MUT-635] a repeat product import skips everything; UPDATE rewrites dependencies, product, variant and attribute values', async () => {
    const ctx = world();
    await importTx(ctx, dto([Section.PRODUCTS]));
    expect(await importTx(ctx, dto([Section.PRODUCTS]))).toEqual({
      units: counts(0, 0, 1),
      categories: counts(0, 0, 1),
      brands: counts(0, 0, 1),
      tags: counts(0, 0, 1),
      products: counts(0, 0, 1),
      product_variants: counts(0, 0, 1),
      variant_attributes: counts(0, 0, 1),
    });
    ctx.t.brand.rows[0].logo = 'new.png';
    ctx.t.product.rows[0].tax = 9;
    ctx.t.productVariant.rows[0].regular_price = 99;
    ctx.t.variantAttribute.rows[0].value = 'XL';
    ctx.t.tagOnProduct.seed({ product_id: 1, tag_id: 999 });
    expect(
      await importTx(ctx, dto([Section.PRODUCTS], Strategy.UPDATE)),
    ).toEqual({
      units: counts(0, 1),
      categories: counts(0, 1),
      brands: counts(0, 1),
      tags: counts(0, 1),
      products: counts(0, 1),
      product_variants: counts(0, 1),
      variant_attributes: counts(0, 1),
    });
    expect(ctx.t.brand.rows.find((b) => b.consumer_id === 2)!.logo).toBe(
      'new.png',
    );
    expect(ctx.t.product.rows.find((p) => p.consumer_id === 2)!.tax).toBe(9);
    expect(
      ctx.t.productVariant.rows.find((v) => v.id !== 1)!.regular_price,
    ).toBe(99);
    expect(
      ctx.t.variantAttribute.rows.find((a) => a.consumer_id === 2)!.value,
    ).toBe('XL');
    expect(ctx.t.tag.rows.filter((tag) => tag.consumer_id === 2)).toHaveLength(
      1,
    );
  });

  it("[BE-MUT-636] products are matched by name or code; a mapped product renamed into another product's name or code is a conflict", async () => {
    const byName = world();
    byName.t.product.seed({
      id: 200,
      consumer_id: 2,
      name: 'Shirt',
      code: null,
    });
    expect((await importTx(byName, dto([Section.PRODUCTS]))).products).toEqual(
      counts(0, 0, 1),
    );
    const byCode = world();
    byCode.t.product.seed({
      id: 200,
      consumer_id: 2,
      name: 'Other',
      code: 'SH1',
    });
    expect((await importTx(byCode, dto([Section.PRODUCTS]))).products).toEqual(
      counts(0, 0, 1),
    );
    const both = world();
    both.t.product.seed(
      { id: 200, consumer_id: 2, name: 'Shirt', code: 'X' },
      { id: 201, consumer_id: 2, name: 'Y', code: 'SH1' },
    );
    expect((await importTx(both, dto([Section.PRODUCTS]))).products).toEqual(
      counts(0, 0, 0, 1),
    );
    const renamed = world();
    await importTx(renamed, dto([Section.PRODUCTS]));
    const mapped = renamed.t.consumerImportMapping.rows.find(
      (m) => m.entity_type === 'product',
    )!;
    renamed.t.product.rows.find((p) => p.id === mapped.target_record_id)!.name =
      'Renamed';
    renamed.t.product.seed({
      id: 300,
      consumer_id: 2,
      name: 'Shirt',
      code: null,
    });
    expect((await importTx(renamed, dto([Section.PRODUCTS]))).products).toEqual(
      counts(0, 0, 0, 1),
    );
  });

  it('[BE-MUT-637] the destination plan product limit is enforced with the exact numbers and counts only new products', async () => {
    const full = world({ maxProducts: 1 });
    full.t.product.seed({
      id: 200,
      consumer_id: 2,
      name: 'Existing',
      code: null,
    });
    await expect(importTx(full, dto([Section.PRODUCTS]))).rejects.toThrow(
      'Product limit exceeded: Pro allows 1, destination has 1, and this import needs 1 more',
    );
    const exact = world({ maxProducts: 1 });
    await expect(
      importTx(exact, dto([Section.PRODUCTS])),
    ).resolves.toBeDefined();
    const existing = world({ maxProducts: 1 });
    existing.t.product.seed({
      id: 200,
      consumer_id: 2,
      name: 'Shirt',
      code: null,
    });
    await expect(
      importTx(existing, dto([Section.PRODUCTS])),
    ).resolves.toBeDefined();
    expect(exact.t.consumer.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 2 },
      select: { plan: { select: { name: true, max_products: true } } },
    });
  });

  it('[BE-MUT-638] a variant matching two destination variants is a conflict; matching by name applies only without sku and barcode', async () => {
    const ctx = world();
    ctx.t.product.seed({ id: 200, consumer_id: 2, name: 'Shirt', code: 'SH1' });
    ctx.t.productVariant.seed(
      { id: 20, product_id: 200, name: 'A', sku: 'SH1-S', barcode: 'x' },
      { id: 21, product_id: 200, name: 'B', sku: 'y', barcode: 'B1' },
    );
    expect(
      (await importTx(ctx, dto([Section.PRODUCTS]))).product_variants,
    ).toEqual(counts(0, 0, 0, 1));
    const named = world();
    named.t.productVariant.rows[0].sku = null;
    named.t.productVariant.rows[0].barcode = null;
    named.t.product.seed({
      id: 200,
      consumer_id: 2,
      name: 'Shirt',
      code: 'SH1',
    });
    named.t.productVariant.seed({
      id: 20,
      product_id: 200,
      name: 'Small',
      sku: 'other',
      barcode: null,
    });
    expect(
      (await importTx(named, dto([Section.PRODUCTS]))).product_variants,
    ).toEqual(counts(0, 0, 1));
    const unmatched = world();
    unmatched.t.product.seed({
      id: 200,
      consumer_id: 2,
      name: 'Shirt',
      code: 'SH1',
    });
    unmatched.t.productVariant.seed({
      id: 20,
      product_id: 200,
      name: 'Small',
      sku: 'zzz',
      barcode: 'zzz',
    });
    expect(
      (await importTx(unmatched, dto([Section.PRODUCTS]))).product_variants,
    ).toEqual(counts(1));
  });

  it('[BE-MUT-639] dependency name collisions with a different saved mapping are refused, and a variant without its units fails the import', async () => {
    const ctx = world();
    await importTx(ctx, dto([Section.PRODUCTS]));
    const mapped = ctx.t.consumerImportMapping.rows.find(
      (m) => m.entity_type === 'unit',
    )!;
    ctx.t.unit.rows.find((u) => u.id === mapped.target_record_id)!.name =
      'Renamed';
    ctx.t.unit.seed({ id: 500, consumer_id: 2, name: 'Piece' });
    await expect(importTx(ctx, dto([Section.PRODUCTS]))).rejects.toThrow(
      "Cannot safely import product unit 'Piece': its previous mapping and destination name point to different records",
    );
    const broken = world();
    broken.t.productVariant.rows[0].sale_unit_id = 777;
    await expect(importTx(broken, dto([Section.PRODUCTS]))).rejects.toThrow(
      "Product 'Shirt' has a variant with a missing unit relationship",
    );
    const noPurchase = world();
    noPurchase.t.productVariant.rows[0].purchase_unit_id = 777;
    await expect(importTx(noPurchase, dto([Section.PRODUCTS]))).rejects.toThrow(
      'missing unit relationship',
    );
  });

  it('[BE-MUT-640] a product without category, brand, code or tags imports with nulls', async () => {
    const ctx = world();
    Object.assign(ctx.t.product.rows[0], {
      category_id: null,
      brand_id: null,
      code: null,
    });
    ctx.t.tagOnProduct.rows.length = 0;
    await importTx(ctx, dto([Section.PRODUCTS]));
    expect(ctx.t.product.rows.find((p) => p.consumer_id === 2)).toMatchObject({
      category_id: null,
      brand_id: null,
      code: null,
    });
    expect(ctx.t.tagOnProduct.upsert).not.toHaveBeenCalled();
  });

  it('[BE-MUT-641] inventory needs products and branches in the same import', async () => {
    for (const sections of [
      [Section.INVENTORY],
      [Section.INVENTORY, Section.PRODUCTS],
      [Section.INVENTORY, Section.BRANCHES],
    ]) {
      const ctx = world();
      await expect(importTx(ctx, dto(sections))).rejects.toThrow(
        'Inventory import requires Products and Branches to be selected',
      );
    }
  });

  it('[BE-MUT-642] stock batches are copied with their branch, variant and vendor mapped, and an audit row records the opening stock', async () => {
    const ctx = world();
    const summary = await importTx(ctx, dto(ALL));
    expect(summary.inventory_batches).toEqual(counts(1));
    const batch = ctx.t.inventoryBatch.rows.find((b) => b.id !== 1)!;
    const branch = ctx.t.branch.rows.find(
      (b) => b.consumer_id === 2 && b.name === 'Mirpur',
    )!;
    const variant = ctx.t.productVariant.rows.find((v) => v.id !== 1)!;
    const vendor = ctx.t.vendor.rows.find((v) => v.consumer_id === 2)!;
    expect(batch).toMatchObject({
      variant_id: variant.id,
      branch_id: branch.id,
      batch_number: 'BN-1',
      quantity: 5,
      reserved_quantity: 1,
      cost_price: 4,
      vendor_id: vendor.id,
      location: 'A-1',
      expiry_date: null,
      payment_status: 'paid',
      paid_amount: 20,
      created_at: created,
    });
    expect(ctx.t.inventoryAuditLog.create).toHaveBeenCalledWith({
      data: {
        consumer_id: 2,
        branch_id: branch.id,
        variant_id: variant.id,
        batch_id: batch.id,
        inventoryBatchId: batch.id,
        event_type: 'PURCHASE_IN',
        quantity_delta: 5,
        quantity_after: 5,
        reference_id: batch.id,
        reference_type: 'inventory_batches',
        notes: 'Stock copied by account data import from account #1',
      },
    });
    expect(ctx.t.inventoryBatch.findMany).toHaveBeenCalledWith({
      where: { branch: { consumer_id: 1 } },
      orderBy: { id: 'asc' },
    });
    expect(await importTx(ctx, dto(ALL))).toMatchObject({
      inventory_batches: counts(0, 0, 1),
    });
  });

  it('[BE-MUT-643] an empty source batch gets no opening audit row; a batch without a vendor maps to none', async () => {
    const ctx = world();
    Object.assign(ctx.t.inventoryBatch.rows[0], {
      quantity: 0,
      vendor_id: null,
    });
    await importTx(ctx, dto(ALL));
    expect(ctx.t.inventoryAuditLog.create).not.toHaveBeenCalled();
    expect(
      ctx.t.inventoryBatch.rows.find((b) => b.id !== 1)!.vendor_id,
    ).toBeNull();
  });

  it('[BE-MUT-644] UPDATE rewrites a copied batch and audits a quantity change with its delta; an unchanged quantity writes no audit', async () => {
    const ctx = world();
    await importTx(ctx, dto(ALL));
    ctx.t.inventoryAuditLog.create.mockClear();
    ctx.t.inventoryBatch.rows[0].cost_price = 6;
    expect(
      (await importTx(ctx, dto(ALL, Strategy.UPDATE))).inventory_batches,
    ).toEqual(counts(0, 1));
    expect(ctx.t.inventoryAuditLog.create).not.toHaveBeenCalled();
    expect(ctx.t.inventoryBatch.rows.find((b) => b.id !== 1)!.cost_price).toBe(
      6,
    );
    ctx.t.inventoryBatch.rows[0].quantity = 9;
    await importTx(ctx, dto(ALL, Strategy.UPDATE));
    const copy = ctx.t.inventoryBatch.rows.find((b) => b.id !== 1)!;
    expect(ctx.t.inventoryAuditLog.create).toHaveBeenCalledWith({
      data: {
        consumer_id: 2,
        branch_id: copy.branch_id,
        variant_id: copy.variant_id,
        batch_id: copy.id,
        inventoryBatchId: copy.id,
        event_type: 'ADJUSTMENT',
        quantity_delta: 4,
        quantity_after: 9,
        reference_id: copy.id,
        reference_type: 'inventory_batches',
        notes: 'Quantity set by account data import from account #1',
      },
    });
  });

  it('[BE-MUT-645] a mapped batch whose number now exists elsewhere is a conflict; missing relationships fail the import with the batch number', async () => {
    const conflict = world();
    await importTx(conflict, dto(ALL));
    const copy = conflict.t.inventoryBatch.rows.find((b) => b.id !== 1)!;
    const mapped = conflict.t.consumerImportMapping.rows.find(
      (m) => m.entity_type === 'inventory_batch',
    )!;
    expect(mapped.target_record_id).toBe(copy.id);
    copy.batch_number = 'MOVED';
    conflict.t.inventoryBatch.seed({
      id: 400,
      variant_id: copy.variant_id,
      branch_id: copy.branch_id,
      batch_number: 'BN-1',
      quantity: 1,
    });
    expect((await importTx(conflict, dto(ALL))).inventory_batches).toEqual(
      counts(0, 0, 0, 1),
    );

    const noVendor = world();
    noVendor.t.vendor.rows.length = 0;
    await expect(importTx(noVendor, dto(ALL))).rejects.toThrow(
      "Inventory batch 'BN-1' is missing its imported vendor relationship",
    );
    const noVariant = world();
    noVariant.t.productVariant.rows.length = 0;
    noVariant.t.product.rows.length = 0;
    await expect(importTx(noVariant, dto(ALL))).rejects.toThrow(
      "Inventory batch 'BN-1' is missing its imported product variant or branch relationship",
    );
  });
});
