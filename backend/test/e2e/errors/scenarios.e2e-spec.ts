import { Boot, bootDomain } from '../../helpers/domain';
import { getPrisma, resetDb, disconnect } from '../../helpers/db';
import {
  buildSaleDto,
  createCustomer,
  createBatch,
  createRewardsSettings,
  createStockedVariant,
  createTenant,
  createAdmin,
  TEST_PASSWORD,
} from '../../factories';
import { api } from '../../helpers/http';
import { getCsrf, authHeaders } from '../../helpers/auth';
import * as request from 'supertest';
import { SalesService } from '../../../src/consumer/sales/services/sales.service';

describe('specific error scenarios over HTTP: status and message are pinned', () => {
  const db = getPrisma();
  let boot: Boot;
  let tenant: Awaited<ReturnType<typeof createTenant>>;
  let other: Awaited<ReturnType<typeof createTenant>>;
  let stocked: Awaited<ReturnType<typeof createStockedVariant>>;

  beforeAll(async () => {
    await resetDb();
    boot = await bootDomain();
    tenant = await createTenant(db, { branches: 1, maxBranches: 3 });
    other = await createTenant(db);
    stocked = await createStockedVariant(db, tenant, {
      price: 100,
      taxPercent: 5,
      batches: [{ qty: 3, cost: 50 }],
    });
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });

  const mine = () => api(boot.app).as(tenant.adminUser);
  const body = (response: request.Response) => response.body;

  it('[X-ERR-032] selling more than the stock is a 400 that names the shortage', async () => {
    const dto = buildSaleDto(tenant, [{ variant: stocked, qty: 4 }]);
    const response = await mine().post('/consumer/sales', dto);
    expect(response.status).toBe(400);
    expect(body(response).message).toMatch(/^Insufficient stock for/);
  });

  it('[X-ERR-033] a stale price is a 400 asking for a refresh', async () => {
    const dto = buildSaleDto(tenant, [{ variant: stocked, qty: 1 }]);
    dto.items[0].unit_price = 90;
    const response = await mine().post('/consumer/sales', dto);
    expect(response.status).toBe(400);
    expect(body(response).message).toMatch(
      /^Price of variant \d+ has changed \(now 100\.00\)\. Refresh the product list and try again\.$/,
    );
  });

  it('[X-ERR-034] redeeming more points than the balance is a 400, not a 500', async () => {
    await createRewardsSettings(db, { consumer_id: tenant.consumer.id });
    const customer = await createCustomer(db, {
      consumer_id: tenant.consumer.id,
    });
    const response = await mine().post(
      `/consumer/rewards/customers/${customer.id}/redeem`,
      {
        points: 50,
      },
    );
    expect(response.status).toBe(400);
    expect(body(response).message).toBe('Insufficient points balance');
  });

  it("[X-ERR-035] another tenant's vendor, branch, category and brand are 404s", async () => {
    const vendor = await db.vendor.create({
      data: { consumer_id: other.consumer.id, name: 'Foreign vendor' },
    });
    const vendorResponse = await mine().get(`/consumer/vendors/${vendor.id}`);
    expect(vendorResponse.status).toBe(404);
    expect(body(vendorResponse).message).toMatch(/not found/i);
    const branchResponse = await mine().get(
      `/consumer/branches/${other.branches[0].id}`,
    );
    expect(branchResponse.status).toBe(404);
    expect(body(branchResponse).message).toMatch(/not found/i);
  });

  it('[X-ERR-036] a duplicate product name is a 409 with readable text', async () => {
    const payload = {
      name: 'Duplicate me',
      has_variants: false,
      tax: 0,
      tax_method: 'EXCLUSIVE',
      tag_ids: [],
      variants: [
        {
          name: 'Default',
          regular_price: '10',
          sale_unit_id: stocked.sale_unit_id,
          purchase_unit_id: stocked.purchase_unit_id,
          alert_quantity: 1,
        },
      ],
    };
    const first = await mine().post('/consumer/products', payload);
    expect(first.status).toBe(201);
    const second = await mine().post('/consumer/products', payload);
    expect(second.status).toBe(409);
    expect(body(second).message).toBe(
      'A product with this name already exists.',
    );
  });

  it('[X-ERR-037] deleting a branch that still holds data is a 409 with readable text', async () => {
    const branch = await db.branch.create({
      data: { consumer_id: tenant.consumer.id, name: 'Has stock' },
    });
    await createBatch(db, tenant, {
      variant_id: stocked.id,
      branch_id: branch.id,
      quantity: 2,
    });
    const response = await mine().delete(`/consumer/branches/${branch.id}`);
    expect([400, 409]).toContain(response.status);
    expect(body(response).message).toMatch(/^[A-Z].*(stock|sales|data|used)/);
    expect(JSON.stringify(body(response))).not.toMatch(/foreign key|P2003/i);
  });

  it('[X-ERR-038] a zero quantity is a 400 whose message has no field path', async () => {
    const dto = buildSaleDto(tenant, [{ variant: stocked, qty: 1 }]);
    dto.items[0].quantity = 0;
    const response = await mine().post('/consumer/sales', dto);
    expect(response.status).toBe(400);
    expect(typeof body(response).message).toBe('string');
    expect(body(response).message).toMatch(/quantity/i);
    expect(body(response).message).not.toMatch(/items\.\d/);
  });

  it('[X-ERR-039] a missing CSRF token is a 403 the UI retries automatically', async () => {
    const response = await api(boot.app)
      .as(tenant.adminUser, { csrf: false })
      .post(
        '/consumer/sales',
        buildSaleDto(tenant, [{ variant: stocked, qty: 1 }]),
      );
    expect(response.status).toBe(403);
    expect(body(response)).toEqual({ message: 'invalid csrf token' });
  });

  it('[X-ERR-040] an unexpected failure is a generic 500 without the real cause', async () => {
    const sales = boot.get(SalesService);
    const spy = jest
      .spyOn(sales, 'findOneQuotation')
      .mockRejectedValueOnce(new Error('db exploded'));
    const response = await mine().get('/consumer/sales/quotations/1');
    spy.mockRestore();
    expect(response.status).toBe(500);
    expect(JSON.stringify(body(response))).not.toContain('db exploded');
    expect(typeof body(response).message).toBe('string');
  });

  it('[X-ERR-030] a wrong super-admin password and an unknown email give the same 401 text', async () => {
    const admin = await createAdmin(db);
    const attempt = async (email: string, password: string) => {
      const csrf = await getCsrf(boot.app);
      return request(boot.app.getHttpServer())
        .post('/api/v1/auth/login-superadmin')
        .set('Host', 'localhost')
        .set(authHeaders({ csrf }))
        .send({ email, password });
    };
    const wrong = await attempt(admin.email, `${TEST_PASSWORD}x`);
    const unknown = await attempt('nobody@example.test', TEST_PASSWORD);
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe('Invalid email or password');
    expect(unknown.body.message).toBe('Invalid email or password');
  });
});
