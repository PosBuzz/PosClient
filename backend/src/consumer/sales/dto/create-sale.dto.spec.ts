import { plainToInstance } from 'class-transformer';
import { ValidationPipe } from '@nestjs/common';
import { errorsFor } from '../../../../test/helpers/validate-dto';
import { CreateSaleDto } from './create-sale.dto';

const sale = {
  branch_id: 1,
  items: [{ variant_id: 1, quantity: 1, unit_price: 100, line_total: 100 }],
};
describe('sale DTO validation', () => {
  it('[BE-DTO-001] minimal sale is valid', async () =>
    expect(await errorsFor(CreateSaleDto, sale)).toEqual([]));
  it('[BE-DTO-002] zero quantity is rejected', async () =>
    expect(
      await errorsFor(CreateSaleDto, {
        ...sale,
        items: [{ ...sale.items[0], quantity: 0 }],
      }),
    ).toContain('items.0.quantity.min'));
  it('[BE-DTO-003] negative prices, tax and every discount are rejected', async () => {
    for (const field of [
      'unit_price',
      'sold_unit_price',
      'line_total',
      'tax_amount',
      'average_discount_amount',
      'special_discount_amount',
      'promotion_discount_amount',
    ]) {
      expect(
        await errorsFor(CreateSaleDto, {
          ...sale,
          items: [{ ...sale.items[0], [field]: -1 }],
        }),
      ).toContain(`items.0.${field}.min`);
    }
    for (const field of [
      'discount_amount',
      'shipping_cost',
      'received_amount',
    ]) {
      expect(
        await errorsFor(CreateSaleDto, { ...sale, [field]: -1 }),
      ).toContain(`${field}.min`);
    }
  });
  it('[BE-DTO-004] zero payment is rejected and 0.01 is valid', async () => {
    expect(
      await errorsFor(CreateSaleDto, {
        ...sale,
        payments: [{ payment_method: 'CASH', amount: 0 }],
      }),
    ).toContain('payments.0.amount.min');
    expect(
      await errorsFor(CreateSaleDto, {
        ...sale,
        payments: [{ payment_method: 'CASH', amount: 0.01 }],
      }),
    ).toEqual([]);
  });
  it('[BE-DTO-005] empty sales are rejected before any state change', async () =>
    expect(await errorsFor(CreateSaleDto, { ...sale, items: [] })).toContain(
      'items.arrayMinSize',
    ));
  it('[BE-DTO-006] electronic payments require a valid payment type', async () => {
    for (const payment_method of ['CARD', 'BANK_TRANSFER', 'MFS']) {
      expect(
        await errorsFor(CreateSaleDto, {
          ...sale,
          payments: [{ payment_method, amount: 1 }],
        }),
      ).toContain('payments.0.payment_type.isEnum');
      expect(
        await errorsFor(CreateSaleDto, {
          ...sale,
          payments: [{ payment_method, payment_type: 'INVALID', amount: 1 }],
        }),
      ).toContain('payments.0.payment_type.isEnum');
      expect(
        await errorsFor(CreateSaleDto, {
          ...sale,
          payments: [{ payment_method, payment_type: 'BKASH', amount: 1 }],
        }),
      ).toEqual([]);
    }
  });
  it('[BE-DTO-007] cash does not require payment type', async () =>
    expect(
      await errorsFor(CreateSaleDto, {
        ...sale,
        payments: [{ payment_method: 'CASH', amount: 1 }],
      }),
    ).toEqual([]));
  it('[BE-DTO-008] unknown enums are rejected', async () => {
    for (const field of [
      'sale_type',
      'price_type',
      'online_order_status',
      'payment_status',
    ]) {
      expect(
        await errorsFor(CreateSaleDto, { ...sale, [field]: 'UNKNOWN' }),
      ).toContain(`${field}.isEnum`);
    }
    expect(
      await errorsFor(CreateSaleDto, {
        ...sale,
        payments: [{ payment_method: 'UNKNOWN', amount: 1 }],
      }),
    ).toContain('payments.0.payment_method.isEnum');
  });
  it('[BE-DTO-009] numeric strings are not implicitly converted; unknown fields pass through', async () => {
    const plain = { ...sale, items: [{ ...sale.items[0], quantity: '5' }] };
    expect(await errorsFor(CreateSaleDto, plain)).toContain(
      'items.0.quantity.isInt',
    );
    expect(plainToInstance(CreateSaleDto, plain).items[0].quantity).toBe('5');
    const pipe = new ValidationPipe({ transform: true });
    const transformed = await pipe.transform(
      { ...sale, unknown: 'preserved' },
      { type: 'body', metatype: CreateSaleDto },
    );
    expect(transformed).toBeInstanceOf(CreateSaleDto);
    expect(transformed).toHaveProperty('unknown', 'preserved');
  });
});
