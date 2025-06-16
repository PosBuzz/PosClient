import { Module } from '@nestjs/common';
import { PlanController } from './controllers/plan.controller';
import { PlanService } from './services/plan.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [PlanController],
  providers: [PlanService],
})
export class PlanModule {}
