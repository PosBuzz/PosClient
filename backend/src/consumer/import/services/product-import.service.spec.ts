import { ProductImportService } from './product-import.service';

const COLUMNS = {
  sheetName: 'Products',
  columns: [
    {
      header: 'Product Name',
      required: true,
      hint: 'Repeat the same product name on several rows to give that product several variants.',
      example: 'Bluetooth Headphones',
    },
    {
      header: 'Product Code',
      required: false,
      hint: 'Optional, must be unique. Only read from the first row of each product.',
      example: 'BTH-100',
    },
    {
      header: 'Category',
      required: false,
      hint: 'Category name. It must already exist — create it first under Categories.',
      example: 'Electronics',
    },
    {
      header: 'Brand',
      required: false,
      hint: 'Brand name. It must already exist — create it first under Brands.',
      example: 'Acme',
    },
    {
      header: 'Unit',
      required: true,
      hint: 'Unit name, e.g. Piece. It must already exist under Units. Used as both sale and purchase unit.',
      example: 'Piece',
    },
    {
      header: 'Tax %',
      required: false,
      hint: 'Whole number, 0-100. Defaults to 0. Read from the first row of each product.',
      example: 5,
    },
    {
      header: 'Tax Method',
      required: false,
      hint: 'One of: INCLUSIVE, EXCLUSIVE. Defaults to EXCLUSIVE.',
      example: 'EXCLUSIVE',
    },
    {
      header: 'Variant Name',
      required: true,
      hint: 'Name of this variant, e.g. Black or 500ml. Use "Default" for products without real variants.',
      example: 'Black',
    },
    {
      header: 'SKU',
      required: false,
      hint: 'Optional, must be unique across all variants.',
      example: 'BTH-100-BLK',
    },
    {
      header: 'Barcode',
      required: false,
      hint: 'Optional, must be unique across all variants.',
      example: '8801234567890',
    },
    {
      header: 'Regular Price',
      required: true,
      hint: 'Selling price of this variant.',
      example: 2500,
    },
    {
      header: 'Wholesale Price',
      required: false,
      hint: 'Optional wholesale price.',
      example: 2200,
    },
    {
      header: 'Alert Quantity',
      required: false,
      hint: 'Optional low-stock threshold, whole number.',
      example: 5,
    },
    {
      header: 'Description',
      required: false,
      hint: 'Optional. Read from the first row of each product.',
      example: 'Over-ear wireless headphones',
    },
  ],
};

const row = (rowNumber: number, values: Record<string, string>) => ({
  rowNumber,
  values,
});

function setup() {
  const prisma: any = {
    category: {
      findMany: jest.fn().mockResolvedValue([{ id: 1, name: ' Electronics ' }]),
    },
    brand: { findMany: jest.fn().mockResolvedValue([{ id: 2, name: 'Acme' }]) },
    unit: { findMany: jest.fn().mockResolvedValue([{ id: 3, name: 'Piece' }]) },
    product: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn() },
    productVariant: { findMany: jest.fn().mockResolvedValue([]) },
    consumer: { findUnique: jest.fn() },
  };
  return { prisma, service: new ProductImportService(prisma) };
}

const base = (n: number, extra: Record<string, string> = {}) =>
  row(n, {
    'product name': 'Headphones',
    'variant name': 'Black',
    unit: 'piece',
    'regular price': '1,500.50',
    ...extra,
  });

