import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ImportController } from './import.controller';
import { CustomerImportService } from './services/customer-import.service';
import { ImportService } from './services/import.service';
import { InventoryImportService } from './services/inventory-import.service';
import { ProductImportService } from './services/product-import.service';
import { SpreadsheetService } from './services/spreadsheet.service';

@Module({
  imports: [PrismaModule],
  controllers: [ImportController],
  providers: [
    ImportService,
    SpreadsheetService,
    ProductImportService,
    InventoryImportService,
    CustomerImportService,
  ],
})
export class ImportModule {}
