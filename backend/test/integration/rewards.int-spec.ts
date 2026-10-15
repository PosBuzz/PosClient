import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createCustomer, createRewardsSettings } from '../factories';
import { RewardsService } from '../../src/consumer/rewards/services/rewards.service';
import { PaymentMethod } from '../../src/consumer/sales/dto/create-sale.dto';

describe('rewards ledger', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let rewards: RewardsService;

  beforeAll(async () => {
    boot = await bootDomain();
    rewards = boot.get(RewardsService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
    saleVariant = undefined;
  });
  afterEach(() => w.check());

  const cid = () => w.tenant.consumer.id;
  const uid = () => w.tenant.adminUser.id;
  const settings = (overrides: object = {}) =>
    createRewardsSettings(db, {
      consumer_id: cid(),
      redemption_value: 1,
      minimum_redemption: 1,
      ...overrides,
    });
  const customer = () => createCustomer(db, { consumer_id: cid() });
  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );
  const grant = (customerId: number, points: number) =>
    rewards.adjustPoints(
      cid(),
      { customer_id: customerId, points, description: 'seed' },
      uid(),
    );
  let saleVariant: Awaited<ReturnType<World['stock']>> | undefined;
  /** Earnings reference a sale row, so tests that call earnPoints need real sales. */
  const realSaleId = async () => {
    saleVariant ??= await w.stock({
      price: 10,
      batches: [{ qty: 500, cost: 1 }],
    });
    return (await w.sell([{ variant: saleVariant, qty: 1 }])).id as number;
  };
  const balance = async (customerId: number) =>
    (
      await db.customerRewardsPoints.findUniqueOrThrow({
        where: { customer_id: customerId },
      })
    ).total_points;

  describe('earning', () => {
    it('[BE-RWD-001] {RewardsService.earnPoints} points follow the rate, the minimum purchase, the per-sale cap and the enable switch', async () => {
      const c = await customer();
      await settings({
        points_per_currency: 2,
        minimum_purchase_amount: 50,
        maximum_points_per_sale: 150,
      });
      expect(
        await rewards.earnPoints(cid(), c.id, await realSaleId(), 40),
      ).toBeNull();
      expect(
        (await rewards.earnPoints(cid(), c.id, await realSaleId(), 60.5))!
          .points,
      ).toBe(121);
      expect(
        (await rewards.earnPoints(cid(), c.id, await realSaleId(), 500))!
          .points,
      ).toBe(150);
      await db.rewardsSettings.update({
        where: { consumer_id: cid() },
        data: { is_enabled: false },
      });
      expect(
        await rewards.earnPoints(cid(), c.id, await realSaleId(), 500),
      ).toBeNull();
      expect(await balance(c.id)).toBe(271);
    });
  });

  describe('redeeming', () => {
    const redeem = (customerId: number, points: number) =>
      rewards.redeemPoints(cid(), { customer_id: customerId, points }, uid());

    it('[BE-RWD-002] each redemption rule refuses with its own message', async () => {
      const c = await customer();
      await settings({ minimum_redemption: 10, maximum_redemption: 100 });
      await grant(c.id, 150);
      expect((await failure(redeem(c.id, 5))).message).toMatch(
        /Minimum redemption is 10/,
      );
      expect((await failure(redeem(c.id, 101))).message).toMatch(
        /Maximum redemption is 100/,
      );
      await redeem(c.id, 100);
      expect((await failure(redeem(c.id, 60))).message).toMatch(
        /Insufficient points balance/,
      );
      await db.rewardsSettings.update({
        where: { consumer_id: cid() },
        data: { is_enabled: false },
      });
      expect((await failure(redeem(c.id, 10))).message).toMatch(/disabled/);
      expect(await balance(c.id)).toBe(50);
    });

    it('[BE-RWD-003] {RewardsService.calculateRedemptionValue} redemption value is points times the configured rate', () => {
      expect(rewards.calculateRedemptionValue(250, 0.04)).toBe(10);
    });

    it("[BE-RWD-008] points of another tenant's customer cannot be touched", async () => {
      await settings();
      const foreign = await createCustomer(db, {
        consumer_id: w.bystander.consumer.id,
      });
      await w.rebaseBystander();
      const adjust = await failure(grant(foreign.id, 500));
      expect(adjust).toBeInstanceOf(NotFoundException);
      const spend = await failure(redeem(foreign.id, 1));
      expect(spend).toBeInstanceOf(NotFoundException);
      expect(
        await db.rewardsPointTransaction.count({
          where: { customer_id: foreign.id },
        }),
      ).toBe(0);
    });
  });

  it('[BE-RWD-006] an adjustment that would overdraw the balance is refused', async () => {
    const c = await customer();
    await settings();
    await grant(c.id, 30);
    const error = await failure(grant(c.id, -31));
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toMatch(/Insufficient points balance/);
    expect(await balance(c.id)).toBe(30);
  });

  it('[BE-RWD-005] {RewardsService.processCreditRefund} {RewardsService.validateCreditPayment} a credit payment followed by its refund returns the balance to where it started', async () => {
    const c = await customer();
    await settings();
    await grant(c.id, 500);
    const sale = await (async () => {
      const v = await w.stock({ price: 100, batches: [{ qty: 5, cost: 10 }] });
      return w.sell([{ variant: v, qty: 1 }], {
        customer_id: c.id,
        payments: [{ payment_method: PaymentMethod.CREDIT, amount: 100 }],
      });
    })();
    expect(await balance(c.id)).toBe(400);
    await rewards.processCreditRefund(cid(), c.id, 100, sale.id);
    expect(await balance(c.id)).toBe(500);
    expect(
      (await rewards.validateCreditPayment(cid(), c.id, 501)).isValid,
    ).toBe(false);
    expect(
      (await rewards.validateCreditPayment(cid(), c.id, 500)).isValid,
    ).toBe(true);
  });

  describe('expiry', () => {
    const earnAt = async (
      customerId: number,
      saleId: number,
      amount: number,
      expiredDaysAgo: number,
    ) => {
      const tx = await rewards.earnPoints(cid(), customerId, saleId, amount);
      await db.rewardsPointTransaction.update({
        where: { id: tx!.id },
        data: {
          expiry_date: new Date(Date.now() - expiredDaysAgo * 86_400_000),
        },
      });
      return tx!;
    };

    it('[BE-RWD-004] {RewardsService.expirePoints} expired earnings are taken off the balance once', async () => {
      const c = await customer();
      await settings({ points_expire_days: 30 });
      await earnAt(c.id, 1, 100, 1);
      expect(await rewards.expirePoints(cid())).toEqual({ expired: 100 });
      expect(await balance(c.id)).toBe(0);
      expect(await rewards.expirePoints(cid())).toEqual({ expired: 0 });
      expect(
        await db.rewardsPointTransaction.count({ where: { type: 'EXPIRE' } }),
      ).toBe(1);
    });

    it('[BE-RWD-009] {RewardsService.earnPoints} {RewardsService.expirePoints} a later earning expires on a later run even after an earlier one expired', async () => {
      const c = await customer();
      await settings({ points_expire_days: 30 });
      const first = await earnAt(c.id, 1, 100, 10);
      const second = await rewards.earnPoints(
        cid(),
        c.id,
        await realSaleId(),
        40,
      );
      await rewards.expirePoints(cid());
      expect(await balance(c.id)).toBe(40);
      await db.rewardsPointTransaction.update({
        where: { id: second!.id },
        data: { expiry_date: new Date(Date.now() - 86_400_000) },
      });
      expect(await rewards.expirePoints(cid())).toEqual({ expired: 40 });
      expect(await balance(c.id)).toBe(0);
      void first;
    });

    it('[BE-RWD-010] {RewardsService.redeemPoints} {RewardsService.expirePoints} points already spent are not expired twice', async () => {
      const c = await customer();
      await settings({ points_expire_days: 30 });
      await earnAt(c.id, 1, 100, 1);
      await rewards.redeemPoints(
        cid(),
        { customer_id: c.id, points: 80 },
        uid(),
      );
      const result = await rewards.expirePoints(cid());
      expect(result).toEqual({ expired: 20 });
      expect(await balance(c.id)).toBe(0);
    });
  });

  it('[BE-RWD-007] two concurrent credit sales cannot both spend the same points', async () => {
    const c = await customer();
    await settings();
    await grant(c.id, 10000);
    const v = await w.stock({ price: 8000, batches: [{ qty: 5, cost: 10 }] });
    const sell = () =>
      w.sell([{ variant: v, qty: 1 }], {
        customer_id: c.id,
        payments: [{ payment_method: PaymentMethod.CREDIT, amount: 8000 }],
      });
    const results = await Promise.allSettled([sell(), sell()]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await balance(c.id)).toBe(2000);
    expect(
      await db.rewardsPointTransaction.count({ where: { type: 'REDEEM' } }),
    ).toBe(1);
  });
});
