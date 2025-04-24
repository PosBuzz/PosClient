import { Module } from '@nestjs/common';
import { ChangePasswordModule } from './change-password/change-password.module';

@Module({
  imports: [ChangePasswordModule]
})
export class ConsumerModule {}
