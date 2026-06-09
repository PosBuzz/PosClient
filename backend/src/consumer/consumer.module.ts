import { Module } from '@nestjs/common';
import { BranchModule } from './branch/branch.module';
import { BrandModule } from './brand/brand.module';
import { CategoryModule } from './category/category.module';
import { ChangePasswordModule } from './change-password/change-password.module';
import { CustomerModule } from './customer/customer.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InventoryModule } from './inventory/inventory.module';
import { PaymentsModule } from './payments/payments.module';
import { PurchasePaymentsModule } from './purchase-payments/purchase-payments.module';
import { ProductModule } from './product/product.module';
import { ProfileModule } from './profile/profile.module';
import { PromotionsModule } from './promotions/promotions.module';
import { ReturnsModule } from './returns/returns.module';
import { RewardsModule } from './rewards/rewards.module';
import { SalesModule } from './sales/sales.module';
import { TagModule } from './tag/tag.module';
import { UnitModule } from './unit/unit.module';
import { UsersModule } from './users/users.module';
import { VendorModule } from './vendor/vendor.module';
import { ProductAuditModule } from 'src/product-audit/product-audit.module';
import { ReceiptModule } from './receipt-pdf/receipt.module';

@Module({
  imports: [
    ChangePasswordModule,
    ProfileModule,
    UsersModule,
    CategoryModule,
    TagModule,
    UnitModule,
    BrandModule,
    BranchModule,
    VendorModule,
    ProductModule,
    InventoryModule,
    CustomerModule,
    SalesModule,
    ReturnsModule,
    RewardsModule,
    PaymentsModule,
    PurchasePaymentsModule,
    PromotionsModule,
    DashboardModule,
    ProductAuditModule,
    ReceiptModule,
  ],
})
export class ConsumerModule {}
