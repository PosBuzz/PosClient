import { Module } from '@nestjs/common';
import { PlanService } from './services/plan.service';
import { PlanController } from './controllers/plan.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PlanController],
  providers: [PlanService],
})
export class PlanModule {}
