import { Module } from '@nestjs/common';
import { CustomerService } from './services/customer.service';
import { CustomerController } from './controllers/customer.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  controllers: [CustomerController],
  providers: [CustomerService],
})
export class CustomerModule {}
