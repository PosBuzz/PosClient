import { BadRequestException } from '@nestjs/common';

export function validatePurchase(
  quantity: number,
  costPrice: string | number,
  payments?: { amount: number }[],
) {
  const cost = Number(costPrice);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new BadRequestException(
      'Purchase quantity must be greater than zero',
    );
  }
  if (!Number.isFinite(cost) || cost < 0) {
    throw new BadRequestException('Cost price must be a non-negative number');
  }
  const amounts = (payments || []).map((payment) => Number(payment.amount));
  if (amounts.some((amount) => !Number.isFinite(amount) || amount <= 0)) {
    throw new BadRequestException('Payment amounts must be greater than zero');
  }
  const paid = amounts.reduce((sum, amount) => sum + amount, 0);
  if (Math.round(paid * 100) > Math.round(cost * quantity * 100)) {
    throw new BadRequestException('Payments exceed total purchase cost');
  }
}
