import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { SpreadsheetService } from './spreadsheet.service';

const columns = [
  { header: 'Name', required: true, hint: 'Product name', example: 'Soap' },
  { header: 'Price', required: true, hint: 'Selling price', example: 12.5 },
  { header: 'Note', required: false, hint: 'Anything', example: 'x' },
];

async function workbookWith(rows: Array<Array<string | number | null>>) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Data');
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('SpreadsheetService', () => {
  const service = new SpreadsheetService();

  it('[BE-IMP-001] {SpreadsheetService.buildTemplate} {SpreadsheetService.parse} a template has the headers, a filled example row and a notes sheet, and reads back', async () => {
    const buffer = await service.buildTemplate('Products', columns);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    expect(workbook.worksheets.map((s) => s.name)).toEqual([
      'Products',
      'How to use',
    ]);
    const parsed = await service.parse(buffer, columns);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual([
      { rowNumber: 2, values: { name: 'Soap', price: '12.5', note: 'x' } },
    ]);
  });

  it('[BE-IMP-002] {SpreadsheetService.parse} headers match in any case, blank rows are skipped and row numbers are Excel rows', async () => {
    const buffer = await workbookWith([
      ['NAME', 'price'],
      ['Tea', 3],
      [null, null],
      ['Salt', 1],
    ]);
    const parsed = await service.parse(buffer, columns);
    expect(parsed.errors).toEqual([]);
    expect(
      parsed.rows.map((r) => [r.rowNumber, r.values.name, r.values.price]),
    ).toEqual([
      [2, 'Tea', '3'],
      [4, 'Salt', '1'],
    ]);
  });

  it('[BE-IMP-003] {SpreadsheetService.parse} a missing required column is reported once, not per row', async () => {
    const buffer = await workbookWith([['Name'], ['Tea'], ['Salt']]);
    const parsed = await service.parse(buffer, columns);
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors).toEqual([
      {
        row: 1,
        column: 'Price',
        message:
          'Required column "Price" is missing. Download the template and keep its header row.',
      },
    ]);
  });

  it('[BE-IMP-004] {SpreadsheetService.parse} a file that is not a workbook, or has no headers, is a readable 400', async () => {
    const notExcel = await service
      .parse(Buffer.from('definitely not a spreadsheet'), columns)
      .catch((e) => e);
    expect(notExcel).toBeInstanceOf(BadRequestException);
    expect(notExcel.message).toMatch(/^The file could not be read/);
    const empty = await service
      .parse(await workbookWith([[null, null]]), columns)
      .catch((e) => e);
    expect(empty).toBeInstanceOf(BadRequestException);
    expect(empty.message).toBe(
      'The first row must contain the column headers from the template.',
    );
  });
});
