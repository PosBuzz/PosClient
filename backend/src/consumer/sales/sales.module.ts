import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SalesController } from './controllers/sales.controller';
import { SalesPdfService } from './services/sales-pdf.service';
import { SalesService } from './services/sales.service';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [RewardsModule],
  controllers: [SalesController],
  providers: [SalesService, SalesPdfService],
  exports: [SalesService, SalesPdfService],
})
export class SalesModule {}
