import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createBatch, createVariant, createVendor } from '../factories';
import { PurchasePaymentsService } from '../../src/consumer/purchase-payments/services/purchase-payments.service';

describe('vendor (purchase) payments (detail)', () => {
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
  /** A purchase of `qty` units at `cost` with `paid` already paid. */
  const purchase = async (
    o: {
      qty?: number;
      cost?: number;
      paid?: number;
      status?: string;
      productName?: string;
      variantName?: string;
      batch_number?: string;
      vendor_id?: number | null;
      branch?: number;
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
      branch_id: w.tenant.branches[o.branch ?? 0].id,
      quantity: qty,
      cost_price: cost,
      paid_amount: paid,
      payment_status:
        o.status ??
        (paid >= qty * cost ? 'paid' : paid > 0 ? 'partial' : 'due'),
      ...(o.batch_number ? { batch_number: o.batch_number } : {}),
      ...(o.vendor_id !== undefined ? { vendor_id: o.vendor_id } : {}),
      ...(o.created_at ? { created_at: o.created_at } : {}),
    });
  };
  const pay = (batchId: number, payments: any[], consumerId = cid()) =>
    ppay.makePayment({ batch_id: batchId, payments }, consumerId) as any;
  const list = (filters: object = {}, consumerId = cid()) =>
    ppay.getPurchaseBatches(filters, consumerId) as Promise<any>;
  const ids = (res: any) => res.data.map((b: any) => b.id);

  it('[BE-PPAY-101] {PurchasePaymentsService.getPurchaseBatches} rows carry the relations, total cost, remaining amount and paging meta', async () => {
    const vendor = await createVendor(db, { consumer_id: cid(), name: 'Acme' });
    const b = await purchase({
      qty: 10,
      cost: 40,
      paid: 100,
      productName: 'Widget',
      variantName: 'Large',
      vendor_id: vendor.id,
    });
    const res = await list();
    expect(res.meta).toEqual({ total: 1, page: 1, limit: 20, total_pages: 1 });
    expect(res.data).toHaveLength(1);
    const row = res.data[0];
    expect(row).toMatchObject({
      id: b.id,
      total_cost: 400,
      remaining_amount: 300,
      payment_status: 'partial',
    });
    expect(row.variant).toEqual({
      id: b.variant_id,
      name: 'Large',
      product: expect.objectContaining({ name: 'Widget' }),
    });
    expect(Object.keys(row.variant.product).sort()).toEqual(['id', 'name']);
    expect(row.branch).toEqual({
      id: w.tenant.branches[0].id,
      name: w.tenant.branches[0].name,
    });
    expect(row.vendor).toEqual({ id: vendor.id, name: 'Acme' });
    expect(row.purchasePayments).toEqual([]);
  });

  it('[BE-PPAY-102] {PurchasePaymentsService.getPurchaseBatches} only this tenant is listed and paid-up or overpaid rows never show a negative remaining amount', async () => {
    const paid = await purchase({ qty: 5, cost: 10, paid: 80 });
    const exact = await purchase({ qty: 5, cost: 10, paid: 50 });
    const res = await list();
    expect(ids(res).sort()).toEqual([paid.id, exact.id].sort());
    const byId = new Map(res.data.map((r: any) => [r.id, r]));
    expect((byId.get(paid.id) as any).remaining_amount).toBe(0);
    expect((byId.get(paid.id) as any).total_cost).toBe(50);
    expect((byId.get(exact.id) as any).remaining_amount).toBe(0);
    const theirs = await list({}, w.bystander.consumer.id);
    expect(theirs.data).toHaveLength(w.theirs.batches.length);
    expect(ids(theirs)).not.toContain(paid.id);
  });

  it('[BE-PPAY-103] {PurchasePaymentsService.getPurchaseBatches} total cost follows the quantity bought, not the stock left', async () => {
    const b = await purchase({ qty: 10, cost: 40, paid: 100 });
    await db.inventoryBatch.update({
      where: { id: b.id },
      data: { quantity: 2 },
    });
    const row = (await list()).data[0];
    expect(row.quantity).toBe(2);
    expect(row.total_cost).toBe(400);
    expect(row.remaining_amount).toBe(300);
    // a batch with no purchase row falls back to its current quantity
    await db.inventoryAuditLog.deleteMany({ where: { batch_id: b.id } });
    const fallback = (await list()).data[0];
    expect(fallback.total_cost).toBe(80);
    expect(fallback.remaining_amount).toBe(0);
    await db.inventoryBatch.delete({ where: { id: b.id } });
  });

  it('[BE-PPAY-104] {PurchasePaymentsService.getPurchaseBatches} the payment status filter: all, each status, and unpaid meaning partial or due', async () => {
    const paid = await purchase({ qty: 1, cost: 10, paid: 10 });
    const partial = await purchase({ qty: 1, cost: 10, paid: 5 });
    const due = await purchase({ qty: 1, cost: 10, paid: 0 });
    const sorted = (r: any) => ids(r).sort((a: number, b: number) => a - b);
    const all = [paid.id, partial.id, due.id].sort((a, b) => a - b);
    expect(sorted(await list())).toEqual(all);
    expect(sorted(await list({ payment_status: 'all' }))).toEqual(all);
    expect(ids(await list({ payment_status: 'paid' }))).toEqual([paid.id]);
    expect(ids(await list({ payment_status: 'partial' }))).toEqual([
      partial.id,
    ]);
    expect(ids(await list({ payment_status: 'due' }))).toEqual([due.id]);
    expect(sorted(await list({ payment_status: 'unpaid' }))).toEqual(
      [partial.id, due.id].sort((a, b) => a - b),
    );
  });

  it('[BE-PPAY-105] {PurchasePaymentsService.getPurchaseBatches} search matches batch number, product name or variant name, ignoring case', async () => {
    const a = await purchase({ batch_number: 'ZEBRA-77' });
    const b = await purchase({ productName: 'Quokka Chair' });
    const c = await purchase({ variantName: 'Narwhal Blue' });
    await purchase({});
    expect(ids(await list({ search: 'zebra' }))).toEqual([a.id]);
    expect(ids(await list({ search: 'QUOKKA' }))).toEqual([b.id]);
    expect(ids(await list({ search: 'narwhal' }))).toEqual([c.id]);
    expect((await list({ search: 'no-such-thing' })).data).toEqual([]);
    expect((await list({ search: 'no-such-thing' })).meta.total).toBe(0);
  });

  it('[BE-PPAY-106] {PurchasePaymentsService.getPurchaseBatches} branch, vendor and vendorless filters', async () => {
    const v1 = await createVendor(db, { consumer_id: cid() });
    const v2 = await createVendor(db, { consumer_id: cid() });
    const a = await purchase({ branch: 0, vendor_id: v1.id });
    const b = await purchase({ branch: 1, vendor_id: v2.id });
    const c = await purchase({ branch: 1, vendor_id: null });
    expect(
      ids(await list({ branch_id: w.tenant.branches[1].id })).sort(),
    ).toEqual([b.id, c.id].sort());
    expect(ids(await list({ branch_id: w.tenant.branches[0].id }))).toEqual([
      a.id,
    ]);
    expect(ids(await list({ vendor_id: v1.id }))).toEqual([a.id]);
    expect(ids(await list({ vendorless: true }))).toEqual([c.id]);
    // vendorless wins over a vendor id
    expect(ids(await list({ vendorless: true, vendor_id: v1.id }))).toEqual([
      c.id,
    ]);
    expect(ids(await list({ vendorless: false, vendor_id: v2.id }))).toEqual([
      b.id,
    ]);
  });

  it('[BE-PPAY-107] {PurchasePaymentsService.getPurchaseBatches} the date range is inclusive at both ends', async () => {
    const d1 = new Date('2026-03-01T00:00:00.000Z');
    const d2 = new Date('2026-03-10T00:00:00.000Z');
    const d3 = new Date('2026-03-20T00:00:00.000Z');
    const a = await purchase({ created_at: d1 });
    const b = await purchase({ created_at: d2 });
    const c = await purchase({ created_at: d3 });
    const sorted = (r: any) => ids(r).sort((x: number, y: number) => x - y);
    expect(sorted(await list({ date_from: d2.toISOString() }))).toEqual(
      [b.id, c.id].sort((x, y) => x - y),
    );
    expect(sorted(await list({ date_to: d2.toISOString() }))).toEqual(
      [a.id, b.id].sort((x, y) => x - y),
    );
    expect(
      ids(
        await list({
          date_from: d2.toISOString(),
          date_to: d2.toISOString(),
        }),
      ),
    ).toEqual([b.id]);
  });

  it('[BE-PPAY-108] {PurchasePaymentsService.getPurchaseBatches} paging, sort field and sort order', async () => {
    const a = await purchase({
      cost: 30,
      qty: 1,
      paid: 0,
      created_at: new Date('2026-01-01T00:00:00Z'),
    });
    const b = await purchase({
      cost: 10,
      qty: 1,
      paid: 0,
      created_at: new Date('2026-01-02T00:00:00Z'),
    });
    const c = await purchase({
      cost: 20,
      qty: 1,
      paid: 0,
      created_at: new Date('2026-01-03T00:00:00Z'),
    });
    expect(ids(await list())).toEqual([c.id, b.id, a.id]);
    expect(ids(await list({ sort_order: 'asc' }))).toEqual([a.id, b.id, c.id]);
    expect(
      ids(await list({ sort_by: 'cost_price', sort_order: 'asc' })),
    ).toEqual([b.id, c.id, a.id]);
    expect(
      ids(await list({ sort_by: 'cost_price', sort_order: 'desc' })),
    ).toEqual([a.id, c.id, b.id]);
    const p1 = await list({ page: 1, limit: 2, sort_order: 'asc' });
    expect(p1.meta).toEqual({ total: 3, page: 1, limit: 2, total_pages: 2 });
    expect(ids(p1)).toEqual([a.id, b.id]);
    const p2 = await list({ page: 2, limit: 2, sort_order: 'asc' });
    expect(p2.meta).toEqual({ total: 3, page: 2, limit: 2, total_pages: 2 });
    expect(ids(p2)).toEqual([c.id]);
    expect((await list({ page: 1, limit: 3 })).meta.total_pages).toBe(1);
  });

  it('[BE-PPAY-109] {PurchasePaymentsService.getBatchForPayment} returns the batch with relations, payments newest first and the signed remaining amount', async () => {
    const vendor = await createVendor(db, { consumer_id: cid(), name: 'Acme' });
    const b = await purchase({
      qty: 10,
      cost: 40,
      paid: 100,
      productName: 'Widget',
      vendor_id: vendor.id,
    });
    await db.purchasePayment.create({
      data: {
        batch_id: b.id,
        payment_method: 'CASH',
        amount: 40,
        created_at: new Date('2026-01-01T00:00:00Z'),
      },
    });
    await db.purchasePayment.create({
      data: {
        batch_id: b.id,
        payment_method: 'CASH',
        amount: 60,
        created_at: new Date('2026-02-01T00:00:00Z'),
      },
    });
    const got: any = await ppay.getBatchForPayment(b.id, cid());
    expect(got).toMatchObject({
      id: b.id,
      total_cost: 400,
      remaining_amount: 300,
    });
    expect(got.variant.product.name).toBe('Widget');
    expect(got.branch).toEqual({
      id: w.tenant.branches[0].id,
      name: w.tenant.branches[0].name,
    });
    expect(got.vendor).toEqual({ id: vendor.id, name: 'Acme' });
    expect(got.purchasePayments.map((p: any) => Number(p.amount))).toEqual([
      60, 40,
    ]);
    // an overpaid batch is reported as is, not clamped
    await db.inventoryBatch.update({
      where: { id: b.id },
      data: { paid_amount: 450 },
    });
    expect(
      ((await ppay.getBatchForPayment(b.id, cid())) as any).remaining_amount,
    ).toBe(-50);
  });

  it('[BE-PPAY-110] {PurchasePaymentsService.getBatchForPayment} {PurchasePaymentsService.getBatchPayments} a missing batch is a 404 with its message', async () => {
    for (const call of [
      () => ppay.getBatchForPayment(999999, cid()),
      () => ppay.getBatchPayments(999999, cid()),
      () => pay(999999, [{ payment_method: 'CASH', amount: 1 }]),
    ]) {
      const e = await failure(call());
      expect(e).toBeInstanceOf(NotFoundException);
      expect(e.getStatus()).toBe(404);
      expect(e.message).toBe('Batch not found');
    }
  });

  it('[BE-PPAY-111] {PurchasePaymentsService.makePayment} invalid payment lists are refused with their exact messages and write nothing', async () => {
    const b = await purchase({ qty: 10, cost: 40, paid: 100 });
    const cases: [any[] | undefined, string][] = [
      [[], 'At least one payment method is required'],
      [undefined, 'At least one payment method is required'],
      [
        [{ payment_method: 'CASH', amount: 0 }],
        'Total payment amount must be greater than 0',
      ],
      [
        [{ payment_method: 'CASH', amount: -5 }],
        'Total payment amount must be greater than 0',
      ],
      [
        [{ payment_method: 'CASH', amount: 'abc' }],
        'Total payment amount must be greater than 0',
      ],
      [
        [
          { payment_method: 'CASH', amount: 100 },
          { payment_method: 'CASH', amount: -50 },
        ],
        'Total payment amount must be greater than 0',
      ],
      [
        [{ payment_method: 'CASH', amount: Infinity }],
        'Total payment amount must be greater than 0',
      ],
    ];
    for (const [payments, message] of cases) {
      const e = await failure(pay(b.id, payments as any));
      expect(e).toBeInstanceOf(BadRequestException);
      expect(e.getStatus()).toBe(400);
      expect(e.message).toBe(message);
    }
    expect(await db.purchasePayment.count({ where: { batch_id: b.id } })).toBe(
      0,
    );
    expect(
      Number(
        (await db.inventoryBatch.findUniqueOrThrow({ where: { id: b.id } }))
          .paid_amount,
      ),
    ).toBe(100);
  });

  it("[BE-PPAY-112] {PurchasePaymentsService.makePayment} another tenant's batch is not found and a zero-quantity or settled batch is refused", async () => {
    const b = await purchase({ qty: 10, cost: 40, paid: 100 });
    const foreign = await failure(
      pay(
        b.id,
        [{ payment_method: 'CASH', amount: 10 }],
        w.bystander.consumer.id,
      ),
    );
    expect(foreign).toBeInstanceOf(NotFoundException);
    expect(foreign.message).toBe('Batch not found');
    const zero = await purchase({ qty: 0, cost: 40, paid: 0, status: 'due' });
    const zeroErr = await failure(
      pay(zero.id, [{ payment_method: 'CASH', amount: 1 }]),
    );
    expect(zeroErr).toBeInstanceOf(BadRequestException);
    expect(zeroErr.message).toBe(
      'Cannot make a vendor payment for a batch with zero quantity',
    );
    const settled = await purchase({ qty: 1, cost: 10, paid: 10 });
    const settledErr = await failure(
      pay(settled.id, [{ payment_method: 'CASH', amount: 1 }]),
    );
    expect(settledErr).toBeInstanceOf(BadRequestException);
    expect(settledErr.message).toBe('Batch is already fully paid');
    // the status flag, not the arithmetic, decides "already paid"
    const flagged = await purchase({
      qty: 1,
      cost: 10,
      paid: 0,
      status: 'paid',
    });
    expect(
      (await failure(pay(flagged.id, [{ payment_method: 'CASH', amount: 1 }])))
        .message,
    ).toBe('Batch is already fully paid');
  });

  it('[BE-PPAY-113] {PurchasePaymentsService.makePayment} the amount may equal the remaining balance but not exceed it by a cent', async () => {
    const b = await purchase({ qty: 10, cost: 40, paid: 100 });
    const over = await failure(
      pay(b.id, [
        { payment_method: 'CASH', amount: 200 },
        { payment_method: 'CARD', amount: 100.01 },
      ]),
    );
    expect(over).toBeInstanceOf(BadRequestException);
    expect(over.message).toBe(
      'Total payment amount (300.01) exceeds remaining amount (300)',
    );
    expect(await db.purchasePayment.count({ where: { batch_id: b.id } })).toBe(
      0,
    );
    const ok = await pay(b.id, [
      { payment_method: 'CASH', amount: 200 },
      { payment_method: 'CARD', amount: 100 },
    ]);
    expect(ok.batch).toMatchObject({
      id: b.id,
      payment_status: 'paid',
      remaining_amount: 0,
      total_cost: 400,
    });
    expect(Number(ok.batch.paid_amount)).toBe(400);
  });

  it('[BE-PPAY-114] {PurchasePaymentsService.makePayment} a part payment leaves the batch partial; a first payment on a due batch makes it partial; rows keep method, type and reference', async () => {
    const due = await purchase({ qty: 10, cost: 40, paid: 0 });
    expect(due.payment_status).toBe('due');
    const res = await pay(due.id, [
      {
        payment_method: 'BANK_TRANSFER',
        payment_type: 'SONALI_BANK_LIMITED',
        amount: 150,
        reference: 'CHQ-9',
      },
      { payment_method: 'CASH', amount: 50 },
    ]);
    expect(res.batch).toMatchObject({
      id: due.id,
      payment_status: 'partial',
      total_cost: 400,
      remaining_amount: 200,
      quantity: 10,
      batch_number: due.batch_number,
    });
    expect(Number(res.batch.paid_amount)).toBe(200);
    expect(Number(res.batch.cost_price)).toBe(40);
    expect(res.payments).toHaveLength(2);
    const rows = await db.purchasePayment.findMany({
      where: { batch_id: due.id },
      orderBy: { id: 'asc' },
    });
    expect(
      rows.map((r) => [
        r.payment_method,
        r.payment_type,
        Number(r.amount),
        r.reference,
      ]),
    ).toEqual([
      ['BANK_TRANSFER', 'SONALI_BANK_LIMITED', 150, 'CHQ-9'],
      ['CASH', null, 50, null],
    ]);
    const stored = await db.inventoryBatch.findUniqueOrThrow({
      where: { id: due.id },
    });
    expect(stored.payment_status).toBe('partial');
    expect(Number(stored.paid_amount)).toBe(200);
  });

  it('[BE-PPAY-115] {PurchasePaymentsService.makePayment} a payment is refused when the batch changed since it was read, and nothing is written', async () => {
    const b = await purchase({ qty: 10, cost: 40, paid: 100 });
    const stale = await db.inventoryBatch.findUniqueOrThrow({
      where: { id: b.id },
    });
    const spy = jest
      .spyOn(prisma().inventoryBatch, 'findFirst')
      .mockResolvedValueOnce({ ...stale, paid_amount: 90 });
    const e = await failure(
      pay(b.id, [{ payment_method: 'CASH', amount: 10 }]),
    );
    spy.mockRestore();
    expect(e).toBeInstanceOf(BadRequestException);
    expect(e.message).toBe('Batch changed. Refresh and try the payment again.');
    expect(await db.purchasePayment.count({ where: { batch_id: b.id } })).toBe(
      0,
    );
    expect(
      Number(
        (await db.inventoryBatch.findUniqueOrThrow({ where: { id: b.id } }))
          .paid_amount,
      ),
    ).toBe(100);
  });

  it('[BE-PPAY-116] {PurchasePaymentsService.getBatchPayments} lists only that batch payments, newest first, and an empty list when none', async () => {
    const a = await purchase({ qty: 10, cost: 40, paid: 100 });
    const other = await purchase({ qty: 10, cost: 40, paid: 100 });
    expect(await ppay.getBatchPayments(a.id, cid())).toEqual({ payments: [] });
    await db.purchasePayment.create({
      data: {
        batch_id: a.id,
        payment_method: 'CASH',
        amount: 11,
        created_at: new Date('2026-01-01T00:00:00Z'),
      },
    });
    await db.purchasePayment.create({
      data: {
        batch_id: a.id,
        payment_method: 'CASH',
        amount: 22,
        created_at: new Date('2026-02-01T00:00:00Z'),
      },
    });
    await db.purchasePayment.create({
      data: { batch_id: other.id, payment_method: 'CASH', amount: 33 },
    });
    const res: any = await ppay.getBatchPayments(a.id, cid());
    expect(res.payments.map((p: any) => Number(p.amount))).toEqual([22, 11]);
    expect(Object.keys(res)).toEqual(['payments']);
  });

  it('[BE-PPAY-117] {PurchasePaymentsService.getPurchaseBatches} {PurchasePaymentsService.getBatchForPayment} {PurchasePaymentsService.makePayment} {PurchasePaymentsService.getBatchPayments} unexpected failures are wrapped as a generic 500', async () => {
    const b = await purchase({});
    const cases: [string, string, () => Promise<unknown>, string][] = [
      [
        'inventoryBatch',
        'count',
        () => ppay.getPurchaseBatches({}, cid()),
        'Failed to get purchase payment batches',
      ],
      [
        'inventoryBatch',
        'findFirst',
        () => ppay.getBatchForPayment(b.id, cid()),
        'Failed to get batch for payment',
      ],
      [
        'inventoryBatch',
        'findFirst',
        () => pay(b.id, [{ payment_method: 'CASH', amount: 1 }]),
        'Failed to make payment',
      ],
      [
        'inventoryBatch',
        'findFirst',
        () => ppay.getBatchPayments(b.id, cid()),
        'Failed to fetch purchase payments',
      ],
    ];
    for (const [model, method, call, message] of cases) {
      const spy = jest
        .spyOn(prisma()[model], method)
        .mockRejectedValueOnce(new Error('db down'));
      const e = await failure(call());
      spy.mockRestore();
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(500);
      expect(e.message).toBe(message);
    }
  });
});