describe('ProductImportService.prepare (unit)', () => {
  it('[BE-MUT-650] the sheet layout is pinned: name, required flags, hints and examples', () => {
    const { service } = setup();
    expect({ sheetName: service.sheetName, columns: service.columns }).toEqual(
      COLUMNS,
    );
  });

  it('[BE-MUT-651] lookups are tenant scoped and use the names, codes, skus and barcodes of the file', async () => {
    const { prisma, service } = setup();
    await service.prepare(4, [
      base(2, { 'product code': 'C1', sku: 'S1', barcode: 'B1' }),
      base(3, { 'variant name': 'White' }),
    ]);
    for (const model of ['category', 'brand', 'unit']) {
      expect(prisma[model].findMany).toHaveBeenCalledWith({
        where: { consumer_id: 4 },
        select: { id: true, name: true },
      });
    }
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        consumer_id: 4,
        OR: [
          { name: { in: ['Headphones', 'Headphones'] } },
          { code: { in: ['C1'] } },
        ],
      },
      select: { name: true, code: true },
    });
    expect(prisma.productVariant.findMany).toHaveBeenCalledWith({
      where: {
        product: { consumer_id: 4 },
        OR: [{ sku: { in: ['S1'] } }, { barcode: { in: ['B1'] } }],
      },
      select: { sku: true, barcode: true },
    });
  });

  it('[BE-MUT-652] rows of one product fold into a single product with ordered variants; product columns come from its first row', async () => {
    const { service } = setup();
    const result = await service.prepare(4, [
      base(2, {
        'product code': 'C1',
        description: 'Over-ear',
        category: 'electronics',
        brand: 'ACME',
        'tax %': '15',
        'tax method': 'inclusive',
        sku: 'S1',
        barcode: 'B1',
        'wholesale price': '1200',
        'alert quantity': '5',
      }),
      base(3, {
        'variant name': 'White',
        description: 'Ignored',
        'tax %': '99',
        'regular price': '1600',
      }),
      row(4, {
        'product name': ' headphones ',
        'variant name': 'Red',
        unit: 'Piece',
        'regular price': '1',
      }),
    ]);
    expect(result.errors).toEqual([]);
    expect(result.prepared).toHaveLength(1);
    expect(result.prepared[0]).toEqual({
      name: 'Headphones',
      code: 'C1',
      description: 'Over-ear',
      category_id: 1,
      brand_id: 2,
      tax: 15,
      tax_method: 'INCLUSIVE',
      variants: [
        {
          rowNumber: 2,
          name: 'Black',
          sku: 'S1',
          barcode: 'B1',
          regular_price: 1500.5,
          wholesale_price: 1200,
          sale_unit_id: 3,
          purchase_unit_id: 3,
          alert_quantity: 5,
        },
        expect.objectContaining({
          rowNumber: 3,
          name: 'White',
          regular_price: 1600,
        }),
        expect.objectContaining({
          rowNumber: 4,
          name: 'Red',
          regular_price: 1,
        }),
      ],
    });
  });

  it('[BE-MUT-653] optional columns default: tax 0, EXCLUSIVE, no category/brand/code', async () => {
    const { service } = setup();
    const result = await service.prepare(4, [base(2)]);
    expect(result.prepared[0]).toMatchObject({
      tax: 0,
      tax_method: 'EXCLUSIVE',
      category_id: undefined,
      brand_id: undefined,
      code: undefined,
    });
  });

  it('[BE-MUT-654] required fields, limits and ranges are reported per column', async () => {
    const { service } = setup();
    const result = await service.prepare(4, [
      row(2, {}),
      base(3, { 'variant name': 'V3', 'regular price': '-1' }),
      base(4, {
        'variant name': 'V4',
        'wholesale price': '-1',
        'alert quantity': '1.5',
        'tax %': '101',
      }),
      base(5, { 'variant name': 'V5', 'tax method': 'weird' }),
      base(6, {
        'product name': 'n'.repeat(192),
        'variant name': 'v'.repeat(192),
        unit: 'u'.repeat(192),
        sku: 's'.repeat(101),
        barcode: 'b'.repeat(101),
        'product code': 'c'.repeat(101),
        description: 'd'.repeat(1001),
        category: 'c'.repeat(192),
        brand: 'b'.repeat(192),
      }),
    ]);
    expect(result.prepared).toEqual([]);
    const byRow = (n: number) =>
      result.errors
        .filter((e) => e.row === n)
        .map((e) => [e.column, e.message]);
    expect(byRow(2)).toEqual([
      ['Product Name', 'Product Name is required'],
      ['Variant Name', 'Variant Name is required'],
      ['Unit', 'Unit is required'],
      ['Regular Price', 'Regular Price is required'],
    ]);
    expect(byRow(3)).toEqual([
      ['Regular Price', 'Regular Price must be at least 0'],
    ]);
    expect(byRow(4).map(([c]) => c)).toEqual([
      'Wholesale Price',
      'Alert Quantity',
      'Tax %',
    ]);
    expect(byRow(5).map(([c]) => c)).toEqual(['Tax Method']);
    expect(byRow(6).map(([c]) => c)).toEqual([
      'Product Name',
      'Variant Name',
      'Unit',
      'SKU',
      'Barcode',
      'Product Code',
      'Description',
      'Category',
      'Brand',
    ]);
    const ok = await service.prepare(4, [
      base(2, {
        'product name': 'n'.repeat(191),
        'variant name': 'v'.repeat(191),
        sku: 's'.repeat(100),
        barcode: 'b'.repeat(100),
        'product code': 'c'.repeat(100),
        description: 'd'.repeat(1000),
        'tax %': '100',
        'wholesale price': '0',
        'alert quantity': '0',
        'regular price': '0',
      }),
    ]);
    expect(ok.errors).toEqual([]);
  });

  it('[BE-MUT-655] unknown category, brand and unit are reported with a hint on how to fix them', async () => {
    const { service } = setup();
    const result = await service.prepare(4, [
      base(2, { category: 'Nope', brand: 'Nope', unit: 'Nope' }),
    ]);
    expect(result.errors).toEqual([
      {
        row: 2,
        column: 'Category',
        message:
          'Category "Nope" does not exist. Create it first, or leave the cell empty.',
      },
      {
        row: 2,
        column: 'Brand',
        message:
          'Brand "Nope" does not exist. Create it first, or leave the cell empty.',
      },
      {
        row: 2,
        column: 'Unit',
        message: 'Unit "Nope" does not exist. Create it first under Units.',
      },
    ]);
  });

  it('[BE-MUT-656] names, codes, skus and barcodes already in the shop are rejected case-insensitively', async () => {
    const { prisma, service } = setup();
    prisma.product.findMany.mockResolvedValue([
      { name: ' headphones ', code: ' C1 ' },
      { name: 'Other', code: null },
    ]);
    prisma.productVariant.findMany.mockResolvedValue([
      { sku: ' s1 ', barcode: null },
      { sku: null, barcode: ' B1 ' },
    ]);
    const result = await service.prepare(4, [
      base(2, {
        'product name': 'HEADPHONES',
        'product code': 'c1',
        sku: 'S1',
        barcode: 'b1',
      }),
    ]);
    expect(result.prepared).toEqual([]);
    expect(result.errors).toEqual([
      {
        row: 2,
        column: 'Product Name',
        message: 'A product named "HEADPHONES" already exists',
      },
      {
        row: 2,
        column: 'Product Code',
        message: 'Product code "c1" is already used by another product',
      },
      { row: 2, column: 'SKU', message: 'SKU "S1" is already used' },
      { row: 2, column: 'Barcode', message: 'Barcode "b1" is already used' },
    ]);
  });

  it("[BE-MUT-657] the name check applies to a product's first row only, so later variant rows of a new product are fine", async () => {
    const { service } = setup();
    const result = await service.prepare(4, [
      base(2),
      base(3, { 'variant name': 'White' }),
    ]);
    expect(result.errors).toEqual([]);
    expect(result.prepared[0].variants).toHaveLength(2);
  });

  it('[BE-MUT-658] duplicate skus, barcodes and variant names inside the file point at the first row', async () => {
    const { service } = setup();
    const result = await service.prepare(4, [
      base(2, { sku: 'S1', barcode: 'B1' }),
      base(5, { 'variant name': 'White', sku: 's1', barcode: 'b1' }),
      base(9, { 'variant name': 'black' }),
    ]);
    expect(result.prepared[0].variants).toHaveLength(1);
    expect(result.errors).toEqual([
      {
        row: 5,
        column: 'SKU',
        message: 'SKU "s1" is used again on row 2 of this file',
      },
      {
        row: 5,
        column: 'Barcode',
        message: 'Barcode "b1" is used again on row 2 of this file',
      },
      {
        row: 9,
        column: 'Variant Name',
        message:
          '"Headphones" already has a variant named "black" earlier in this file',
      },
    ]);
  });

  it('[BE-MUT-659] a product code used by two products of the file is rejected for the second product only', async () => {
    const { service } = setup();
    const result = await service.prepare(4, [
      base(2, { 'product code': 'C1' }),
      base(3, { 'product name': 'Speaker', 'product code': 'c1' }),
      base(4, {
        'product name': 'Speaker',
        'product code': 'c1',
        'variant name': 'Blue',
      }),
    ]);
    expect(result.prepared.map((p) => p.name)).toEqual(['Headphones']);
    expect(result.errors.map((e) => [e.row, e.message])).toEqual([
      [3, 'Product code "c1" is already used by another product'],
      [4, 'Product code "c1" is already used by another product'],
    ]);
  });
});

