import { NotFoundException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createCustomer } from '../factories';
import { CustomerService } from '../../src/consumer/customer/services/customer.service';

describe('customer service extra (mutation hardening)', () => {
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
  // No w.check(): these specs seed deliberately unbalanced returns/payments/points.
  afterEach(() => undefined);

  const cid = () => w.tenant.consumer.id;
  const mk = (extra: object = {}) =>
    createCustomer(db, { consumer_id: cid(), ...extra });
  const failure = async (p: Promise<unknown>) =>
    p.then(
      () => null,
      (e: any) => e,
    );
  const day = (m: number, d: number) => new Date(Date.UTC(2026, m, d));

  async function mkReturn(
    variant: { id: number },
    customerId: number,
    refund: number,
    exchange: number,
    date: Date,
    consumerId = cid(),
  ) {
    const sale = await w.sell([{ variant: variant as any, qty: 1 }], {
      customer_id: customerId,
    });
    return db.return.create({
      data: {
        consumer_id: consumerId,
        original_sale_id: sale.id,
        branch_id: w.tenant.branches[0].id,
        return_number: `RX-${sale.id}`,
        return_date: date,
        total_refund: refund,
        total_exchange: exchange,
        reason: 'r',
        user_id: w.tenant.adminUser.id,
      } as any,
    });
  }

  it('[BE-CUST-201] {CustomerService.getSummary} the returns section sums refunds and exchanges of this customer only and reports the latest return date', async () => {
    const c = await mk();
    const other = await mk();
    const v = await w.stock({ price: 100, batches: [{ qty: 50, cost: 10 }] });
    await mkReturn(v, c.id, 10, 1, day(2, 1));
    await mkReturn(v, c.id, 25.5, 2.25, day(2, 9));
    await mkReturn(v, c.id, 4, 0, day(2, 5));
    await mkReturn(v, other.id, 999, 999, day(2, 20));
    const s: any = await customers.getSummary(c.id, cid());
    expect(s.returns).toEqual({
      count: 3,
      refunded_amount: 39.5,
      exchanged_amount: 3.25,
      last_return_at: day(2, 9),
    });
    const o: any = await customers.getSummary(other.id, cid());
    expect(o.returns).toMatchObject({ count: 1, refunded_amount: 999 });
    expect(typeof s.returns.refunded_amount).toBe('number');
  });

  it('[BE-CUST-202] {CustomerService.getSummary} outstanding nets paid amounts across unpaid sales, ignores paid sales and never goes negative', async () => {
    const c = await mk();
    const v = await w.stock({ price: 100, batches: [{ qty: 50, cost: 10 }] });
    const a = await w.sell([{ variant: v, qty: 1 }], { customer_id: c.id }, 30);
    const b = await w.sell([{ variant: v, qty: 2 }], { customer_id: c.id }, 50);
    await w.sell([{ variant: v, qty: 1 }], { customer_id: c.id }, 100);
    await db.sale.updateMany({
      where: { id: { in: [a.id, b.id] } },
      data: { payment_status: 'partial' },
    });
    const s: any = await customers.getSummary(c.id, cid());
    expect(s.sales).toMatchObject({
      count: 3,
      gross_amount: 400,
      paid_amount: 180,
      outstanding_amount: 220,
    });
    // overpaid unpaid sales clamp the outstanding at zero
    await db.sale.update({
      where: { id: a.id },
      data: { received_amount: 900 },
    });
    const clamped: any = await customers.getSummary(c.id, cid());
    expect(clamped.sales.outstanding_amount).toBe(0);
    // all-paid flag removes sales from the outstanding aggregate
    await db.sale.updateMany({
      where: { customer_id: c.id },
      data: { payment_status: 'paid', received_amount: 0 },
    });
    const paid: any = await customers.getSummary(c.id, cid());
    expect(paid.sales.outstanding_amount).toBe(0);
    expect(paid.sales.paid_amount).toBe(0);
  });

  it('[BE-CUST-203] {CustomerService.getSummary} exposes exactly the documented customer columns and the rewards row without extra keys', async () => {
    const c = await mk();
    await db.customerRewardsPoints.deleteMany({ where: { customer_id: c.id } });
    await db.customerRewardsPoints.create({
      data: { customer_id: c.id, consumer_id: cid(), total_points: 3 } as any,
    });
    const s: any = await customers.getSummary(c.id, cid());
    expect(Object.keys(s).sort()).toEqual(
      ['customer', 'recent_sales', 'returns', 'rewards', 'sales'].sort(),
    );
    expect(Object.keys(s.customer).sort()).toEqual(
      [
        'address',
        'birthday',
        'created_at',
        'customer_type',
        'email',
        'id',
        'name',
        'phone',
      ].sort(),
    );
    expect(Object.keys(s.rewards).sort()).toEqual(
      [
        'last_earned_at',
        'last_redeemed_at',
        'lifetime_earned',
        'lifetime_redeemed',
        'total_points',
      ].sort(),
    );
    expect(s.rewards).toMatchObject({ total_points: 3, lifetime_earned: 0 });
    expect(s.rewards.last_earned_at).toBeNull();
    // a foreign tenant cannot read the summary
    const err = await failure(
      customers.getSummary(c.id, w.bystander.consumer.id),
    );
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.message).toBe('Customer not found');
  });

  it('[BE-CUST-204] {CustomerService.getSummary} {CustomerService.getSalesHistory} recent/history rows have exactly the listed keys and exclude other customers and non-sale rows', async () => {
    const c = await mk();
    const other = await mk();
    const v = await w.stock({ price: 50, batches: [{ qty: 50, cost: 10 }] });
    const mine = await w.sell([{ variant: v, qty: 1 }], { customer_id: c.id });
    const order = await w.sell([{ variant: v, qty: 1 }], {
      customer_id: c.id,
    });
    await w.sell([{ variant: v, qty: 1 }], { customer_id: other.id });
    await db.sale.update({
      where: { id: order.id },
      data: { sale_type: 'order' },
    });
    const s: any = await customers.getSummary(c.id, cid());
    expect(s.recent_sales).toHaveLength(1);
    expect(Object.keys(s.recent_sales[0]).sort()).toEqual(
      [
        'branch',
        'id',
        'payment_status',
        'received_amount',
        'sale_date',
        'sale_number',
        'total_amount',
      ].sort(),
    );
    expect(s.recent_sales[0].id).toBe(mine.id);
    expect(Object.keys(s.recent_sales[0].branch)).toEqual(['name']);
    const h: any = await customers.getSalesHistory(c.id, cid());
    expect(h.data.map((x: any) => x.id)).toEqual([mine.id]);
    expect(h.meta.total).toBe(1);
    expect(Object.keys(h.data[0]).sort()).toEqual(
      [
        'branch',
        'id',
        'outstanding_amount',
        'payment_status',
        'received_amount',
        'sale_date',
        'sale_number',
        'total_amount',
      ].sort(),
    );
  });

  it('[BE-CUST-205] {CustomerService.getReturnsHistory} {CustomerService.getRewardsHistory} rows have exactly the listed keys', async () => {
    const c = await mk();
    const v = await w.stock({ price: 50, batches: [{ qty: 50, cost: 10 }] });
    await mkReturn(v, c.id, 5, 1, day(4, 1));
    const r: any = await customers.getReturnsHistory(c.id, cid());
    expect(Object.keys(r.data[0]).sort()).toEqual(
      [
        'branch',
        'id',
        'original_sale',
        'reason',
        'return_date',
        'return_number',
        'total_exchange',
        'total_refund',
      ].sort(),
    );
    expect(Object.keys(r.data[0].original_sale).sort()).toEqual([
      'id',
      'sale_number',
    ]);
    expect(Object.keys(r.data[0].branch)).toEqual(['name']);
    await db.rewardsPointTransaction.create({
      data: {
        customer_id: c.id,
        consumer_id: cid(),
        type: 'EARN',
        points: 2,
        balance_before: 0,
        balance_after: 2,
      } as any,
    });
    const t: any = await customers.getRewardsHistory(c.id, cid());
    const row = t.data[t.data.length - 1];
    expect(Object.keys(row).sort()).toEqual(
      [
        'balance_after',
        'created_at',
        'description',
        'id',
        'points',
        'sale',
        'type',
      ].sort(),
    );
  });

  it('[BE-CUST-206] {CustomerService.getSalesHistory} infinite or fractional paging inputs normalise and the third page skips exactly two pages', async () => {
    const c = await mk();
    const v = await w.stock({ price: 10, batches: [{ qty: 50, cost: 1 }] });
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) {
      const s = await w.sell([{ variant: v, qty: 1 }], { customer_id: c.id });
      await db.sale.update({
        where: { id: s.id },
        data: { sale_date: day(5, i + 1) },
      });
      ids.push(s.id);
    }
    const inf: any = await customers.getSalesHistory(
      c.id,
      cid(),
      Infinity,
      Infinity,
    );
    expect(inf.meta).toMatchObject({ page: 1, limit: 20 });
    const p3: any = await customers.getSalesHistory(c.id, cid(), 3, 2);
    expect(p3.data.map((x: any) => x.id)).toEqual([ids[0]]);
    const p2: any = await customers.getSalesHistory(c.id, cid(), 2, 2);
    expect(p2.data.map((x: any) => x.id)).toEqual([ids[2], ids[1]]);
    const none: any = await customers.getSalesHistory(c.id, cid(), 9, 2);
    expect(none.data).toEqual([]);
    expect(none.meta).toEqual({ total: 5, page: 9, limit: 2, total_pages: 3 });
    const exact: any = await customers.getSalesHistory(c.id, cid(), 1, 5);
    expect(exact.meta.total_pages).toBe(1);
    const frac: any = await customers.getSalesHistory(c.id, cid(), 1, 4);
    expect(frac.meta.total_pages).toBe(2);
  });

  it('[BE-CUST-207] {CustomerService.getRewardsHistory} {CustomerService.getReturnsHistory} the unpaged defaults and the empty customer return an empty page with total_pages 0', async () => {
    const c = await mk();
    const rw: any = await customers.getRewardsHistory(c.id, cid());
    expect(rw).toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 20, total_pages: 0 },
    });
    const rt: any = await customers.getReturnsHistory(c.id, cid());
    expect(rt).toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 20, total_pages: 0 },
    });
    const sl: any = await customers.getSalesHistory(c.id, cid());
    expect(sl.meta).toEqual({ total: 0, page: 1, limit: 20, total_pages: 0 });
  });

  it('[BE-CUST-208] {CustomerService.getReturnsHistory} returns of another tenant for the same customer are excluded', async () => {
    const c = await mk();
    const v = await w.stock({ price: 50, batches: [{ qty: 50, cost: 10 }] });
    const mine = await mkReturn(v, c.id, 5, 0, day(6, 1));
    const stray = await mkReturn(v, c.id, 7, 0, day(6, 2));
    await db.return.update({
      where: { id: stray.id },
      data: { consumer_id: w.bystander.consumer.id },
    });
    const r: any = await customers.getReturnsHistory(c.id, cid());
    expect(r.data.map((x: any) => x.id)).toEqual([mine.id]);
    expect(r.meta.total).toBe(1);
    const s: any = await customers.getSummary(c.id, cid());
    expect(s.returns).toMatchObject({ count: 1, refunded_amount: 5 });
    await db.return.update({
      where: { id: stray.id },
      data: { consumer_id: cid() },
    });
  });

  it('[BE-CUST-209] {CustomerService.getRewardsHistory} other tenants and other customers transactions are excluded', async () => {
    const c = await mk();
    const mkTx = (customer_id: number, consumer_id: number, points: number) =>
      db.rewardsPointTransaction.create({
        data: {
          customer_id,
          consumer_id,
          type: 'EARN',
          points,
          balance_before: 0,
          balance_after: points,
        } as any,
      });
    const t = await mkTx(c.id, cid(), 4);
    const stray = await mkTx(c.id, w.bystander.consumer.id, 40);
    const h: any = await customers.getRewardsHistory(c.id, cid());
    expect(h.data.map((x: any) => x.id)).toEqual([t.id]);
    expect(h.meta.total).toBe(1);
    await db.rewardsPointTransaction.delete({ where: { id: stray.id } });
  });

  it('[BE-CUST-210] {CustomerService.create} {CustomerService.update} an empty birthday is null on create and clears on update; absent keeps; other fields are optional', async () => {
    const created: any = await customers.create(
      {
        name: 'E',
        phone: '0171',
        birthday: '',
        customer_type: 'regular',
      } as any,
      cid(),
    );
    expect(created.birthday).toBeNull();
    const c = await mk({ birthday: day(0, 1) });
    for (const empty of ['', null]) {
      await db.customer.update({
        where: { id: c.id },
        data: { birthday: day(0, 1) },
      });
      const out: any = await customers.update(
        c.id,
        { birthday: empty } as any,
        cid(),
      );
      expect(out.birthday).toBeNull();
    }
    const kept: any = await customers.update(c.id, { name: 'Only' }, cid());
    expect(kept.name).toBe('Only');
    const withB: any = await customers.update(
      c.id,
      { birthday: '2001-02-03' },
      cid(),
    );
    const again: any = await customers.update(c.id, { phone: '555' }, cid());
    expect(again.birthday).toEqual(withB.birthday);
    expect(again.phone).toBe('555');
    expect(again.name).toBe('Only');
    expect(again.email).toBe(withB.email);
  });

  it('[BE-CUST-211] {CustomerService.findAllWithFilters} falsy page and limit fall back, page offsets use the effective limit, empty type is no filter, search ORs name/email/phone', async () => {
    for (let i = 0; i < 25; i++) {
      await mk({
        name: `N${String(i).padStart(2, '0')}`,
        phone: `ph${i}`,
        email: i === 7 ? 'special@x.test' : null,
      });
    }
    const z: any = await customers.findAllWithFilters(
      { page: 0, limit: 0 },
      cid(),
    );
    expect(z.meta).toEqual({ total: 25, page: 1, limit: 20, total_pages: 2 });
    expect(z.data).toHaveLength(20);
    const p2: any = await customers.findAllWithFilters({ page: 2 }, cid());
    expect(p2.data.map((x: any) => x.name)).toEqual([
      'N20',
      'N21',
      'N22',
      'N23',
      'N24',
    ]);
    const emptyType: any = await customers.findAllWithFilters(
      { customer_type: '' },
      cid(),
    );
    expect(emptyType.meta.total).toBe(25);
    const byEmail: any = await customers.findAllWithFilters(
      { search: 'SPECIAL' },
      cid(),
    );
    expect(byEmail.data.map((x: any) => x.name)).toEqual(['N07']);
    const byPhone: any = await customers.findAllWithFilters(
      { search: 'ph12' },
      cid(),
    );
    expect(byPhone.data.map((x: any) => x.name)).toEqual(['N12']);
    const none: any = await customers.findAllWithFilters(
      { search: 'zzz-none' },
      cid(),
    );
    expect(none).toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 20, total_pages: 0 },
    });
    const over: any = await customers.findAllWithFilters({ limit: 101 }, cid());
    expect(over.meta.limit).toBe(100);
    expect(over.data).toHaveLength(25);
    const other: any = await customers.findAllWithFilters(
      {},
      w.bystander.consumer.id,
    );
    expect(other.meta.total).toBe(0);
  });

  it('[BE-CUST-212] {CustomerService.search} returns the data wrapper with all columns, matches a mid-string substring and is tenant scoped', async () => {
    const c = await mk({ name: 'Xx Mid Yy', phone: '0123', email: 'q@q.test' });
    const r: any = await customers.search('mid', cid());
    expect(Object.keys(r)).toEqual(['data']);
    expect(r.data).toEqual([c]);
    const foreign: any = await customers.search('mid', w.bystander.consumer.id);
    expect(foreign.data).toEqual([]);
    const phone: any = await customers.search(' 0123 ', cid());
    expect(phone.data).toHaveLength(1);
    const mail: any = await customers.search('Q@Q', cid());
    expect(mail.data).toHaveLength(1);
  });
});
