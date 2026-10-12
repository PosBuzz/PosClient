import { errorsFor } from '../../../../test/helpers/validate-dto';
import { dtoCases, DtoCase } from '../../../../test/helpers/dto-cases';
import { CreatePromotionDto } from './create-promotion.dto';
import { UpdatePromotionDto } from './update-promotion.dto';
const valid = {
  name: 'Offer',
  scope: 'SINGLE_PRODUCT',
  discount_type: 'percentage',
  discount_value: 10,
  start_date: '2026-01-01',
  min_purchase: 0,
  min_quantity: 1,
  usage_limit: 1,
  cap_quantity: 1,
  cap_discount_amount: 0,
  max_discount_amount: 0,
  customer_usage_limit: 1,
  brand_id: 1,
  branch_ids: [1],
  variant_ids: [1],
};
const numeric = [
  'min_quantity',
  'usage_limit',
  'cap_quantity',
  'customer_usage_limit',
  'brand_id',
];
const monetary = [
  'discount_value',
  'min_purchase',
  'cap_discount_amount',
  'max_discount_amount',
];
const cases: DtoCase[] = [
  ['scope', 'INVALID', 'isEnum'],
  ['discount_type', 'PERCENTAGE', 'isEnum'],
  ...numeric.map((path) => [path, 1.5, 'isInt'] as const),
  ...numeric.map((path) => [path, 0, 'min'] as const),
  ...monetary.map((path) => [path, 'invalid', 'isNumber'] as const),
  ...monetary.map((path) => [path, -1, 'min'] as const),
  ['discount_value', 0, 'min'],
  ['branch_ids', [1.5], 'isInt'],
  ['variant_ids', [1.5], 'isInt'],
  ['branch_ids', [1, 1], 'arrayUnique'],
  ['variant_ids', [1, 1], 'arrayUnique'],
];
describe('promotion create/update DTOs', () => {
  it('[BE-DTO-500] full valid promotion; partial update and optional fields', async () => {
    expect(await errorsFor(CreatePromotionDto, valid)).toEqual([]);
    expect(await errorsFor(UpdatePromotionDto, {})).toEqual([]);
    expect(await errorsFor(UpdatePromotionDto, { discount_value: 5 })).toEqual(
      [],
    );
  });
  dtoCases(CreatePromotionDto, valid, 501, cases);
  dtoCases(UpdatePromotionDto, valid, 540, cases);
});
