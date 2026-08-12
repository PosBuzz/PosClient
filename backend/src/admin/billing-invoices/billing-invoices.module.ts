import { Module } from '@nestjs/common';
import { BillingInvoicesController } from './billing-invoices.controller';
import { BillingInvoicesService } from './billing-invoices.service';
import { BillingHistoryService } from './billing-history.service';

@Module({
  controllers: [BillingInvoicesController],
  providers: [BillingInvoicesService, BillingHistoryService],
})
export class BillingInvoicesModule {}
