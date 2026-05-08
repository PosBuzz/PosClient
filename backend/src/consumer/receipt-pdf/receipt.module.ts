import { forwardRef, Module } from '@nestjs/common';
import { ReceiptPdfSettingController } from './controllers/receipt-pdf-setting.controller';
import { TestReceiptVariationsController } from './controllers/test-receipt-variations.controller';
import { ReceiptPdfSettingService } from './services/receipt-pdf-setting.service';
import { ReceiptPdfService } from './services/receipt-pdf.service';
import { SalesPdfService } from './services/sales-pdf.service';
import { SalesModule } from '../sales/sales.module';

@Module({
  imports: [forwardRef(() => SalesModule)],
  controllers: [ TestReceiptVariationsController, ReceiptPdfSettingController],
  providers: [SalesPdfService, ReceiptPdfService, ReceiptPdfSettingService],
  exports: [SalesPdfService, ReceiptPdfSettingService],
})
export class ReceiptModule {}
