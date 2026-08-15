/**
 * Shared shapes for spreadsheet imports.
 *
 * Every importer follows the same contract: parse the sheet into rows, validate
 * every row, and only write when the whole file is clean. Partial imports are
 * deliberately not supported — a half-imported price list is worse than a
 * rejected one, because there is no way to tell which rows landed.
 */

export type ImportEntity = 'products' | 'inventory' | 'customers';

export interface ImportColumn {
  /** Header text shown in the template and matched (case-insensitively) on upload */
  header: string;
  required: boolean;
  /** Shown in the template's notes row */
  hint: string;
  /** Example value written into the template's sample row */
  example: string | number;
}

export interface ImportRowError {
  /** 1-based row number as it appears in Excel, header row included */
  row: number;
  column: string | null;
  message: string;
}

export interface ImportResult {
  entity: ImportEntity;
  /** Rows found below the header */
  totalRows: number;
  /** Rows that would be / were written */
  validRows: number;
  errors: ImportRowError[];
  /** False for a preview (dry run) */
  imported: boolean;
  /** Per-entity counts, e.g. { products: 3, variants: 7 } */
  created: Record<string, number>;
}

/** A parsed sheet row: header text (lower-cased) -> trimmed cell text */
export interface ParsedRow {
  /** 1-based Excel row number */
  rowNumber: number;
  values: Record<string, string>;
}
