import { PrismaClient, TaxMethod } from '@prisma/client';
import { Boot, saleDto } from '../../helpers/domain';
import {
  createBatch,
  createCustomer,
  createPromotion,
  createRewardsSettings,
  createStockedVariant,
  createTenant,
} from '../../factories';
import { SalesService } from '../../../src/consumer/sales/services/sales.service';
import { ReturnService } from '../../../src/consumer/returns/services/return.service';
import { PaymentsService } from '../../../src/consumer/payments/services/payments.service';
import { OperationalCostsService } from '../../../src/consumer/operational-costs/services/operational-costs.service';
import { PaymentMethod } from '../../../src/consumer/sales/dto/create-sale.dto';
import { ConsumerPermission } from '../../../src/auth/enums/consumerPermissions.enum';

/**
 * The canonical "business day" (B4). Everything goes through the services, so stored data is what
 * production writes. Prisma stamps created_at/sale_date from the database clock, so after each
 * event the stored timestamps are pinned with SQL to the scenario instant; JS `Date` is faked
 * only while a service runs (sale numbers, reward expiry).
 */
export const DAY = '2026-03-14';
export const iso = (time: string, day = DAY) => `${day}T${time}:00.000Z`;

const ONLY_DATE = [
  'nextTick',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
  'queueMicrotask',
  'hrtime',
  'performance',
] as const;

/** Runs `fn` with only `Date` frozen at `instant`. */
export async function at<T>(instant: string, fn: () => Promise<T>): Promise<T> {
  jest.useFakeTimers({ now: new Date(instant), doNotFake: [...ONLY_DATE] });
  try {
    return await fn();
  } finally {
    jest.useRealTimers();
  }
}

export type Scenario = Awaited<ReturnType<typeof buildBusinessDay>>;

