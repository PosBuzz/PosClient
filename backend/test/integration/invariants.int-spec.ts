import { createTestApp } from '../helpers/app';
import { getPrisma, resetDb, disconnect } from '../helpers/db';
import {
  assertInvariants,
  findViolations,
  snapshotTenant,
} from '../helpers/invariants';
import { createTenant, createStockedVariant, buildSaleDto } from '../factories';
import { SalesService } from '../../src/consumer/sales/services/sales.service';
import { PaymentMethod } from '../../src/consumer/sales/dto/create-sale.dto';

describe('invariant net self-test', () => {
  const db = getPrisma();
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let sales: SalesService;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    sales = app.get(SalesService, { strict: false });
  });
  afterAll(async () => {
    await app.close();
    await disconnect();
  });

  async function scenario() {
    await resetDb();
    const tenant = await createTenant(db);
    const bystander = await createTenant(db);
    const variant = await createStockedVariant(db, tenant, {
      price: 100,
      taxPercent: 5,
      batches: [{ qty: 10, cost: 40 }],
    });
    const other = await createStockedVariant(db, bystander, {
      price: 50,
      batches: [{ qty: 5, cost: 20 }],
    });
    const sell = async (t: typeof tenant, v: typeof variant, qty: number) => {
      const dto = buildSaleDto(t, [{ variant: v, qty }]);
      const total = dto.items.reduce((s, i) => s + Number(i.line_total), 0);
      dto.payments = [{ payment_method: PaymentMethod.CASH, amount: total }];
      return sales.create(dto, t.consumer.id, t.adminUser.id) as Promise<any>;
    };
    const sale = await sell(tenant, variant, 2);
    await sell(bystander, other, 1);
    return { tenant, bystander, variant, sale };
  }

  it('[BE-NET-001] a clean scenario has no violations', async () => {
    const { bystander } = await scenario();
    const before = await snapshotTenant(db, bystander.consumer.id);
    await assertInvariants(db, { consumerId: bystander.consumer.id, before });
  });

  it('[BE-NET-002] a batch quantity edited without an audit row is reported (INV-01)', async () => {
    const { variant } = await scenario();
    await db.$executeRawUnsafe(
      `UPDATE inventory_batches SET quantity = quantity + 1 WHERE variant_id = ${variant.id}`,
    );
    const ids = (await findViolations(db)).map((v) => v.id);
    expect(ids).toEqual(expect.arrayContaining(['INV-01', 'INV-04']));
  });

  it('[BE-NET-003] a broken sale total is reported (INV-05)', async () => {
    const { sale } = await scenario();
    await db.$executeRawUnsafe(
      `UPDATE sales SET total_amount = total_amount + 5 WHERE id = ${sale.id}`,
    );
    const violations = await findViolations(db);
    expect(violations.some((v) => v.id === 'INV-05')).toBe(true);
    expect(violations.some((v) => v.id === 'INV-08')).toBe(true);
  });

  it('[BE-NET-004] a change to the bystander tenant is reported (INV-13)', async () => {
    const { bystander } = await scenario();
    const before = await snapshotTenant(db, bystander.consumer.id);
    await db.$executeRawUnsafe(
      `UPDATE customers SET name = 'tampered' WHERE consumer_id = ${bystander.consumer.id}`,
    );
    await db.customer.create({
      data: {
        consumer_id: bystander.consumer.id,
        name: 'Leaked',
        phone: '01700000000',
        customer_type: 'regular',
      },
    });
    await expect(
      assertInvariants(db, { consumerId: bystander.consumer.id, before }),
    ).rejects.toThrow(/INV-13/);
  });

  it('[BE-NET-005] a negative or over-reserved batch is reported (INV-02/03)', async () => {
    const { variant } = await scenario();
    await db.$executeRawUnsafe(
      `UPDATE inventory_batches SET reserved_quantity = quantity + 1 WHERE variant_id = ${variant.id}`,
    );
    expect((await findViolations(db)).some((v) => v.id === 'INV-03')).toBe(
      true,
    );
  });

  it('[BE-NET-006] a rewards balance that disagrees with its ledger is reported (INV-11)', async () => {
    const { tenant } = await scenario();
    const customer = await db.customer.create({
      data: {
        consumer_id: tenant.consumer.id,
        name: 'Loyal',
        phone: '01711111111',
        customer_type: 'regular',
      },
    });
    await db.customerRewardsPoints.create({
      data: {
        customer_id: customer.id,
        consumer_id: tenant.consumer.id,
        total_points: 50,
      },
    });
    await db.rewardsPointTransaction.create({
      data: {
        customer_id: customer.id,
        consumer_id: tenant.consumer.id,
        type: 'EARN',
        points: 40,
        balance_before: 0,
        balance_after: 40,
      },
    });
    expect((await findViolations(db)).some((v) => v.id === 'INV-11')).toBe(
      true,
    );
  });
});
