import { Module } from '@nestjs/common';
import { ConsumerModule } from './consumer/consumer.module';
import { CrudModule } from './crud/crud.module';
import { PlanModule } from './plan/plan.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [ConsumerModule, CrudModule, PlanModule, UsersModule],
})
export class AdminModule {}
