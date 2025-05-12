import { Module } from '@nestjs/common';
import { ChangePasswordModule } from './change-password/change-password.module';
import { UsersModule } from './users/users.module';
import { ProductModule } from './product/product.module';

@Module({
  imports: [ChangePasswordModule, UsersModule, ProductModule],
})
export class ConsumerModule {}
