import { errorsFor } from '../../../../test/helpers/validate-dto';
import { dtoCases, DtoCase } from '../../../../test/helpers/dto-cases';
import { CreateInventoryBatchDto } from './create-inventory-batch.dto';
import { CreateInventoryTransferDto } from './create-inventory-transfer.dto';
import { CreateInventoryAdjustmentDto } from './inventory-adjustment.dto';
const batch = {
  variant_id: 1,
  branch_id: 1,
  batch_number: 'B1',
  quantity: 1,
  cost_price: '10',
  vendor_id: 1,
  payments: [{ payment_method: 'CASH', amount: 1, payment_type: 'BKASH' }],
};
describe('inventory DTOs', () => {
  it('[BE-DTO-200] valid stock purchase, transfer and signed adjustment', async () => {
    expect(await errorsFor(CreateInventoryBatchDto, batch)).toEqual([]);
    expect(
      await errorsFor(CreateInventoryTransferDto, {
        source_branch_id: 1,
        destination_branch_id: 2,
        items: [{ batch_id: 1, quantity: 1 }],
      }),
    ).toEqual([]);
    for (const quantity_change of [-1, 1]) {
      expect(
        await errorsFor(CreateInventoryAdjustmentDto, {
          variant_id: 1,
          branch_id: 1,
          batch_id: 1,
          quantity_change,
          reason: 'Count correction',
        }),
      ).toEqual([]);
    }
  });
  const cases: DtoCase[] = [
    ...['variant_id', 'branch_id', 'quantity', 'vendor_id'].map(
      (path) => [path, 1.5, 'isInt'] as const,
    ),
    ['quantity', 0, 'min'],
    ['payments.0.payment_method', 'INVALID', 'isEnum'],
    ['payments.0.payment_method', '', 'isNotEmpty'],
    ['payments.0.payment_type', 'INVALID', 'isEnum'],
    ['payments.0.amount', 'invalid', 'isNumber'],
    ['payments.0.amount', undefined, 'isNotEmpty'],
    ['payments.0.amount', 0, 'isPositive'],
    ['payments.0.amount', 0.001, 'min'],
  ];
  dtoCases(CreateInventoryBatchDto, batch, 201, cases);
  dtoCases(
    CreateInventoryTransferDto,
    {
      source_branch_id: 1,
      destination_branch_id: 2,
      items: [{ batch_id: 1, quantity: 1 }],
    },
    220,
    [
      'source_branch_id',
      'destination_branch_id',
      'items.0.batch_id',
      'items.0.quantity',
    ].map((path) => [path, 1.5, 'isInt'] as const),
  );
  dtoCases(
    CreateInventoryAdjustmentDto,
    {
      variant_id: 1,
      branch_id: 1,
      batch_id: 1,
      quantity_change: 1,
      reason: 'Count',
    },
    230,
    ['variant_id', 'branch_id', 'batch_id', 'quantity_change'].map(
      (path) => [path, 1.5, 'isInt'] as const,
    ),
  );
});