export async function buildBusinessDay(
  db: PrismaClient,
  boot: Boot,
  options: { lateNight?: boolean; withoutNoise?: boolean } = {},
) {
  const sales = boot.get(SalesService);
  const returns = boot.get(ReturnService);
  const payments = boot.get(PaymentsService);
  const costs = boot.get(OperationalCostsService);

  const tenant = await createTenant(db, { branches: 2, maxBranches: 2 });
  const cashierB = await tenant.user([ConsumerPermission.sales]);
  const [main, second] = tenant.branches;
  const cid = tenant.consumer.id;
  const admin = tenant.adminUser.id;

  await createRewardsSettings(db, {
    consumer_id: cid,
    points_per_currency: 1,
    minimum_redemption: 1,
    redemption_value: 1,
  });
  const c1 = await createCustomer(db, { consumer_id: cid, name: 'C1' });

  // P1 100 + 5% EXCLUSIVE, P2 250 INCLUSIVE 15%, P3 40 untaxed. 100 units in each branch.
  const product = async (
    price: number,
    taxPercent: number,
    taxMethod: TaxMethod,
    extra = {},
  ) => {
    const v = await createStockedVariant(db, tenant, {
      price,
      taxPercent,
      taxMethod,
      batches: [
        {
          qty: 100,
          cost: price / 2,
          createdAt: new Date('2026-03-01T00:00:00Z'),
        },
      ],
    });
    await db.productVariant.update({ where: { id: v.id }, data: extra });
    const mainBatch = await db.inventoryBatch.findFirstOrThrow({
      where: { variant_id: v.id, branch_id: main.id },
    });
    const secondBatch = await createBatch(db, tenant, {
      variant_id: v.id,
      branch_id: second.id,
      quantity: 100,
      cost_price: price / 2,
      created_at: new Date('2026-03-01T00:00:00Z'),
    });
    return { variant: v, mainBatch, secondBatch };
  };
  const p1 = await product(100, 5, TaxMethod.EXCLUSIVE);
  const p2 = await product(250, 15, TaxMethod.INCLUSIVE, {
    alert_quantity: 98,
  });
  const p3 = await product(40, 0, TaxMethod.EXCLUSIVE);
  const promo = await createPromotion(db, tenant, {
    variants: [p1.variant.id],
  }); // 10% on P1

  const stampSale = async (saleId: number, instant: string) => {
    await db.$executeRaw`UPDATE sales SET sale_date = ${new Date(instant)}, created_at = ${new Date(instant)} WHERE id = ${saleId}`;
    await db.$executeRaw`UPDATE sale_payments SET created_at = ${new Date(instant)} WHERE sale_id = ${saleId}`;
  };
  const stampReturn = async (returnId: number, instant: string) => {
    await db.$executeRaw`UPDATE returns SET return_date = ${new Date(instant)}, created_at = ${new Date(instant)} WHERE id = ${returnId}`;
    await db.$executeRaw`UPDATE return_payments SET created_at = ${new Date(instant)} WHERE return_id = ${returnId}`;
  };
  const sell = async (
    instant: string,
    lines: Parameters<typeof saleDto>[1],
    extra: object = {},
    pay: number | 'full' | null = 'full',
    branch = main,
  ) => {
    const dto = saleDto(
      tenant,
      lines,
      { branch_id: branch.id, served_by_id: admin, ...extra },
      pay,
    );
    const sale: any = await at(instant, () => sales.create(dto, cid, admin));
    await stampSale(sale.id, instant);
    return sale;
  };
  const itemOf = (saleId: number, variantId: number) =>
    db.saleItem.findFirstOrThrow({
      where: { sale_id: saleId, variant_id: variantId },
    });
  const refund = async (instant: string, dto: object) => {
    const created: any = await at(instant, () =>
      returns.create(cid, admin, dto as any),
    );
    await stampReturn(created.id, instant);
    return created;
  };
  const card = { payment_type: 'BRAC_BANK_LIMITED' } as const;

  // S0: previous day, P3 x2 = 80, only 30 paid then
  const s0 = await sell(
    iso('15:00', '2026-03-13'),
    [{ variant: p3.variant, qty: 2 }],
    {},
    30,
  );

  // E1 10:00 Main: S1 = P1 x2 + P3 x1 cash
  const s1 = await sell(iso('10:00'), [
    { variant: p1.variant, qty: 2 },
    { variant: p3.variant, qty: 1 },
  ]);
  // E2 10:30 Main: S2 = P2 x1, special discount 20, MFS full, customer C1, served by cashier B
  const s2 = await sell(
    iso('10:30'),
    [{ variant: p2.variant, qty: 1, specialDiscount: 20 }],
    {
      customer_id: c1.id,
      served_by_id: cashierB.id,
      payments: [
        { payment_method: PaymentMethod.MFS, amount: 230, ...card } as any,
      ],
    },
  );
  // E3 11:00 Second: S3 = P1 x1 with the 10% promotion, 50 paid
  const s3dto = saleDto(
    tenant,
    [{ variant: p1.variant, qty: 1, promotionDiscount: 10 }],
    {
      branch_id: second.id,
      served_by_id: admin,
      applied_promotion_id: promo.id,
    },
    50,
  );
  s3dto.items[0].applied_promotion_id = promo.id;
  const s3: any = await at(iso('11:00'), () => sales.create(s3dto, cid, admin));
  await stampSale(s3.id, iso('11:00'));
  // E4 11:30 Main: S4 = P3 x5, average discount 20 (10% of 200), shipping 60, card
  const s4 = await sell(
    iso('11:30'),
    [{ variant: p3.variant, qty: 5, averageDiscount: 20 }],
    {
      shipping_cost: 60,
      payments: [
        { payment_method: PaymentMethod.CARD, amount: 240, ...card } as any,
      ],
    },
  );
  // E5 12:00 Main: quotation Q1 (must count nowhere)
  let q1: any = null;
  let s5: any = null;
  if (!options.withoutNoise) {
    const qdto = saleDto(
      tenant,
      [{ variant: p1.variant, qty: 3 }],
      { sale_type: 'quotation' as any },
      null,
    );
    q1 = await at(iso('12:00'), () => sales.create(qdto, cid, admin));
    await stampSale(q1.id, iso('12:00'));
    // E6 12:30 Main: S5, soft-deleted at 12:45 (must count nowhere)
    s5 = await sell(iso('12:30'), [{ variant: p1.variant, qty: 1 }]);
    await at(iso('12:45'), () =>
      sales.softDelete(s5.id, cid, admin, { reason: 'test' } as any),
    );
  }
  // E7 13:00 Main: R1 against S1, 1 x P3, cash refund 40
  const r1 = await refund(iso('13:00'), {
    original_sale_id: s1.id,
    branch_id: main.id,
    items: [
      {
        sale_item_id: (await itemOf(s1.id, p3.variant.id)).id,
        variant_id: p3.variant.id,
        batch_id: p3.mainBatch.id,
        quantity: 1,
      },
    ],
    payments: [{ payment_method: 'CASH', amount: 40 }],
  });
  // R0 11:15 against S0 (previous day), 1 x P3, cash refund 40
  const r0 = await refund(iso('11:15'), {
    original_sale_id: s0.id,
    branch_id: main.id,
    items: [
      {
        sale_item_id: (await itemOf(s0.id, p3.variant.id)).id,
        variant_id: p3.variant.id,
        batch_id: p3.mainBatch.id,
        quantity: 1,
      },
    ],
    payments: [{ payment_method: 'CASH', amount: 40 }],
  });
  // E8 13:30 Main: R2 against S4, 2 x P3 (2/5 of 180 = 72) exchanged for P1 x1
  const r2 = await refund(iso('13:30'), {
    original_sale_id: s4.id,
    branch_id: main.id,
    items: [
      {
        sale_item_id: (await itemOf(s4.id, p3.variant.id)).id,
        variant_id: p3.variant.id,
        batch_id: p3.mainBatch.id,
        quantity: 2,
      },
    ],
    payments: [{ payment_method: 'EXCHANGE', amount: 72 }],
    exchanges: [
      {
        variant_id: p1.variant.id,
        batch_id: p1.mainBatch.id,
        quantity: 1,
        unit_price: 100,
        line_total: 105,
      },
    ],
  });
  // E9 14:00 Second: 25 more on S3 (20 stays due)
  const stampPayments = async (
    saleId: number,
    instant: string,
    afterId: number,
  ) => {
    await db.$executeRaw`UPDATE sale_payments SET created_at = ${new Date(instant)} WHERE sale_id = ${saleId} AND id > ${afterId}`;
  };
  const lastPaymentId = async () =>
    (await db.salePayment.aggregate({ _max: { id: true } }))._max.id ?? 0;
  let before = await lastPaymentId();
  await at(iso('14:00'), () =>
    payments.makePayment(
      {
        sale_id: s3.id,
        payments: [{ payment_method: 'CASH', amount: 25 }],
      } as any,
      cid,
    ),
  );
  await stampPayments(s3.id, iso('14:00'), before);
  // E9b 12:00 Main: the customer settles the other 50 of yesterday's S0 (an older sale)
  before = await lastPaymentId();
  await at(iso('12:00'), () =>
    payments.makePayment(
      {
        sale_id: s0.id,
        payments: [{ payment_method: 'CASH', amount: 50 }],
      } as any,
      cid,
    ),
  );
  await stampPayments(s0.id, iso('12:00'), before);
  // E10 14:30 Main: operational cost 300
  await at(iso('14:30'), () =>
    costs.create(cid, admin, {
      name: 'Rent',
      amount: 300,
      incurred_on: iso('14:30'),
      branch_id: main.id,
    } as any),
  );
  // E11 15:00 Main: S6 = delivery-later P2 x1, cash 250 (reserved)
  const s6 = await sell(iso('15:00'), [{ variant: p2.variant, qty: 1 }], {
    is_delivery_later: true,
  });

  // Late night (19:30Z = 01:30 next day in Dhaka)
  let s7: any = null;
  if (options.lateNight) {
    s7 = await sell(iso('19:30'), [{ variant: p3.variant, qty: 1 }]);
  }

  return {
    tenant,
    main,
    second,
    cashierB,
    c1,
    promo,
    p1,
    p2,
    p3,
    sales: { s0, s1, s2, s3, s4, s5, s6, s7 },
    quotation: q1,
    returns: { r0, r1, r2 },
  };
}

