import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { expectGenericWrapping } from '../../../../test/helpers/error-wrapping';
import { RewardsService } from './rewards.service';

afterEach(() => jest.restoreAllMocks());

const NOW = new Date('2026-05-05T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const settingsRow = (extra: object = {}) => ({
  consumer_id: 5,
  is_enabled: true,
  points_per_currency: 1,
  minimum_purchase_amount: 0,
  maximum_points_per_sale: null,
  redemption_value: 0.5,
  minimum_redemption: 100,
  maximum_redemption: null,
  points_expire_days: null,
  ...extra,
});

function setup() {
  const mk = (...names: string[]) =>
    Object.fromEntries(names.map((n) => [n, jest.fn()]));
  const tx: any = {
    customer: mk('findFirst'),
    customerRewardsPoints: mk('upsert', 'findUniqueOrThrow', 'update'),
    rewardsPointTransaction: mk('create'),
    $queryRaw: jest.fn(),
  };
  const prisma: any = {
    rewardsSettings: mk('findUnique', 'upsert'),
    customer: mk('findFirst'),
    customerRewardsPoints: mk('findUnique', 'create', 'findMany', 'count'),
    rewardsPointTransaction: mk('findMany', 'count'),
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
  };
  prisma.rewardsSettings.findUnique.mockResolvedValue(settingsRow());
  tx.customer.findFirst.mockResolvedValue({ id: 8 });
  tx.customerRewardsPoints.findUniqueOrThrow.mockResolvedValue({
    total_points: 500,
    lifetime_earned: 1000,
    lifetime_redeemed: 300,
  });
  tx.rewardsPointTransaction.create.mockResolvedValue({ id: 99 });
  return { prisma, tx, service: new RewardsService(prisma) };
}

describe('RewardsService settings (unit)', () => {
  afterEach(() => jest.useRealTimers());

  it('[BE-MUT-480] stored settings are returned as they are', async () => {
    const { prisma, service } = setup();
    await expect(service.getSettings(5)).resolves.toEqual(settingsRow());
    expect(prisma.rewardsSettings.findUnique).toHaveBeenCalledWith({
      where: { consumer_id: 5 },
    });
  });

  it('[BE-MUT-481] a shop without settings gets the documented defaults', async () => {
    const { prisma, service } = setup();
    prisma.rewardsSettings.findUnique.mockResolvedValue(null);
    await expect(service.getSettings(5)).resolves.toEqual({
      consumer_id: 5,
      is_enabled: true,
      points_per_currency: 1,
      minimum_purchase_amount: 0,
      maximum_points_per_sale: null,
      redemption_value: 0.01,
      minimum_redemption: 100,
      maximum_redemption: null,
      points_expire_days: null,
      allow_partial_redemption: true,
      earn_on_sale_only: true,
    });
  });

  it('[BE-MUT-482] saving settings upserts per consumer and stamps the update time', async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    const { prisma, service } = setup();
    prisma.rewardsSettings.upsert.mockResolvedValue({ id: 1 });
    await expect(
      service.createOrUpdateSettings(5, { points_per_currency: 2 } as any),
    ).resolves.toEqual({ id: 1 });
    expect(prisma.rewardsSettings.upsert).toHaveBeenCalledWith({
      where: { consumer_id: 5 },
      update: { points_per_currency: 2, updated_at: NOW },
      create: { consumer_id: 5, points_per_currency: 2 },
    });
  });

  it('[BE-MUT-483] settings failures are logged and hidden behind generic 500s', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setup();
        prisma.rewardsSettings.findUnique.mockRejectedValue(f);
        return service.getSettings(5);
      },
      message: 'Failed to fetch rewards settings',
      logged: ['Error fetching rewards settings for consumer 5'],
    });
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setup();
        prisma.rewardsSettings.upsert.mockRejectedValue(f);
        return service.createOrUpdateSettings(5, {} as any);
      },
      message: 'Failed to create or update rewards settings',
      logged: ['Error creating or updating rewards settings for consumer 5'],
    });
  });
});

