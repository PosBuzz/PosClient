import { Module } from '@nestjs/common';
import { ConsumerModule } from './consumer/consumer.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [ConsumerModule, BillingModule],
})
export class AdminModule {}
