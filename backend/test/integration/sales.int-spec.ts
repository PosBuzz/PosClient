import { BadRequestException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import {
  Boot,
  World,
  batchOf,
  bootDomain,
  newWorld,
  saleDto,
} from '../helpers/domain';
import {
  createCustomer,
  createPromotion,
  createRewardsSettings,
} from '../factories';
import { SalesService } from '../../src/consumer/sales/services/sales.service';
import { RewardsService } from '../../src/consumer/rewards/services/rewards.service';
import { PaymentMethod } from '../../src/consumer/sales/dto/create-sale.dto';

describe('sales: create', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let sales: SalesService;
  let rewards: RewardsService;

  beforeAll(async () => {
    boot = await bootDomain();
    sales = boot.get(SalesService);
    rewards = boot.get(RewardsService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());

  const create = (dto: any, tenant = w.tenant) =>
    sales.create(dto, tenant.consumer.id, tenant.adminUser.id) as Promise<any>;
  const rejects = async (promise: Promise<unknown>, message: RegExp) => {
    const error: any = await promise.then(
      () => null,
      (e) => e,
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toMatch(message);
  };
  const salesCount = () =>
    db.sale.count({ where: { consumer_id: w.tenant.consumer.id } });

  it('[BE-SALE-001] a fully paid cash sale records payment and one SALE_OUT audit row', async () => {
    const v = await w.stock({
      price: 100,
      taxPercent: 5,
      batches: [{ qty: 10, cost: 40 }],
    });
    const sale = await w.sell([{ variant: v, qty: 3 }]);
    expect(sale.payment_status).toBe('paid');
    expect(Number(sale.received_amount)).toBe(Number(sale.total_amount));
    const batch = await batchOf(
      db,
      v.id === 0
        ? 0
        : (
            await db.inventoryBatch.findFirstOrThrow({
              where: { variant_id: v.id },
            })
          ).id,
    );
    expect(batch.quantity).toBe(7);
    const audits = await db.inventoryAuditLog.findMany({
      where: { variant_id: v.id, event_type: 'SALE_OUT' },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      quantity_delta: -3,
      quantity_after: 7,
      reference_type: 'sale_items',
    });
  });

  it('[BE-SALE-002] FIFO takes the oldest batch first', async () => {
    const v = await w.stock({
      price: 100,
      batches: [
        { qty: 5, cost: 40, createdAt: new Date('2026-03-02T10:00:00Z') },
        { qty: 2, cost: 40, createdAt: new Date('2026-03-01T10:00:00Z') },
      ],
    });
    await w.sell([{ variant: v, qty: 2 }]);
    const batches = await db.inventoryBatch.findMany({
      where: { variant_id: v.id },
      orderBy: { created_at: 'asc' },
    });
    expect(batches.map((b) => b.quantity)).toEqual([0, 5]);
  });

  it('[BE-SALE-003] FIFO skips a batch whose free quantity is zero', async () => {
    const v = await w.stock({
      price: 100,
      batches: [
        { qty: 3, cost: 40, createdAt: new Date('2026-03-01T10:00:00Z') },
        { qty: 5, cost: 40, createdAt: new Date('2026-03-02T10:00:00Z') },
      ],
    });
    const [oldest, newest] = await db.inventoryBatch.findMany({
      where: { variant_id: v.id },
      orderBy: { created_at: 'asc' },
    });
    await db.inventoryBatch.update({
      where: { id: oldest.id },
      data: { reserved_quantity: 3 },
    });
    await w.sell([{ variant: v, qty: 1 }]);
    expect((await batchOf(db, oldest.id)).quantity).toBe(3);
    expect((await batchOf(db, newest.id)).quantity).toBe(4);
  });

  it('[BE-SALE-004] an explicit batch is used even when it is not the oldest', async () => {
    const v = await w.stock({
      price: 100,
      batches: [
        { qty: 3, cost: 40, createdAt: new Date('2026-03-01T10:00:00Z') },
        { qty: 5, cost: 40, createdAt: new Date('2026-03-02T10:00:00Z') },
      ],
    });
    const [oldest, newest] = await db.inventoryBatch.findMany({
      where: { variant_id: v.id },
      orderBy: { created_at: 'asc' },
    });
    await w.sell([{ variant: v, qty: 2, batchId: newest.id }]);
    expect((await batchOf(db, oldest.id)).quantity).toBe(3);
    expect((await batchOf(db, newest.id)).quantity).toBe(3);
  });

  it('[BE-SALE-005] a sale never splits across batches (characterization: confirm intent)', async () => {
    const v = await w.stock({
      price: 100,
      batches: [
        { qty: 2, cost: 40, createdAt: new Date('2026-03-01T10:00:00Z') },
        { qty: 3, cost: 40, createdAt: new Date('2026-03-02T10:00:00Z') },
      ],
    });
    await rejects(w.sell([{ variant: v, qty: 4 }]), /Insufficient stock/);
    expect(await salesCount()).toBe(0);
  });

  it("[BE-SALE-006] another tenant's variant is refused and nothing is written", async () => {
    await rejects(
      create(saleDto(w.tenant, [{ variant: w.theirs, qty: 1 }])),
      /Product variant .* not found/,
    );
    expect(await salesCount()).toBe(0);
  });

  it("[BE-SALE-007] another tenant's branch is refused", async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 5, cost: 40 }] });
    const dto = saleDto(w.tenant, [{ variant: v, qty: 1 }]);
    dto.branch_id = w.bystander.branches[0].id;
    await rejects(create(dto), /Branch not found or not accessible/);
  });

  it("[BE-SALE-008] another tenant's customer or served-by user is refused", async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 5, cost: 40 }] });
    const foreign = await createCustomer(db, {
      consumer_id: w.bystander.consumer.id,
    });
    await w.rebaseBystander();
    await rejects(
      w.sell([{ variant: v, qty: 1 }], { customer_id: foreign.id }),
      /Customer not found or not accessible/,
    );
    await rejects(
      w.sell([{ variant: v, qty: 1 }], {
        served_by_id: w.bystander.adminUser.id,
      }),
      /Served by user not found or not accessible/,
    );
    expect(await salesCount()).toBe(0);
  });

  it('[BE-SALE-009] no payments means due with nothing received', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 5, cost: 40 }] });
    const sale = await w.sell([{ variant: v, qty: 1 }], {}, null);
    expect(sale.payment_status).toBe('due');
    expect(Number(sale.received_amount)).toBe(0);
  });

  it('[BE-SALE-010] a partial payment is recorded as partial', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 5, cost: 40 }] });
    const sale = await w.sell([{ variant: v, qty: 1 }], {}, 40);
    expect(sale.payment_status).toBe('partial');
    expect(Number(sale.received_amount)).toBe(40);
  });

  it('[BE-SALE-011] split payments create one row each and add up', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 5, cost: 40 }] });
    const sale = await w.sell([{ variant: v, qty: 1 }], {
      payments: [
        { payment_method: PaymentMethod.CASH, amount: 60 },
        {
          payment_method: PaymentMethod.MFS,
          payment_type: 'BRAC_BANK_LIMITED',
          amount: 40,
        } as any,
      ],
    });
    const rows = await db.salePayment.findMany({ where: { sale_id: sale.id } });
    expect(rows).toHaveLength(2);
    expect(Number(sale.received_amount)).toBe(100);
    expect(sale.payment_status).toBe('paid');
  });

  it('[BE-SALE-012] mixed tax, special and average discounts and shipping store the POS totals', async () => {
    const a = await w.stock({
      price: 100,
      taxPercent: 5,
      batches: [{ qty: 10, cost: 40 }],
    });
    const b = await w.stock({
      price: 115,
      taxPercent: 15,
      taxMethod: 'INCLUSIVE',
      batches: [{ qty: 10, cost: 40 }],
    });
    // A: 2 x 100 + 5% = 210 (tax 10), special 20 -> 190.  B: 115 inclusive (tax 15), average 10 -> 105.
    // subtotal (190+20-10)+(105+10-15)=300; tax 25; discount 30; shipping 60; total 300-30+25+60=355
    const sale = await w.sell(
      [
        { variant: a, qty: 2, specialDiscount: 20 },
        { variant: b, qty: 1, averageDiscount: 10 },
      ],
      { shipping_cost: 60 },
    );
    expect({
      subtotal: Number(sale.subtotal),
      tax: Number(sale.tax_amount),
      discount: Number(sale.discount_amount),
      shipping: Number(sale.shipping_cost),
      total: Number(sale.total_amount),
    }).toEqual({
      subtotal: 300,
      tax: 25,
      discount: 30,
      shipping: 60,
      total: 355,
    });
    expect(sale.payment_status).toBe('paid');
  });

  it('[BE-SALE-013] a quotation does not touch stock, ignores availability and has a QUO number', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 1, cost: 40 }] });
    const q = await create(
      saleDto(
        w.tenant,
        [{ variant: v, qty: 5 }],
        { sale_type: 'quotation' as any },
        null,
      ),
    );
    expect(q.sale_number).toMatch(/^QUO-\d{8}-0001$/);
    const batch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: v.id },
    });
    expect(batch.quantity).toBe(1);
    expect(
      await db.inventoryAuditLog.count({
        where: { variant_id: v.id, event_type: 'SALE_OUT' },
      }),
    ).toBe(0);
  });

  it('[BE-SALE-014] creating a sale from a quotation marks it converted, once', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    const q = await create(
      saleDto(
        w.tenant,
        [{ variant: v, qty: 2 }],
        { sale_type: 'quotation' as any },
        null,
      ),
    );
    const sale = await w.sell([{ variant: v, qty: 2 }], { quotation_id: q.id });
    const quotation = await db.sale.findUniqueOrThrow({ where: { id: q.id } });
    expect(quotation.converted_to_sale_id).toBe(sale.id);
    expect(quotation.converted_at).not.toBeNull();
    await rejects(
      w.sell([{ variant: v, qty: 2 }], { quotation_id: q.id }),
      /already been converted/,
    );
  });

  it('[BE-SALE-015] {SalesService.convertQuotationToSale} convertQuotationToSale deducts stock, leaves the sale due and converts only once', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    const q = await create(
      saleDto(
        w.tenant,
        [{ variant: v, qty: 2 }],
        { sale_type: 'quotation' as any },
        null,
      ),
    );
    const sale: any = await sales.convertQuotationToSale(
      q.id,
      w.tenant.consumer.id,
      w.tenant.adminUser.id,
    );
    expect(sale.payment_status).toBe('due');
    const batch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: v.id },
    });
    expect(batch.quantity).toBe(8);
    const quotation = await db.sale.findUniqueOrThrow({ where: { id: q.id } });
    expect(quotation.converted_to_sale_id).toBe(sale.id);
    await expect(
      sales.convertQuotationToSale(
        q.id,
        w.tenant.consumer.id,
        w.tenant.adminUser.id,
      ),
    ).rejects.toThrow(/already been converted/);
  });

  it('[BE-SALE-016] delivery-later reserves stock without moving quantity or auditing', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    const sale = await w.sell([{ variant: v, qty: 3 }], {
      is_delivery_later: true,
    });
    const batch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: v.id },
    });
    expect(batch).toMatchObject({ quantity: 10, reserved_quantity: 3 });
    expect(
      await db.inventoryAuditLog.count({
        where: { variant_id: v.id, event_type: 'SALE_OUT' },
      }),
    ).toBe(0);
    expect(sale.delivery_status).toBe('PENDING');
  });

  it('[BE-SALE-017] {SalesService.completePendingDelivery} completing a pending delivery moves reserved stock out with one audit row', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    const sale = await w.sell([{ variant: v, qty: 3 }], {
      is_delivery_later: true,
    });
    const done: any = await sales.completePendingDelivery(
      sale.id,
      w.tenant.consumer.id,
      w.tenant.adminUser.id,
    );
    const batch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: v.id },
    });
    expect(batch).toMatchObject({ quantity: 7, reserved_quantity: 0 });
    expect(done.delivery_status).toBe('DELIVERED');
    expect(done.delivered_at).not.toBeNull();
    expect(
      await db.inventoryAuditLog.count({
        where: { variant_id: v.id, event_type: 'SALE_OUT' },
      }),
    ).toBe(1);
  });

  it('[BE-SALE-018] {SalesService.cancelPendingDelivery} {SalesService.completePendingDelivery} cancelling a pending delivery releases the reservation only', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    const sale = await w.sell([{ variant: v, qty: 3 }], {
      is_delivery_later: true,
    });
    const done: any = await sales.cancelPendingDelivery(
      sale.id,
      w.tenant.consumer.id,
    );
    const batch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: v.id },
    });
    expect(batch).toMatchObject({ quantity: 10, reserved_quantity: 0 });
    expect(done.delivery_status).toBe('CANCELLED');
    await expect(
      sales.completePendingDelivery(
        sale.id,
        w.tenant.consumer.id,
        w.tenant.adminUser.id,
      ),
    ).rejects.toThrow(/Pending delivery not found/);
  });

  it('[BE-SALE-019] {SalesService.updateOnlineOrderStatus} an online order starts PENDING and its status can be updated', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    const sale = await w.sell([{ variant: v, qty: 1 }], {
      is_online_order: true,
    });
    expect(sale.online_order_status).toBe('PENDING');
    await sales.updateOnlineOrderStatus(
      sale.id,
      { status: 'CONFIRMED' } as any,
      w.tenant.consumer.id,
    );
    expect(
      (await db.sale.findUniqueOrThrow({ where: { id: sale.id } }))
        .online_order_status,
    ).toBe('CONFIRMED');
  });

  it('[BE-SALE-020] sale numbers are sequential per tenant', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    const numbers = [];
    for (let i = 0; i < 3; i++) {
      numbers.push((await w.sell([{ variant: v, qty: 1 }])).sale_number);
    }
    expect(numbers.map((n: string) => n.split('-').pop())).toEqual([
      '0001',
      '0002',
      '0003',
    ]);
    const theirsAgain = await db.sale.findMany({
      where: { consumer_id: w.bystander.consumer.id },
    });
    expect(theirsAgain.map((s) => s.sale_number.split('-').pop())).toEqual([
      '0001',
    ]);
  });

  it('[BE-SALE-021] a fully paid sale to a customer earns reward points (INV-11 holds)', async () => {
    await createRewardsSettings(db, {
      consumer_id: w.tenant.consumer.id,
      points_per_currency: 1,
    });
    const customer = await createCustomer(db, {
      consumer_id: w.tenant.consumer.id,
    });
    const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    const sale = await w.sell([{ variant: v, qty: 2 }], {
      customer_id: customer.id,
    });
    const tx = await db.rewardsPointTransaction.findMany({
      where: { customer_id: customer.id },
    });
    expect(tx).toHaveLength(1);
    expect(tx[0]).toMatchObject({
      type: 'EARN',
      sale_id: sale.id,
      points: 200,
    });
  });

  it('[BE-SALE-022] an empty sale is refused', async () => {
    const dto = saleDto(w.tenant, []);
    await rejects(create(dto), /at least one item/);
    expect(await salesCount()).toBe(0);
  });

  describe('promotions on create', () => {
    const promo = async (v: { id: number }, overrides: object = {}) =>
      createPromotion(db, w.tenant, { variants: [v.id], overrides });

    it('[BE-SALE-023] an applied promotion is stored and closed once its usage limit is reached', async () => {
      const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
      const p = await promo(v, { usage_limit: 1 });
      // buildSaleDto cannot set per-item applied ids; send them explicitly
      const dto = saleDto(
        w.tenant,
        [{ variant: v, qty: 2, promotionDiscount: 20 }],
        {
          applied_promotion_id: p.id,
        },
      );
      dto.items[0].applied_promotion_id = p.id;
      dto.payments = [{ payment_method: PaymentMethod.CASH, amount: 180 }];
      const created = await create(dto);
      expect(created.promotion_id).toBe(p.id);
      expect(Number(created.promotion_discount)).toBe(20);
      expect(
        (await db.promotion.findUniqueOrThrow({ where: { id: p.id } }))
          .is_active,
      ).toBe(false);
    });

    it.each([
      ['inactive', { is_active: false }, /inactive/],
      ['expired', { end_date: new Date('2020-06-01T00:00:00Z') }, /expired/],
      [
        'not started',
        { start_date: new Date('2099-01-01T00:00:00Z'), end_date: null },
        /not started/,
      ],
      [
        'member only without customer',
        { member_only: true },
        /registered customers only/,
      ],
    ])(
      '[BE-SALE-024] %s promotion is refused and no sale is written',
      async (_n, overrides, message) => {
        const v = await w.stock({
          price: 100,
          batches: [{ qty: 10, cost: 40 }],
        });
        const p = await promo(v, overrides);
        const dto = saleDto(
          w.tenant,
          [{ variant: v, qty: 1, promotionDiscount: 10 }],
          {
            applied_promotion_id: p.id,
          },
        );
        dto.items[0].applied_promotion_id = p.id;
        await rejects(create(dto), message);
        expect(await salesCount()).toBe(0);
      },
    );

    it('[BE-SALE-024] a promotion limited to another branch is refused', async () => {
      const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
      const other = await db.branch.create({
        data: { consumer_id: w.tenant.consumer.id, name: 'Other' },
      });
      const p = await createPromotion(db, w.tenant, {
        variants: [v.id],
        branches: [other.id],
        overrides: { branch_specific: true },
      });
      const dto = saleDto(
        w.tenant,
        [{ variant: v, qty: 1, promotionDiscount: 10 }],
        { applied_promotion_id: p.id },
      );
      dto.items[0].applied_promotion_id = p.id;
      await rejects(create(dto), /not available for selected branch/);
    });
  });

  it('[BE-SALE-030] racing sales never oversell the last unit', async () => {
    for (let round = 0; round < 5; round++) {
      const v = await w.stock({ price: 100, batches: [{ qty: 1, cost: 40 }] });
      const results = await Promise.allSettled([
        w.sell([{ variant: v, qty: 1 }]),
        w.sell([{ variant: v, qty: 1 }]),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failure = results.find(
        (r) => r.status === 'rejected',
      ) as PromiseRejectedResult;
      expect(failure.reason.message).toMatch(/Insufficient stock/);
      const batch = await db.inventoryBatch.findFirstOrThrow({
        where: { variant_id: v.id },
      });
      expect(batch.quantity).toBe(0);
    }
  });

  it('[BE-SALE-031] concurrent sales and quotations get distinct numbers', async () => {
    const v = await w.stock({ price: 100, batches: [{ qty: 50, cost: 40 }] });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => w.sell([{ variant: v, qty: 1 }])),
    );
    expect(new Set(results.map((r) => r.sale_number)).size).toBe(10);
    const quotes = await Promise.all(
      Array.from({ length: 10 }, () =>
        create(
          saleDto(
            w.tenant,
            [{ variant: v, qty: 1 }],
            { sale_type: 'quotation' as any },
            null,
          ),
        ),
      ),
    );
    expect(new Set(quotes.map((r) => r.sale_number)).size).toBe(10);
  });

  describe('server-side price checks', () => {
    it('[BE-SALE-040] a line total below the catalog price is refused', async () => {
      const v = await w.stock({ price: 100, batches: [{ qty: 5, cost: 40 }] });
      const dto = saleDto(w.tenant, [{ variant: v, qty: 1 }]);
      dto.items[0].line_total = 1;
      await rejects(create(dto), /does not match its catalog price and tax/);
      expect(await salesCount()).toBe(0);
    });

    it('[BE-SALE-042] unit price must equal the regular or wholesale catalog price', async () => {
      const v = await w.stock({ price: 100, batches: [{ qty: 5, cost: 40 }] });
      const dto = saleDto(w.tenant, [{ variant: v, qty: 1 }]);
      dto.items[0].unit_price = 90;
      await rejects(create(dto), /Price of variant .* has changed/);
      await db.productVariant.update({
        where: { id: v.id },
        data: { wholesale_price: 80 },
      });
      const wholesale = saleDto(
        w.tenant,
        [{ variant: { ...v, wholesale_price: 80 } as any, qty: 1 }],
        { price_type: 'wholesale' as any },
      );
      expect((await create(wholesale)).id).toBeGreaterThan(0);
      await db.productVariant.update({
        where: { id: v.id },
        data: { wholesale_price: 0 },
      });
      const fallback = saleDto(
        w.tenant,
        [{ variant: { ...v, wholesale_price: 0 } as any, qty: 1 }],
        { price_type: 'wholesale' as any },
      );
      expect(Number(fallback.items[0].unit_price)).toBe(100);
      expect((await create(fallback)).id).toBeGreaterThan(0);
    });

    it('[BE-SALE-043] tax off by more than a rounding cent is refused; a cent is tolerated', async () => {
      const v = await w.stock({
        price: 100,
        taxPercent: 5,
        batches: [{ qty: 5, cost: 40 }],
      });
      const bad = saleDto(w.tenant, [{ variant: v, qty: 1 }]);
      bad.items[0].tax_amount = Number(bad.items[0].tax_amount) + 1;
      await rejects(create(bad), /does not match its catalog price and tax/);
      const near = saleDto(w.tenant, [{ variant: v, qty: 1 }]);
      near.items[0].tax_amount = Number(near.items[0].tax_amount) + 0.01;
      expect((await create(near)).id).toBeGreaterThan(0);
    });

    it('[BE-SALE-044] a promotion discount with no promotion is refused', async () => {
      const v = await w.stock({ price: 100, batches: [{ qty: 5, cost: 40 }] });
      await rejects(
        w.sell([{ variant: v, qty: 1, promotionDiscount: 10 }]),
        /has no promotion/,
      );
    });

    it('[BE-SALE-045] item promotion discounts above the server evaluation are refused', async () => {
      const v = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
      const p = await createPromotion(db, w.tenant, { variants: [v.id] }); // 10%
      const over = saleDto(w.tenant, [
        { variant: v, qty: 2, promotionDiscount: 30 },
      ]);
      over.items[0].applied_promotion_id = p.id;
      await rejects(create(over), /exceeds what the promotion allows/);
      const exact = saleDto(w.tenant, [
        { variant: v, qty: 2, promotionDiscount: 20 },
      ]);
      exact.items[0].applied_promotion_id = p.id;
      expect((await create(exact)).id).toBeGreaterThan(0);
    });
  });

  describe('credit (reward points) payments', () => {
    const withPoints = async (points: number) => {
      await createRewardsSettings(db, {
        consumer_id: w.tenant.consumer.id,
        redemption_value: 1,
        minimum_redemption: 1,
      });
      const customer = await createCustomer(db, {
        consumer_id: w.tenant.consumer.id,
      });
      await rewards.adjustPoints(
        w.tenant.consumer.id,
        { customer_id: customer.id, points, description: 'seed' },
        w.tenant.adminUser.id,
      );
      return customer;
    };

    it('[BE-SALE-041] a credit payment the customer cannot cover is refused with nothing written', async () => {
      const customer = await withPoints(10);
      const v = await w.stock({ price: 100, batches: [{ qty: 5, cost: 40 }] });
      await rejects(
        w.sell([{ variant: v, qty: 1 }], {
          customer_id: customer.id,
          payments: [{ payment_method: PaymentMethod.CREDIT, amount: 100 }],
        }),
        /Credit payment validation failed/,
      );
      expect(await salesCount()).toBe(0);
      expect(
        (
          await db.inventoryBatch.findFirstOrThrow({
            where: { variant_id: v.id },
          })
        ).quantity,
      ).toBe(5);
      expect(
        await db.rewardsPointTransaction.count({ where: { type: 'REDEEM' } }),
      ).toBe(0);
    });

    it('[BE-SALE-046] a covered credit payment redeems points exactly once', async () => {
      const customer = await withPoints(500);
      const v = await w.stock({ price: 100, batches: [{ qty: 5, cost: 40 }] });
      const sale = await w.sell([{ variant: v, qty: 1 }], {
        customer_id: customer.id,
        payments: [{ payment_method: PaymentMethod.CREDIT, amount: 100 }],
      });
      const redeems = await db.rewardsPointTransaction.findMany({
        where: { type: 'REDEEM' },
      });
      expect(redeems).toHaveLength(1);
      expect(redeems[0]).toMatchObject({ sale_id: sale.id, points: -100 });
      const balance = await db.customerRewardsPoints.findUniqueOrThrow({
        where: { customer_id: customer.id },
      });
      expect(balance.total_points).toBe(400);
    });
  });
});