describe('RewardsService customer points (unit)', () => {
  const pointsInclude = {
    customer: { select: { id: true, name: true, email: true, phone: true } },
  };

  it('[BE-MUT-484] a customer of another shop is a 404; an existing balance is returned as is', async () => {
    const { prisma, service } = setup();
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(service.getCustomerPoints(5, 8)).rejects.toThrow(
      new NotFoundException('Customer not found'),
    );
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 8, consumer_id: 5 },
    });
    prisma.customer.findFirst.mockResolvedValue({ id: 8 });
    prisma.customerRewardsPoints.findUnique.mockResolvedValue({
      total_points: 7,
    });
    await expect(service.getCustomerPoints(5, 8)).resolves.toEqual({
      total_points: 7,
    });
    expect(prisma.customerRewardsPoints.findUnique).toHaveBeenCalledWith({
      where: { customer_id: 8 },
      include: pointsInclude,
    });
    expect(prisma.customerRewardsPoints.create).not.toHaveBeenCalled();
  });

  it('[BE-MUT-485] a customer without a balance row gets a zero one created', async () => {
    const { prisma, service } = setup();
    prisma.customer.findFirst.mockResolvedValue({ id: 8 });
    prisma.customerRewardsPoints.findUnique.mockResolvedValue(null);
    prisma.customerRewardsPoints.create.mockResolvedValue({ total_points: 0 });
    await expect(service.getCustomerPoints(5, 8)).resolves.toEqual({
      total_points: 0,
    });
    expect(prisma.customerRewardsPoints.create).toHaveBeenCalledWith({
      data: {
        customer_id: 8,
        consumer_id: 5,
        total_points: 0,
        lifetime_earned: 0,
        lifetime_redeemed: 0,
      },
      include: pointsInclude,
    });
  });

  it('[BE-MUT-486] the customers list defaults to page 1 of 20 by points descending and reports page metadata', async () => {
    const { prisma, service } = setup();
    prisma.customerRewardsPoints.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.customerRewardsPoints.count.mockResolvedValue(45);
    await expect(service.getCustomersWithPoints(5, {} as any)).resolves.toEqual(
      {
        data: [{ id: 1 }],
        meta: { total: 45, page: 1, limit: 20, total_pages: 3 },
      },
    );
    expect(prisma.customerRewardsPoints.findMany).toHaveBeenCalledWith({
      where: { consumer_id: 5 },
      include: pointsInclude,
      orderBy: { total_points: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(prisma.customerRewardsPoints.count).toHaveBeenCalledWith({
      where: { consumer_id: 5 },
    });
  });

  it('[BE-MUT-487] paging, sorting and search map to skip/take/orderBy and a case-insensitive name/email/phone match', async () => {
    const { prisma, service } = setup();
    prisma.customerRewardsPoints.findMany.mockResolvedValue([]);
    prisma.customerRewardsPoints.count.mockResolvedValue(0);
    await service.getCustomersWithPoints(5, {
      page: 3,
      limit: 10,
      search: 'ann',
      sort_by: 'lifetime_earned',
      sort_order: 'asc',
    } as any);
    expect(prisma.customerRewardsPoints.findMany).toHaveBeenCalledWith({
      where: {
        consumer_id: 5,
        customer: {
          OR: [
            { name: { contains: 'ann', mode: 'insensitive' } },
            { email: { contains: 'ann', mode: 'insensitive' } },
            { phone: { contains: 'ann', mode: 'insensitive' } },
          ],
        },
      },
      include: pointsInclude,
      orderBy: { lifetime_earned: 'asc' },
      skip: 20,
      take: 10,
    });
  });

  it('[BE-MUT-488] customer point failures are logged and hidden behind generic 500s', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setup();
        prisma.customer.findFirst.mockRejectedValue(f);
        return service.getCustomerPoints(5, 8);
      },
      message: 'Failed to fetch customer points',
      logged: ['Error fetching customer points for customer 8 for consumer 5'],
      notFoundPassesThrough: true,
    });
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setup();
        prisma.customerRewardsPoints.findMany.mockRejectedValue(f);
        prisma.customerRewardsPoints.count.mockResolvedValue(0);
        return service.getCustomersWithPoints(5, {});
      },
      message: 'Failed to fetch customers with points',
      logged: ['Error fetching customers with points for consumer 5'],
    });
  });
});