describe('ProductImportService limit and write (unit)', () => {
  it('[BE-MUT-660] the plan cap is checked with the used count and explains the overflow; unlimited plans always pass', async () => {
    const { prisma, service } = setup();
    prisma.consumer.findUnique.mockResolvedValue({
      plan: { name: 'Pro', max_products: 10 },
    });
    prisma.product.count.mockResolvedValue(8);
    await expect(service.checkProductLimit(4, 2)).resolves.toBeNull();
    await expect(service.checkProductLimit(4, 3)).resolves.toBe(
      'This file adds 3 product(s), which would exceed your Pro plan limit of 10 (you already have 8). Upgrade your plan or import fewer products.',
    );
    expect(prisma.consumer.findUnique).toHaveBeenCalledWith({
      where: { id: 4 },
      select: { plan: { select: { name: true, max_products: true } } },
    });
    expect(prisma.product.count).toHaveBeenCalledWith({
      where: { consumer_id: 4 },
    });
    prisma.consumer.findUnique.mockResolvedValue({
      plan: { name: null, max_products: 1 },
    });
    await expect(service.checkProductLimit(4, 5)).resolves.toContain(
      'your current plan limit of 1',
    );
    prisma.product.count.mockClear();
    prisma.consumer.findUnique.mockResolvedValue({
      plan: { name: 'Free', max_products: null },
    });
    await expect(service.checkProductLimit(4, 500)).resolves.toBeNull();
    expect(prisma.product.count).not.toHaveBeenCalled();
    prisma.consumer.findUnique.mockResolvedValue(null);
    await expect(service.checkProductLimit(4, 500)).resolves.toBeNull();
  });

  it('[BE-MUT-661] write creates each product with its variants, marking the first variant default and multi-variant products as such', async () => {
    const tx: any = {
      product: {
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: 10 })
          .mockResolvedValueOnce({ id: 11 }),
      },
      productVariant: { create: jest.fn() },
    };
    const { service } = setup();
    const variant = (name: string, extra: object = {}) => ({
      rowNumber: 2,
      name,
      regular_price: 5,
      sale_unit_id: 3,
      purchase_unit_id: 3,
      ...extra,
    });
    await expect(
      service.write(
        4,
        [
          {
            name: 'A',
            code: 'C',
            description: 'd',
            category_id: 1,
            brand_id: 2,
            tax: 7,
            tax_method: 'INCLUSIVE',
            variants: [
              variant('V1', {
                sku: 'S',
                barcode: 'B',
                wholesale_price: 4,
                alert_quantity: 2,
              }),
              variant('V2'),
            ],
          },
          {
            name: 'B',
            tax: 0,
            tax_method: 'EXCLUSIVE',
            variants: [variant('Only')],
          },
        ] as any,
        tx,
      ),
    ).resolves.toEqual({ products: 2, variants: 3 });
    expect(tx.product.create).toHaveBeenNthCalledWith(1, {
      data: {
        consumer_id: 4,
        name: 'A',
        code: 'C',
        description: 'd',
        category_id: 1,
        brand_id: 2,
        tax: 7,
        tax_method: 'INCLUSIVE',
        has_variants: true,
      },
    });
    expect(tx.product.create.mock.calls[1][0].data.has_variants).toBe(false);
    expect(tx.productVariant.create.mock.calls.map(([a]: any) => a)).toEqual([
      {
        data: {
          product_id: 10,
          name: 'V1',
          sku: 'S',
          barcode: 'B',
          regular_price: 5,
          wholesale_price: 4,
          sale_unit_id: 3,
          purchase_unit_id: 3,
          alert_quantity: 2,
          is_default: true,
        },
      },
      {
        data: expect.objectContaining({
          product_id: 10,
          name: 'V2',
          alert_quantity: 0,
          is_default: false,
        }),
      },
      {
        data: expect.objectContaining({
          product_id: 11,
          name: 'Only',
          is_default: true,
        }),
      },
    ]);
  });
});
