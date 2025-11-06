import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ReturnController } from './controllers/return.controller';
import { ReturnService } from './services/return.service';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [PrismaModule, RewardsModule],
  controllers: [ReturnController],
  providers: [ReturnService],
  exports: [ReturnService],
})
export class ReturnsModule {}
