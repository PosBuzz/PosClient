import { Module } from '@nestjs/common';
import { SupportController } from './controllers/support.controller';
import { SupportService } from './services/support.service';

@Module({
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
