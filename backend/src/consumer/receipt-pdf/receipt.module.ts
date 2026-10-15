import { forwardRef, Module } from '@nestjs/common';
import { ReceiptPdfSettingController } from './controllers/receipt-pdf-setting.controller';
import { TestReceiptVariationsController } from './controllers/test-receipt-variations.controller';
import { ReceiptPdfSettingService } from './services/receipt-pdf-setting.service';
import { ReceiptPdfService } from './services/receipt-pdf.service';
import { SalesPdfService } from './services/sales-pdf.service';
import { SalesModule } from '../sales/sales.module';
import { ReturnPdfService } from './services/return-pdf.service';
import { QuotationPdfService } from './services/quotation-pdf.service';
import { TransferPdfService } from './services/transfer-pdf.service';

@Module({
  imports: [forwardRef(() => SalesModule)],
  controllers: [TestReceiptVariationsController, ReceiptPdfSettingController],
  providers: [
    SalesPdfService,
    ReceiptPdfService,
    ReceiptPdfSettingService,
    ReturnPdfService,
    QuotationPdfService,
    TransferPdfService,
  ],
  exports: [
    SalesPdfService,
    QuotationPdfService,
    ReturnPdfService,
    TransferPdfService,
    ReceiptPdfSettingService,
  ],
})
export class ReceiptModule {}
