import { Module } from '@nestjs/common';
import { VendorController } from './controllers/vendor.controller';
import { VendorService } from './services/vendor.service';

@Module({
  controllers: [VendorController],
  providers: [VendorService],
})
export class VendorModule {}