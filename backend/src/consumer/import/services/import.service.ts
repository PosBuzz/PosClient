import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ImportColumn,
  ImportEntity,
  ImportResult,
  ImportRowError,
} from '../import.types';
import { CustomerImportService } from './customer-import.service';
import { InventoryImportService } from './inventory-import.service';
import { ProductImportService } from './product-import.service';
import { SpreadsheetService } from './spreadsheet.service';

export const IMPORT_ENTITIES: ImportEntity[] = [
  'products',
  'inventory',
  'customers',
];

@Injectable()
export class ImportService {
  // private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly spreadsheet: SpreadsheetService,
    private readonly products: ProductImportService,
    private readonly inventory: InventoryImportService,
    private readonly customers: CustomerImportService,
  ) {}

  assertKnownEntity(entity: string): asserts entity is ImportEntity {
    if (!IMPORT_ENTITIES.includes(entity as ImportEntity)) {
      throw new BadRequestException(
        `Unknown import type "${entity}". Supported: ${IMPORT_ENTITIES.join(', ')}.`,
      );
    }
  }

  columnsFor(entity: ImportEntity): ImportColumn[] {
    return this.importerFor(entity).columns;
  }

  async buildTemplate(entity: ImportEntity): Promise<Buffer> {
    const importer = this.importerFor(entity);
    return this.spreadsheet.buildTemplate(importer.sheetName, importer.columns);
  }

  /**
   * Validates the upload and, unless `dryRun`, writes it in a single
   * transaction. Any invalid row aborts the whole file — see import.types.ts
   * for why partial imports are not offered.
   */
  async run(
    entity: ImportEntity,
    consumerId: number,
    userId: number | undefined,
    file: Buffer,
    dryRun: boolean,
  ): Promise<ImportResult> {
    const importer = this.importerFor(entity);
    const { rows, errors: sheetErrors } = await this.spreadsheet.parse(
      file,
      importer.columns,
    );

    if (sheetErrors.length) {
      return this.result(entity, 0, 0, sheetErrors, false, {});
    }

    if (!rows.length) {
      throw new BadRequestException(
        'The sheet has no data rows below the header.',
      );
    }

    switch (entity) {
      case 'customers': {
        const { prepared, errors } = await this.customers.prepare(
          consumerId,
          rows,
        );
        if (errors.length || dryRun) {
          return this.result(
            entity,
            rows.length,
            prepared.length,
            errors,
            false,
            {},
          );
        }
        const created = await this.customers.write(consumerId, prepared);
        return this.result(
          entity,
          rows.length,
          prepared.length,
          [],
          true,
          created,
        );
      }

      case 'products': {
        const { prepared, errors } = await this.products.prepare(
          consumerId,
          rows,
        );

        const limitError = await this.products.checkProductLimit(
          consumerId,
          prepared.length,
        );
        if (limitError) {
          errors.push({ row: 1, column: null, message: limitError });
        }

        const variantCount = prepared.reduce(
          (sum, product) => sum + product.variants.length,
          0,
        );

        if (errors.length || dryRun) {
          return this.result(
            entity,
            rows.length,
            variantCount,
            errors,
            false,
            {},
          );
        }

        const created = await this.prisma.$transaction((tx) =>
          this.products.write(consumerId, prepared, tx),
        );
        return this.result(
          entity,
          rows.length,
          variantCount,
          [],
          true,
          created,
        );
      }

      case 'inventory': {
        const { prepared, errors } = await this.inventory.prepare(
          consumerId,
          rows,
        );
        if (errors.length || dryRun) {
          return this.result(
            entity,
            rows.length,
            prepared.length,
            errors,
            false,
            {},
          );
        }
        const created = await this.prisma.$transaction((tx) =>
          this.inventory.write(consumerId, userId, prepared, tx),
        );
        return this.result(
          entity,
          rows.length,
          prepared.length,
          [],
          true,
          created,
        );
      }
    }
  }

  private importerFor(entity: ImportEntity) {
    switch (entity) {
      case 'products':
        return this.products;
      case 'inventory':
        return this.inventory;
      case 'customers':
        return this.customers;
    }
  }

  private result(
    entity: ImportEntity,
    totalRows: number,
    validRows: number,
    errors: ImportRowError[],
    imported: boolean,
    created: Record<string, number>,
  ): ImportResult {
    return {
      entity,
      totalRows,
      validRows,
      // Keep the payload sane if someone uploads a badly broken 5,000-row file
      errors: errors.slice(0, 200),
      imported,
      created,
    };
  }
}
