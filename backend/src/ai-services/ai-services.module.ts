import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DescriptionController } from './controllers/description.controller';
import { DescriptionService } from './services/description.service';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [HttpModule, RabbitMQModule],
  controllers: [DescriptionController],
  providers: [DescriptionService],
})
export class AiServicesModule {}
