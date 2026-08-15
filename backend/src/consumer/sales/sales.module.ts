import { forwardRef, Module } from '@nestjs/common';
import { PromotionsModule } from '../promotions/promotions.module';
import { TestReceiptVariationsController } from '../receipt-pdf/controllers/test-receipt-variations.controller';
import { ReceiptModule } from '../receipt-pdf/receipt.module';
import { RewardsModule } from '../rewards/rewards.module';
import { SalesController } from './controllers/sales.controller';
import { SalesService } from './services/sales.service';
import { BusinessReportPdfService } from './services/business-report-pdf.service';

@Module({
  imports: [RewardsModule, PromotionsModule, forwardRef(() => ReceiptModule)],
  controllers: [SalesController, TestReceiptVariationsController],
  providers: [SalesService, BusinessReportPdfService],
  exports: [SalesService],
})
export class SalesModule {}
