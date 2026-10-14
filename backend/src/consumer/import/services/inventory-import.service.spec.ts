import { InventoryImportService } from './inventory-import.service';

const row = (rowNumber: number, values: Record<string, string>) => ({
  rowNumber,
  values,
});

function setup() {
  const prisma: any = {
    productVariant: { findMany: jest.fn().mockResolvedValue([]) },
    branch: { findMany: jest.fn().mockResolvedValue([]) },
    vendor: { findMany: jest.fn().mockResolvedValue([]) },
    inventoryBatch: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { prisma, service: new InventoryImportService(prisma) };
}

/** Lookups for variant 11 (SKU "BTH-1", barcode "8801"), branch 5 "Main" and vendor 7 "Acme". */
function withCatalog(ctx: ReturnType<typeof setup>) {
  ctx.prisma.productVariant.findMany.mockResolvedValue([
    { id: 11, sku: 'BTH-1', barcode: '8801' },
    { id: 12, sku: 'NOBAR', barcode: null },
  ]);
  ctx.prisma.branch.findMany.mockResolvedValue([{ id: 5, name: ' Main ' }]);
  ctx.prisma.vendor.findMany.mockResolvedValue([{ id: 7, name: 'Acme ' }]);
  return ctx;
}

const COLUMNS = {
  sheetName: 'Stock Intake',
  columns: [
    {
      header: 'SKU',
      required: false,
      hint: 'SKU of the variant receiving stock. Fill in either SKU or Barcode — SKU wins if both are given.',
      example: 'BTH-100-BLK',
    },
    {
      header: 'Barcode',
      required: false,
      hint: 'Barcode of the variant, used when SKU is empty.',
      example: '8801234567890',
    },
    {
      header: 'Branch',
      required: true,
      hint: 'Branch name receiving the stock. It must already exist.',
      example: 'Main',
    },
    {
      header: 'Batch Number',
      required: false,
      hint: 'Optional. Left empty, one is generated per row. A batch number that already exists for the variant is rejected.',
      example: 'B-2026-0001',
    },
    {
      header: 'Quantity',
      required: true,
      hint: 'Whole number, at least 1.',
      example: 40,
    },
    {
      header: 'Cost Price',
      required: true,
      hint: 'Purchase cost per unit.',
      example: 1800,
    },
    {
      header: 'Location',
      required: false,
      hint: 'Where this stock is stored, e.g. A-3-2. Shown in product search.',
      example: 'A-3-2',
    },
    {
      header: 'Expiry Date',
      required: false,
      hint: 'Optional, format 2026-12-31. Leave empty if it does not expire.',
      example: '2027-06-30',
    },
    {
      header: 'Vendor',
      required: false,
      hint: 'Vendor name. It must already exist under Vendors.',
      example: 'Acme Supplies',
    },
  ],
};

const base = (n: number, extra: Record<string, string> = {}) =>
  row(n, {
    sku: 'bth-1',
    branch: 'main',
    quantity: '3',
    'cost price': '10',
    ...extra,
  });

describe('InventoryImportService (unit)', () => {
  afterEach(() => jest.useRealTimers());

  it('[BE-MUT-330] the sheet layout is pinned: names, required flags, hints and examples', () => {
    const { service } = setup();
    expect({ sheetName: service.sheetName, columns: service.columns }).toEqual(
      COLUMNS,
    );
  });

  it('[BE-MUT-331] lookups are tenant scoped; variants are only fetched when a SKU or barcode is present', async () => {
    const empty = setup();
    await empty.service.prepare(4, [row(2, { branch: 'x' })]);
    expect(empty.prisma.productVariant.findMany).not.toHaveBeenCalled();
    const ctx = withCatalog(setup());
    await ctx.service.prepare(4, [base(2), row(3, { barcode: '8801' })]);
    expect(ctx.prisma.productVariant.findMany).toHaveBeenCalledWith({
      where: {
        product: { consumer_id: 4 },
        OR: [{ sku: { in: ['bth-1'] } }, { barcode: { in: ['8801'] } }],
      },
      select: { id: true, sku: true, barcode: true },
    });
    expect(ctx.prisma.branch.findMany).toHaveBeenCalledWith({
      where: { consumer_id: 4 },
      select: { id: true, name: true },
    });
    expect(ctx.prisma.vendor.findMany).toHaveBeenCalledWith({
      where: { consumer_id: 4 },
      select: { id: true, name: true },
    });
    expect(ctx.prisma.inventoryBatch.findMany).toHaveBeenCalledWith({
      where: { variant: { product: { consumer_id: 4 } } },
      select: { variant_id: true, batch_number: true },
    });
    const barcodeOnly = setup();
    await barcodeOnly.service.prepare(4, [row(2, { barcode: '8801' })]);
    expect(
      barcodeOnly.prisma.productVariant.findMany.mock.calls[0][0].where.OR,
    ).toEqual([{ sku: { in: [] } }, { barcode: { in: ['8801'] } }]);
  });

  it('[BE-MUT-332] a full row resolves variant, branch and vendor case-insensitively and keeps every value', async () => {
    const ctx = withCatalog(setup());
    const result = await ctx.service.prepare(4, [
      base(2, {
        'batch number': 'B-1',
        location: 'A-3',
        'expiry date': '2027-06-30',
        vendor: 'ACME',
        'cost price': '1,250.5',
      }),
    ]);
    expect(result.errors).toEqual([]);
    expect(result.prepared).toEqual([
      {
        rowNumber: 2,
        variant_id: 11,
        branch_id: 5,
        batch_number: 'B-1',
        quantity: 3,
        cost_price: 1250.5,
        location: 'A-3',
        expiry_date: new Date('2027-06-30'),
        vendor_id: 7,
      },
    ]);
  });

  it('[BE-MUT-333] SKU wins over barcode; a barcode alone identifies the variant case-insensitively', async () => {
    const ctx = withCatalog(setup());
    ctx.prisma.productVariant.findMany.mockResolvedValue([
      { id: 11, sku: 'BTH-1', barcode: 'AbC9' },
      { id: 12, sku: 'OTHER', barcode: 'zzz' },
    ]);
    const result = await ctx.service.prepare(4, [
      base(2, { barcode: 'zzz', 'batch number': 'A' }),
      row(3, {
        barcode: 'ABC9',
        branch: 'main',
        quantity: '1',
        'cost price': '0',
        'batch number': 'B',
      }),
    ]);
    expect(result.errors).toEqual([]);
    expect(result.prepared.map((p) => p.variant_id)).toEqual([11, 11]);
  });

  it('[BE-MUT-334] a row with neither SKU nor barcode, or an unknown one, is reported on the right column', async () => {
    const ctx = withCatalog(setup());
    const result = await ctx.service.prepare(4, [
      row(2, { branch: 'main', quantity: '1', 'cost price': '1' }),
      base(3, { sku: 'ghost' }),
      row(4, {
        barcode: 'nope',
        branch: 'main',
        quantity: '1',
        'cost price': '1',
      }),
    ]);
    expect(result.prepared).toEqual([]);
    expect(result.errors).toEqual([
      {
        row: 2,
        column: 'SKU',
        message: 'Fill in either SKU or Barcode to identify the product',
      },
      {
        row: 3,
        column: 'SKU',
        message: 'No product variant found with SKU "ghost"',
      },
      {
        row: 4,
        column: 'Barcode',
        message: 'No product variant found with barcode "nope"',
      },
    ]);
  });

  it('[BE-MUT-335] unknown branch and vendor are reported; quantity must be a whole number of at least 1 and cost at least 0', async () => {
    const ctx = withCatalog(setup());
    const result = await ctx.service.prepare(4, [
      base(2, { branch: 'Elsewhere', vendor: 'Nobody' }),
      base(3, { quantity: '0' }),
      base(4, { quantity: '1.5' }),
      base(5, { 'cost price': '-1' }),
      row(6, { sku: 'bth-1' }),
    ]);
    expect(result.prepared).toEqual([]);
    expect(result.errors).toEqual([
      {
        row: 2,
        column: 'Branch',
        message: 'Branch "Elsewhere" does not exist',
      },
      {
        row: 2,
        column: 'Vendor',
        message:
          'Vendor "Nobody" does not exist. Create it first, or leave the cell empty.',
      },
      { row: 3, column: 'Quantity', message: 'Quantity must be at least 1' },
      {
        row: 4,
        column: 'Quantity',
        message: 'Quantity must be a whole number (got "1.5")',
      },
      {
        row: 5,
        column: 'Cost Price',
        message: 'Cost Price must be at least 0',
      },
      { row: 6, column: 'Branch', message: 'Branch is required' },
      { row: 6, column: 'Quantity', message: 'Quantity is required' },
      { row: 6, column: 'Cost Price', message: 'Cost Price is required' },
    ]);
    const zero = await ctx.service.prepare(4, [base(2, { 'cost price': '0' })]);
    expect(zero.errors).toEqual([]);
  });

  it('[BE-MUT-336] text columns are capped: SKU/barcode/location/batch at 100, branch/vendor at 191', async () => {
    const ctx = withCatalog(setup());
    const ok = await ctx.service.prepare(4, [
      base(2, { location: 'l'.repeat(100), 'batch number': 'b'.repeat(100) }),
    ]);
    expect(ok.errors).toEqual([]);
    const tooLong = await ctx.service.prepare(4, [
      row(2, {
        sku: 's'.repeat(101),
        barcode: 'c'.repeat(101),
        branch: 'x'.repeat(192),
        quantity: '1',
        'cost price': '1',
        location: 'l'.repeat(101),
        vendor: 'v'.repeat(192),
        'batch number': 'b'.repeat(101),
      }),
    ]);
    expect(tooLong.errors.map((e) => e.column)).toEqual([
      'SKU',
      'Barcode',
      'Branch',
      'Location',
      'Vendor',
      'Batch Number',
      'SKU', // both identifiers were rejected as too long, so none is left
    ]);
  });

  it('[BE-MUT-337] an empty batch number is generated per row from the clock and row number', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-10T12:00:00Z'));
    const ctx = withCatalog(setup());
    const stamp = Date.now();
    const result = await ctx.service.prepare(4, [base(2), base(3)]);
    expect(result.errors).toEqual([]);
    expect(result.prepared.map((p) => p.batch_number)).toEqual([
      `IMP-${stamp}-2`,
      `IMP-${stamp}-3`,
    ]);
  });

  it('[BE-MUT-338] no batch number is generated for a row whose variant is unknown', async () => {
    const ctx = withCatalog(setup());
    const result = await ctx.service.prepare(4, [base(2, { sku: 'ghost' })]);
    expect(result.prepared).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });

  it('[BE-MUT-339] an existing batch number for the same variant is rejected case-insensitively; the same number on another variant is fine', async () => {
    const ctx = withCatalog(setup());
    ctx.prisma.inventoryBatch.findMany.mockResolvedValue([
      { variant_id: 11, batch_number: 'Batch-A' },
    ]);
    const result = await ctx.service.prepare(4, [
      base(2, { 'batch number': 'BATCH-a' }),
      base(3, { sku: 'nobar', 'batch number': 'BATCH-a' }),
    ]);
    expect(result.errors).toEqual([
      {
        row: 2,
        column: 'Batch Number',
        message: 'Batch "BATCH-a" already exists for this product',
      },
    ]);
    expect(result.prepared.map((p) => p.variant_id)).toEqual([12]);
  });

  it('[BE-MUT-340] the same batch number twice in the file for one variant is reported on the later row', async () => {
    const ctx = withCatalog(setup());
    const result = await ctx.service.prepare(4, [
      base(2, { 'batch number': 'X' }),
      base(6, { 'batch number': 'x' }),
    ]);
    expect(result.prepared).toHaveLength(1);
    expect(result.errors).toEqual([
      {
        row: 6,
        column: 'Batch Number',
        message: 'Batch "x" is used again for the same product on row 2',
      },
    ]);
  });

  describe('write', () => {
    const batch = {
      rowNumber: 2,
      variant_id: 11,
      branch_id: 5,
      batch_number: 'B-1',
      quantity: 3,
      cost_price: 10,
    };

    it('[BE-MUT-341] each batch is created unpaid with optional fields nulled, with a matching PURCHASE_IN audit entry', async () => {
      const tx: any = {
        inventoryBatch: {
          create: jest.fn().mockResolvedValue({ id: 99, quantity: 3 }),
        },
        inventoryAuditLog: { create: jest.fn() },
      };
      const { service } = setup();
      await expect(service.write(4, 8, [batch], tx)).resolves.toEqual({
        batches: 1,
      });
      expect(tx.inventoryBatch.create).toHaveBeenCalledWith({
        data: {
          variant_id: 11,
          branch_id: 5,
          batch_number: 'B-1',
          quantity: 3,
          cost_price: 10,
          location: null,
          expiry_date: null,
          vendor_id: undefined,
          payment_status: 'due',
          paid_amount: 0,
        },
      });
      expect(tx.inventoryAuditLog.create).toHaveBeenCalledWith({
        data: {
          consumer_id: 4,
          variant_id: 11,
          batch_id: 99,
          inventoryBatchId: 99,
          branch_id: 5,
          event_type: 'PURCHASE_IN',
          quantity_delta: 3,
          quantity_after: 3,
          reference_id: 99,
          reference_type: 'inventory_batches',
          notes: 'Excel import - batch B-1 - Qty: 3',
          created_by_user_id: 8,
        },
      });
    });

    it('[BE-MUT-342] location, expiry and vendor are stored when given, and every batch gets its own audit row', async () => {
      const tx: any = {
        inventoryBatch: {
          create: jest
            .fn()
            .mockResolvedValueOnce({ id: 1, quantity: 3 })
            .mockResolvedValueOnce({ id: 2, quantity: 3 }),
        },
        inventoryAuditLog: { create: jest.fn() },
      };
      const { service } = setup();
      const expiry = new Date('2027-01-01');
      await expect(
        service.write(
          4,
          undefined,
          [
            { ...batch, location: 'A-3', expiry_date: expiry, vendor_id: 7 },
            { ...batch, batch_number: 'B-2' },
          ],
          tx,
        ),
      ).resolves.toEqual({ batches: 2 });
      expect(tx.inventoryBatch.create.mock.calls[0][0].data).toMatchObject({
        location: 'A-3',
        expiry_date: expiry,
        vendor_id: 7,
      });
      expect(tx.inventoryAuditLog.create).toHaveBeenCalledTimes(2);
      expect(tx.inventoryAuditLog.create.mock.calls[1][0].data).toMatchObject({
        batch_id: 2,
        created_by_user_id: undefined,
      });
    });
  });
});
