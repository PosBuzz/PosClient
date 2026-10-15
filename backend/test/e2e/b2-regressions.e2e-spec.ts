import { createTestApp } from '../helpers/app';
import { getPrisma, resetDb, disconnect } from '../helpers/db';
import { createTenant, createUnit } from '../factories';
import { api } from '../helpers/http';
import { SalesService } from '../../src/consumer/sales/services/sales.service';

describe('B2 runtime regression checks', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>;
  const db = getPrisma();
  beforeAll(async () => {
    context = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await context?.app.close();
    await disconnect();
  });
  it('[BE-DTO-010] empty sale is rejected through HTTP and direct service without writing rows', async () => {
    const tenant = await createTenant(db);
    const dto = { branch_id: tenant.branches[0].id, items: [] };
    const response = await api(context.app)
      .as(tenant.adminUser)
      .post('/consumer/sales', dto);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: 'A sale must contain at least one item.',
    });
    await expect(
      context.app
        .get(SalesService)
        .create(dto, tenant.consumer.id, tenant.adminUser.id),
    ).rejects.toThrow('A sale must contain at least one item');
    expect(await db.sale.count()).toBe(0);
    expect(await db.saleItem.count()).toBe(0);
    expect(await db.salePayment.count()).toBe(0);
    expect(await db.inventoryAuditLog.count()).toBe(0);
  });
  it('[BE-PEF-009] real duplicate product returns a specific safe Prisma-filter message', async () => {
    const tenant = await createTenant(db);
    const unit = await createUnit(db, { consumer_id: tenant.consumer.id });
    const dto = {
      name: 'Duplicate product',
      has_variants: false,
      variants: [
        {
          name: 'Default',
          regular_price: '100.00',
          sale_unit_id: unit.id,
          purchase_unit_id: unit.id,
        },
      ],
    };
    expect(
      (
        await api(context.app)
          .as(tenant.adminUser)
          .post('/consumer/products', dto)
      ).status,
    ).toBe(201);
    const response = await api(context.app)
      .as(tenant.adminUser)
      .post('/consumer/products', dto);
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      statusCode: 409,
      message: 'A product with this name already exists.',
    });
    expect(
      await db.product.count({ where: { consumer_id: tenant.consumer.id } }),
    ).toBe(1);
  });
});
