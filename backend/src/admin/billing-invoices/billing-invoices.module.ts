import { Module } from '@nestjs/common';
import { BillingInvoicesService } from './billing-invoices.service';
import { BillingInvoicesController } from './billing-invoices.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BillingInvoicesController],
  providers: [BillingInvoicesService],
})
export class BillingInvoicesModule {}
