import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ExportService } from './export.service';

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
});
