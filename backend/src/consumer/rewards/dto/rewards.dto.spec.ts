import { errorsFor } from '../../../../test/helpers/validate-dto';
import { dtoCases, DtoCase } from '../../../../test/helpers/dto-cases';
import { plainToInstance } from 'class-transformer';
import {
  CreateRewardsPointTransactionDto,
  RedeemPointsDto,
  AdjustPointsDto,
} from './rewards-transaction.dto';
import {
  CreateRewardsSettingsDto,
  UpdateRewardsSettingsDto,
} from './rewards-settings.dto';
import { RewardsFiltersDto } from './rewards-filters.dto';
const settings = {
  points_per_currency: 1,
  minimum_purchase_amount: 0,
  maximum_points_per_sale: 1,
  redemption_value: 0.01,
  minimum_redemption: 1,
  maximum_redemption: 1,
  points_expire_days: 1,
};
const amounts = [
  'points_per_currency',
  'minimum_purchase_amount',
  'maximum_points_per_sale',
  'redemption_value',
];
const integers = [
  'minimum_redemption',
  'maximum_redemption',
  'points_expire_days',
];
const cases: DtoCase[] = [
  ...amounts.map((path) => [path, 'bad', 'isNumber'] as const),
  ...amounts.map((path) => [path, -1, 'min'] as const),
  ...integers.map((path) => [path, 1.5, 'isInt'] as const),
  ...integers.map((path) => [path, 0, 'min'] as const),
];
describe('rewards DTOs', () => {
  it('[BE-DTO-600] valid settings defaults, redemption, signed adjustment and transaction', async () => {
    for (const cls of [CreateRewardsSettingsDto, UpdateRewardsSettingsDto]) {
      expect(await errorsFor(cls, {})).toEqual([]);
    }
    expect(
      await errorsFor(RedeemPointsDto, { customer_id: 1, points: 1 }),
    ).toEqual([]);
    for (const points of [-10, 10]) {
      expect(
        await errorsFor(AdjustPointsDto, {
          customer_id: 1,
          points,
          description: 'Manual correction',
        }),
      ).toEqual([]);
      expect(
        await errorsFor(CreateRewardsPointTransactionDto, {
          customer_id: 1,
          type: 'ADJUSTMENT',
          points,
          sale_id: 1,
        }),
      ).toEqual([]);
    }
    expect(await errorsFor(RewardsFiltersDto, {})).toEqual([]);
  });
  dtoCases(CreateRewardsSettingsDto, settings, 601, cases);
  dtoCases(UpdateRewardsSettingsDto, settings, 620, cases);
  dtoCases(
    CreateRewardsPointTransactionDto,
    { customer_id: 1, type: 'EARN', points: 10, sale_id: 1 },
    640,
    [
      ['customer_id', 1.5, 'isInt'],
      ['customer_id', 0, 'min'],
      ['points', 1.5, 'isInt'],
      ['sale_id', 1.5, 'isInt'],
      ['type', 'INVALID', 'isEnum'],
    ],
  );
  dtoCases(RedeemPointsDto, { customer_id: 1, points: 10 }, 650, [
    ['customer_id', 1.5, 'isInt'],
    ['customer_id', 0, 'min'],
    ['points', 1.5, 'isInt'],
    ['points', 0, 'min'],
  ]);
  dtoCases(
    AdjustPointsDto,
    { customer_id: 1, points: 1, description: 'Correction' },
    660,
    [
      ['customer_id', 1.5, 'isInt'],
      ['customer_id', 0, 'min'],
      ['points', 1.5, 'isInt'],
    ],
  );
  dtoCases(RewardsFiltersDto, { page: 1, limit: 20, customer_id: 1 }, 670, [
    ...['page', 'limit', 'customer_id'].map(
      (path) => [path, 1.5, 'isInt'] as const,
    ),
    ...['page', 'limit', 'customer_id'].map(
      (path) => [path, 0, 'min'] as const,
    ),
  ]);
  it('[BE-DTO-680] zero maximum points means uncapped (UI and service convention)', async () => {
    const plain = { ...settings, maximum_points_per_sale: 0 };
    expect(await errorsFor(CreateRewardsSettingsDto, plain)).toEqual([]);
    expect(
      plainToInstance(CreateRewardsSettingsDto, plain).maximum_points_per_sale,
    ).toBeNull();
  });
});
