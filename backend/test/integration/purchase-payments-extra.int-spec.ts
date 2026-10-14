import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createBatch, createVariant, createVendor } from '../factories';
import { PurchasePaymentsService } from '../../src/consumer/purchase-payments/services/purchase-payments.service';

describe('vendor (purchase) payments (extra, adversarial)', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let ppay: PurchasePaymentsService;

  beforeAll(async () => {
    boot = await bootDomain();
    ppay = boot.get(PurchasePaymentsService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot, { branches: 2 });
  });
  afterEach(() => w.check());

  const cid = () => w.tenant.consumer.id;
  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );
  const prisma = () => (ppay as any).prisma;
  const purchase = async (
    o: {
      qty?: number;
      cost?: number;
      paid?: number;
      status?: string;
      productName?: string;
      variantName?: string;
      created_at?: Date;
    } = {},
  ) => {
    const qty = o.qty ?? 10;
    const cost = o.cost ?? 40;
    const paid = o.paid ?? 100;
    const variant = await createVariant(
      db,
      w.tenant,
      { name: o.variantName ?? 'Default' },
      o.productName ? { name: o.productName } : {},
    );
    return createBatch(db, w.tenant, {
      variant_id: variant.id,
      branch_id: w.tenant.branches[0].id,
      quantity: qty,
      cost_price: cost,
      paid_amount: paid,
      payment_status:
        o.status ??
        (paid >= qty * cost ? 'paid' : paid > 0 ? 'partial' : 'due'),
      ...(o.created_at ? { created_at: o.created_at } : {}),
    });
  };
  const pay = (batchId: number, payments: any[], consumerId = cid()) =>
    ppay.makePayment({ batch_id: batchId, payments }, consumerId) as any;
  const list = (filters: object = {}, consumerId = cid()) =>
    ppay.getPurchaseBatches(filters, consumerId) as Promise<any>;
  const ids = (res: any) => res.data.map((b: any) => b.id);
  const stored = async (id: number) =>
    db.inventoryBatch.findUniqueOrThrow({ where: { id } });

  it("[BE-PPAY-201] {PurchasePaymentsService.getBatchForPayment} {PurchasePaymentsService.getBatchPayments} {PurchasePaymentsService.makePayment} another tenant's batch is a 404 and nothing is written", async () => {
    const b = await purchase({ qty: 10, cost: 40, paid: 0 });
    const other = w.bystander.consumer.id;
    for (const call of [
      () => ppay.getBatchForPayment(b.id, other),
      () => ppay.getBatchPayments(b.id, other),
      () => pay(b.id, [{ payment_method: 'CASH', amount: 5 }], other),
    ]) {
      const e = await failure(call());
      expect(e).toBeInstanceOf(NotFoundException);
      expect(e.message).toBe('Batch not found');
    }
    expect(await db.purchasePayment.count({ where: { batch_id: b.id } })).toBe(
      0,
    );
    expect(Number((await stored(b.id)).paid_amount)).toBe(0);
  });

  it('[BE-PPAY-202] {PurchasePaymentsService.makePayment} checks run in a fixed order: payment list, batch, quantity, paid flag, amount', async () => {
    // bad payments win over a missing batch
    const bad = await failure(
      pay(999999, [{ payment_method: 'CASH', amount: 0 }]),
    );
    expect(bad).toBeInstanceOf(BadRequestException);
    expect(bad.message).toBe('Total payment amount must be greater than 0');
    const none = await failure(pay(999999, []));
    expect(none.message).toBe('At least one payment method is required');
    // zero quantity wins over an already-paid flag
    const zeroPaid = await purchase({
      qty: 0,
      cost: 40,
      paid: 0,
      status: 'paid',
    });
    expect(
      (await failure(pay(zeroPaid.id, [{ payment_method: 'CASH', amount: 1 }])))
        .message,
    ).toBe('Cannot make a vendor payment for a batch with zero quantity');
    // an already-paid flag wins over an excessive amount
    const paid = await purchase({ qty: 1, cost: 10, paid: 10 });
    expect(
      (await failure(pay(paid.id, [{ payment_method: 'CASH', amount: 99999 }])))
        .message,
    ).toBe('Batch is already fully paid');
  });

  it('[BE-PPAY-203] {PurchasePaymentsService.makePayment} string amounts are summed as numbers, an empty reference is stored as null and the stored amount is kept', async () => {
    const b = await purchase({ qty: 10, cost: 40, paid: 0 });
    const res = await pay(b.id, [
      { payment_method: 'CASH', amount: '50.25', reference: '' },
      { payment_method: 'CARD', amount: 20, reference: 'R-1' },
    ]);
    expect(Number(res.batch.paid_amount)).toBe(70.25);
    expect(res.batch.remaining_amount).toBeCloseTo(329.75, 5);
    const rows = await db.purchasePayment.findMany({
      where: { batch_id: b.id },
      orderBy: { id: 'asc' },
    });
    expect(
      rows.map((r) => [r.payment_method, Number(r.amount), r.reference]),
    ).toEqual([
      ['CASH', 50.25, null],
      ['CARD', 20, 'R-1'],
    ]);
    expect(res.payments).toHaveLength(2);
    expect(res.payments.map((p: any) => p.batch_id)).toEqual([b.id, b.id]);
  });

  it('[BE-PPAY-204] {PurchasePaymentsService.makePayment} the response batch has exactly the selected fields plus total cost and remaining amount', async () => {
    const b = await purchase({ qty: 10, cost: 40, paid: 100 });
    const res = await pay(b.id, [{ payment_method: 'CASH', amount: 1 }]);
    expect(Object.keys(res).sort()).toEqual(['batch', 'payments']);
    expect(Object.keys(res.batch).sort()).toEqual(
      [
        'batch_number',
        'cost_price',
        'id',
        'paid_amount',
        'payment_status',
        'quantity',
        'remaining_amount',
        'total_cost',
      ].sort(),
    );
    expect(res.batch.total_cost).toBe(400);
    expect(res.batch.remaining_amount).toBe(299);
    expect(res.batch.payment_status).toBe('partial');
  });

  it('[BE-PPAY-205] {PurchasePaymentsService.makePayment} a payment is refused when the batch cost changed since it was read', async () => {
    const b = await purchase({ qty: 10, cost: 40, paid: 100 });
    const current = await stored(b.id);
    const spy = jest
      .spyOn(prisma().inventoryBatch, 'findFirst')
      .mockResolvedValueOnce({ ...current, cost_price: 41 });
    const e = await failure(
      pay(b.id, [{ payment_method: 'CASH', amount: 10 }]),
    );
    spy.mockRestore();
    expect(e).toBeInstanceOf(BadRequestException);
    expect(e.message).toBe('Batch changed. Refresh and try the payment again.');
    expect(await db.purchasePayment.count({ where: { batch_id: b.id } })).toBe(
      0,
    );
  });

  it('[BE-PPAY-206] {PurchasePaymentsService.makePayment} the claim touches only the paid batch', async () => {
    const a = await purchase({ qty: 10, cost: 40, paid: 100 });
    const other = await purchase({ qty: 10, cost: 40, paid: 100 });
    await pay(a.id, [{ payment_method: 'CASH', amount: 25 }]);
    expect(Number((await stored(a.id)).paid_amount)).toBe(125);
    expect(Number((await stored(other.id)).paid_amount)).toBe(100);
    expect(
      await db.purchasePayment.count({ where: { batch_id: other.id } }),
    ).toBe(0);
  });

  it('[BE-PPAY-207] {PurchasePaymentsService.makePayment} a payment that fails part way leaves the balance and payment rows untouched', async () => {
    const b = await purchase({ qty: 10, cost: 40, paid: 100 });
    const e = await failure(
      pay(b.id, [
        { payment_method: 'CASH', amount: 10 },
        { payment_method: 'NOT_A_METHOD', amount: 10 },
      ]),
    );
    expect(e).toBeTruthy();
    expect(e.message).not.toBe('Batch not found');
    expect(await db.purchasePayment.count({ where: { batch_id: b.id } })).toBe(
      0,
    );
    const row = await stored(b.id);
    expect(Number(row.paid_amount)).toBe(100);
    expect(row.payment_status).toBe('partial');
  });

  it('[BE-PPAY-208] {PurchasePaymentsService.makePayment} paying the exact remainder settles the batch and a short payment leaves it partial', async () => {
    const b = await purchase({ qty: 10, cost: 40, paid: 100 });
    const short = await pay(b.id, [{ payment_method: 'CASH', amount: 299 }]);
    expect(short.batch.payment_status).toBe('partial');
    const last = await pay(b.id, [{ payment_method: 'CASH', amount: 1 }]);
    expect(last.batch.payment_status).toBe('paid');
    expect(last.batch.remaining_amount).toBe(0);
    const again = await failure(
      pay(b.id, [{ payment_method: 'CASH', amount: 1 }]),
    );
    expect(again.message).toBe('Batch is already fully paid');
  });

  it('[BE-PPAY-209] {PurchasePaymentsService.getPurchaseBatches} defaults: page 1, 20 rows, newest first; the second page holds the rest', async () => {
    const created: number[] = [];
    for (let i = 0; i < 21; i++) {
      const b = await purchase({
        qty: 1,
        cost: 1,
        paid: 1,
        created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      });
      created.push(b.id);
    }
    const first = await list();
    expect(first.data).toHaveLength(20);
    expect(first.meta).toEqual({
      total: 21,
      page: 1,
      limit: 20,
      total_pages: 2,
    });
    expect(ids(first)).toEqual([...created].reverse().slice(0, 20));
    const second = await list({ page: 2 });
    expect(ids(second)).toEqual([created[0]]);
    expect(second.meta.page).toBe(2);
    expect((await list({ limit: 5 })).meta.total_pages).toBe(5);
    expect((await list({ limit: 5 })).data).toHaveLength(5);
  });

  it('[BE-PPAY-210] {PurchasePaymentsService.getPurchaseBatches} an empty payment status means no filter, the unpaid keyword is not a stored status, and nothing yields zero pages', async () => {
    const paid = await purchase({ qty: 1, cost: 10, paid: 10 });
    const due = await purchase({ qty: 1, cost: 10, paid: 0 });
    expect(
      ids(await list({ payment_status: '' })).sort(
        (x: number, y: number) => x - y,
      ),
    ).toEqual([paid.id, due.id].sort((x, y) => x - y));
    expect(ids(await list({ payment_status: 'partial' }))).toEqual([]);
    const none = await list({ search: 'nothing-matches' });
    expect(none.meta).toEqual({ total: 0, page: 1, limit: 20, total_pages: 0 });
  });

  it('[BE-PPAY-211] findPurchaseBatches: fixed statuses win over the payment status filter; an empty list falls back to it', async () => {
    const paid = await purchase({ qty: 1, cost: 10, paid: 10 });
    const partial = await purchase({ qty: 1, cost: 10, paid: 5 });
    const due = await purchase({ qty: 1, cost: 10, paid: 0 });
    const run = (filters: object, statuses?: string[]) =>
      (ppay as any).findPurchaseBatches(filters, cid(), statuses);
    expect(ids(await run({ payment_status: 'due' }, ['paid']))).toEqual([
      paid.id,
    ]);
    expect(
      ids(await run({}, ['partial', 'due'])).sort(
        (x: number, y: number) => x - y,
      ),
    ).toEqual([partial.id, due.id].sort((x, y) => x - y));
    expect(ids(await run({ payment_status: 'due' }, []))).toEqual([due.id]);
    expect(ids(await run({ payment_status: 'due' }, undefined))).toEqual([
      due.id,
    ]);
  });

  it('[BE-PPAY-212] {PurchasePaymentsService.getPurchaseBatches} search never reaches another tenant, and list rows carry their payments newest first', async () => {
    const mine = await purchase({ productName: 'Shared Name Widget' });
    const vendor = await createVendor(db, { consumer_id: cid() });
    expect(vendor.id).toBeGreaterThan(0);
    await db.purchasePayment.create({
      data: {
        batch_id: mine.id,
        payment_method: 'CASH',
        amount: 1,
        created_at: new Date('2026-01-01T00:00:00Z'),
      },
    });
    await db.purchasePayment.create({
      data: {
        batch_id: mine.id,
        payment_method: 'CASH',
        amount: 2,
        created_at: new Date('2026-02-01T00:00:00Z'),
      },
    });
    const res = await list({ search: 'shared name' });
    expect(ids(res)).toEqual([mine.id]);
    expect(
      res.data[0].purchasePayments.map((p: any) => Number(p.amount)),
    ).toEqual([2, 1]);
    const theirs = await list(
      { search: 'shared name' },
      w.bystander.consumer.id,
    );
    expect(theirs.data).toEqual([]);
  });

  it('[BE-PPAY-213] {PurchasePaymentsService.getBatchForPayment} the variant is limited to id, name and product', async () => {
    const b = await purchase({ productName: 'Gizmo', variantName: 'Mini' });
    const got: any = await ppay.getBatchForPayment(b.id, cid());
    expect(got.variant).toEqual({
      id: b.variant_id,
      name: 'Mini',
      product: { id: expect.any(Number), name: 'Gizmo' },
    });
    expect(got.vendor).toBeNull();
    expect(got.total_cost).toBe(400);
  });

  it('[BE-PPAY-214] every method logs its failure with the ids and the stack, and answers with the exact message', async () => {
    const error = jest
      .spyOn((ppay as any).logger, 'error')
      .mockImplementation(() => undefined);
    const b = await purchase({});
    const cases: [string, string, () => Promise<unknown>, string, string][] = [
      [
        'inventoryBatch',
        'count',
        () => ppay.getPurchaseBatches({}, cid()),
        `Error getting purchase payment batches for consumer ${cid()}`,
        'Failed to get purchase payment batches',
      ],
      [
        'inventoryBatch',
        'findFirst',
        () => ppay.getBatchForPayment(b.id, cid()),
        `Error getting batch for payment with ID ${b.id} for consumer ${cid()}`,
        'Failed to get batch for payment',
      ],
      [
        'inventoryBatch',
        'findFirst',
        () => pay(b.id, [{ payment_method: 'CASH', amount: 1 }]),
        `Error making purchase payment for batch with ID ${b.id} for consumer ${cid()}`,
        'Failed to make payment',
      ],
      [
        'inventoryBatch',
        'findFirst',
        () => ppay.getBatchPayments(b.id, cid()),
        `Error fetching purchase payments for batch ${b.id} for consumer ${cid()}`,
        'Failed to fetch purchase payments',
      ],
    ];
    for (const [model, method, call, logged, message] of cases) {
      error.mockClear();
      const boom = new Error('db down');
      const spy = jest
        .spyOn(prisma()[model], method)
        .mockRejectedValueOnce(boom);
      const e = await failure(call());
      spy.mockRestore();
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(500);
      expect(e.message).toBe(message);
      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(logged, boom.stack);
    }
    error.mockRestore();
  });

  it('[BE-PPAY-215] client errors are rethrown as they are and not logged', async () => {
    const error = jest
      .spyOn((ppay as any).logger, 'error')
      .mockImplementation(() => undefined);
    const b = await purchase({});
    const calls: [string, () => Promise<unknown>][] = [
      ['count', () => ppay.getPurchaseBatches({}, cid())],
      ['findFirst', () => ppay.getBatchForPayment(b.id, cid())],
      ['findFirst', () => pay(b.id, [{ payment_method: 'CASH', amount: 1 }])],
      ['findFirst', () => ppay.getBatchPayments(b.id, cid())],
    ];
    for (const [method, call] of calls) {
      const own = new BadRequestException('readable');
      const spy = jest
        .spyOn(prisma().inventoryBatch, method)
        .mockRejectedValueOnce(own);
      const e = await failure(call());
      spy.mockRestore();
      expect(e).toBe(own);
    }
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
