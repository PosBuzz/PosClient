import { Module } from '@nestjs/common';
import { BillingController } from './controllers/billing.controller';
import { BillingService } from './services/billing.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  providers: [BillingService, PrismaService],
  controllers: [BillingController],
})
export class BillingModule {}
