import { Module } from '@nestjs/common';
import { ProductController } from './controllers/product.controller';
import { ProductVariantService } from './services/product-variant.service';
import { ProductService } from './services/product.service';

@Module({
  controllers: [ProductController],
  providers: [ProductService, ProductVariantService],
  exports: [ProductService, ProductVariantService],
})
export class ProductModule {}