describe('RewardsService earn/redeem/adjust (unit)', () => {
  afterEach(() => jest.useRealTimers());

  it('[BE-MUT-489] a disabled programme, a purchase below the minimum or one earning zero points earns nothing', async () => {
    const off = setup();
    off.prisma.rewardsSettings.findUnique.mockResolvedValue(
      settingsRow({ is_enabled: false }),
    );
    await expect(off.service.earnPoints(5, 8, 1, 1000)).resolves.toBeNull();
    const low = setup();
    low.prisma.rewardsSettings.findUnique.mockResolvedValue(
      settingsRow({ minimum_purchase_amount: 50 }),
    );
    await expect(low.service.earnPoints(5, 8, 1, 49.99)).resolves.toBeNull();
    expect(low.prisma.$transaction).not.toHaveBeenCalled();
    await expect(low.service.earnPoints(5, 8, 1, 50)).resolves.toEqual({
      id: 99,
    });
    const zero = setup();
    await expect(zero.service.earnPoints(5, 8, 1, 0.9)).resolves.toBeNull();
    expect(zero.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('[BE-MUT-490] points are floor(amount x rate), capped by the per-sale maximum, with a sale reference', async () => {
    const { tx, service } = setup();
    await service.earnPoints(5, 8, 12, 99.9);
    expect(
      tx.rewardsPointTransaction.create.mock.calls[0][0].data,
    ).toMatchObject({
      type: 'EARN',
      points: 99,
      sale_id: 12,
      description: 'Earned 99 points from purchase',
      reference: 'SALE-12',
      expiry_date: null,
      created_by_user_id: undefined,
    });
    const rate = setup();
    rate.prisma.rewardsSettings.findUnique.mockResolvedValue(
      settingsRow({ points_per_currency: 2.5 }),
    );
    await rate.service.earnPoints(5, 8, 12, 10);
    expect(
      rate.tx.rewardsPointTransaction.create.mock.calls[0][0].data.points,
    ).toBe(25);
    const capped = setup();
    capped.prisma.rewardsSettings.findUnique.mockResolvedValue(
      settingsRow({ maximum_points_per_sale: 50 }),
    );
    await capped.service.earnPoints(5, 8, 12, 500);
    expect(
      capped.tx.rewardsPointTransaction.create.mock.calls[0][0].data.points,
    ).toBe(50);
    await capped.service.earnPoints(5, 8, 12, 50);
    expect(
      capped.tx.rewardsPointTransaction.create.mock.calls[1][0].data.points,
    ).toBe(50);
    await capped.service.earnPoints(5, 8, 12, 30);
    expect(
      capped.tx.rewardsPointTransaction.create.mock.calls[2][0].data.points,
    ).toBe(30);
  });

  it('[BE-MUT-491] earned points expire after the configured number of days', async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    const { prisma, tx, service } = setup();
    prisma.rewardsSettings.findUnique.mockResolvedValue(
      settingsRow({ points_expire_days: 30 }),
    );
    await service.earnPoints(5, 8, 12, 100);
    expect(
      tx.rewardsPointTransaction.create.mock.calls[0][0].data.expiry_date,
    ).toEqual(new Date(NOW.getTime() + 30 * DAY));
  });

  it('[BE-MUT-492] earning updates the balance, lifetime earned and last-earned time under a row lock', async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    const { tx, service } = setup();
    await service.earnPoints(5, 8, 12, 100);
    expect(tx.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 8, consumer_id: 5 },
      select: { id: true },
    });
    expect(tx.customerRewardsPoints.upsert).toHaveBeenCalledWith({
      where: { customer_id: 8 },
      update: {},
      create: {
        customer_id: 8,
        consumer_id: 5,
        total_points: 0,
        lifetime_earned: 0,
        lifetime_redeemed: 0,
      },
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.rewardsPointTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customer_id: 8,
        consumer_id: 5,
        type: 'EARN',
        points: 100,
        balance_before: 500,
        balance_after: 600,
      }),
    });
    expect(tx.customerRewardsPoints.update).toHaveBeenCalledWith({
      where: { customer_id: 8 },
      data: { total_points: 600, lifetime_earned: 1100, last_earned_at: NOW },
    });
  });

  it('[BE-MUT-493] redeeming validates the programme, limits and balance before spending', async () => {
    const run = async (settings: object, points: number, balance = 500) => {
      const ctx = setup();
      ctx.prisma.rewardsSettings.findUnique.mockResolvedValue(
        settingsRow(settings),
      );
      ctx.prisma.customer.findFirst.mockResolvedValue({ id: 8 });
      ctx.prisma.customerRewardsPoints.findUnique.mockResolvedValue({
        total_points: balance,
      });
      return ctx.service
        .redeemPoints(5, { customer_id: 8, points } as any, 3)
        .catch((e) => e);
    };
    expect((await run({ is_enabled: false }, 200)).message).toBe(
      'Rewards system is disabled',
    );
    expect((await run({}, 99)).message).toBe(
      'Minimum redemption is 100 points',
    );
    expect((await run({ maximum_redemption: 300 }, 301)).message).toBe(
      'Maximum redemption is 300 points',
    );
    expect((await run({}, 600)).message).toBe('Insufficient points balance');
    for (const error of await Promise.all([run({}, 99), run({}, 600)])) {
      expect(error).toBeInstanceOf(BadRequestException);
    }
    expect(await run({}, 100)).toEqual({ id: 99 });
    expect(await run({ maximum_redemption: 300 }, 300)).toEqual({ id: 99 });
    expect(await run({}, 500)).toEqual({ id: 99 });
  });

  it('[BE-MUT-494] a redemption spends negative points, records the author and updates lifetime redeemed', async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    const { prisma, tx, service } = setup();
    prisma.customer.findFirst.mockResolvedValue({ id: 8 });
    prisma.customerRewardsPoints.findUnique.mockResolvedValue({
      total_points: 500,
    });
    await service.redeemPoints(
      5,
      { customer_id: 8, points: 150, reference: 'R1', notes: 'n' },
      3,
    );
    expect(
      tx.rewardsPointTransaction.create.mock.calls[0][0].data,
    ).toMatchObject({
      type: 'REDEEM',
      points: -150,
      balance_before: 500,
      balance_after: 350,
      description: 'Redeemed 150 points',
      reference: 'R1',
      notes: 'n',
      expiry_date: null,
      created_by_user_id: 3,
    });
    expect(tx.customerRewardsPoints.update).toHaveBeenCalledWith({
      where: { customer_id: 8 },
      data: {
        total_points: 350,
        lifetime_redeemed: 450,
        last_redeemed_at: NOW,
      },
    });
  });

  it('[BE-MUT-495] a balance that would go negative is refused inside the transaction; adjustments change only the balance', async () => {
    const { tx, service } = setup();
    await expect(
      service.adjustPoints(
        5,
        { customer_id: 8, points: -501, description: 'd' } as any,
        3,
      ),
    ).rejects.toThrow('Insufficient points balance');
    expect(tx.rewardsPointTransaction.create).not.toHaveBeenCalled();
    await service.adjustPoints(
      5,
      { customer_id: 8, points: -500, description: 'fix', notes: 'n' },
      3,
    );
    expect(
      tx.rewardsPointTransaction.create.mock.calls[0][0].data,
    ).toMatchObject({
      type: 'ADJUSTMENT',
      points: -500,
      balance_after: 0,
      description: 'fix',
      notes: 'n',
      created_by_user_id: 3,
    });
    expect(tx.customerRewardsPoints.update).toHaveBeenCalledWith({
      where: { customer_id: 8 },
      data: { total_points: 0 },
    });
  });

  it('[BE-MUT-496] a customer from another shop is a 404 and nothing is written', async () => {
    const { tx, service } = setup();
    tx.customer.findFirst.mockResolvedValue(null);
    await expect(
      service.adjustPoints(
        5,
        { customer_id: 8, points: 5, description: 'd' } as any,
        3,
      ),
    ).rejects.toThrow(new NotFoundException('Customer not found'));
    expect(tx.customerRewardsPoints.upsert).not.toHaveBeenCalled();
    expect(tx.rewardsPointTransaction.create).not.toHaveBeenCalled();
  });

  it('[BE-MUT-497] earn, redeem, adjust and transaction failures are logged and hidden behind generic 500s', async () => {
    const wrap = (
      arrange: (c: ReturnType<typeof setup>, f: unknown) => void,
      call: (s: RewardsService) => Promise<unknown>,
      message: string,
      logged: string,
    ) =>
      expectGenericWrapping({
        run: (f) => {
          const c = setup();
          arrange(c, f);
          return call(c.service);
        },
        message,
        logged: [logged],
      });
    await wrap(
      (c, f) => jest.spyOn(c.service, 'getSettings').mockRejectedValue(f),
      (s) => s.earnPoints(5, 8, 12, 100),
      'Failed to earn points',
      'Error earning points with customer 8 sale 12 amount 100 for consumer 5',
    );
    await wrap(
      (c, f) => jest.spyOn(c.service, 'getSettings').mockRejectedValue(f),
      (s) => s.redeemPoints(5, { customer_id: 8, points: 100 }, 3),
      'Failed to redeem points',
      'Error redeeming points with user 3 customer 8 for consumer 5',
    );
    await wrap(
      (c, f) => c.prisma.$transaction.mockRejectedValue(f),
      (s) => s.adjustPoints(5, { customer_id: 8, points: 1 } as any, 3),
      'Failed to create point transaction',
      'Error creating point transaction with user 3 customer 8 for consumer 5',
    );
    await wrap(
      (c, f) =>
        jest
          .spyOn(c.service as any, 'createPointTransaction')
          .mockRejectedValue(f),
      (s) => s.adjustPoints(5, { customer_id: 8, points: 1 } as any, 3),
      'Failed to adjust points',
      'Error adjusting points with user 3 customer 8 for consumer 5',
    );
  });
});

