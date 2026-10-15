import { Prisma, ProductVariant, Product } from '@prisma/client';
import { Tenant } from './tenant.factory';
import { CreateSaleDto } from '../../src/consumer/sales/dto/create-sale.dto';
import {
  calculateTaxAndTotal,
  catalogUnitPrice,
} from '../../src/consumer/sales/utils/sale-pricing.util';
type SaleLine = {
  variant: ProductVariant & { product: Product };
  qty: number;
  specialDiscount?: number;
  averageDiscount?: number;
  promotionDiscount?: number;
  batchId?: number;
};
export function buildSaleDto(
  tenant: Tenant,
  lines: SaleLine[],
  extra: Partial<CreateSaleDto> = {},
): CreateSaleDto {
  return {
    branch_id: tenant.branches[0].id,
    items: lines.map((line) => {
      const unit_price = catalogUnitPrice(
        line.variant,
        extra.price_type === 'wholesale',
      );
      const totals = calculateTaxAndTotal(
        unit_price,
        line.qty,
        line.variant.product.tax,
        line.variant.product.tax_method,
      );
      const discounts =
        (line.specialDiscount ?? 0) +
        (line.averageDiscount ?? 0) +
        (line.promotionDiscount ?? 0);
      return {
        variant_id: line.variant.id,
        batch_id: line.batchId,
        quantity: line.qty,
        unit_price,
        sold_unit_price: unit_price,
        tax_amount: totals.tax_amount,
        line_total: new Prisma.Decimal(totals.line_total)
          .minus(discounts)
          .toNumber(),
        special_discount_amount: line.specialDiscount,
        average_discount_amount: line.averageDiscount,
        promotion_discount_amount: line.promotionDiscount,
      };
    }),
    ...extra,
  };
}
