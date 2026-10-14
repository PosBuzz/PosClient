import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { PaymentsService } from '../../src/consumer/payments/services/payments.service';

describe('sale payments (detail)', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let payments: PaymentsService;

  beforeAll(async () => {
    boot = await bootDomain();
    payments = boot.get(PaymentsService);
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
  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );
  const dueSale = async (price = 100, paid: number | null = null) => {
    const v = await w.stock({ price, batches: [{ qty: 50, cost: 10 }] });
    return w.sell([{ variant: v, qty: 1 }], {}, paid);
  };
  const payDto = (saleId: number, payment: object[]) =>
    ({ sale_id: saleId, payments: payment }) as any;

  it('[BE-PAY-101] {PaymentsService.getPartiallyPaidSales} list rows carry branch name, remaining amount and paging meta', async () => {
    const s = await dueSale(100, 30);
    const res: any = await payments.getPartiallyPaidSales({}, cid());
    expect(res.meta).toEqual({ total: 1, page: 1, limit: 20, total_pages: 1 });
    expect(res.data).toHaveLength(1);
    expect(res.data[0]).toMatchObject({
      id: s.id,
      sale_number: s.sale_number,
      branch_name: w.tenant.branches[0].name,
      remaining_amount: 70,
      payment_status: 'partial',
    });
    expect(res.data[0].branch).toEqual({ name: w.tenant.branches[0].name });
  });

  it('[BE-PAY-102] {PaymentsService.getPartiallyPaidSales} paging, ordering and total_pages', async () => {
    const a = await dueSale(100);
    const b = await dueSale(100);
    const c = await dueSale(100);
    const p1: any = await payments.getPartiallyPaidSales(
      { page: 1, limit: 2 },
      cid(),
    );
    expect(p1.meta).toEqual({ total: 3, page: 1, limit: 2, total_pages: 2 });
    expect(p1.data).toHaveLength(2);
    const p2: any = await payments.getPartiallyPaidSales(
      { page: 2, limit: 2 },
      cid(),
    );
    expect(p2.data).toHaveLength(1);
    const ids = [...p1.data, ...p2.data].map((s: any) => s.id);
    expect(new Set(ids)).toEqual(new Set([a.id, b.id, c.id]));
    const asc: any = await payments.getPartiallyPaidSales(
      { sort_by: 'id', sort_order: 'asc' } as any,
      cid(),
    );
    expect(asc.data.map((s: any) => s.id)).toEqual([a.id, b.id, c.id]);
    const desc: any = await payments.getPartiallyPaidSales(
      { sort_by: 'id', sort_order: 'desc' } as any,
      cid(),
    );
    expect(desc.data.map((s: any) => s.id)).toEqual([c.id, b.id, a.id]);
    const dflt: any = await payments.getPartiallyPaidSales({}, cid());
    expect(dflt.data.map((s: any) => s.id)).toEqual(
      [...dflt.data]
        .sort(
          (x: any, y: any) =>
            new Date(y.sale_date).getTime() - new Date(x.sale_date).getTime(),
        )
        .map((s: any) => s.id),
    );
  });

  it('[BE-PAY-103] {PaymentsService.getPartiallyPaidSales} status, search, branch, date and tenant filters', async () => {
    const due = await dueSale(100);
    const partial = await dueSale(100, 40);
    const paid = await dueSale(100, 100);
    await db.sale.update({
      where: { id: due.id },
      data: {
        customer_name: 'Zebra Corp',
        customer_phone: '555-0101',
        sale_date: new Date('2024-01-10T00:00:00Z'),
      },
    });
    await db.sale.update({
      where: { id: partial.id },
      data: { sale_date: new Date('2024-03-10T00:00:00Z') },
    });

    const only = async (f: object) =>
      ((await payments.getPartiallyPaidSales(f, cid())) as any).data
        .map((s: any) => s.id)
        .sort();

    expect(await only({ payment_status: 'due' })).toEqual([due.id]);
    expect(await only({ payment_status: 'partial' })).toEqual([partial.id]);
    expect(await only({ payment_status: 'all' })).toEqual(
      [due.id, partial.id].sort(),
    );
    expect(await only({ payment_status: 'paid' })).toEqual([paid.id]);
    expect(await only({ search: 'zebra' })).toEqual([due.id]);
    expect(await only({ search: '555-0101' })).toEqual([due.id]);
    expect(await only({ search: due.sale_number })).toEqual([due.id]);
    expect(await only({ search: 'nomatch-xyz' })).toEqual([]);
    expect(await only({ branch_id: w.tenant.branches[0].id })).toEqual(
      [due.id, partial.id].sort(),
    );
    expect(await only({ branch_id: 999999 })).toEqual([]);
    expect(await only({ date_from: '2024-02-01' })).toEqual([partial.id]);
    expect(await only({ date_to: '2024-02-01' })).toEqual([due.id]);
    expect(
      await only({ date_from: '2024-01-01', date_to: '2024-12-31' }),
    ).toEqual([due.id, partial.id].sort());
    // quotations never appear
    await db.sale.update({
      where: { id: due.id },
      data: { sale_type: 'quotation' },
    });
    expect(await only({})).toEqual([partial.id]);
    // other tenant sees nothing
    expect(
      (
        (await payments.getPartiallyPaidSales(
          {},
          w.bystander.consumer.id,
        )) as any
      ).data,
    ).toEqual([]);
  });

  it('[BE-PAY-104] {PaymentsService.getSaleForPayment} returns the sale with newest-first payments and remaining amount', async () => {
    const s = await dueSale(100);
    await payments.makePayment(
      payDto(s.id, [{ payment_method: 'CASH', amount: 10, reference: 'r1' }]),
      cid(),
    );
    await new Promise((r) => setTimeout(r, 15));
    await payments.makePayment(
      payDto(s.id, [{ payment_method: 'CARD', amount: 20, reference: 'r2' }]),
      cid(),
    );
    const res: any = await payments.getSaleForPayment(s.id, cid());
    expect(res).toMatchObject({
      id: s.id,
      sale_number: s.sale_number,
      branch_name: w.tenant.branches[0].name,
      remaining_amount: 70,
      payment_status: 'partial',
    });
    expect(res.payments.map((p: any) => p.reference)).toEqual(['r2', 'r1']);
    expect(res.payments[0]).toMatchObject({ payment_method: 'CARD' });
  });

  it('[BE-PAY-105] {PaymentsService.getSaleForPayment} refuses missing, foreign, quotation, deleted, paid and cancelled sales', async () => {
    const s = await dueSale(100);
    const nf = await failure(payments.getSaleForPayment(999999, cid()));
    expect(nf).toBeInstanceOf(NotFoundException);
    expect(nf.message).toBe('Sale not found');
    expect(
      await failure(payments.getSaleForPayment(s.id, w.bystander.consumer.id)),
    ).toBeInstanceOf(NotFoundException);

    await db.sale.update({
      where: { id: s.id },
      data: { payment_status: 'paid' },
    });
    const paid = await failure(payments.getSaleForPayment(s.id, cid()));
    expect(paid).toBeInstanceOf(BadRequestException);
    expect(paid.message).toBe('Sale is already fully paid');

    await db.sale.update({
      where: { id: s.id },
      data: { payment_status: 'cancelled' },
    });
    const cancelled = await failure(payments.getSaleForPayment(s.id, cid()));
    expect(cancelled).toBeInstanceOf(BadRequestException);
    expect(cancelled.message).toBe('Cannot make payment on cancelled sale');

    await db.sale.update({
      where: { id: s.id },
      data: { payment_status: 'due', sale_type: 'quotation' },
    });
    expect(
      await failure(payments.getSaleForPayment(s.id, cid())),
    ).toBeInstanceOf(NotFoundException);
    await db.sale.update({
      where: { id: s.id },
      data: { sale_type: 'sale', deleted_at: new Date() },
    });
    expect(
      await failure(payments.getSaleForPayment(s.id, cid())),
    ).toBeInstanceOf(NotFoundException);
  });

  it('[BE-PAY-106] {PaymentsService.makePayment} validation messages and nothing is written', async () => {
    const s = await dueSale(100);
    const none = await failure(
      payments.makePayment({ sale_id: s.id } as any, cid()),
    );
    expect(none).toBeInstanceOf(BadRequestException);
    expect(none.message).toBe('At least one payment method is required');
    const empty = await failure(payments.makePayment(payDto(s.id, []), cid()));
    expect(empty.message).toBe('At least one payment method is required');
    for (const amount of [0, -5]) {
      const e = await failure(
        payments.makePayment(
          payDto(s.id, [{ payment_method: 'CASH', amount }]),
          cid(),
        ),
      );
      expect(e).toBeInstanceOf(BadRequestException);
      expect(e.message).toBe('Total payment amount must be greater than 0');
    }
    const missing = await failure(
      payments.makePayment(
        payDto(999999, [{ payment_method: 'CASH', amount: 5 }]),
        cid(),
      ),
    );
    expect(missing).toBeInstanceOf(NotFoundException);
    expect(missing.message).toBe('Sale not found');
    expect(await db.salePayment.count({ where: { sale_id: s.id } })).toBe(0);
  });

  it('[BE-PAY-107] {PaymentsService.makePayment} cancelled, paid, quotation and deleted sales are refused with their own message', async () => {
    const s = await dueSale(100);
    const attempt = () =>
      failure(
        payments.makePayment(
          payDto(s.id, [{ payment_method: 'CASH', amount: 5 }]),
          cid(),
        ),
      );
    await db.sale.update({
      where: { id: s.id },
      data: { payment_status: 'cancelled' },
    });
    const c = await attempt();
    expect(c).toBeInstanceOf(BadRequestException);
    expect(c.message).toBe('Cannot make payment on cancelled sale');
    await db.sale.update({
      where: { id: s.id },
      data: { payment_status: 'paid' },
    });
    expect((await attempt()).message).toBe('Sale is already fully paid');
    await db.sale.update({
      where: { id: s.id },
      data: { payment_status: 'due', sale_type: 'quotation' },
    });
    expect(await attempt()).toBeInstanceOf(NotFoundException);
    await db.sale.update({
      where: { id: s.id },
      data: { sale_type: 'sale', deleted_at: new Date() },
    });
    expect(await attempt()).toBeInstanceOf(NotFoundException);
    expect(await db.salePayment.count({ where: { sale_id: s.id } })).toBe(0);
  });

  it('[BE-PAY-108] {PaymentsService.makePayment} a status changed after validation is refused under the row lock', async () => {
    const s = await dueSale(100);
    const prisma: any = (payments as any).prisma;
    const realFind = prisma.sale.findFirst.bind(prisma.sale);
    // Concurrent writer flips the row right after the unlocked read.
    for (const status of ['paid', 'cancelled']) {
      const spy = jest
        .spyOn(prisma.sale, 'findFirst')
        .mockImplementationOnce(async (args: any) => {
          const row = await realFind(args);
          await db.sale.update({
            where: { id: s.id },
            data: { payment_status: status },
          });
          return row;
        });
      const e = await failure(
        payments.makePayment(
          payDto(s.id, [{ payment_method: 'CASH', amount: 5 }]),
          cid(),
        ),
      );
      spy.mockRestore();
      expect(e).toBeInstanceOf(BadRequestException);
      expect(e.message).toBe(
        status === 'paid'
          ? 'Sale is already fully paid'
          : 'Cannot make payment on cancelled sale',
      );
      await db.sale.update({
        where: { id: s.id },
        data: { payment_status: 'due' },
      });
    }
    // Row vanishes between read and lock
    const spy = jest
      .spyOn(prisma.sale, 'findFirst')
      .mockImplementationOnce(async (args: any) => {
        const row = await realFind(args);
        await db.sale.update({
          where: { id: s.id },
          data: { deleted_at: null },
        });
        await db.$executeRaw`DELETE FROM "sale_payments" WHERE "sale_id" = ${s.id}`.catch(
          () => 0,
        );
        return { ...row, id: 987654 };
      });
    const e = await failure(
      payments.makePayment(
        payDto(987654, [{ payment_method: 'CASH', amount: 5 }]),
        cid(),
      ),
    );
    spy.mockRestore();
    expect(e).toBeInstanceOf(NotFoundException);
    expect(e.message).toBe('Sale not found');
    expect(await db.salePayment.count({ where: { sale_id: s.id } })).toBe(0);
  });

  it('[BE-PAY-109] {PaymentsService.makePayment} stores every payment line and returns the updated sale', async () => {
    const s = await dueSale(100);
    const res: any = await payments.makePayment(
      payDto(s.id, [
        { payment_method: 'CASH', amount: 25, reference: 'ref-a' },
        { payment_method: 'CARD', amount: 15.5, reference: 'ref-b' },
      ]),
      cid(),
    );
    expect(res.payments).toHaveLength(2);
    expect(res.sale).toEqual({
      id: s.id,
      sale_number: s.sale_number,
      total_amount: expect.anything(),
      received_amount: expect.anything(),
      payment_status: 'partial',
      remaining_amount: 59.5,
    });
    expect(Number(res.sale.total_amount)).toBe(100);
    expect(Number(res.sale.received_amount)).toBe(40.5);
    const rows = await db.salePayment.findMany({
      where: { sale_id: s.id },
      orderBy: { id: 'asc' },
    });
    expect(
      rows.map((r) => [r.payment_method, Number(r.amount), r.reference]),
    ).toEqual([
      ['CASH', 25, 'ref-a'],
      ['CARD', 15.5, 'ref-b'],
    ]);
    const stored = await db.sale.findUniqueOrThrow({ where: { id: s.id } });
    expect(Number(stored.received_amount)).toBe(40.5);
    expect(stored.payment_status).toBe('partial');
  });

  it('[BE-PAY-110] {PaymentsService.makePayment} paying exactly the remainder settles; one cent over is refused with the remaining figure', async () => {
    const s = await dueSale(100, 20);
    const over = await failure(
      payments.makePayment(
        payDto(s.id, [{ payment_method: 'CASH', amount: 80.01 }]),
        cid(),
      ),
    );
    expect(over).toBeInstanceOf(BadRequestException);
    expect(over.message).toBe(
      'Total payment amount (80.01) exceeds remaining amount (80)',
    );
    const ok: any = await payments.makePayment(
      payDto(s.id, [{ payment_method: 'CASH', amount: 80 }]),
      cid(),
    );
    expect(ok.sale).toMatchObject({
      payment_status: 'paid',
      remaining_amount: 0,
    });
  });

  it('[BE-PAY-111] {PaymentsService.makePayment} unexpected failures are wrapped as a 500', async () => {
    const s = await dueSale(100);
    const prisma: any = (payments as any).prisma;
    const spy = jest
      .spyOn(prisma.sale, 'findFirst')
      .mockRejectedValueOnce(new Error('db down'));
    const e = await failure(
      payments.makePayment(
        payDto(s.id, [{ payment_method: 'CASH', amount: 5 }]),
        cid(),
      ),
    );
    spy.mockRestore();
    expect(e).toBeInstanceOf(HttpException);
    expect(e.getStatus()).toBe(500);
    expect(e.message).toBe('Failed to make payment');
  });

  it('[BE-PAY-112] {PaymentsService.getSalePayments} lists newest first, includes paid sales, hides foreign and deleted ones', async () => {
    const s = await dueSale(100);
    await payments.makePayment(
      payDto(s.id, [{ payment_method: 'CASH', amount: 10, reference: 'one' }]),
      cid(),
    );
    await new Promise((r) => setTimeout(r, 15));
    await payments.makePayment(
      payDto(s.id, [{ payment_method: 'CARD', amount: 90, reference: 'two' }]),
      cid(),
    );
    const res: any = await payments.getSalePayments(s.id, cid());
    expect(res.payments.map((p: any) => p.reference)).toEqual(['two', 'one']);
    expect(Object.keys(res.payments[0]).sort()).toEqual(
      [
        'amount',
        'created_at',
        'id',
        'payment_method',
        'reference',
        'updated_at',
      ].sort(),
    );
    const other = await dueSale(100);
    await payments.makePayment(
      payDto(other.id, [{ payment_method: 'CASH', amount: 1, reference: 'x' }]),
      cid(),
    );
    expect((await payments.getSalePayments(s.id, cid())).payments).toHaveLength(
      2,
    );
    const nf = await failure(
      payments.getSalePayments(s.id, w.bystander.consumer.id),
    );
    expect(nf).toBeInstanceOf(NotFoundException);
    expect(nf.message).toBe('Sale not found');
    await db.sale.update({
      where: { id: s.id },
      data: { deleted_at: new Date() },
    });
    expect(await failure(payments.getSalePayments(s.id, cid()))).toBeInstanceOf(
      NotFoundException,
    );
  });

  it('[BE-PAY-113] unexpected failures in list, detail and history are wrapped as a 500', async () => {
    const prisma: any = (payments as any).prisma;
    const cases: [string, () => Promise<unknown>, string][] = [
      [
        'count',
        () => payments.getPartiallyPaidSales({}, cid()),
        'Failed to get partially paid sales',
      ],
      [
        'findFirst',
        () => payments.getSaleForPayment(1, cid()),
        'Failed to get sale for payment',
      ],
      [
        'findFirst',
        () => payments.getSalePayments(1, cid()),
        'Failed to fetch sale payments',
      ],
    ];
    for (const [fn, call, message] of cases) {
      const spy = jest
        .spyOn(prisma.sale, fn as any)
        .mockRejectedValueOnce(new Error('boom'));
      const e = await failure(call());
      spy.mockRestore();
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(500);
      expect(e.message).toBe(message);
    }
  });
});
