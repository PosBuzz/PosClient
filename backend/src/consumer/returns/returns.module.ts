import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ReceiptModule } from '../receipt-pdf/receipt.module';
import { RewardsModule } from '../rewards/rewards.module';
import { ReturnController } from './controllers/return.controller';
import { ReturnService } from './services/return.service';

@Module({
  imports: [PrismaModule, RewardsModule, forwardRef(() => ReceiptModule)],
  controllers: [ReturnController],
  providers: [ReturnService],
  exports: [ReturnService],
})
export class ReturnsModule {}
