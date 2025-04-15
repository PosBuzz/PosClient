import { Module } from '@nestjs/common';
import { ConsumerModule } from './consumer/consumer.module';
import { CrudModule } from './crud/crud.module';
import { PlanModule } from './plan/plan.module';

@Module({
  imports: [ConsumerModule, CrudModule, PlanModule],
})
export class AdminModule {}
