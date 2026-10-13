import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RewardsService } from '../../src/consumer/rewards/services/rewards.service';
import { ConsumerDataImportService } from '../../src/admin/consumer/services/consumer-data-import.service';
import {
  ConsumerImportSection,
  ConsumerImportDuplicateStrategy,
} from '../../src/admin/consumer/dto/consumer-data-import.dto';
import {
  createCustomer,
  createRewardsSettings,
  createTenant,
} from '../factories';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';

describe('credit rewards and import history subjects', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  beforeAll(async () => {
    boot = await bootDomain();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  const cid = () => w.tenant.consumer.id;

  it('[BE-RWD-100] {RewardsService.processCreditPayment} (cross-tenant) rounds redeemed points upward, persists the ledger and rejects foreign customers and insufficient balances', async () => {
    const rewards = boot.get(RewardsService);
    await createRewardsSettings(db, {
      consumer_id: cid(),
      redemption_value: 2,
      minimum_redemption: 1,
    });
    const customer = await createCustomer(db, { consumer_id: cid() });
    await rewards.adjustPoints(
      cid(),
      { customer_id: customer.id, points: 100, description: 'Initial points' },
      w.tenant.adminUser.id,
    );
    const variant = await w.stock({
      price: 100,
      batches: [{ qty: 10, cost: 40 }],
    });
    const sale = await w.sell([{ variant, qty: 1 }]);
    const result = await rewards.processCreditPayment(
      cid(),
      customer.id,
      21,
      sale.id,
      'CREDIT-PROOF',
    );
    expect(result).toMatchObject({
      type: 'REDEEM',
      points: -11,
      customer_id: customer.id,
      sale_id: sale.id,
      reference: 'CREDIT-PROOF',
    });
    expect(
      await db.rewardsPointTransaction.findUniqueOrThrow({
        where: { id: result.id },
      }),
    ).toMatchObject({
      points: -11,
      description: 'Redeemed 11 points for $21.00 credit',
    });
    expect(
      await db.customerRewardsPoints.findFirstOrThrow({
        where: { customer_id: customer.id },
      }),
    ).toMatchObject({ total_points: 89, lifetime_redeemed: 11 });
    const count = await db.rewardsPointTransaction.count();
    const otherCustomer = await createCustomer(db, {
      consumer_id: w.bystander.consumer.id,
    });
    await w.rebaseBystander();
    const foreign = await rewards
      .processCreditPayment(cid(), otherCustomer.id, 21, sale.id)
      .catch((e) => e);
    expect(foreign).toBeInstanceOf(NotFoundException);
    expect(foreign.getStatus()).toBe(404);
    expect(foreign.message).toBe('Customer not found');
    const tooMuch = await rewards
      .processCreditPayment(cid(), customer.id, 200, sale.id)
      .catch((e) => e);
    expect(tooMuch).toBeInstanceOf(BadRequestException);
    expect(tooMuch.getStatus()).toBe(400);
    expect(tooMuch.message).toBe(
      'Insufficient points. Maximum credit available: $178.00',
    );
    expect(await db.rewardsPointTransaction.count()).toBe(count);
    expect(
      await db.customerRewardsPoints.findFirstOrThrow({
        where: { customer_id: customer.id },
      }),
    ).toMatchObject({ total_points: 89 });
  });

  it('[BE-IMP-103] {ConsumerDataImportService.history} lists completed jobs newest first with source/target metadata and clamps requested limits', async () => {
    const destination = await createTenant(db);
    const service = boot.get(ConsumerDataImportService);
    const dto = {
      source_consumer_id: cid(),
      target_consumer_id: destination.consumer.id,
      sections: [ConsumerImportSection.CUSTOMERS],
      duplicate_strategy: ConsumerImportDuplicateStrategy.SKIP,
      confirm_target_subdomain: destination.consumer.subdomain,
    };
    const first = await service.run(dto);
    const second = await service.run(dto);
    await db.consumerDataImport.update({
      where: { id: first.id },
      data: { created_at: new Date('2026-03-15T10:00:00Z') },
    });
    await db.consumerDataImport.update({
      where: { id: second.id },
      data: { created_at: new Date('2026-03-16T10:00:00Z') },
    });
    expect((await service.history()).map((row) => row.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(await service.history(0)).toMatchObject([
      {
        id: second.id,
        status: 'COMPLETED',
        source: { id: cid() },
        target: { id: destination.consumer.id },
        requested_by: null,
      },
    ]);
    expect(await service.history(Number.NaN)).toHaveLength(2);
    expect(await service.history(1000)).toHaveLength(2);
    expect(await db.consumerDataImport.count()).toBe(2);
  });
});