describe('RewardsService transactions list (unit)', () => {
  const include = {
    customer: { select: { id: true, name: true, email: true, phone: true } },
    sale: { select: { id: true, sale_number: true, total_amount: true } },
    created_by: { select: { id: true, name: true } },
  };

  it('[BE-MUT-498] the default listing is page 1 of 20, newest first, scoped to the shop', async () => {
    const { prisma, service } = setup();
    prisma.rewardsPointTransaction.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.rewardsPointTransaction.count.mockResolvedValue(21);
    await expect(service.getPointTransactions(5, {} as any)).resolves.toEqual({
      data: [{ id: 1 }],
      meta: { total: 21, page: 1, limit: 20, total_pages: 2 },
    });
    expect(prisma.rewardsPointTransaction.findMany).toHaveBeenCalledWith({
      where: { consumer_id: 5 },
      include,
      orderBy: { created_at: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it('[BE-MUT-499] every filter is applied: customer (ownership checked), search, type and an inclusive date range', async () => {
    const { prisma, service } = setup();
    prisma.customer.findFirst.mockResolvedValue({ id: 8 });
    prisma.rewardsPointTransaction.findMany.mockResolvedValue([]);
    prisma.rewardsPointTransaction.count.mockResolvedValue(0);
    await service.getPointTransactions(5, {
      page: 2,
      limit: 5,
      customer_id: '8',
      search: 'ann',
      type: 'EARN',
      date_from: '2026-01-01',
      date_to: '2026-02-01',
      sort_by: 'points',
      sort_order: 'asc',
    } as any);
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 8, consumer_id: 5 },
      select: { id: true },
    });
    expect(prisma.rewardsPointTransaction.findMany).toHaveBeenCalledWith({
      where: {
        consumer_id: 5,
        customer_id: '8',
        customer: {
          OR: [
            { name: { contains: 'ann', mode: 'insensitive' } },
            { email: { contains: 'ann', mode: 'insensitive' } },
            { phone: { contains: 'ann', mode: 'insensitive' } },
          ],
        },
        type: 'EARN',
        created_at: {
          gte: new Date('2026-01-01'),
          lte: new Date('2026-02-01'),
        },
      },
      include,
      orderBy: { points: 'asc' },
      skip: 5,
      take: 5,
    });
  });

  it('[BE-MUT-500] a one-sided date range sets only that bound; a foreign customer is a 404', async () => {
    const { prisma, service } = setup();
    prisma.rewardsPointTransaction.findMany.mockResolvedValue([]);
    prisma.rewardsPointTransaction.count.mockResolvedValue(0);
    await service.getPointTransactions(5, { date_from: '2026-01-01' });
    expect(
      prisma.rewardsPointTransaction.findMany.mock.calls[0][0].where.created_at,
    ).toEqual({
      gte: new Date('2026-01-01'),
    });
    await service.getPointTransactions(5, { date_to: '2026-02-01' });
    expect(
      prisma.rewardsPointTransaction.findMany.mock.calls[1][0].where.created_at,
    ).toEqual({
      lte: new Date('2026-02-01'),
    });
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(
      service.getPointTransactions(5, { customer_id: 8 } as any),
    ).rejects.toThrow(new NotFoundException('Customer not found'));
  });

  it('[BE-MUT-501] listing failures are logged and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setup();
        prisma.rewardsPointTransaction.findMany.mockRejectedValue(f);
        prisma.rewardsPointTransaction.count.mockResolvedValue(0);
        return service.getPointTransactions(5, {});
      },
      message: 'Failed to fetch point transactions',
      logged: ['Error fetching point transactions for consumer 5'],
      notFoundPassesThrough: true,
    });
  });
});

