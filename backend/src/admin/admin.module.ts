import { Module } from '@nestjs/common';
import { ConsumerModule } from './consumer/consumer.module';
import { BillingModule } from './billing/billing.module';
import { CrudModule } from './crud/crud.module';
import { PlanModule } from './plan/plan.module';

@Module({
  imports: [ConsumerModule, BillingModule, CrudModule, PlanModule],
})
export class AdminModule {}
