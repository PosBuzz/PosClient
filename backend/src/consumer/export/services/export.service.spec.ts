import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { EXPORT_ROW_LIMIT, ExportService } from './export.service';

const prisma: any = {
  customer: {
    findMany: jest.fn().mockResolvedValue([
      {
        name: 'Karim',
        phone: '017',
        email: null,
        address: 'Dhaka',
        customer_type: 'regular',
        birthday: new Date('1990-05-01T00:00:00Z'),
      },
    ]),
  },
  productVariant: {
    findMany: jest.fn().mockResolvedValue([
      {
        name: 'Red',
        sku: 'S-1',
        barcode: null,
        regular_price: '75.5',
        wholesale_price: null,
        product: { name: 'Shirt', category: { name: 'Tops' }, brand: null },
      },
    ]),
  },
  inventoryBatch: {
    findMany: jest.fn().mockResolvedValue([
      {
        batch_number: 'B1',
        quantity: 4,
        cost_price: '30',
        expiry_date: null,
        branch: { name: 'Main' },
        variant: { name: 'Red', sku: 'S-1', product: { name: 'Shirt' } },
      },
    ]),
  },
};

describe('ExportService', () => {
  const service = new ExportService(prisma);

  it('[BE-EXPORT-001] {ExportService.parseFormat} defaults to xlsx and rejects anything but xlsx or pdf', () => {
    expect(service.parseFormat()).toBe('xlsx');
    expect(service.parseFormat('PDF')).toBe('pdf');
    expect(() => service.parseFormat('csv')).toThrow(BadRequestException);
  });

  it('[BE-EXPORT-002] {ExportService.export} scopes every list to the signed-in business', async () => {
    await service.export('customers', 9, 'xlsx');
    await service.export('products', 9, 'xlsx');
    await service.export('inventory', 9, 'xlsx');
    expect(prisma.customer.findMany.mock.calls[0][0].where).toEqual({
      consumer_id: 9,
    });
    expect(prisma.productVariant.findMany.mock.calls[0][0].where).toEqual({
      product: { consumer_id: 9 },
    });
    expect(prisma.inventoryBatch.findMany.mock.calls[0][0].where).toEqual({
      branch: { consumer_id: 9 },
      quantity: { gt: 0 },
    });
  });

  it('[BE-EXPORT-003] {ExportService.export} builds a spreadsheet with a header row and one row per record', async () => {
    const file = await service.export('products', 1, 'xlsx');
    expect(file.filename).toMatch(/^products-\d{4}-\d{2}-\d{2}\.xlsx$/);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.getRow(1).values).toEqual([
      undefined,
      'Product',
      'Variant',
      'SKU',
      'Barcode',
      'Category',
      'Brand',
      'Price',
      'Wholesale',
    ]);
    expect(sheet.getRow(2).getCell(1).value).toBe('Shirt');
    expect(sheet.getRow(2).getCell(7).value).toBe(75.5);
    expect(sheet.rowCount).toBe(2);
  });

  it('[BE-EXPORT-004] {ExportService.export} builds a real PDF for each list', async () => {
    for (const entity of ['customers', 'products', 'inventory'] as const) {
      const file = await service.export(entity, 1, 'pdf');
      expect(file.contentType).toBe('application/pdf');
      expect(file.buffer.subarray(0, 4).toString()).toBe('%PDF');
    }
  });

  it('[BE-EXPORT-005] {ExportService.toPdf} paginates a long list instead of cutting it off', async () => {
    const rows = Array.from({ length: 120 }, (_, i) => [`Row ${i}`, i]);
    const pdf = await service.toPdf({
      title: 'Long',
      columns: [
        { header: 'Name', width: 3 },
        { header: 'No', width: 1, align: 'right' },
      ],
      rows,
    });
    const pages = pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThan(1);
  });
  const load = async (entity: 'customers' | 'products' | 'inventory') => {
    const file = await service.export(entity, 1, 'xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    return { file, sheet: workbook.worksheets[0] };
  };
  const pageCount = async (rows: number) => {
    const pdf = await service.toPdf({
      title: 'Pages',
      columns: [{ header: 'Name', width: 1 }],
      rows: Array.from({ length: rows }, (_, i) => [`Row ${i}`]),
    });
    return (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
  };

  it('[BE-EXPORT-006] {ExportService.parseFormat} accepts either case and names the bad format in its message', () => {
    expect(service.parseFormat('XLSX')).toBe('xlsx');
    expect(service.parseFormat('pdf')).toBe('pdf');
    expect(() => service.parseFormat('csv')).toThrow(
      'Unsupported export format "csv". Use xlsx or pdf.',
    );
    expect(() => service.parseFormat('')).toThrow(BadRequestException);
  });

  it('[BE-EXPORT-007] {ExportService.export} names the file after the entity and today and sets the content type', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const sheet = await service.export('customers', 1, 'xlsx');
    expect(sheet.filename).toBe(`customers-${today}.xlsx`);
    expect(sheet.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const pdf = await service.export('inventory', 1, 'pdf');
    expect(pdf.filename).toBe(`inventory-${today}.pdf`);
    expect(pdf.contentType).toBe('application/pdf');
  });

  it('[BE-EXPORT-008] {ExportService.export} writes every customer column, blanks missing values and formats the birthday as a date', async () => {
    const { sheet } = await load('customers');
    expect(sheet.name).toBe('Customers');
    expect(sheet.getRow(1).values).toEqual([
      undefined,
      'Name',
      'Phone',
      'Email',
      'Address',
      'Type',
      'Birthday',
    ]);
    expect(sheet.getRow(2).values).toEqual([
      undefined,
      'Karim',
      '017',
      '',
      'Dhaka',
      'regular',
      '1990-05-01',
    ]);
    expect(sheet.getRow(1).font?.bold).toBe(true);
    expect(sheet.getRow(2).font?.bold).toBeFalsy();
    expect([1, 2, 3, 4, 5, 6].map((i) => sheet.getColumn(i).width)).toEqual([
      24, 18, 24, 30, 12, 15,
    ]);
  });

  it('[BE-EXPORT-009] {ExportService.export} writes every product cell and keeps a zero wholesale price distinct from none', async () => {
    const { sheet } = await load('products');
    expect(sheet.name).toBe('Products');
    expect(sheet.getRow(2).values).toEqual([
      undefined,
      'Shirt',
      'Red',
      'S-1',
      '',
      'Tops',
      '',
      75.5,
      '',
    ]);
    prisma.productVariant.findMany.mockResolvedValueOnce([
      {
        name: 'Blue',
        sku: null,
        barcode: '123',
        regular_price: '10',
        wholesale_price: '0',
        product: { name: 'Hat', category: null, brand: { name: 'Acme' } },
      },
    ]);
    const second = (await load('products')).sheet.getRow(2);
    expect(second.values).toEqual([
      undefined,
      'Hat',
      'Blue',
      '',
      '123',
      '',
      'Acme',
      10,
      0,
    ]);
    expect(sheet.getColumn(1).width).toBe(30);
    expect(sheet.getColumn(7).width).toBe(12);
  });

  it('[BE-EXPORT-010] {ExportService.export} writes every inventory cell including cost and expiry', async () => {
    prisma.inventoryBatch.findMany.mockResolvedValueOnce([
      {
        batch_number: 'B9',
        quantity: 7,
        cost_price: '12.5',
        expiry_date: new Date('2027-02-03T00:00:00Z'),
        branch: { name: 'North' },
        variant: { name: 'Blue', sku: null, product: { name: 'Hat' } },
      },
    ]);
    const { sheet } = await load('inventory');
    expect(sheet.name).toBe('Inventory');
    expect(sheet.getRow(1).values).toEqual([
      undefined,
      'Branch',
      'Product',
      'Variant',
      'SKU',
      'Batch',
      'Qty',
      'Cost',
      'Expiry',
    ]);
    expect(sheet.getRow(2).values).toEqual([
      undefined,
      'North',
      'Hat',
      'Blue',
      '',
      'B9',
      7,
      12.5,
      '2027-02-03',
    ]);
  });

  it('[BE-EXPORT-011] {ExportService.export} caps and orders every query and loads the related names', async () => {
    jest.clearAllMocks();
    await service.export('customers', 3, 'xlsx');
    await service.export('products', 3, 'xlsx');
    await service.export('inventory', 3, 'xlsx');
    expect(EXPORT_ROW_LIMIT).toBe(20000);
    expect(prisma.customer.findMany.mock.calls[0][0]).toEqual({
      where: { consumer_id: 3 },
      orderBy: { name: 'asc' },
      take: EXPORT_ROW_LIMIT,
    });
    expect(prisma.productVariant.findMany.mock.calls[0][0]).toEqual({
      where: { product: { consumer_id: 3 } },
      include: { product: { include: { category: true, brand: true } } },
      orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
      take: EXPORT_ROW_LIMIT,
    });
    expect(prisma.inventoryBatch.findMany.mock.calls[0][0]).toEqual({
      where: { branch: { consumer_id: 3 }, quantity: { gt: 0 } },
      include: {
        branch: { select: { name: true } },
        variant: { include: { product: { select: { name: true } } } },
      },
      orderBy: [{ branch_id: 'asc' }, { variant_id: 'asc' }, { id: 'asc' }],
      take: EXPORT_ROW_LIMIT,
    });
  });

  it('[BE-EXPORT-012] {ExportService.toPdf} makes an A4 landscape page and breaks to a new page exactly when the page is full', async () => {
    const pdf = (await service.export('customers', 1, 'pdf')).buffer.toString(
      'latin1',
    );
    expect(pdf).toContain('/MediaBox [0 0 841.89 595.28]');
    // 40 rows fit under the header on the first page, 43 on each page after it
    expect(await pageCount(40)).toBe(1);
    expect(await pageCount(41)).toBe(2);
    expect(await pageCount(83)).toBe(2);
    expect(await pageCount(84)).toBe(3);
  });
});
