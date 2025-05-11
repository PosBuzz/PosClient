import { Module } from '@nestjs/common';
import { BillingInvoicesController } from './billing-invoices.controller';
import { BillingInvoicesService } from './billing-invoices.service';

@Module({
  controllers: [BillingInvoicesController],
  providers: [BillingInvoicesService],
})
export class BillingInvoicesModule {}
