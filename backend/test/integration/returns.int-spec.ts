import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, batchOf, bootDomain, newWorld } from '../helpers/domain';
import { createCustomer, createRewardsSettings } from '../factories';
import { ReturnService } from '../../src/consumer/returns/services/return.service';
import { SalesService } from '../../src/consumer/sales/services/sales.service';
import { RewardsService } from '../../src/consumer/rewards/services/rewards.service';
import { PaymentMethod } from '../../src/consumer/sales/dto/create-sale.dto';

describe('returns and exchanges', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let returns: ReturnService;
  let sales: SalesService;

  beforeAll(async () => {
    boot = await bootDomain();
    returns = boot.get(ReturnService);
    sales = boot.get(SalesService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());

  /** A: 3 x 100, B: 2 x 50, shipping 50 => total 450. */
  async function committedSale(
    extra: object = {},
    pay: number | 'full' = 'full',
  ) {
    const a = await w.stock({ price: 100, batches: [{ qty: 10, cost: 40 }] });
    const b = await w.stock({ price: 50, batches: [{ qty: 10, cost: 20 }] });
    const sale = await w.sell(
      [
        { variant: a, qty: 3 },
        { variant: b, qty: 2 },
      ],
      { shipping_cost: 50, ...extra },
      pay,
    );
    const batchA = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: a.id },
    });
    const batchB = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: b.id },
    });
    const items = await db.saleItem.findMany({
      where: { sale_id: sale.id },
      orderBy: { id: 'asc' },
    });
    return { a, b, sale, batchA, batchB, itemA: items[0], itemB: items[1] };
  }
  const cash = (amount: number) => [{ payment_method: 'CASH' as any, amount }];
  const make = (dto: any) =>
    returns.create(w.tenant.consumer.id, w.tenant.adminUser.id, {
      branch_id: w.tenant.branches[0].id,
      items: [],
      ...dto,
    }) as Promise<any>;
  const failure = async (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (e: any) => e,
    );
  const returnA = (
    s: Awaited<ReturnType<typeof committedSale>>,
    quantity: number,
    extra: object = {},
  ) =>
    make({
      original_sale_id: s.sale.id,
      items: [
        {
          sale_item_id: s.itemA.id,
          variant_id: s.a.id,
          batch_id: s.batchA.id,
          quantity,
        },
      ],
      payments: cash(100 * quantity),
      ...extra,
    });

  it('[BE-RET-001] {ReturnService.create} returning one unit restocks the batch and writes the audit trail', async () => {
    const s = await committedSale();
    const ret = await returnA(s, 1);
    expect(Number(ret.total_refund)).toBe(100);
    expect(
      (
        await db.inventoryBatch.findUniqueOrThrow({
          where: { id: s.batchA.id },
        })
      ).quantity,
    ).toBe(8);
    expect(
      await db.inventoryAuditLog.count({
        where: { batch_id: s.batchA.id, event_type: 'RETURN_IN' },
      }),
    ).toBe(1);
    expect(
      await db.inventoryAdjustment.count({
        where: { batch_id: s.batchA.id, adjustment_type: 'return_in' },
      }),
    ).toBe(1);
  });

  it('[BE-RET-062] {ReturnService.create} a return processed at another branch restocks that branch, not the one that sold it', async () => {
    w = await newWorld(db, boot, { branches: 2 });
    const [soldAt, returnedAt] = w.tenant.branches;
    const s = await committedSale();
    await db.inventoryBatch.update({
      where: { id: s.batchA.id },
      data: { batch_number: 'LOT-62', location: 'Rack 4' },
    });

    const ret = await returnA(s, 2, { branch_id: returnedAt.id });
    expect(Number(ret.total_refund)).toBe(200);

    // The selling branch keeps what the sale left (10 - 3 = 7)
    expect((await batchOf(db, s.batchA.id)).quantity).toBe(7);
    // The return branch got a matching batch holding the returned units
    const landed = await db.inventoryBatch.findMany({
      where: { variant_id: s.a.id, branch_id: returnedAt.id },
    });
    expect(landed).toHaveLength(1);
    expect(landed[0]).toMatchObject({
      quantity: 2,
      batch_number: 'LOT-62',
      location: 'Rack 4',
    });
    expect(
      await db.inventoryAuditLog.count({
        where: {
          batch_id: landed[0].id,
          branch_id: returnedAt.id,
          event_type: 'RETURN_IN',
          quantity_delta: 2,
        },
      }),
    ).toBe(1);
    expect(
      await db.inventoryAuditLog.count({
        where: { batch_id: s.batchA.id, event_type: 'RETURN_IN' },
      }),
    ).toBe(0);

    // A second return there tops up the same batch instead of making another
    await returnA(s, 1, { branch_id: returnedAt.id });
    const again = await db.inventoryBatch.findMany({
      where: { variant_id: s.a.id, branch_id: returnedAt.id },
    });
    expect(again.map((b) => b.quantity)).toEqual([3]);
    expect(soldAt.id).not.toBe(returnedAt.id);
  });

  it("[BE-RET-063] {ReturnService.create} a row filled from two batches returns to the batch named first, then the sale's other batches in the order it took them", async () => {
    const v = await w.stock({
      price: 100,
      batches: [
        { qty: 2, cost: 40, createdAt: new Date('2026-03-01T10:00:00Z') },
        { qty: 5, cost: 40, createdAt: new Date('2026-03-02T10:00:00Z') },
      ],
    });
    const sale = await w.sell([{ variant: v, qty: 5 }], {}, 'full');
    const [old, fresh] = await db.inventoryBatch.findMany({
      where: { variant_id: v.id },
      orderBy: { created_at: 'asc' },
    });
    const item = await db.saleItem.findFirstOrThrow({
      where: { sale_id: sale.id },
    });
    expect(item.quantity).toBe(5); // old gave 2, fresh gave 3
    const give = (quantity: number, batchId: number) =>
      make({
        original_sale_id: sale.id,
        items: [
          {
            sale_item_id: item.id,
            variant_id: v.id,
            batch_id: batchId,
            quantity,
          },
        ],
        payments: cash(100 * quantity),
      });
    const stock = async () => [
      (await batchOf(db, old.id)).quantity,
      (await batchOf(db, fresh.id)).quantity,
    ];
    expect(await stock()).toEqual([0, 2]);

    await give(1, fresh.id); // named batch first
    expect(await stock()).toEqual([0, 3]);
    await give(2, old.id); // old only supplied 2
    expect(await stock()).toEqual([2, 3]);
    await give(1, old.id); // old is used up, so the rest follows the sale's order
    expect(await stock()).toEqual([2, 4]);
    await give(1, fresh.id);
    expect(await stock()).toEqual([2, 5]);
    expect(
      (
        await db.saleItemBatch.findMany({
          where: { sale_item_id: item.id },
          orderBy: { id: 'asc' },
        })
      ).map((leg) => [leg.quantity, leg.returned_quantity]),
    ).toEqual([
      [2, 2],
      [3, 3],
    ]);
    // nothing is left to return
    const refused = await failure(give(1, old.id));
    expect(refused).toBeInstanceOf(BadRequestException);
    expect(await stock()).toEqual([2, 5]);
  });

  it('[BE-RET-064] {ReturnService.create} units from a row of two batches returned at another branch land in matching batches created there', async () => {
    w = await newWorld(db, boot, { branches: 2 });
    const [, elsewhere] = w.tenant.branches;
    const v = await w.stock({
      price: 100,
      batches: [
        { qty: 2, cost: 40, createdAt: new Date('2026-03-01T10:00:00Z') },
        { qty: 5, cost: 40, createdAt: new Date('2026-03-02T10:00:00Z') },
      ],
    });
    const sale = await w.sell([{ variant: v, qty: 5 }], {}, 'full');
    const [old, fresh] = await db.inventoryBatch.findMany({
      where: { variant_id: v.id },
      orderBy: { created_at: 'asc' },
    });
    const item = await db.saleItem.findFirstOrThrow({
      where: { sale_id: sale.id },
    });
    await make({
      branch_id: elsewhere.id,
      original_sale_id: sale.id,
      items: [
        {
          sale_item_id: item.id,
          variant_id: v.id,
          batch_id: old.id,
          quantity: 4,
        },
      ],
      payments: cash(400),
    });
    // the selling branch is untouched; the other branch holds copies of both batches
    expect((await batchOf(db, old.id)).quantity).toBe(0);
    expect((await batchOf(db, fresh.id)).quantity).toBe(2);
    const landed = await db.inventoryBatch.findMany({
      where: { variant_id: v.id, branch_id: elsewhere.id },
      orderBy: { id: 'asc' },
    });
    expect(landed.map((b) => [b.batch_number, b.quantity])).toEqual([
      [old.batch_number, 2],
      [fresh.batch_number, 2],
    ]);
  });

  it('[BE-RET-002] {ReturnService.create} a refund that differs from the selected value is refused', async () => {
    const s = await committedSale();
    const error = await failure(returnA(s, 1, { payments: cash(90) }));
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toMatch(/must exactly match/);
  });

  it('[BE-RET-003] {ReturnService.create} returning more than what is left is refused', async () => {
    const s = await committedSale();
    await returnA(s, 2);
    const error = await failure(returnA(s, 2));
    expect(error.message).toMatch(/exceeds available quantity/);
  });

  it('[BE-RET-004] a shipping-only refund is allowed and moves no stock', async () => {
    const s = await committedSale();
    const ret = await make({
      original_sale_id: s.sale.id,
      shipping_refund_amount: 50,
      payments: cash(50),
    });
    expect(Number(ret.total_refund)).toBe(50);
    expect(
      await db.inventoryAuditLog.count({ where: { event_type: 'RETURN_IN' } }),
    ).toBe(0);
  });

  it('[BE-RET-005] shipping refunds cannot exceed what remains', async () => {
    const s = await committedSale();
    await make({
      original_sale_id: s.sale.id,
      shipping_refund_amount: 30,
      payments: cash(30),
    });
    const error = await failure(
      make({
        original_sale_id: s.sale.id,
        shipping_refund_amount: 30,
        payments: cash(30),
      }),
    );
    expect(error.message).toMatch(/exceeds remaining refundable shipping/);
  });

  it('[BE-RET-006] a return needs an item or a shipping refund', async () => {
    const s = await committedSale();
    const error = await failure(
      make({ original_sale_id: s.sale.id, payments: cash(10) }),
    );
    expect(error.message).toMatch(/Select at least one return item/);
  });

  it('[BE-RET-007] a return needs at least one payment', async () => {
    const s = await committedSale();
    const error = await failure(returnA(s, 1, { payments: [] }));
    expect(error.message).toMatch(/At least one payment method/);
  });

  it('[BE-RET-008] a zero payment amount is refused', async () => {
    const s = await committedSale();
    const error = await failure(returnA(s, 1, { payments: cash(0) }));
    expect(error.message).toMatch(/greater than 0/);
  });

  it('[BE-RET-043] a return on a partly paid sale cancels the due first and pays out only the rest', async () => {
    const s = await committedSale({}, 200);
    // total 450, paid 200, due 250; returning 300 of goods cancels 250 and pays out 50
    const tooMuch = await failure(returnA(s, 3, { payments: cash(300) }));
    expect(tooMuch.message).toMatch(/still owes .*250\.00/);
    const ret = await returnA(s, 3, { payments: cash(50) });
    expect(Number(ret.total_refund)).toBe(50);
    expect(Number(ret.due_reduction)).toBe(250);
    const sale = await db.sale.findUniqueOrThrow({ where: { id: s.sale.id } });
    expect(Number(sale.total_amount)).toBe(200);
    expect(sale.payment_status).toBe('paid');
  });

  it('[BE-RET-044] a return smaller than the due pays nothing out and only lowers the due', async () => {
    const s = await committedSale({}, 200);
    const ret = await returnA(s, 1, { payments: undefined });
    expect(Number(ret.total_refund)).toBe(0);
    expect(Number(ret.due_reduction)).toBe(100);
    expect(await db.returnPayment.count({ where: { return_id: ret.id } })).toBe(
      0,
    );
    const sale = await db.sale.findUniqueOrThrow({ where: { id: s.sale.id } });
    expect(Number(sale.total_amount)).toBe(350);
    expect(Number(sale.received_amount)).toBe(200);
    expect(sale.payment_status).not.toBe('paid');
  });

  it('[BE-RET-045] after a due was cancelled the sale can still be returned up to its original total', async () => {
    const s = await committedSale({}, 200);
    await returnA(s, 1, { payments: undefined });
    const summary: any = await sales.findBySaleNumber(
      s.sale.sale_number,
      w.tenant.consumer.id,
    );
    expect(summary.return_summary).toMatchObject({
      total_due_cancelled: 100,
      due_amount: 150,
      available_amount: 350,
    });
  });

  it('[BE-RET-009] {SalesService.softDelete} a deleted sale cannot be returned against', async () => {
    const s = await committedSale();
    await sales.softDelete(
      s.sale.id,
      w.tenant.consumer.id,
      w.tenant.adminUser.id,
      {},
    );
    const error = await failure(returnA(s, 1));
    expect(error).toBeInstanceOf(NotFoundException);
  });

  it('[BE-RET-010] items that do not belong to the sale are refused', async () => {
    const s = await committedSale();
    const other = await committedSale();
    const error = await failure(
      make({
        original_sale_id: s.sale.id,
        items: [
          {
            sale_item_id: other.itemA.id,
            variant_id: other.a.id,
            batch_id: other.batchA.id,
            quantity: 1,
          },
        ],
        payments: cash(100),
      }),
    );
    expect(error.message).toMatch(/do not belong/);
  });

  describe('exchanges', () => {
    const exchangeFor = async (stock = 5) => {
      const c = await w.stock({
        price: 100,
        batches: [{ qty: stock, cost: 30 }],
      });
      const batchC = await db.inventoryBatch.findFirstOrThrow({
        where: { variant_id: c.id },
      });
      return { c, batchC };
    };
    const exchangeDto = (c: { id: number }, batchId: number, quantity = 1) => ({
      variant_id: c.id,
      batch_id: batchId,
      quantity,
      unit_price: 100,
      line_total: 100 * quantity,
    });

    it('[BE-RET-011] an exchange restocks the returned item and takes the new one out', async () => {
      const s = await committedSale();
      const { c, batchC } = await exchangeFor();
      const ret = await returnA(s, 1, {
        payments: [{ payment_method: 'EXCHANGE', amount: 100 }],
        exchanges: [exchangeDto(c, batchC.id)],
      });
      expect(Number(ret.total_exchange)).toBe(100);
      expect(Number(ret.total_refund)).toBe(0);
      expect(
        (
          await db.inventoryBatch.findUniqueOrThrow({
            where: { id: s.batchA.id },
          })
        ).quantity,
      ).toBe(8);
      expect(
        (
          await db.inventoryBatch.findUniqueOrThrow({
            where: { id: batchC.id },
          })
        ).quantity,
      ).toBe(4);
      expect(
        await db.inventoryAuditLog.count({
          where: { batch_id: batchC.id, event_type: 'EXCHANGE_OUT' },
        }),
      ).toBe(1);
    });

    it('[BE-RET-012] an exchange with too little stock writes nothing', async () => {
      const s = await committedSale();
      const { c, batchC } = await exchangeFor(1);
      const before = await db.return.count();
      const error = await failure(
        returnA(s, 1, {
          payments: [{ payment_method: 'EXCHANGE', amount: 200 }],
          items: [
            {
              sale_item_id: s.itemA.id,
              variant_id: s.a.id,
              batch_id: s.batchA.id,
              quantity: 2,
            },
          ],
          exchanges: [exchangeDto(c, batchC.id, 2)],
        }),
      );
      expect(error.message).toMatch(/Insufficient stock for exchange/);
      expect(await db.return.count()).toBe(before);
      expect(
        (
          await db.inventoryBatch.findUniqueOrThrow({
            where: { id: s.batchA.id },
          })
        ).quantity,
      ).toBe(7);
    });

    it('[BE-RET-013] an exchange variant of another tenant is refused', async () => {
      const s = await committedSale();
      const error = await failure(
        returnA(s, 1, {
          payments: [{ payment_method: 'EXCHANGE', amount: 100 }],
          exchanges: [
            {
              variant_id: w.theirs.id,
              quantity: 1,
              unit_price: 100,
              line_total: 100,
            },
          ],
        }),
      );
      expect(error).toBeInstanceOf(NotFoundException);
    });

    it('[BE-RET-018] an exchange batch of a different variant or tenant is refused with nothing written', async () => {
      const s = await committedSale();
      const { c } = await exchangeFor();
      const theirBatch = await db.inventoryBatch.findFirstOrThrow({
        where: { variant_id: w.theirs.id },
      });
      for (const batchId of [theirBatch.id, s.batchB.id]) {
        const before = await db.return.count();
        const error = await failure(
          returnA(s, 1, {
            payments: [{ payment_method: 'EXCHANGE', amount: 100 }],
            exchanges: [exchangeDto(c, batchId)],
          }),
        );
        expect(error.message).toMatch(/is not a batch of variant/);
        expect(await db.return.count()).toBe(before);
      }
    });

    it('[BE-RET-032] stock that is only reserved cannot be exchanged out', async () => {
      const s = await committedSale();
      const { c, batchC } = await exchangeFor(2);
      await db.inventoryBatch.update({
        where: { id: batchC.id },
        data: { reserved_quantity: 2 },
      });
      const error = await failure(
        returnA(s, 1, {
          payments: [{ payment_method: 'EXCHANGE', amount: 100 }],
          exchanges: [exchangeDto(c, batchC.id)],
        }),
      );
      expect(error.message).toMatch(/Insufficient stock for exchange/);
    });

    it('[BE-SALE-053] {SalesService.softDelete} a sale that was created as an exchange cannot be deleted', async () => {
      const s = await committedSale();
      const { c } = await exchangeFor();
      const exchangeSale = await w.sell([{ variant: c, qty: 1 }]);
      await returnA(s, 1, { exchange_sale_id: exchangeSale.id });
      const error = await failure(
        sales.softDelete(
          exchangeSale.id,
          w.tenant.consumer.id,
          w.tenant.adminUser.id,
          {},
        ),
      );
      expect(error.message).toMatch(/created as an exchange/);
    });
  });

  it('[BE-SALE-052] {SalesService.softDelete} a sale with a return cannot be deleted', async () => {
    const s = await committedSale();
    await returnA(s, 1);
    const error = await failure(
      sales.softDelete(
        s.sale.id,
        w.tenant.consumer.id,
        w.tenant.adminUser.id,
        {},
      ),
    );
    expect(error.message).toMatch(/return\(s\) against it/);
  });

  it('[BE-RET-014] a credit refund gives the points back', async () => {
    await createRewardsSettings(db, {
      consumer_id: w.tenant.consumer.id,
      redemption_value: 1,
      minimum_redemption: 1,
    });
    const customer = await createCustomer(db, {
      consumer_id: w.tenant.consumer.id,
    });
    await boot
      .get(RewardsService)
      .adjustPoints(
        w.tenant.consumer.id,
        { customer_id: customer.id, points: 1000, description: 'seed' },
        w.tenant.adminUser.id,
      );
    const s = await committedSale({
      customer_id: customer.id,
      payments: [{ payment_method: PaymentMethod.CREDIT, amount: 450 }],
    });
    const points = () =>
      db.customerRewardsPoints.findUniqueOrThrow({
        where: { customer_id: customer.id },
      });
    expect((await points()).total_points).toBe(550);
    await returnA(s, 1, {
      payments: [{ payment_method: 'CREDIT', amount: 100 }],
    });
    expect((await points()).total_points).toBe(650);
  });

  it('[BE-RET-015] return numbers are RET-date-sequence per tenant', async () => {
    const s = await committedSale();
    const first = await returnA(s, 1);
    const second = await returnA(s, 1);
    expect(first.return_number).toMatch(/^RET-\d{8}-0001$/);
    expect(second.return_number).toMatch(/^RET-\d{8}-0002$/);
  });

  it('[BE-RET-016] a batch of another tenant is refused and left untouched', async () => {
    const s = await committedSale();
    const theirBatch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: w.theirs.id },
    });
    const error = await failure(
      make({
        original_sale_id: s.sale.id,
        items: [
          {
            sale_item_id: s.itemA.id,
            variant_id: s.a.id,
            batch_id: theirBatch.id,
            quantity: 1,
          },
        ],
        payments: cash(100),
      }),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toMatch(/is not a batch of variant/);
  });

  it('[BE-RET-017] a batch of a different variant, or a different variant id, is refused', async () => {
    const s = await committedSale();
    const wrongBatch = await failure(
      make({
        original_sale_id: s.sale.id,
        items: [
          {
            sale_item_id: s.itemA.id,
            variant_id: s.a.id,
            batch_id: s.batchB.id,
            quantity: 1,
          },
        ],
        payments: cash(100),
      }),
    );
    expect(wrongBatch.message).toMatch(/is not a batch of variant/);
    const wrongVariant = await failure(
      make({
        original_sale_id: s.sale.id,
        items: [
          {
            sale_item_id: s.itemA.id,
            variant_id: s.b.id,
            batch_id: s.batchB.id,
            quantity: 1,
          },
        ],
        payments: cash(100),
      }),
    );
    expect(wrongVariant.message).toMatch(
      /does not match the sold product variant/,
    );
  });

  it('[BE-RET-019] an item returned without a batch does not restock (characterization: confirm intent)', async () => {
    const s = await committedSale();
    await make({
      original_sale_id: s.sale.id,
      items: [{ sale_item_id: s.itemA.id, variant_id: s.a.id, quantity: 1 }],
      payments: cash(100),
    });
    expect(
      (
        await db.inventoryBatch.findUniqueOrThrow({
          where: { id: s.batchA.id },
        })
      ).quantity,
    ).toBe(7);
    expect(
      await db.inventoryAuditLog.count({ where: { event_type: 'RETURN_IN' } }),
    ).toBe(0);
  });

  it('[BE-RET-030] concurrent returns on different sales all succeed with unique numbers', async () => {
    const all = await Promise.all([1, 2, 3, 4, 5].map(() => committedSale()));
    const results = await Promise.all(all.map((s) => returnA(s, 1)));
    expect(new Set(results.map((r) => r.return_number)).size).toBe(5);
  });

  it('[BE-RET-031] concurrent returns of the same units refund them once', async () => {
    const s = await committedSale();
    const results = await Promise.allSettled([returnA(s, 3), returnA(s, 3)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(failed.reason.message).toMatch(
      /Another return was recorded|exceeds available quantity/,
    );
    expect(
      (
        await db.inventoryBatch.findUniqueOrThrow({
          where: { id: s.batchA.id },
        })
      ).quantity,
    ).toBe(10);
  });
});
