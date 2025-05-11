import { Module } from '@nestjs/common';
import { ChangePasswordController } from './change-password.controller';
import { ChangePasswordService } from './change-password.service';

@Module({
  controllers: [ChangePasswordController],
  providers: [ChangePasswordService],
})
export class ChangePasswordModule {}
