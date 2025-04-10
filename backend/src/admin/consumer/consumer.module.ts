import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ConsumerController } from './controllers/consumer.controller';
import { ConsumerService } from './services/consumer.service';

@Module({
  imports: [PrismaModule],
  controllers: [ConsumerController],
  providers: [ConsumerService],
})
export class ConsumerModule {}
