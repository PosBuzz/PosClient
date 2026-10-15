import { Boot, bootDomain } from '../../helpers/domain';
import { getPrisma, resetDb, disconnect } from '../../helpers/db';
import { snapshotTenant } from '../../helpers/invariants';
import { api } from '../../helpers/http';
import { LEAK, SeededTenant, seedTenant } from './seed';
import { BODY_CASES } from './body-foreign-ids';

describe('tenant isolation: ids inside request bodies', () => {
  const db = getPrisma();
  let boot: Boot;
  let a: SeededTenant;
  let b: SeededTenant;
  let counter = 0;

  beforeAll(async () => {
    await resetDb();
    boot = await bootDomain();
    a = await seedTenant(db, boot, 'AAAAAA');
    b = await seedTenant(db, boot, LEAK);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });

  const send = (method: 'POST' | 'PATCH', path: string, body: object) => {
    const session = api(boot.app).as(a.tenant.adminUser);
    return method === 'POST'
      ? session.post(path, body)
      : session.patch(path, body);
  };

  describe.each(BODY_CASES.filter((c) => c.swaps.length > 0))('$name', (c) => {
    it('[BE-TEN-012] the plain request works (so a refusal below is about the foreign id)', async () => {
      if (c.skipControl) return; // A has no due sale / unpaid batch here; B3 covers the plain request
      const response = await send(c.method, c.path(a), c.valid(a, ++counter));
      expect({
        name: c.name,
        ok: response.status < 300,
        status: response.status,
        message: response.body?.message,
      }).toMatchObject({ ok: true });
    });

    it.each(c.swaps.map((s) => [s.field, s] as const))(
      '[BE-TEN-012] a foreign %s is never accepted and changes nothing',
      async (_field, swap) => {
        const before = await snapshotTenant(db, b.tenant.consumer.id);
        const response = await send(c.method, c.path(a), swap.body(a, b));
        const text = `${response.text ?? ''}${JSON.stringify(response.body ?? '')}`;
        const refused = response.status >= 400 && response.status < 500;
        expect({
          field: `${c.name} ${swap.field}`,
          status: response.status,
          refused,
        }).toMatchObject({ refused: true });
        expect(text).not.toContain(LEAK);
        expect(await snapshotTenant(db, b.tenant.consumer.id)).toBe(before);
      },
    );
  });

  it('[BE-ROB-005] extra properties in a body cannot move a record into another tenant', async () => {
    const before = await snapshotTenant(db, b.tenant.consumer.id);
    const sale = await api(boot.app)
      .as(a.tenant.adminUser)
      .post('/consumer/sales', {
        branch_id: a.ids.branch,
        consumer_id: b.tenant.consumer.id,
        items: [
          {
            variant_id: a.ids.variant,
            quantity: 1,
            unit_price: 100,
            sold_unit_price: 100,
            tax_amount: 5,
            line_total: 105,
          },
        ],
        payments: [{ payment_method: 'CASH', amount: 105 }],
      });
    expect(sale.status).toBeLessThan(300);
    expect(
      (await db.sale.findUniqueOrThrow({ where: { id: sale.body.id } }))
        .consumer_id,
    ).toBe(a.tenant.consumer.id);
    const customer = await api(boot.app)
      .as(a.tenant.adminUser)
      .post('/consumer/customers', {
        name: 'Mass',
        phone: '01733333399',
        customer_type: 'individual',
        consumer_id: b.tenant.consumer.id,
      });
    expect(customer.status).toBeLessThan(300);
    expect(
      (await db.customer.findUniqueOrThrow({ where: { id: customer.body.id } }))
        .consumer_id,
    ).toBe(a.tenant.consumer.id);
    const product = await api(boot.app)
      .as(a.tenant.adminUser)
      .post('/consumer/products', {
        name: 'Mass product',
        code: 'MP1',
        has_variants: false,
        consumer_id: b.tenant.consumer.id,
        variants: [
          {
            name: 'Default',
            regular_price: '10.00',
            sale_unit_id: a.ids.unit,
            purchase_unit_id: a.ids.unit,
          },
        ],
      });
    expect(product.status).toBeLessThan(300);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: product.body.id } }))
        .consumer_id,
    ).toBe(a.tenant.consumer.id);
    const user = await api(boot.app)
      .as(a.tenant.adminUser)
      .post('/consumer/users', {
        name: 'Mass User',
        email: 'mass@example.test',
        password: 'Passw0rd!x',
        role_id: a.ids.role,
        consumer_id: b.tenant.consumer.id,
      });
    expect(user.status).toBeLessThan(300);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.body.id } }))
        .consumer_id,
    ).toBe(a.tenant.consumer.id);
    expect(await snapshotTenant(db, b.tenant.consumer.id)).toBe(before);
  });

  it("[BE-TEN-014] a role cannot be given a permission outside the shop's plan", async () => {
    const outside = await db.permission.create({
      data: { action: 'outside_plan_permission' },
    });
    const create = await api(boot.app)
      .as(a.tenant.adminUser)
      .post('/consumer/users/roles', {
        name: 'Escalated',
        permission_ids: [outside.id],
      });
    expect(create.status).toBe(400);
    expect(create.body.message).toMatch(/not included in your plan/);
    const update = await api(boot.app)
      .as(a.tenant.adminUser)
      .patch(`/consumer/users/roles/${a.ids.role}`, {
        permission_ids: [outside.id],
      });
    expect(update.status).toBe(400);
    expect(
      await db.rolePermission.count({ where: { permission_id: outside.id } }),
    ).toBe(0);
  });
});
