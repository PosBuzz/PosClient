import { errorsFor } from '../../../../test/helpers/validate-dto';
import { dtoCases, DtoCase } from '../../../../test/helpers/dto-cases';
import { MakePurchasePaymentDto } from './make-purchase-payment.dto';
import { PurchaseBatchesFiltersDto } from './purchase-batches-filters.dto';
const valid = {
  batch_id: 1,
  payments: [{ payment_method: 'CASH', payment_type: 'BKASH', amount: 1 }],
};
describe('purchase payment DTOs', () => {
  it('[BE-DTO-400] valid purchase payment and default filters', async () => {
    expect(await errorsFor(MakePurchasePaymentDto, valid)).toEqual([]);
    expect(await errorsFor(PurchaseBatchesFiltersDto, {})).toEqual([]);
  });
  const cases: DtoCase[] = [
    ['batch_id', undefined, 'isNotEmpty'],
    ['batch_id', 'bad', 'isNumber'],
    ['batch_id', 0, 'min'],
    ['payments.0.payment_method', '', 'isNotEmpty'],
    ['payments.0.payment_method', 'UNKNOWN', 'isEnum'],
    ['payments.0.payment_type', 'UNKNOWN', 'isEnum'],
    ['payments.0.amount', undefined, 'isNotEmpty'],
    ['payments.0.amount', 'bad', 'isNumber'],
    ['payments.0.amount', 0, 'isPositive'],
    ['payments.0.amount', 0.001, 'min'],
  ];
  dtoCases(MakePurchasePaymentDto, valid, 401, cases);
  dtoCases(
    PurchaseBatchesFiltersDto,
    { page: 1, limit: 20, branch_id: 1, vendor_id: 1 },
    420,
    [
      ...['page', 'limit', 'branch_id', 'vendor_id'].map(
        (path) => [path, 1.5, 'isInt'] as const,
      ),
      ['page', 0, 'min'],
      ['limit', 0, 'min'],
    ],
  );
});
