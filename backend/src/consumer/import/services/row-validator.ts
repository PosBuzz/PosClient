import { ImportRowError, ParsedRow } from '../import.types';

/**
 * Field-level checks for one spreadsheet row. Collects every problem in the row
 * instead of throwing on the first, so a user fixing their file sees all of it
 * at once rather than one error per re-upload.
 */
export class RowValidator {
  private readonly errors: ImportRowError[] = [];

  constructor(private readonly row: ParsedRow) {}

  get rowNumber(): number {
    return this.row.rowNumber;
  }

  get problems(): ImportRowError[] {
    return this.errors;
  }

  get ok(): boolean {
    return this.errors.length === 0;
  }

  add(column: string | null, message: string): void {
    this.errors.push({ row: this.row.rowNumber, column, message });
  }

  /** Raw trimmed text of a column, '' when absent */
  raw(column: string): string {
    return this.row.values[column.toLowerCase()] ?? '';
  }

  text(
    column: string,
    opts: { required?: boolean; max?: number } = {},
  ): string | undefined {
    const value = this.raw(column);

    if (!value) {
      if (opts.required) this.add(column, `${column} is required`);
      return undefined;
    }

    if (opts.max && value.length > opts.max) {
      this.add(column, `${column} must be ${opts.max} characters or fewer`);
      return undefined;
    }

    return value;
  }

  number(
    column: string,
    opts: {
      required?: boolean;
      min?: number;
      max?: number;
      integer?: boolean;
    } = {},
  ): number | undefined {
    const value = this.raw(column);

    if (!value) {
      if (opts.required) this.add(column, `${column} is required`);
      return undefined;
    }

    // Tolerate values pasted with thousand separators or a currency symbol
    const cleaned = value.replace(/[,\s৳$]/g, '');
    const parsed = Number(cleaned);

    if (!Number.isFinite(parsed)) {
      this.add(column, `${column} must be a number (got "${value}")`);
      return undefined;
    }

    if (opts.integer && !Number.isInteger(parsed)) {
      this.add(column, `${column} must be a whole number (got "${value}")`);
      return undefined;
    }

    if (opts.min !== undefined && parsed < opts.min) {
      this.add(column, `${column} must be at least ${opts.min}`);
      return undefined;
    }

    if (opts.max !== undefined && parsed > opts.max) {
      this.add(column, `${column} must be at most ${opts.max}`);
      return undefined;
    }

    return parsed;
  }

  date(column: string, opts: { required?: boolean } = {}): Date | undefined {
    const value = this.raw(column);

    if (!value) {
      if (opts.required) this.add(column, `${column} is required`);
      return undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      this.add(
        column,
        `${column} must be a date like 2026-12-31 (got "${value}")`,
      );
      return undefined;
    }

    return parsed;
  }

  /** Matches one of `allowed` case-insensitively, returning the canonical form */
  choice<T extends string>(
    column: string,
    allowed: readonly T[],
    opts: { required?: boolean; fallback?: T } = {},
  ): T | undefined {
    const value = this.raw(column);

    if (!value) {
      if (opts.required) this.add(column, `${column} is required`);
      return opts.fallback;
    }

    const match = allowed.find(
      (option) => option.toLowerCase() === value.toLowerCase(),
    );

    if (!match) {
      this.add(
        column,
        `${column} must be one of: ${allowed.join(', ')} (got "${value}")`,
      );
      return undefined;
    }

    return match;
  }

  email(column: string): string | undefined {
    const value = this.raw(column);
    if (!value) return undefined;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      this.add(column, `${column} is not a valid email (got "${value}")`);
      return undefined;
    }

    return value;
  }
}
