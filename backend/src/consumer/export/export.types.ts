export type ExportFormat = 'xlsx' | 'pdf';
export type ExportEntity = 'products' | 'customers' | 'inventory';

export interface ExportColumn {
  header: string;
  /** Relative width; the PDF and the sheet both scale from it */
  width: number;
  align?: 'left' | 'right';
}

export interface ExportTable {
  title: string;
  columns: ExportColumn[];
  rows: (string | number)[][];
}
