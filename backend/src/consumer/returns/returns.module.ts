import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ReturnController } from './controllers/return.controller';
import { ReturnService } from './services/return.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReturnController],
  providers: [ReturnService],
  exports: [ReturnService],
})
export class ReturnsModule {}
