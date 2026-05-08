import { ReceiptModule } from '../../consumer/receipt-pdf/receipt.module';
import { Module } from '@nestjs/common';
import { ConsumerController } from './controllers/consumer.controller';
import { ConsumerService } from './services/consumer.service';

@Module({
  imports: [ReceiptModule],
  controllers: [ConsumerController],
  providers: [ConsumerService],
})
export class ConsumerModule {}
