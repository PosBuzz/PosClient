import { NotFoundException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createCustomer } from '../factories';
import { CustomerService } from '../../src/consumer/customer/services/customer.service';

describe('customer service detail', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let customers: CustomerService;

  beforeAll(async () => {
    boot = await bootDomain();
    customers = boot.get(CustomerService);
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
  const mk = (extra: object = {}) =>
    createCustomer(db, { consumer_id: cid(), ...extra });
  const failure = async (p: Promise<unknown>) =>
    p.then(
      () => null,
      (e: any) => e,
    );
  const reward = (
    customer_id: number,
    points: number,
    created_at: Date,
    extra: object = {},
  ) =>
    db.rewardsPointTransaction.create({
      data: {
        customer_id,
        consumer_id: cid(),
        type: 'EARN',
        points,
        balance_before: 0,
        balance_after: points,
        created_at,
        ...extra,
      } as any,
    });

  it('[BE-CUST-101] {CustomerService.create} stores every field; birthday becomes a date, absent birthday is null', async () => {
    const c: any = await customers.create(
      {
        name: 'Full',
        email: 'f@x.test',
        phone: '0170001',
        address: 'Road 1',
        birthday: '1991-02-03',
        customer_type: 'business',
      } as any,
      cid(),
    );
    const row = await db.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect(row).toMatchObject({
      consumer_id: cid(),
      name: 'Full',
      email: 'f@x.test',
      phone: '0170001',
      address: 'Road 1',
      customer_type: 'business',
    });
    expect(row.birthday!.toISOString().slice(0, 10)).toBe('1991-02-03');
    const bare: any = await customers.create(
      { name: 'Bare', phone: '0170002', customer_type: 'regular' } as any,
      cid(),
    );
    expect(bare.birthday).toBeNull();
    expect(bare.email).toBeNull();
  });

  it('[BE-CUST-102] {CustomerService.findAll} {CustomerService.findOne} sorted tenant listing; findOne returns the row or NotFound', async () => {
    await mk({ name: 'Zed' });
    const a = await mk({ name: 'Alpha' });
    const foreign = await createCustomer(db, { name: 'Aaa' });
    const list = await customers.findAll(cid());
    expect(list.map((c) => c.name)).toEqual(['Alpha', 'Zed']);
    expect((await customers.findOne(a.id, cid())).name).toBe('Alpha');
    const err = await failure(customers.findOne(foreign.id, cid()));
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.message).toBe('Customer not found');
  });

  it('[BE-CUST-103] {CustomerService.search} blank query is an empty array; matches name/email/phone case-insensitively, trimmed, tenant scoped, sorted, capped at 20', async () => {
    expect(await customers.search('', cid())).toEqual([]);
    expect(await customers.search('   ', cid())).toEqual([]);
    expect(await customers.search(undefined as any, cid())).toEqual([]);
    await mk({ name: 'Bob Marley', email: 'x1@a.test', phone: '0111' });
    await mk({ name: 'Carl', email: 'BOBBY@a.test', phone: '0222' });
    await mk({ name: 'Dan', email: 'd@a.test', phone: '99bob99' });
    await mk({ name: 'Eve', email: 'e@a.test', phone: '0333' });
    await createCustomer(db, { name: 'Bob Foreign' });
    const r: any = await customers.search('  BOB ', cid());
    expect(r.data.map((c: any) => c.name)).toEqual([
      'Bob Marley',
      'Carl',
      'Dan',
    ]);
    expect(((await customers.search('0333', cid())) as any).data).toHaveLength(
      1,
    );
    expect(((await customers.search('nomatch', cid())) as any).data).toEqual(
      [],
    );
    for (let i = 0; i < 22; i++) {
      await mk({ name: `Many ${String(i).padStart(2, '0')}` });
    }
    const many: any = await customers.search('many', cid());
    expect(many.data).toHaveLength(20);
    expect(many.data[0].name).toBe('Many 00');
  });

  it('[BE-CUST-104] {CustomerService.findAllWithFilters} pages, caps the limit at 100, filters by type and search, and reports meta', async () => {
    for (let i = 0; i < 5; i++) {
      await mk({
        name: `P${i}`,
        customer_type: i < 2 ? 'business' : 'regular',
        email: i === 4 ? 'needle@x.test' : null,
      });
    }
    await createCustomer(db, { name: 'Foreign', customer_type: 'business' });
    const all: any = await customers.findAllWithFilters({}, cid());
    expect(all.data).toHaveLength(5);
    expect(all.meta).toEqual({ total: 5, page: 1, limit: 20, total_pages: 1 });
    const p2: any = await customers.findAllWithFilters(
      { page: 2, limit: 2 },
      cid(),
    );
    expect(p2.data.map((c: any) => c.name)).toEqual(['P2', 'P3']);
    expect(p2.meta).toEqual({ total: 5, page: 2, limit: 2, total_pages: 3 });
    const biz: any = await customers.findAllWithFilters(
      { customer_type: 'business' },
      cid(),
    );
    expect(biz.meta.total).toBe(2);
    const s: any = await customers.findAllWithFilters(
      { search: ' NEEDLE ' },
      cid(),
    );
    expect(s.data.map((c: any) => c.name)).toEqual(['P4']);
    const both: any = await customers.findAllWithFilters(
      { search: 'p', customer_type: 'regular' },
      cid(),
    );
    expect(both.meta.total).toBe(3);
    const blank: any = await customers.findAllWithFilters(
      { search: '   ' },
      cid(),
    );
    expect(blank.meta.total).toBe(5);
    const cap: any = await customers.findAllWithFilters({ limit: 500 }, cid());
    expect(cap.meta.limit).toBe(100);
    const mid: any = await customers.findAllWithFilters({ limit: 100 }, cid());
    expect(mid.meta.limit).toBe(100);
    const sm: any = await customers.findAllWithFilters({ limit: 99 }, cid());
    expect(sm.meta.limit).toBe(99);
  });

  it('[BE-CUST-105] {CustomerService.update} writes every field; absent birthday is kept, a value replaces it; NotFound otherwise', async () => {
    const c = await mk({ name: 'Old', birthday: new Date('1990-01-01') });
    const foreign = await createCustomer(db, { name: 'Foreign' });
    const u: any = await customers.update(
      c.id,
      {
        name: 'New',
        email: 'n@x.test',
        phone: '0179999',
        address: 'A2',
        customer_type: 'business',
      } as any,
      cid(),
    );
    expect(u).toMatchObject({
      name: 'New',
      email: 'n@x.test',
      phone: '0179999',
      address: 'A2',
      customer_type: 'business',
    });
    expect(u.birthday.toISOString().slice(0, 10)).toBe('1990-01-01');
    const b: any = await customers.update(
      c.id,
      { birthday: '2000-12-25' },
      cid(),
    );
    expect(b.birthday.toISOString().slice(0, 10)).toBe('2000-12-25');
    const err = await failure(
      customers.update(foreign.id, { name: 'H' }, cid()),
    );
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.message).toBe('Customer not found');
    expect(
      (await db.customer.findUniqueOrThrow({ where: { id: foreign.id } })).name,
    ).toBe('Foreign');
  });

  it('[BE-CUST-106] {CustomerService.remove} returns the deleted row, leaves others; foreign is NotFound', async () => {
    const c = await mk();
    const other = await mk();
    const foreign = await createCustomer(db);
    const removed: any = await customers.remove(c.id, cid());
    expect(removed.id).toBe(c.id);
    expect(await db.customer.count({ where: { id: c.id } })).toBe(0);
    expect(await db.customer.count({ where: { id: other.id } })).toBe(1);
    const err = await failure(customers.remove(foreign.id, cid()));
    expect(err).toBeInstanceOf(NotFoundException);
    expect(await db.customer.count({ where: { id: foreign.id } })).toBe(1);
  });

  it('[BE-CUST-107] {CustomerService.getSummary} a customer without activity gets zeroed sections and default rewards', async () => {
    const c = await mk({
      name: 'Idle',
      email: 'i@x.test',
      address: 'Addr',
      birthday: new Date('1988-08-08'),
    });
    const s: any = await customers.getSummary(c.id, cid());
    expect(s.customer).toMatchObject({
      id: c.id,
      name: 'Idle',
      email: 'i@x.test',
      phone: c.phone,
      address: 'Addr',
      customer_type: 'regular',
    });
    expect(s.customer.created_at).toBeInstanceOf(Date);
    expect(s.customer).not.toHaveProperty('rewards_points');
    expect(s.sales).toEqual({
      count: 0,
      gross_amount: 0,
      paid_amount: 0,
      outstanding_amount: 0,
      last_sale_at: null,
    });
    expect(s.returns).toEqual({
      count: 0,
      refunded_amount: 0,
      exchanged_amount: 0,
      last_return_at: null,
    });
    expect(s.rewards).toEqual({
      total_points: 0,
      lifetime_earned: 0,
      lifetime_redeemed: 0,
      last_earned_at: null,
      last_redeemed_at: null,
    });
    expect(s.recent_sales).toEqual([]);
    const err = await failure(customers.getSummary(999999999, cid()));
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.message).toBe('Customer not found');
  });

  it('[BE-CUST-108] {CustomerService.getSummary} totals ignore deleted, non-sale and foreign rows; outstanding counts only unpaid sales; rewards come from the points row; recent sales are the newest five', async () => {
    const c = await mk();
    const v = await w.stock({ price: 100, batches: [{ qty: 100, cost: 10 }] });
    const sales: any[] = [];
    for (let i = 0; i < 6; i++) {
      sales.push(
        await w.sell(
          [{ variant: v, qty: 1 }],
          { customer_id: c.id },
          i === 0 ? 30 : 100,
        ),
      );
    }
    // sales[0] unpaid 70 outstanding. Hide: sales[1] deleted, sales[2] not a sale
    await db.sale.update({
      where: { id: sales[1].id },
      data: { deleted_at: new Date() },
    });
    await db.sale.update({
      where: { id: sales[2].id },
      data: { sale_type: 'order' },
    });
    // a second tenant's sale for same customer id must be ignored
    const dates = [1, 2, 3, 4, 5, 6].map((d) => new Date(Date.UTC(2026, 0, d)));
    for (let i = 0; i < 6; i++) {
      await db.sale.update({
        where: { id: sales[i].id },
        data: { sale_date: dates[i] },
      });
    }
    await db.rewardsPointTransaction.deleteMany({
      where: { customer_id: c.id },
    });
    await db.customerRewardsPoints.deleteMany({ where: { customer_id: c.id } });
    await db.customerRewardsPoints.create({
      data: {
        customer_id: c.id,
        consumer_id: cid(),
        total_points: 7,
        lifetime_earned: 10,
        lifetime_redeemed: 3,
        last_earned_at: new Date('2026-01-01T00:00:00Z'),
        last_redeemed_at: new Date('2026-01-02T00:00:00Z'),
      } as any,
    });
    const s: any = await customers.getSummary(c.id, cid());
    expect(s.sales).toMatchObject({
      count: 4,
      gross_amount: 400,
      paid_amount: 330,
      outstanding_amount: 70,
    });
    expect(s.sales.last_sale_at).toEqual(dates[5]);
    expect(s.rewards).toMatchObject({
      total_points: 7,
      lifetime_earned: 10,
      lifetime_redeemed: 3,
    });
    expect(s.rewards.last_earned_at).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(s.rewards.last_redeemed_at).toEqual(
      new Date('2026-01-02T00:00:00Z'),
    );
    expect(s.recent_sales.map((x: any) => x.id)).toEqual([
      sales[5].id,
      sales[4].id,
      sales[3].id,
      sales[0].id,
    ]);
    const last = s.recent_sales[3];
    expect(last).toMatchObject({
      sale_number: sales[0].sale_number,
      total_amount: 100,
      received_amount: 30,
      payment_status: expect.any(String),
    });
    expect(typeof last.total_amount).toBe('number');
    expect(last.branch.name).toEqual(expect.any(String));
  });

  it('[BE-CUST-109] {CustomerService.getSummary} recent sales are capped at five', async () => {
    const c = await mk();
    const v = await w.stock({ price: 10, batches: [{ qty: 50, cost: 1 }] });
    for (let i = 0; i < 6; i++) {
      await w.sell([{ variant: v, qty: 1 }], { customer_id: c.id });
    }
    const s: any = await customers.getSummary(c.id, cid());
    expect(s.sales.count).toBe(6);
    expect(s.recent_sales).toHaveLength(5);
  });

  it('[BE-CUST-110] {CustomerService.getSalesHistory} paginates newest first with outstanding per sale, excludes deleted and non-sale rows, defaults and clamps paging', async () => {
    const c = await mk();
    const other = await mk();
    const v = await w.stock({ price: 100, batches: [{ qty: 100, cost: 10 }] });
    const s: any[] = [];
    for (let i = 0; i < 4; i++) {
      s.push(
        await w.sell(
          [{ variant: v, qty: 1 }],
          { customer_id: c.id },
          i === 0 ? 40 : 100,
        ),
      );
    }
    await w.sell([{ variant: v, qty: 1 }], { customer_id: other.id });
    await db.sale.update({
      where: { id: s[3].id },
      data: { deleted_at: new Date() },
    });
    for (let i = 0; i < 3; i++) {
      await db.sale.update({
        where: { id: s[i].id },
        data: { sale_date: new Date(Date.UTC(2026, 1, i + 1)) },
      });
    }
    const h: any = await customers.getSalesHistory(c.id, cid());
    expect(h.data.map((x: any) => x.id)).toEqual([s[2].id, s[1].id, s[0].id]);
    expect(h.meta).toEqual({ total: 3, page: 1, limit: 20, total_pages: 1 });
    expect(h.data[2]).toMatchObject({
      total_amount: 100,
      received_amount: 40,
      outstanding_amount: 60,
    });
    expect(h.data[0].outstanding_amount).toBe(0);
    expect(h.data[0].branch.name).toEqual(expect.any(String));
    // overpaid never goes negative
    await db.sale.update({
      where: { id: s[2].id },
      data: { received_amount: 150 },
    });
    const over: any = await customers.getSalesHistory(c.id, cid());
    expect(over.data[0].outstanding_amount).toBe(0);
    await db.sale.update({
      where: { id: s[2].id },
      data: { received_amount: 100 },
    });

    const p2: any = await customers.getSalesHistory(c.id, cid(), 2, 2);
    expect(p2.data.map((x: any) => x.id)).toEqual([s[0].id]);
    expect(p2.meta).toEqual({ total: 3, page: 2, limit: 2, total_pages: 2 });
    for (const [pg, lm, ep, el] of [
      [0, 0, 1, 20],
      [-1, -3, 1, 20],
      [NaN, NaN, 1, 20],
      [undefined, 500, 1, 50],
      [3, 50, 3, 50],
      [1, 49, 1, 49],
      [1, 1, 1, 1],
    ] as any[]) {
      const r: any = await customers.getSalesHistory(c.id, cid(), pg, lm);
      expect(r.meta).toMatchObject({ page: ep, limit: el });
    }
    const err = await failure(customers.getSalesHistory(999999999, cid()));
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.message).toBe('Customer not found');
  });

  it('[BE-CUST-111] {CustomerService.getReturnsHistory} lists returns of the customer sales, newest first, paged, numeric amounts; NotFound for foreign customers', async () => {
    const c = await mk();
    const other = await mk();
    const v = await w.stock({ price: 100, batches: [{ qty: 50, cost: 10 }] });
    const batch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: v.id },
    });
    const mkReturn = async (customerId: number, refund: number, date: Date) => {
      const sale = await w.sell([{ variant: v, qty: 1 }], {
        customer_id: customerId,
      });
      return db.return.create({
        data: {
          consumer_id: cid(),
          original_sale_id: sale.id,
          branch_id: w.tenant.branches[0].id,
          return_number: `R-${sale.id}`,
          return_date: date,
          total_refund: refund,
          total_exchange: 5,
          reason: 'bad',
          user_id: w.tenant.adminUser.id,
        } as any,
      });
    };
    void batch;
    const r1 = await mkReturn(c.id, 10, new Date(Date.UTC(2026, 2, 1)));
    const r2 = await mkReturn(c.id, 20, new Date(Date.UTC(2026, 2, 2)));
    await mkReturn(other.id, 99, new Date(Date.UTC(2026, 2, 3)));
    const h: any = await customers.getReturnsHistory(c.id, cid());
    expect(h.data.map((x: any) => x.id)).toEqual([r2.id, r1.id]);
    expect(h.meta).toEqual({ total: 2, page: 1, limit: 20, total_pages: 1 });
    expect(h.data[0]).toMatchObject({
      return_number: r2.return_number,
      total_refund: 20,
      total_exchange: 5,
      reason: 'bad',
    });
    expect(h.data[0].branch.name).toEqual(expect.any(String));
    expect(h.data[0].original_sale.sale_number).toEqual(expect.any(String));
    const p: any = await customers.getReturnsHistory(c.id, cid(), 2, 1);
    expect(p.data.map((x: any) => x.id)).toEqual([r1.id]);
    expect(p.meta).toEqual({ total: 2, page: 2, limit: 1, total_pages: 2 });
    expect(
      ((await customers.getReturnsHistory(c.id, cid(), 0, 0)) as any).meta,
    ).toMatchObject({ page: 1, limit: 20 });
    expect(
      ((await customers.getReturnsHistory(c.id, cid(), 1, 500)) as any).meta
        .limit,
    ).toBe(50);
    const foreign = await createCustomer(db);
    const err = await failure(customers.getReturnsHistory(foreign.id, cid()));
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.message).toBe('Customer not found');
  });

  it('[BE-CUST-112] {CustomerService.getRewardsHistory} newest first, tenant scoped, paged, with the linked sale; NotFound for foreign customers', async () => {
    const c = await mk();
    const other = await mk();
    const v = await w.stock({ price: 100, batches: [{ qty: 5, cost: 10 }] });
    const sale = await w.sell([{ variant: v, qty: 1 }], { customer_id: c.id });
    await db.rewardsPointTransaction.deleteMany({
      where: { customer_id: c.id },
    });
    await db.customerRewardsPoints.deleteMany({ where: { customer_id: c.id } });
    await db.customerRewardsPoints.create({
      data: { customer_id: c.id, consumer_id: cid(), total_points: 8 } as any,
    });
    const t1 = await reward(c.id, 5, new Date(Date.UTC(2026, 3, 1)), {
      description: 'first',
    });
    const t2 = await reward(c.id, 8, new Date(Date.UTC(2026, 3, 2)), {
      sale_id: sale.id,
    });
    await reward(other.id, 99, new Date(Date.UTC(2026, 3, 3)));
    const h: any = await customers.getRewardsHistory(c.id, cid());
    expect(h.data.map((x: any) => x.id)).toEqual([t2.id, t1.id]);
    expect(h.meta).toEqual({ total: 2, page: 1, limit: 20, total_pages: 1 });
    expect(h.data[0]).toMatchObject({
      type: 'EARN',
      points: 8,
      balance_after: 8,
      sale: { id: sale.id, sale_number: sale.sale_number },
    });
    expect(h.data[1]).toMatchObject({ description: 'first', sale: null });
    const p: any = await customers.getRewardsHistory(c.id, cid(), 2, 1);
    expect(p.data.map((x: any) => x.id)).toEqual([t1.id]);
    expect(p.meta).toEqual({ total: 2, page: 2, limit: 1, total_pages: 2 });
    expect(
      ((await customers.getRewardsHistory(c.id, cid(), -1, -1)) as any).meta,
    ).toMatchObject({ page: 1, limit: 20 });
    expect(
      ((await customers.getRewardsHistory(c.id, cid(), 1, 51)) as any).meta
        .limit,
    ).toBe(50);
    const foreign = await createCustomer(db);
    const err = await failure(customers.getRewardsHistory(foreign.id, cid()));
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.message).toBe('Customer not found');
  });
});
