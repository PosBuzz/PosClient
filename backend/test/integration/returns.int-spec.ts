import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
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

  it('[BE-RET-001] returning one unit restocks the batch and writes the audit trail', async () => {
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

  it('[BE-RET-002] a refund that differs from the selected value is refused', async () => {
    const s = await committedSale();
    const error = await failure(returnA(s, 1, { payments: cash(90) }));
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toMatch(/must exactly match/);
  });

  it('[BE-RET-003] returning more than what is left is refused', async () => {
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

  it('[BE-RET-009] a deleted sale cannot be returned against', async () => {
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

    it('[BE-SALE-053] a sale that was created as an exchange cannot be deleted', async () => {
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

  it('[BE-SALE-052] a sale with a return cannot be deleted', async () => {
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
