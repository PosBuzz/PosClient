import { Module } from '@nestjs/common';
import { PlanController } from './controllers/plan.controller';
import { PlanService } from './services/plan.service';

@Module({
  controllers: [PlanController],
  providers: [PlanService],
})
export class PlanModule {}
