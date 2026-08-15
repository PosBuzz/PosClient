import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ImportColumn, ImportRowError, ParsedRow } from '../import.types';

/**
 * Turns .xlsx/.csv uploads into rows keyed by header, and builds the matching
 * blank template. Knows nothing about products, stock or customers — the
 * per-entity importers own that.
 */
@Injectable()
export class SpreadsheetService {
  /** Header row of the generated templates, and the row data starts on */
  private readonly HEADER_ROW = 1;
  private readonly FIRST_DATA_ROW = 2;

  async parse(
    buffer: Buffer,
    columns: ImportColumn[],
  ): Promise<{ rows: ParsedRow[]; errors: ImportRowError[] }> {
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException(
        'The file could not be read. Upload the .xlsx template, not a PDF, image or password-protected workbook.',
      );
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('The workbook has no sheets.');
    }

    const headerRow = sheet.getRow(this.HEADER_ROW);
    const headerByColumn = new Map<number, string>();

    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = this.cellText(cell).toLowerCase();
      if (header) headerByColumn.set(colNumber, header);
    });

    if (!headerByColumn.size) {
      throw new BadRequestException(
        'The first row must contain the column headers from the template.',
      );
    }

    // A missing required column is a file-level problem: report it once rather
    // than repeating "X is required" against every single row.
    const present = new Set(headerByColumn.values());
    const errors: ImportRowError[] = [];
    for (const column of columns) {
      if (column.required && !present.has(column.header.toLowerCase())) {
        errors.push({
          row: this.HEADER_ROW,
          column: column.header,
          message: `Required column "${column.header}" is missing. Download the template and keep its header row.`,
        });
      }
    }
    if (errors.length) return { rows: [], errors };

    const rows: ParsedRow[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < this.FIRST_DATA_ROW) return;

      const values: Record<string, string> = {};
      let hasValue = false;

      for (const [colNumber, header] of headerByColumn) {
        const text = this.cellText(row.getCell(colNumber));
        values[header] = text;
        if (text) hasValue = true;
      }

      // Skip rows that are entirely blank — Excel loves to keep those around
      if (hasValue) rows.push({ rowNumber, values });
    });

    return { rows, errors };
  }

  /** A workbook containing the header row, a filled example row and a notes sheet */
  async buildTemplate(
    sheetName: string,
    columns: ImportColumn[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = columns.map((column) => ({
      header: column.header,
      key: column.header,
      width: Math.max(16, Math.min(column.header.length + 8, 40)),
    }));

    const header = sheet.getRow(this.HEADER_ROW);
    header.font = { bold: true };
    header.eachCell((cell, colNumber) => {
      const column = columns[colNumber - 1];
      if (!column) return;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: column.required ? 'FFFFE7BA' : 'FFF0F0F0' },
      };
      cell.note = `${column.required ? 'Required' : 'Optional'} — ${column.hint}`;
    });

    sheet.addRow(
      columns.reduce<Record<string, string | number>>((acc, column) => {
        acc[column.header] = column.example;
        return acc;
      }, {}),
    );

    const notes = workbook.addWorksheet('How to use');
    notes.columns = [
      { header: 'Column', key: 'column', width: 26 },
      { header: 'Required', key: 'required', width: 12 },
      { header: 'What to enter', key: 'hint', width: 70 },
    ];
    notes.getRow(1).font = { bold: true };
    for (const column of columns) {
      notes.addRow({
        column: column.header,
        required: column.required ? 'Yes' : 'No',
        hint: column.hint,
      });
    }
    notes.addRow({});
    notes.addRow({
      column: 'Example row',
      required: '',
      hint: 'Row 2 of the first sheet is a filled-in example. Delete it before uploading, or overwrite it with your own data.',
    });
    notes.addRow({
      column: 'Validation',
      required: '',
      hint: 'Nothing is imported unless every row passes validation. Errors are reported per row so you can fix and re-upload.',
    });

    const out = await workbook.xlsx.writeBuffer();
    return Buffer.from(out);
  }

  /** Cell text, flattening the shapes ExcelJS returns for formulas/rich text/links */
  private cellText(cell: ExcelJS.Cell): string {
    const value = cell?.value;
    if (value === null || value === undefined) return '';

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    if (typeof value === 'object') {
      const candidate = value as Record<string, any>;
      if (typeof candidate.text === 'string') return candidate.text.trim();
      if (Array.isArray(candidate.richText)) {
        return candidate.richText
          .map((part: any) => part.text ?? '')
          .join('')
          .trim();
      }
      if (candidate.result !== undefined && candidate.result !== null) {
        return String(candidate.result).trim();
      }
      if (candidate.hyperlink) return String(candidate.hyperlink).trim();
      return '';
    }

    return String(value).trim();
  }
}
