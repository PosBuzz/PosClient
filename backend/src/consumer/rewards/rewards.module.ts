import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RewardsController } from './controllers/rewards.controller';
import { RewardsService } from './services/rewards.service';

@Module({
  controllers: [RewardsController],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
