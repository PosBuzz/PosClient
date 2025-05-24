import { Module } from '@nestjs/common';
import { BrandController } from './controllers/brand.controller';
import { BrandService } from './services/brand.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  controllers: [BrandController],
  providers: [BrandService],
})
export class BrandModule {}