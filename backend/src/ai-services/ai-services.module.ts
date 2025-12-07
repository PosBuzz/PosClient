import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { DescriptionController } from './controllers/description.controller';
import { DescriptionService } from './services/description.service';
import { RabbitMQModule } from 'src/rabbitmq/rabbitmq.module';

@Module({
  imports: [HttpModule, RabbitMQModule],
  controllers: [DescriptionController],
  providers: [DescriptionService],
})
export class AiServicesModule {}