/**
 * Hand-computed truth for 2026-03-14, all branches. Every figure shows its arithmetic.
 * Sales in the day: S1, S2, S3, S4, S6 (S5 deleted, Q1 a quotation, S0 is yesterday's).
 */
export const expected = {
  eod: {
    total_sales: 5,
    // S1 250 + S2 230 + S3 95 + S4 240 + S6 250
    total_amount: 1065,
    // subtotals: S1 240, S2 217.39, S3 100, S4 200, S6 217.39
    gross_subtotal: 974.78,
    // discounts given: S2 special 20 + S3 promotion 10 + S4 average 20
    total_discount: 50,
    // taxes: S1 10, S2 32.61, S3 5, S4 0, S6 32.61
    total_tax: 80.22,
    total_shipping: 60,
    // payments created on the day: cash 250 (S1) + 50 + 25 (S3) + 50 (S0 rest) + 250 (S6) = 625
    cash_sales: 625,
    // MFS 230 (S2) + card 240 (S4)
    digital_sales: 470,
    real_money_collected: 1095,
    total_collected: 1095,
    // 625 + 470 - the 50 collected on yesterday's S0
    period_sales_collected: 1045,
    due_collected: 50,
    // S3: 95 - 50 - 25 = 20 is the only sale of the day still owed
    total_due: 20,
    due_sales_count: 1,
    average_transaction_value: 213, // 1065 / 5
    total_items_sold: 11, // S1 3 + S2 1 + S3 1 + S4 5 + S6 1
    unique_products_sold: 3,
    operational_costs: 300,
    // returns dated the day: R0 (40), R1 (40), R2 (exchange 72)
    total_returns: 3,
    total_refund: 80,
    total_items_returned: 4, // 1 + 1 + 2
    cash_refunds: 80,
    digital_refunds: 0,
    total_exchange_return: 72,
    unique_exchanges: 72,
    net_sale_amount: 985, // 1065 - 80
    net_cash_sales: 545, // 625 - 80
    net_money_collected: 1015, // 1095 - 80
    net_operating_result: 685, // 1065 - 80 - 300
    net_operating_cash_flow: 715, // 1015 - 300
    non_cash_sales: 440, // 1065 - 625
  },
  paymentMethods: {
    CASH: { amount: 625, count: 5 },
    MFS: { amount: 230, count: 1 },
    CARD: { amount: 240, count: 1 },
  },
  returnMethods: {
    CASH: { amount: 80, count: 2 },
    EXCHANGE: { amount: 72, count: 1 },
  },
  // net line totals: P1 210 + 95, P2 230 + 250, P3 40 + 180
  products: {
    P1: { qty: 3, amount: 305, returned: 0 },
    P2: { qty: 2, amount: 480, returned: 0 },
    P3: { qty: 6, amount: 220, returned: 4, refund: 152 }, // refunds 40 + 72 + 40
  },
  // Stock after the day (Main / Second), reserved on P2 Main
  stock: {
    // 100 - 2 (S1) - 1 exchange out (R2); S5 left and came back
    P1: { main: 97, second: 99 },
    P2: { main: 99, second: 100, reservedMain: 1 },
    // 100 - 2 (S0) - 1 (S1) - 5 (S4) + 1 (R1) + 1 (R0) + 2 (R2)
    P3: { main: 96, second: 100 },
  },
  rewardsC1: 230,
};