describe('RewardsService.expirePoints (unit)', () => {
  afterEach(() => jest.useRealTimers());

  const arrange = (
    earnings: object[],
    processed: object[] = [],
    balance = 500,
  ) => {
    const ctx = setup();
    ctx.prisma.rewardsSettings.findUnique.mockResolvedValue(
      settingsRow({ points_expire_days: 30 }),
    );
    ctx.prisma.rewardsPointTransaction.findMany
      .mockResolvedValueOnce(earnings)
      .mockResolvedValueOnce(processed);
    ctx.prisma.customerRewardsPoints.findUnique.mockResolvedValue({
      total_points: balance,
    });
    return ctx;
  };

  it('[BE-MUT-502] nothing expires while the programme is off or has no expiry period', async () => {
    for (const extra of [{ is_enabled: false }, { points_expire_days: null }]) {
      const { prisma, service } = setup();
      prisma.rewardsSettings.findUnique.mockResolvedValue(
        settingsRow({ points_expire_days: 30, ...extra }),
      );
      await expect(service.expirePoints(5)).resolves.toEqual({ expired: 0 });
      expect(prisma.rewardsPointTransaction.findMany).not.toHaveBeenCalled();
    }
  });

  it('[BE-MUT-503] expired earnings not yet processed are expired once, oldest first, each marked with its own reference', async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    const { prisma, tx, service } = arrange(
      [
        { id: 1, customer_id: 8, points: 100 },
        { id: 2, customer_id: 8, points: 50 },
        { id: 3, customer_id: 9, points: 70 },
      ],
      [{ reference: 'EXPIRE-2' }],
    );
    await expect(service.expirePoints(5)).resolves.toEqual({ expired: 170 });
    expect(prisma.rewardsPointTransaction.findMany).toHaveBeenNthCalledWith(1, {
      where: { consumer_id: 5, type: 'EARN', expiry_date: { lte: NOW } },
      orderBy: { id: 'asc' },
    });
    expect(prisma.rewardsPointTransaction.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        consumer_id: 5,
        type: 'EXPIRE',
        reference: { startsWith: 'EXPIRE-' },
      },
      select: { reference: true },
    });
    const created = tx.rewardsPointTransaction.create.mock.calls.map(
      ([a]: any) => a.data,
    );
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({
      customer_id: 8,
      type: 'EXPIRE',
      points: -100,
      description: 'Expired 100 points',
      reference: 'EXPIRE-1',
    });
    expect(created[1]).toMatchObject({
      customer_id: 9,
      points: -70,
      reference: 'EXPIRE-3',
    });
    expect(prisma.customerRewardsPoints.findUnique).toHaveBeenCalledWith({
      where: { customer_id: 8 },
      select: { total_points: true },
    });
  });

  it('[BE-MUT-504] already spent points cannot expire: at most the remaining balance is taken, and an empty balance still records the run', async () => {
    const part = arrange([{ id: 1, customer_id: 8, points: 100 }], [], 40);
    part.tx.customerRewardsPoints.findUniqueOrThrow.mockResolvedValue({
      total_points: 40,
      lifetime_earned: 0,
      lifetime_redeemed: 0,
    });
    await expect(part.service.expirePoints(5)).resolves.toEqual({
      expired: 40,
    });
    expect(
      part.tx.rewardsPointTransaction.create.mock.calls[0][0].data.points,
    ).toBe(-40);
    const none = arrange([{ id: 1, customer_id: 8, points: 100 }]);
    none.prisma.customerRewardsPoints.findUnique.mockResolvedValue(null);
    await expect(none.service.expirePoints(5)).resolves.toEqual({ expired: 0 });
    expect(
      none.tx.rewardsPointTransaction.create.mock.calls[0][0].data,
    ).toMatchObject({
      points: -0,
      reference: 'EXPIRE-1',
    });
    const negative = arrange([{ id: 1, customer_id: 8, points: 100 }], [], -20);
    await expect(negative.service.expirePoints(5)).resolves.toEqual({
      expired: 0,
    });
  });

  it('[BE-MUT-505] a failing expiry is logged and skipped so later earnings still expire; client errors abort the run', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation();
    const ctx = arrange([
      { id: 1, customer_id: 8, points: 100 },
      { id: 2, customer_id: 9, points: 60 },
    ]);
    ctx.prisma.customerRewardsPoints.findUnique
      .mockRejectedValueOnce(new Error('db hiccup'))
      .mockResolvedValue({ total_points: 500 });
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    await expect(ctx.service.expirePoints(5)).resolves.toEqual({ expired: 60 });
    expect(err).toHaveBeenCalledWith(
      'Failed to expire points for transaction 1:',
      expect.any(Error),
    );
    const abort = arrange([{ id: 1, customer_id: 8, points: 100 }]);
    abort.tx.customer.findFirst.mockResolvedValue(null);
    await expect(abort.service.expirePoints(5)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    err.mockRestore();
  });

  it('[BE-MUT-506] an unexpected failure while expiring is logged and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { service } = setup();
        jest.spyOn(service, 'getSettings').mockRejectedValue(f);
        return service.expirePoints(5);
      },
      message: 'Failed to expire points',
      logged: ['Error expiring points for consumer 5'],
    });
  });
});

