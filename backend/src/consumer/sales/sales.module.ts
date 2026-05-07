import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SalesController } from './controllers/sales.controller';
import { SalesPdfService } from './services/sales-pdf.service';
import { QuotationPdfService } from './services/quotation-pdf.service';
import { SalesService } from './services/sales.service';
import { RewardsModule } from '../rewards/rewards.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { TestReceiptVariationsController } from './controllers/test-receipt-variations.controller';

@Module({
  imports: [RewardsModule, PromotionsModule],
  controllers: [SalesController, TestReceiptVariationsController],
  providers: [SalesService, SalesPdfService, QuotationPdfService],
  exports: [SalesService, SalesPdfService, QuotationPdfService],
})
export class SalesModule {}
