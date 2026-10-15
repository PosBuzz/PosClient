import { errorsFor } from '../../../../test/helpers/validate-dto';
import { dtoCases, DtoCase } from '../../../../test/helpers/dto-cases';
import { MakePaymentDto } from './make-payment.dto';
const valid = { sale_id: 1, payments: [{ payment_method: 'CASH', amount: 1 }] };
describe('sale credit payment DTO', () => {
  it('[BE-DTO-300] valid payment and explicit string conversion', async () => {
    expect(await errorsFor(MakePaymentDto, valid)).toEqual([]);
    expect(
      await errorsFor(MakePaymentDto, {
        sale_id: '1',
        payments: [{ payment_method: 'CASH', amount: '0.01' }],
      }),
    ).toEqual([]);
  });
  const cases: DtoCase[] = [
    ['sale_id', undefined, 'isNotEmpty'],
    ['sale_id', 'bad', 'isNumber'],
    ['sale_id', 0, 'min'],
    ['payments.0.payment_method', '', 'isNotEmpty'],
    ['payments.0.payment_method', 'UNKNOWN', 'isEnum'],
    ['payments.0.amount', undefined, 'isNotEmpty'],
    ['payments.0.amount', 'bad', 'isNumber'],
    ['payments.0.amount', 0, 'isPositive'],
    ['payments.0.amount', 0.001, 'min'],
  ];
  dtoCases(MakePaymentDto, valid, 301, cases);
});
