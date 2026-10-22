import { Module } from '@nestjs/common';
import { DeliveryPartnersController } from './controllers/delivery-partners.controller';
import { DeliveryPartnersService } from './services/delivery-partners.service';

@Module({
  controllers: [DeliveryPartnersController],
  providers: [DeliveryPartnersService],
})
export class DeliveryPartnersModule {}
