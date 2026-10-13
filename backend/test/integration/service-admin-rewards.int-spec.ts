import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import {
  createAdmin,
  createCustomer,
  createPromotion,
  createRewardsSettings,
  createTenant,
} from '../factories';
import { PlanService } from '../../src/admin/plan/services/plan.service';
import { ConsumerService } from '../../src/admin/consumer/services/consumer.service';
import { BranchService } from '../../src/consumer/branch/services/branch.service';
import { RewardsService } from '../../src/consumer/rewards/services/rewards.service';
import { PromotionsService } from '../../src/consumer/promotions/services/promotions.service';

describe('plans, consumers, branches, rewards and promotion evaluation', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let plans: PlanService;
  let consumers: ConsumerService;
  let branches: BranchService;
  let rewards: RewardsService;
  let promotions: PromotionsService;

  beforeAll(async () => {
    boot = await bootDomain();
    plans = boot.get(PlanService);
    consumers = boot.get(ConsumerService);
    branches = boot.get(BranchService);
    rewards = boot.get(RewardsService);
    promotions = boot.get(PromotionsService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());

  const cid = () => w.tenant.consumer.id;
  const uid = () => w.tenant.adminUser.id;
  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );

  it('[BE-ADM-040] {PlanService.create} {PlanService.findAll} {PlanService.findOne} {PlanService.findAllPermissions} {PlanService.remove} a plan is created with its permissions, listed, read back and removed', async () => {
    await createAdmin(db);
    const permissions: any[] = (await plans.findAllPermissions()) as any[];
    expect(permissions.length).toBeGreaterThan(5);
    const chosen = permissions.slice(0, 3).map((p) => p.id);
    const created: any = await plans.create({
      name: 'Gold',
      price: 500,
      max_products: 100,
      permission_ids: chosen,
    });
    const one: any = await plans.findOne(created.id);
    expect(one.name).toBe('Gold');
    expect(one.max_products).toBe(100);
    expect(one.permissions.map((p: any) => p.permission_id).sort()).toEqual(
      [...chosen].sort(),
    );
    const list: any[] = (await plans.findAll()) as any[];
    expect(list.map((p) => p.id)).toContain(created.id);
    expect(await plans.remove(created.id)).toEqual({ success: true });
    const gone = await failure(plans.findOne(created.id));
    expect(gone.getStatus()).toBe(404);
    expect(gone.message).toBe('Plan not found');
  });

  it('[BE-ADM-041] {PlanService.remove} a plan that a consumer uses cannot be removed', async () => {
    const error = await failure(plans.remove(w.tenant.consumer.plan_id));
    expect(error).not.toBeNull();
    expect(
      await db.plan.count({ where: { id: w.tenant.consumer.plan_id } }),
    ).toBe(1);
  });

  it('[BE-ADM-042] {ConsumerService.findAll} {ConsumerService.update} consumers are searched by name and a rename is stored', async () => {
    const found: any[] = (await consumers.findAll({
      search: w.tenant.consumer.company_name,
    })) as any[];
    expect(found.map((c) => c.id)).toEqual([w.tenant.consumer.id]);
    const none: any[] = (await consumers.findAll({
      search: 'no such company anywhere',
    })) as any[];
    expect(none).toEqual([]);
    await consumers.update(cid(), { company_name: 'Renamed Shop' });
    expect(
      (await db.consumer.findUniqueOrThrow({ where: { id: cid() } }))
        .company_name,
    ).toBe('Renamed Shop');
    expect(
      await failure(consumers.update(999999, { company_name: 'X' } as any)),
    ).toBeInstanceOf(NotFoundException);
  });

  it('[BE-ADM-043] {BranchService.create} {BranchService.getBranchOptions} branches stop at the consumer limit and the options list only the tenant', async () => {
    const own = await createTenant(db, { branches: 1, maxBranches: 2 });
    const second: any = await branches.create(
      { name: 'Second' },
      own.consumer.id,
    );
    expect(second.name).toBe('Second');
    const error = await failure(
      branches.create({ name: 'Third' }, own.consumer.id),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toMatch(/Branch limit reached/);
    const options: any[] = (await branches.getBranchOptions(
      own.consumer.id,
    )) as any[];
    expect(options.map((o) => o.name).sort()).toEqual(
      ['Branch 1', 'Second'].sort(),
    );
    expect(options.filter((o) => o.is_main)).toHaveLength(1);
  });

  describe('rewards', () => {
    const customer = () => createCustomer(db, { consumer_id: cid() });

    it('[BE-RWD-020] {RewardsService.getSettings} {RewardsService.createOrUpdateSettings} defaults apply until settings are saved, and saving twice updates one row', async () => {
      const defaults: any = await rewards.getSettings(cid());
      expect(defaults.is_enabled).toBe(true);
      expect(defaults.minimum_redemption).toBe(100);
      await rewards.createOrUpdateSettings(cid(), {
        points_per_currency: 2,
        redemption_value: 0.5,
        minimum_redemption: 10,
      } as any);
      await rewards.createOrUpdateSettings(cid(), {
        minimum_redemption: 20,
      } as any);
      const saved: any = await rewards.getSettings(cid());
      expect(Number(saved.points_per_currency)).toBe(2);
      expect(Number(saved.redemption_value)).toBe(0.5);
      expect(saved.minimum_redemption).toBe(20);
      expect(
        await db.rewardsSettings.count({ where: { consumer_id: cid() } }),
      ).toBe(1);
    });

    it('[BE-RWD-021] {RewardsService.adjustPoints} {RewardsService.getCustomerPoints} {RewardsService.getCustomersWithPoints} {RewardsService.getPointTransactions} adjustments change the balance and appear in the ledger, listings and only for the tenant', async () => {
      await createRewardsSettings(db, { consumer_id: cid() });
      const c = await customer();
      await rewards.adjustPoints(
        cid(),
        { customer_id: c.id, points: 120, description: 'welcome' },
        uid(),
      );
      await rewards.adjustPoints(
        cid(),
        { customer_id: c.id, points: -20, description: 'correction' },
        uid(),
      );
      const points: any = await rewards.getCustomerPoints(cid(), c.id);
      expect(points.total_points).toBe(100);
      const listed: any = await rewards.getCustomersWithPoints(cid(), {});
      expect(
        listed.data.map((row: any) => row.id ?? row.customer_id),
      ).toContain(c.id);
      const ledger: any = await rewards.getPointTransactions(cid(), {
        customer_id: c.id,
      });
      expect(
        ledger.data
          .map((t: any) => t.points)
          .sort((a: number, b: number) => a - b),
      ).toEqual([-20, 120]);
      expect(
        await failure(rewards.getCustomerPoints(w.bystander.consumer.id, c.id)),
      ).toBeInstanceOf(NotFoundException);
      expect(
        await failure(
          rewards.getPointTransactions(w.bystander.consumer.id, {
            customer_id: c.id,
          } as any),
        ),
      ).toBeInstanceOf(NotFoundException);
    });

    it('[BE-RWD-022] {RewardsService.canRedeemPoints} redemption is allowed only within the balance and the settings', async () => {
      await createRewardsSettings(db, {
        consumer_id: cid(),
        minimum_redemption: 10,
        redemption_value: 1,
      });
      const c = await customer();
      await rewards.adjustPoints(
        cid(),
        { customer_id: c.id, points: 50, description: 'seed' },
        uid(),
      );
      expect((await rewards.canRedeemPoints(cid(), c.id, 30)).canRedeem).toBe(
        true,
      );
      const tooMany = await rewards.canRedeemPoints(cid(), c.id, 80);
      expect(tooMany.canRedeem).toBe(false);
      expect(tooMany.reason).toBeTruthy();
      const tooFew = await rewards.canRedeemPoints(cid(), c.id, 5);
      expect(tooFew.canRedeem).toBe(false);
    });
  });

  it('[BE-PRM-020] {PromotionsService.assertAndCalculateDiscount} a matching cart gets the promotion discount and a non-matching cart is refused with the reason', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    const promo = await createPromotion(db, w.tenant, {
      variants: [v.id],
      overrides: { scope: 'SINGLE_PRODUCT', discount_value: 10 },
    });
    const branch = w.tenant.branches[0].id;
    const items = [
      { variant_id: v.id, quantity: 2, unit_price: 100, line_total: 200 },
    ];
    const evaluation: any = await promotions.assertAndCalculateDiscount(
      promo.id,
      cid(),
      branch,
      undefined,
      items,
    );
    expect(evaluation.is_eligible).toBe(true);
    expect(Number(evaluation.discount_amount)).toBe(20);
    const refused = await failure(
      promotions.assertAndCalculateDiscount(
        promo.id,
        cid(),
        branch,
        undefined,
        [{ variant_id: 999999, quantity: 1, unit_price: 10, line_total: 10 }],
      ),
    );
    expect(refused).toBeInstanceOf(BadRequestException);
    expect(refused.message).toMatch(/^[A-Z]/);
  });
});