describe('RewardsService helpers (unit)', () => {
  it('[BE-MUT-507] calculateRedemptionValue multiplies points by the redemption value, accepting decimals', () => {
    const { service } = setup();
    expect(service.calculateRedemptionValue(200, 0.05)).toBeCloseTo(10);
    expect(service.calculateRedemptionValue(4, '2.5' as any)).toBe(10);
  });

  const can = async (settings: object, points: number, balance = 500) => {
    const { prisma, service } = setup();
    prisma.rewardsSettings.findUnique.mockResolvedValue(settingsRow(settings));
    prisma.customer.findFirst.mockResolvedValue({ id: 8 });
    prisma.customerRewardsPoints.findUnique.mockResolvedValue({
      total_points: balance,
    });
    return service.canRedeemPoints(5, 8, points);
  };

  it('[BE-MUT-508] canRedeemPoints explains each refusal and allows boundary values', async () => {
    await expect(can({ is_enabled: false }, 200)).resolves.toEqual({
      canRedeem: false,
      reason: 'Rewards system is disabled',
    });
    await expect(can({}, 99)).resolves.toEqual({
      canRedeem: false,
      reason: 'Minimum redemption is 100 points',
    });
    await expect(can({ maximum_redemption: 300 }, 301)).resolves.toEqual({
      canRedeem: false,
      reason: 'Maximum redemption is 300 points',
    });
    await expect(can({}, 501)).resolves.toEqual({
      canRedeem: false,
      reason: 'Insufficient points balance',
    });
    for (const [settings, points] of [
      [{}, 100],
      [{ maximum_redemption: 300 }, 300],
      [{}, 500],
    ] as const) {
      await expect(can(settings, points)).resolves.toEqual({ canRedeem: true });
    }
  });

  it('[BE-MUT-509] canRedeemPoints failures are logged and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { service } = setup();
        jest.spyOn(service, 'getSettings').mockRejectedValue(f);
        return service.canRedeemPoints(5, 8, 100);
      },
      message: 'Failed to validate point redemption',
      logged: [
        'Error validating point redemption with customer 8 points 100 for consumer 5',
      ],
    });
  });

  const credit = async (settings: object, amount: number, balance = 500) => {
    const { prisma, service } = setup();
    prisma.rewardsSettings.findUnique.mockResolvedValue(
      settingsRow({ redemption_value: 0.5, ...settings }),
    );
    prisma.customer.findFirst.mockResolvedValue({ id: 8 });
    prisma.customerRewardsPoints.findUnique.mockResolvedValue({
      total_points: balance,
    });
    return service.validateCreditPayment(5, 8, amount);
  };

  it('[BE-MUT-510] validateCreditPayment checks programme, balance, minimum and maximum, reporting the usable maximum', async () => {
    await expect(credit({ is_enabled: false }, 10)).resolves.toEqual({
      isValid: false,
      reason: 'Rewards system is disabled',
    });
    await expect(credit({}, 250.01)).resolves.toEqual({
      isValid: false,
      reason: 'Insufficient points. Maximum credit available: ৳250.00',
      maxCreditAmount: 250,
    });
    await expect(credit({}, 49)).resolves.toEqual({
      isValid: false,
      reason: 'Minimum credit amount is ৳50.00',
      maxCreditAmount: 250,
    });
    await expect(credit({ maximum_redemption: 300 }, 160)).resolves.toEqual({
      isValid: false,
      reason: 'Maximum credit amount is ৳150.00',
      maxCreditAmount: 150,
    });
    await expect(credit({}, 250)).resolves.toEqual({
      isValid: true,
      maxCreditAmount: 250,
    });
    await expect(credit({}, 50)).resolves.toEqual({
      isValid: true,
      maxCreditAmount: 250,
    });
    await expect(credit({ maximum_redemption: 300 }, 150)).resolves.toEqual({
      isValid: true,
      maxCreditAmount: 250,
    });
    await expect(
      credit({ maximum_redemption: 300 }, 160, 100),
    ).resolves.toMatchObject({
      isValid: false,
      reason: 'Insufficient points. Maximum credit available: ৳50.00',
    });
  });

  it('[BE-MUT-511] validateCreditPayment failures are logged and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { service } = setup();
        jest.spyOn(service, 'getSettings').mockRejectedValue(f);
        return service.validateCreditPayment(5, 8, 10);
      },
      message: 'Failed to validate credit payment',
      logged: [
        'Error validating credit payment with customer 8 amount 10 for consumer 5',
      ],
    });
  });

  it('[BE-MUT-512] a credit payment spends the rounded-up points for the amount, linked to the sale, using the caller transaction', async () => {
    const { prisma, service } = setup();
    prisma.rewardsSettings.findUnique.mockResolvedValue(
      settingsRow({ redemption_value: 0.3, minimum_redemption: 1 }),
    );
    prisma.customer.findFirst.mockResolvedValue({ id: 8 });
    prisma.customerRewardsPoints.findUnique.mockResolvedValue({
      total_points: 500,
    });
    const client: any = {
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 8 }) },
      customerRewardsPoints: {
        upsert: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          total_points: 500,
          lifetime_earned: 0,
          lifetime_redeemed: 0,
        }),
        update: jest.fn(),
      },
      rewardsPointTransaction: {
        create: jest.fn().mockResolvedValue({ id: 4 }),
      },
      $queryRaw: jest.fn(),
    };
    await expect(
      service.processCreditPayment(5, 8, 10, 77, undefined, client),
    ).resolves.toEqual({ id: 4 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(
      client.rewardsPointTransaction.create.mock.calls[0][0].data,
    ).toMatchObject({
      customer_id: 8,
      type: 'REDEEM',
      points: -34,
      sale_id: 77,
      description: 'Redeemed 34 points for ৳10.00 credit',
      reference: 'CREDIT-SALE-77',
    });
    await service.processCreditPayment(5, 8, 10, 77, 'MY-REF', client);
    expect(
      client.rewardsPointTransaction.create.mock.calls[1][0].data.reference,
    ).toBe('MY-REF');
  });

  it('[BE-MUT-513] an invalid credit payment is a 400 carrying the reason; failures are hidden behind a generic 500', async () => {
    const { prisma, service } = setup();
    prisma.rewardsSettings.findUnique.mockResolvedValue(
      settingsRow({ is_enabled: false }),
    );
    await expect(service.processCreditPayment(5, 8, 10, 77)).rejects.toThrow(
      new BadRequestException('Rewards system is disabled'),
    );
    await expectGenericWrapping({
      run: (f) => {
        const ctx = setup();
        jest.spyOn(ctx.service, 'validateCreditPayment').mockRejectedValue(f);
        return ctx.service.processCreditPayment(5, 8, 10, 77);
      },
      message: 'Failed to process credit payment',
      logged: [
        'Error processing credit payment with customer 8 amount 10 for consumer 5',
      ],
    });
  });

  it('[BE-MUT-514] a credit refund adds back whole points, notes the return and original sale, and skips tiny amounts', async () => {
    const { prisma, tx, service } = setup();
    prisma.rewardsSettings.findUnique.mockResolvedValue(
      settingsRow({ redemption_value: 0.3 }),
    );
    await expect(service.processCreditRefund(5, 8, 0.29)).resolves.toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    await service.processCreditRefund(5, 8, 10, 77, 12);
    expect(
      tx.rewardsPointTransaction.create.mock.calls[0][0].data,
    ).toMatchObject({
      type: 'ADJUSTMENT',
      points: 33,
      sale_id: undefined,
      description: 'Refunded 33 points for ৳10.00 credit return',
      reference: 'CREDIT-REFUND-12',
      notes: 'Return ID: 12, Original Sale ID: 77',
    });
    await service.processCreditRefund(5, 8, 10, 77, undefined, 'MY-REF');
    expect(
      tx.rewardsPointTransaction.create.mock.calls[1][0].data,
    ).toMatchObject({
      reference: 'MY-REF',
      notes: 'Original Sale ID: 77',
    });
    await service.processCreditRefund(5, 8, 10, 77);
    expect(
      tx.rewardsPointTransaction.create.mock.calls[2][0].data.reference,
    ).toBe('CREDIT-REFUND-77');
  });

  it('[BE-MUT-515] credit refund failures are logged and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { service } = setup();
        jest.spyOn(service, 'getSettings').mockRejectedValue(f);
        return service.processCreditRefund(5, 8, 10);
      },
      message: 'Failed to process credit refund',
      logged: [
        'Error processing credit refund with customer 8 amount 10 for consumer 5',
      ],
    });
  });
});

describe('RewardsService.expireIfDue (unit)', () => {
  afterEach(() => jest.useRealTimers());

  it('[BE-RWD-101] {RewardsService.expireIfDue} expiry runs when points are looked at, at most once a minute per shop, and a failure never reaches the caller', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-24T10:00:00Z'));
    const { service } = setup();
    const expire = jest
      .spyOn(service, 'expirePoints')
      .mockResolvedValue({ expired: 0 });

    await service.expireIfDue(5);
    await service.expireIfDue(5);
    expect(expire).toHaveBeenCalledTimes(1);

    await service.expireIfDue(6);
    expect(expire).toHaveBeenCalledTimes(2);

    jest.setSystemTime(new Date('2026-10-24T10:01:01Z'));
    expire.mockRejectedValue(new Error('db down'));
    await expect(service.expireIfDue(5)).resolves.toBeUndefined();
    expect(expire).toHaveBeenCalledTimes(3);
  });
});
