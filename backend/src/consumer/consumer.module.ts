import { Module } from '@nestjs/common';
import { BranchModule } from './branch/branch.module';
import { BrandModule } from './brand/brand.module';
import { CategoryModule } from './category/category.module';
import { ChangePasswordModule } from './change-password/change-password.module';
import { TagModule } from './tag/tag.module';
import { UnitModule } from './unit/unit.module';
import { UsersModule } from './users/users.module';
import { VendorModule } from './vendor/vendor.module';
import { ProductModule } from './product/product.module';
import { InventoryModule } from './inventory/inventory.module';
import { CacheModule } from './cache/cache.module';
import { CustomerModule } from './customer/customer.module';
import { SalesModule } from './sales/sales.module';

@Module({
  imports: [
    ChangePasswordModule,
    UsersModule,
    CategoryModule,
    TagModule,
    UnitModule,
    BrandModule,
    BranchModule,
    VendorModule,
    ProductModule,
    InventoryModule,
    CacheModule,
    CustomerModule,
    SalesModule,
  ],
})
export class ConsumerModule {}
