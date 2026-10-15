import { errorsFor } from '../../../../test/helpers/validate-dto';
import { dtoCases, DtoCase } from '../../../../test/helpers/dto-cases';
import { CreateReturnDto } from './create-return.dto';
const valid = {
  original_sale_id: 1,
  branch_id: 1,
  exchange_sale_id: 2,
  shipping_refund_amount: 0,
  items: [{ sale_item_id: 1, variant_id: 1, batch_id: 1, quantity: 1 }],
  payments: [{ payment_method: 'CASH', amount: 1 }],
  exchanges: [
    { variant_id: 1, batch_id: 1, quantity: 1, unit_price: 10, line_total: 10 },
  ],
};
describe('return DTO', () => {
  it('[BE-DTO-100] valid return transforms explicit string numbers', async () => {
    expect(await errorsFor(CreateReturnDto, valid)).toEqual([]);
    expect(
      await errorsFor(CreateReturnDto, {
        ...valid,
        branch_id: '1',
        shipping_refund_amount: '0',
        items: [{ ...valid.items[0], quantity: '2' }],
      }),
    ).toEqual([]);
  });
  const cases: DtoCase[] = [
    ...[
      'original_sale_id',
      'branch_id',
      'exchange_sale_id',
      'items.0.sale_item_id',
      'items.0.variant_id',
      'items.0.batch_id',
      'items.0.quantity',
      'exchanges.0.variant_id',
      'exchanges.0.batch_id',
      'exchanges.0.quantity',
    ].map((path) => [path, 1.5, 'isInt'] as const),
    ...[
      'shipping_refund_amount',
      'payments.0.amount',
      'exchanges.0.unit_price',
      'exchanges.0.line_total',
    ].map((path) => [path, 'invalid', 'isNumber'] as const),
    ['payments.0.payment_method', 'INVALID', 'isEnum'],
    ['payments.0.payment_type', 'INVALID', 'isEnum'],
  ];
  // payment_type validation is conditional: use CARD in this baseline.
  dtoCases(
    CreateReturnDto,
    {
      ...valid,
      payments: [{ payment_method: 'CARD', payment_type: 'BKASH', amount: 1 }],
    },
    101,
    cases,
  );
  it('[BE-DTO-119] electronic refund requires type; cash and shipping-only return remain valid', async () => {
    for (const payment_method of ['CARD', 'BANK_TRANSFER', 'MFS']) {
      expect(
        await errorsFor(CreateReturnDto, {
          ...valid,
          payments: [{ payment_method, amount: 1 }],
        }),
      ).toContain('payments.0.payment_type.isEnum');
    }
    expect(
      await errorsFor(CreateReturnDto, {
        original_sale_id: 1,
        branch_id: 1,
        items: [],
        shipping_refund_amount: 5,
      }),
    ).toEqual([]);
  });
});
