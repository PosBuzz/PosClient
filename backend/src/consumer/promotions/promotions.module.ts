import { Module } from '@nestjs/common';
import { PromotionsController } from './controllers/promotions.controller';
import { PromotionsService } from './services/promotions.service';

@Module({
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
