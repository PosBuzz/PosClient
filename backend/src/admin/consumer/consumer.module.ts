import { Module } from '@nestjs/common';
import { ConsumerController } from './controllers/consumer.controller';
import { ConsumerService } from './services/consumer.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ConsumerController],
  providers: [ConsumerService, PrismaService]
})
export class ConsumerModule {}
