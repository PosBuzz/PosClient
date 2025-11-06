import { Module } from '@nestjs/common';
import { ConsumerModule } from './consumer/consumer.module';
import { CrudModule } from './crud/crud.module';
import { PlanModule } from './plan/plan.module';
import { UsersModule } from './users/users.module';
import { BackupRestoreModule } from './backup-restore/backup-restore.module';
import { BillingInvoicesModule } from './billing-invoices/billing-invoices.module';

@Module({
  imports: [
    ConsumerModule,
    CrudModule,
    PlanModule,
    UsersModule,
    BackupRestoreModule,
    BillingInvoicesModule,
  ],
})
export class AdminModule {}
