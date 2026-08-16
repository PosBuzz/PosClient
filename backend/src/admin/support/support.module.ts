import { Module } from '@nestjs/common';
import { AdminSupportController } from './controllers/support.controller';
import { AdminSupportService } from './services/support.service';

@Module({
  controllers: [AdminSupportController],
  providers: [AdminSupportService],
})
export class AdminSupportModule {}
