import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { PaymentsService } from '../../src/consumer/payments/services/payments.service';

describe('sale payments (extra hardening)', () => {
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
  afterEach(() => {
    jest.restoreAllMocks();
    return w.check();
  });

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
  const prismaOf = () => (payments as any).prisma;
  const loggerSpy = () =>
    jest.spyOn((payments as any).logger, 'error').mockImplementation();
  const stored = (id: number) => db.sale.findUniqueOrThrow({ where: { id } });

  it('[BE-PAY-120] {PaymentsService.makePayment} a zero or negative total is refused even when single lines are positive', async () => {
    const s = await dueSale(100);
    const e = await failure(
      payments.makePayment(
        payDto(s.id, [
          { payment_method: 'CASH', amount: 5 },
          { payment_method: 'CARD', amount: -5 },
        ]),
        cid(),
      ),
    );
    expect(e).toBeInstanceOf(BadRequestException);
    expect(e.message).toBe('Total payment amount must be greater than 0');
    const e2 = await failure(
      payments.makePayment(
        payDto(s.id, [
          { payment_method: 'CASH', amount: 5 },
          { payment_method: 'CARD', amount: -6 },
        ]),
        cid(),
      ),
    );
    expect(e2.message).toBe('Total payment amount must be greater than 0');
    expect(await db.salePayment.count({ where: { sale_id: s.id } })).toBe(0);
    // the smallest positive total passes
    const ok: any = await payments.makePayment(
      payDto(s.id, [{ payment_method: 'CASH', amount: 0.01 }]),
      cid(),
    );
    expect(ok.sale.remaining_amount).toBe(99.99);
  });

  it('[BE-PAY-121] {PaymentsService.makePayment} string amounts are summed numerically; lines come back in input order with null references', async () => {
    const s = await dueSale(100);
    const res: any = await payments.makePayment(
      payDto(s.id, [
        { payment_method: 'CASH', amount: '10.5' },
        { payment_method: 'CARD', amount: '4.5', reference: 'r-2' },
        { payment_method: 'CASH', amount: 1 },
      ]),
      cid(),
    );
    expect(res.payments.map((p: any) => p.payment_method)).toEqual([
      'CASH',
      'CARD',
      'CASH',
    ]);
    expect(res.payments.map((p: any) => Number(p.amount))).toEqual([
      10.5, 4.5, 1,
    ]);
    expect(res.payments.map((p: any) => p.reference)).toEqual([
      null,
      'r-2',
      null,
    ]);
    expect(res.payments.every((p: any) => p.sale_id === s.id)).toBe(true);
    expect(Number(res.sale.received_amount)).toBe(16);
    expect(res.sale.remaining_amount).toBe(84);
    expect(Number((await stored(s.id)).received_amount)).toBe(16);
  });

  it('[BE-PAY-122] {PaymentsService.makePayment} only the targeted sale changes, and later payments build on the stored balance', async () => {
    const a = await dueSale(100);
    const b = await dueSale(100, 10);
    await payments.makePayment(
      payDto(a.id, [{ payment_method: 'CASH', amount: 30 }]),
      cid(),
    );
    await payments.makePayment(
      payDto(a.id, [{ payment_method: 'CASH', amount: 20 }]),
      cid(),
    );
    const sa = await stored(a.id);
    expect(Number(sa.received_amount)).toBe(50);
    expect(sa.payment_status).toBe('partial');
    const sb = await stored(b.id);
    expect(Number(sb.received_amount)).toBe(10);
    expect(sb.payment_status).toBe('partial');
    expect(await db.salePayment.count({ where: { sale_id: b.id } })).toBe(1);
    const fin: any = await payments.makePayment(
      payDto(a.id, [{ payment_method: 'CASH', amount: 50 }]),
      cid(),
    );
    expect(fin.sale.payment_status).toBe('paid');
    expect(fin.sale.remaining_amount).toBe(0);
  });

  it('[BE-PAY-123] {PaymentsService.makePayment} amounts are re-read under the lock, not taken from the unlocked read', async () => {
    const s = await dueSale(100);
    const prisma = prismaOf();
    const realFind = prisma.sale.findFirst.bind(prisma.sale);
    jest
      .spyOn(prisma.sale, 'findFirst')
      .mockImplementationOnce(async (args: any) => {
        const row = await realFind(args);
        await db.salePayment.create({
          data: { sale_id: s.id, payment_method: 'CASH', amount: 90 },
        });
        await db.sale.update({
          where: { id: s.id },
          data: { received_amount: 90, payment_status: 'partial' },
        });
        return row;
      });
    const e = await failure(
      payments.makePayment(
        payDto(s.id, [{ payment_method: 'CASH', amount: 20 }]),
        cid(),
      ),
    );
    expect(e).toBeInstanceOf(BadRequestException);
    expect(e.message).toBe(
      'Total payment amount (20) exceeds remaining amount (10)',
    );
    expect(Number((await stored(s.id)).received_amount)).toBe(90);
    expect(await db.salePayment.count({ where: { sale_id: s.id } })).toBe(1);
  });

  it('[BE-PAY-124] {PaymentsService.makePayment} cent rounding at the boundary and in the overpay message', async () => {
    const s = await dueSale(100, 66.67);
    const over = await failure(
      payments.makePayment(
        payDto(s.id, [{ payment_method: 'CASH', amount: 33.34 }]),
        cid(),
      ),
    );
    expect(over.message).toBe(
      'Total payment amount (33.34) exceeds remaining amount (33.33)',
    );
    const ok: any = await payments.makePayment(
      payDto(s.id, [
        { payment_method: 'CASH', amount: 11.11 },
        { payment_method: 'CASH', amount: 22.22 },
      ]),
      cid(),
    );
    expect(ok.sale.payment_status).toBe('paid');
    expect(Number(ok.sale.received_amount)).toBe(100);
    expect(ok.sale.remaining_amount).toBe(0);
    // multi-line overpay names the summed figure
    const s2 = await dueSale(50);
    const over2 = await failure(
      payments.makePayment(
        payDto(s2.id, [
          { payment_method: 'CASH', amount: 25 },
          { payment_method: 'CARD', amount: 25.5 },
        ]),
        cid(),
      ),
    );
    expect(over2.message).toBe(
      'Total payment amount (50.5) exceeds remaining amount (50)',
    );
    expect(await db.salePayment.count({ where: { sale_id: s2.id } })).toBe(0);
  });

  it('[BE-PAY-125] {PaymentsService.makePayment} 500s are logged with the sale and tenant, client errors are not', async () => {
    const s = await dueSale(100);
    const log = loggerSpy();
    const prisma = prismaOf();
    const boom = new Error('db down');
    jest.spyOn(prisma.sale, 'findFirst').mockRejectedValueOnce(boom);
    const e = await failure(
      payments.makePayment(
        payDto(s.id, [{ payment_method: 'CASH', amount: 5 }]),
        cid(),
      ),
    );
    expect(e).toBeInstanceOf(HttpException);
    expect(e.getStatus()).toBe(500);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      `Error making payment for sale with ID ${s.id} for consumer ${cid()}`,
      boom.stack,
    );
    // a failure of the transaction itself is wrapped the same way
    log.mockClear();
    jest.spyOn(prisma, '$transaction').mockRejectedValueOnce(boom);
    const e2 = await failure(
      payments.makePayment(
        payDto(s.id, [{ payment_method: 'CASH', amount: 5 }]),
        cid(),
      ),
    );
    expect(e2.getStatus()).toBe(500);
    expect(e2.message).toBe('Failed to make payment');
    expect(log).toHaveBeenCalledTimes(1);
    expect(Number((await stored(s.id)).received_amount)).toBe(0);
    // client errors skip the logger
    log.mockClear();
    await failure(payments.makePayment(payDto(s.id, []), cid()));
    await failure(
      payments.makePayment(
        payDto(999999, [{ payment_method: 'CASH', amount: 5 }]),
        cid(),
      ),
    );
    expect(log).not.toHaveBeenCalled();
  });

  it('[BE-PAY-126] {PaymentsService.makePayment} a Prisma validation error passes through as-is rather than a generic 500', async () => {
    const s = await dueSale(100);
    const e = await failure(
      payments.makePayment(
        payDto(s.id, [{ payment_method: 'CASH', amount: 'abc' }]),
        cid(),
      ),
    );
    expect(e).not.toBeNull();
    expect(e).not.toBeInstanceOf(HttpException);
    expect(e.name).toBe('PrismaClientValidationError');
    expect(await db.salePayment.count({ where: { sale_id: s.id } })).toBe(0);
  });

  it('[BE-PAY-127] {PaymentsService.getPartiallyPaidSales} {PaymentsService.getSaleForPayment} rows carry exactly the selected fields', async () => {
    const s = await dueSale(100, 25);
    await db.sale.update({
      where: { id: s.id },
      data: { customer_name: 'Zed', customer_phone: '0123' },
    });
    await payments.makePayment(
      payDto(s.id, [{ payment_method: 'CASH', amount: 5, reference: 'q' }]),
      cid(),
    );
    const list: any = await payments.getPartiallyPaidSales({}, cid());
    expect(Object.keys(list.data[0]).sort()).toEqual(
      [
        'id',
        'sale_number',
        'customer_name',
        'customer_phone',
        'sale_date',
        'total_amount',
        'payment_status',
        'received_amount',
        'created_at',
        'branch',
        'branch_name',
        'remaining_amount',
      ].sort(),
    );
    expect(list.data[0]).toMatchObject({
      customer_name: 'Zed',
      customer_phone: '0123',
      remaining_amount: 70,
    });
    const one: any = await payments.getSaleForPayment(s.id, cid());
    expect(Object.keys(one).sort()).toEqual(
      [
        'id',
        'sale_number',
        'customer_name',
        'customer_phone',
        'sale_date',
        'total_amount',
        'payment_status',
        'received_amount',
        'created_at',
        'branch',
        'payments',
        'branch_name',
        'remaining_amount',
      ].sort(),
    );
    expect(Object.keys(one.payments[0]).sort()).toEqual(
      ['id', 'payment_method', 'amount', 'reference', 'created_at'].sort(),
    );
    expect(one.customer_name).toBe('Zed');
    expect(one.remaining_amount).toBe(70);
    // only live sales of this tenant
    const foreign = await failure(
      payments.getSaleForPayment(s.id, w.bystander.consumer.id),
    );
    expect(foreign).toBeInstanceOf(NotFoundException);
  });

  it('[BE-PAY-128] {PaymentsService.getPartiallyPaidSales} default page size is 20; date bounds are inclusive; search matches each column alone', async () => {
    for (let i = 0; i < 21; i++) await dueSale(10);
    const page: any = await payments.getPartiallyPaidSales({}, cid());
    expect(page.data).toHaveLength(20);
    expect(page.meta).toEqual({
      total: 21,
      page: 1,
      limit: 20,
      total_pages: 2,
    });
    const p2: any = await payments.getPartiallyPaidSales({ page: 2 }, cid());
    expect(p2.data).toHaveLength(1);

    const x = page.data[0];
    const y = page.data[1];
    await db.sale.update({
      where: { id: x.id },
      data: { sale_date: new Date('2024-05-01T00:00:00.000Z') },
    });
    await db.sale.update({
      where: { id: y.id },
      data: {
        sale_date: new Date('2024-05-02T00:00:00.000Z'),
        customer_name: 'Quincy',
        customer_phone: '777-1',
      },
    });
    const ids = async (f: object) =>
      (
        (await payments.getPartiallyPaidSales(
          { ...f, limit: 50 },
          cid(),
        )) as any
      ).data
        .map((s: any) => s.id)
        .sort((a: number, b: number) => a - b);
    expect(
      await ids({
        date_from: '2024-05-01T00:00:00.000Z',
        date_to: '2024-05-01T00:00:00.000Z',
      }),
    ).toEqual([x.id]);
    expect(
      await ids({
        date_from: '2024-05-02T00:00:00.000Z',
        date_to: '2024-05-02T00:00:00.000Z',
      }),
    ).toEqual([y.id]);
    expect(await ids({ search: 'quincy' })).toEqual([y.id]);
    expect(await ids({ search: '777-1' })).toEqual([y.id]);
    expect(await ids({ search: y.sale_number })).toEqual([y.id]);
  });

  it('[BE-PAY-129] list, detail and history 500s are logged with their own messages', async () => {
    const log = loggerSpy();
    const prisma = prismaOf();
    const boom = new Error('boom');
    jest.spyOn(prisma.sale, 'count').mockRejectedValueOnce(boom);
    await failure(payments.getPartiallyPaidSales({}, cid()));
    expect(log).toHaveBeenLastCalledWith(
      `Error getting partially paid sales for consumer ${cid()}`,
      boom.stack,
    );
    jest.spyOn(prisma.sale, 'findFirst').mockRejectedValueOnce(boom);
    await failure(payments.getSaleForPayment(42, cid()));
    expect(log).toHaveBeenLastCalledWith(
      `Error getting sale for payment with ID 42 for consumer ${cid()}`,
      boom.stack,
    );
    jest.spyOn(prisma.sale, 'findFirst').mockRejectedValueOnce(boom);
    await failure(payments.getSalePayments(43, cid()));
    expect(log).toHaveBeenLastCalledWith(
      `Error fetching sale payments with ID 43 for consumer ${cid()}`,
      boom.stack,
    );
    log.mockClear();
    await failure(payments.getSaleForPayment(99999999, cid()));
    await failure(payments.getSalePayments(99999999, cid()));
    expect(log).not.toHaveBeenCalled();
  });
});
