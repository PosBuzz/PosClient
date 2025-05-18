import { Module } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { RabbitMQController } from './rabbitmq.controller';

@Module({
  providers: [RabbitMQService],
  controllers: [RabbitMQController],
  exports: [RabbitMQService],
})
export class RabbitMQModule {}
