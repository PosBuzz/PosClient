import { Module } from '@nestjs/common';
import { ChangePasswordModule } from './change-password/change-password.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [ChangePasswordModule, UsersModule],
})
export class ConsumerModule {}
