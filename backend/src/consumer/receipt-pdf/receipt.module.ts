import { forwardRef, Module } from '@nestjs/common';
import { ReceiptPdfSettingController } from './controllers/receipt-pdf-setting.controller';
import { TestReceiptVariationsController } from './controllers/test-receipt-variations.controller';
import { ReceiptPdfSettingService } from './services/receipt-pdf-setting.service';
import { ReceiptPdfService } from './services/receipt-pdf.service';
import { SalesPdfService } from './services/sales-pdf.service';
import { SalesModule } from '../sales/sales.module';
import { ReturnPdfService } from './services/return-pdf.service';
import { QuotationPdfService } from './services/quotation-pdf.service';

@Module({
  imports: [forwardRef(() => SalesModule)],
  controllers: [TestReceiptVariationsController, ReceiptPdfSettingController],
  providers: [
    SalesPdfService,
    ReceiptPdfService,
    ReceiptPdfSettingService,
    ReturnPdfService,
    QuotationPdfService,
  ],
  exports: [
    SalesPdfService,
    QuotationPdfService,
    ReturnPdfService,
    ReceiptPdfSettingService,
  ],
})
export class ReceiptModule {}
