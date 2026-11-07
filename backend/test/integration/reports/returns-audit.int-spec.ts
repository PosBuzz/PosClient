import { getPrisma, disconnect } from '../../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../../helpers/domain';
import { createCustomer, createRewardsSettings } from '../../factories';
import { SalesService } from '../../../src/consumer/sales/services/sales.service';
import { ReturnService } from '../../../src/consumer/returns/services/return.service';
import { PaymentsService } from '../../../src/consumer/payments/services/payments.service';
import { DeliveryPartnersService } from '../../../src/consumer/delivery-partners/services/delivery-partners.service';

// These business-local scenarios are also run in Dhaka and New York.
const day = (d: number) => new Date(2026, 2, d, 12);

describe('business report: returns and historical reconciliation', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let sales: SalesService;
  let returns: ReturnService;
  beforeAll(async () => {
    boot = await bootDomain();
    sales = boot.get(SalesService);
    returns = boot.get(ReturnService);
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
  const uid = () => w.tenant.adminUser.id;
  const report = (d: number, extra: object = {}) =>
    sales.getEODReport(cid(), { date: `2026-03-${d}`, ...extra });
  const purchase = async (
    paid: number | 'full' = 'full',
    extra: object = {},
  ) => {
    const variant = await w.stock({
      price: 100,
      batches: [{ qty: 20, cost: 40 }],
    });
    const sale = await w.sell(
      [{ variant, qty: 4 }],
      { shipping_cost: 50, ...extra },
      paid,
    );
    await db.sale.update({
      where: { id: sale.id },
      data: { sale_date: day(14) },
    });
    await db.salePayment.updateMany({
      where: { sale_id: sale.id },
      data: { created_at: day(14) },
    });
    return sale;
  };
  const giveBack = async (
    sale: any,
    qty: number,
    payments: any[],
    extra: object = {},
  ) => {
    const item = await db.saleItem.findFirstOrThrow({
      where: { sale_id: sale.id },
    });
    const ret = await returns.create(cid(), uid(), {
      original_sale_id: sale.id,
      branch_id: w.tenant.branches[0].id,
      items: qty
        ? [
            {
              sale_item_id: item.id,
              variant_id: item.variant_id,
              batch_id: item.batch_id!,
              quantity: qty,
            },
          ]
        : [],
      payments,
      ...extra,
    });
    await db.return.update({
      where: { id: ret.id },
      data: { return_date: day(15) },
    });
    return ret;
  };
  const cash = (amount: number) => [{ payment_method: 'CASH', amount }];

  it('[BE-RPT-200] {SalesService.getEODReport} due-cancelling returns stay on the return day and preserve the original invoice and historical due', async () => {
    const sale = await purchase(200);
    await giveBack(sale, 3, cash(50)); // 300 returned = 250 due cancelled + 50 cash
    const before = await report(14);
    expect(before.summary).toMatchObject({
      total_amount: 450,
      net_sale_amount: 400,
      total_due: 250,
      due_sales_count: 1,
    });
    expect(before.payment_status_breakdown).toEqual([
      { status: 'partial', count: 1, total_amount: 450 },
    ]);
    expect(before.hourly_sales.find((h) => h.hour === 12)?.total_amount).toBe(
      450,
    );
    const after = await report(15);
    expect(after.summary).toMatchObject({
      total_amount: 0,
      net_sale_amount: -300,
      total_refund: 50,
      due_reduced: 250,
      total_return_value: 300,
      net_money_collected: -50,
      net_operating_result: -300,
    });
    const all = await report(15, { period: 'all' });
    expect(all.summary).toMatchObject({
      total_amount: 450,
      net_sale_amount: 100,
      total_due: 0,
      due_sales_count: 0,
      net_money_collected: 150,
    });
    expect(all.product_sales.reduce((s, p) => s + p.net_amount, 0)).toBe(
      all.summary.net_sale_amount,
    );
  });

  it('[BE-RPT-201] {SalesService.getEODReport} a fully unpaid return counts as a return without inventing money paid out', async () => {
    const sale = await purchase(0);
    await giveBack(sale, 2, []);
    expect((await report(15)).summary).toMatchObject({
      total_refund: 0,
      due_reduced: 200,
      total_return_value: 200,
      net_sale_amount: -200,
      net_money_collected: 0,
      cash_refunds: 0,
    });
    expect((await report(14)).summary.total_due).toBe(450);
  });

  it('[BE-RPT-202] {SalesService.getEODReport} shipping-only refunds reduce shipping margin without reducing product net sales', async () => {
    const sale = await purchase();
    await giveBack(sale, 0, cash(50), { shipping_refund_amount: 50 });
    const today = await report(15);
    expect(today.summary).toMatchObject({
      total_refund: 50,
      shipping_refunded: 50,
      net_sale_amount: 0,
      shipping_margin: -50,
      net_operating_result: -50,
    });
    const all = await report(15, { period: 'all' });
    expect(all.summary).toMatchObject({
      net_sale_amount: 400,
      shipping_margin: 0,
      net_operating_result: 400,
    });
  });

  it('[BE-RPT-203] {SalesService.getEODReport} a linked exchange reverses the returned goods before counting replacement sale revenue', async () => {
    const original = await purchase();
    const v = await w.stock({ price: 150, batches: [{ qty: 5, cost: 40 }] });
    const replacement = await w.sell([{ variant: v, qty: 1 }], {
      payments: [
        { payment_method: 'EXCHANGE' as any, amount: 100 },
        { payment_method: 'CASH' as any, amount: 50 },
      ],
    });
    await db.sale.update({
      where: { id: replacement.id },
      data: { sale_date: day(15) },
    });
    await db.salePayment.updateMany({
      where: { sale_id: replacement.id },
      data: { created_at: day(15) },
    });
    await giveBack(original, 1, [{ payment_method: 'EXCHANGE', amount: 100 }], {
      exchange_sale_id: replacement.id,
    });
    const e = await report(15);
    expect(e.summary).toMatchObject({
      total_amount: 150,
      total_exchange_return: 100,
      total_return_value: 100,
      unique_exchanges: 100,
      net_sale_amount: 50,
      real_money_collected: 50,
      net_money_collected: 50,
      net_operating_result: 50,
    });
    expect(e.product_sales.reduce((s, p) => s + p.net_amount, 0)).toBe(50);
  });

  it('[BE-RPT-204] {SalesService.getEODReport} store-credit refunds do not leave the bank or cash drawer', async () => {
    await createRewardsSettings(db, {
      consumer_id: cid(),
      redemption_value: 1,
      minimum_redemption: 1,
    });
    const customer = await createCustomer(db, { consumer_id: cid() });
    const sale = await purchase('full', { customer_id: customer.id });
    await giveBack(sale, 1, [{ payment_method: 'CREDIT', amount: 100 }]);
    expect((await report(15)).summary).toMatchObject({
      total_refund: 100,
      credit_refunds: 100,
      digital_refunds: 0,
      cash_refunds: 0,
      net_money_collected: 0,
      net_sale_amount: -100,
    });
  });

  it('[BE-RPT-205] {SalesService.getEODReport} historical payment statuses use only collections up to the report end', async () => {
    const sale = await purchase(100);
    await boot.get(PaymentsService).makePayment(
      {
        sale_id: sale.id,
        payments: [{ payment_method: 'CASH' as any, amount: 350 }],
      },
      cid(),
    );
    await db.salePayment.updateMany({
      where: { sale_id: sale.id, amount: 350 },
      data: { created_at: day(15) },
    });
    const e = await report(14);
    expect(e.summary).toMatchObject({ total_due: 350, due_sales_count: 1 });
    expect(e.payment_status_breakdown).toEqual([
      { status: 'partial', count: 1, total_amount: 450 },
    ]);
    expect((await report(15)).summary).toMatchObject({
      total_amount: 0,
      due_collected: 350,
      total_collected: 350,
      non_cash_sales: 0,
    });
  });

  it('[BE-RPT-206] {SalesService.getEODReport} calendar-date expenses stay on their chosen business day in every time zone', async () => {
    await db.operationalCost.create({
      data: {
        consumer_id: cid(),
        created_by: uid(),
        name: 'Rent',
        amount: 300,
        incurred_on: new Date('2026-03-14T00:00:00Z'),
      },
    });
    expect((await report(14)).summary.operational_costs).toBe(300);
    expect((await report(15)).summary.operational_costs).toBe(0);
  });

  it('[BE-RPT-207] {SalesService.getEODReport} delivery charges belong to their ledger posting day even when the order was invoiced yesterday', async () => {
    const partner = await boot
      .get(DeliveryPartnersService)
      .create({ name: 'Courier' }, cid());
    const sale = await purchase(0, { is_online_order: true });
    await sales.updateOnlineOrderStatus(
      sale.id,
      {
        delivery_partner_id: partner.id,
        status: 'DELIVERED',
        cod_amount: 450,
        delivery_charge: 60,
        cod_fee: 5,
      } as any,
      cid(),
      uid(),
    );
    await db.deliveryPartnerTransaction.updateMany({
      where: { sale_id: sale.id },
      data: { created_at: day(15) },
    });
    await db.salePayment.updateMany({
      where: { sale_id: sale.id, payment_method: 'DELIVERY_PARTNER' },
      data: { created_at: day(15) },
    });
    expect((await report(14)).summary.partner_delivery_charges).toBe(0);
    const e = await report(15);
    expect(e.summary).toMatchObject({
      partner_delivery_charges: 65,
      shipping_margin: -65,
      net_operating_result: -65,
      delivery_partner_collected: 450,
      real_money_collected: 0,
    });
    expect(
      e.delivery_partners?.find((p) => p.partner_id === partner.id)?.charges,
    ).toBe(65);
    expect(
      e.delivery_partners?.find((p) => p.partner_id === partner.id)
        ?.cod_collected,
    ).toBe(450);
    expect(
      (await report(15, { branch_id: w.tenant.branches[0].id })).summary
        .partner_delivery_charges,
    ).toBe(65);
  });
  it('[BE-RPT-208] {SalesService.getEODReport} repeated mixed returns reconcile across days, month, all time and branches', async () => {
    const sale = await purchase(200);
    await giveBack(sale, 3, cash(50));
    await giveBack(sale, 1, cash(100));
    await giveBack(sale, 0, cash(50), { shipping_refund_amount: 50 });
    const periods = await Promise.all([
      report(15, { period: 'month' }),
      report(15, { period: 'all' }),
      report(15, { period: 'all', branch_id: w.tenant.branches[0].id }),
    ]);
    for (const e of periods) {
      expect(e.summary).toMatchObject({
        total_amount: 450,
        total_return_value: 450,
        due_reduced: 250,
        total_refund: 200,
        shipping_refunded: 50,
        net_sale_amount: 0,
        net_operating_result: 0,
        net_money_collected: 0,
        total_due: 0,
        due_sales_count: 0,
      });
      expect(
        e.summary.gross_subtotal! -
          e.summary.total_discount! +
          e.summary.total_tax! +
          e.summary.total_shipping!,
      ).toBe(e.summary.total_amount);
    }
    const days = [await report(14), await report(15)];
    for (const key of [
      'total_amount',
      'total_return_value',
      'due_reduced',
      'total_refund',
      'shipping_refunded',
      'net_sale_amount',
      'net_operating_result',
      'net_money_collected',
    ] as const) {
      expect(days.reduce((sum, e) => sum + (e.summary[key] ?? 0), 0)).toBe(
        periods[0].summary[key],
      );
    }
    expect(
      (await report(15, { branch_id: w.tenant.branches[1].id })).summary
        .total_return_value,
    ).toBe(0);
  });

  it('[BE-RPT-209] {SalesService.getEODReport} linking a return to an invoice without exchange tender does not hide its exchange value', async () => {
    const original = await purchase();
    const replacement = await purchase();
    await giveBack(original, 1, [{ payment_method: 'EXCHANGE', amount: 100 }], {
      exchange_sale_id: replacement.id,
    });
    expect((await report(15, { period: 'all' })).summary).toMatchObject({
      exchange_sales: 0,
      total_exchange_return: 100,
      unique_exchanges: 100,
    });
  });
  it("[BE-RPT-210] {SalesService.getEODReport} another shop's branch is rejected rather than exposing its name", async () => {
    await expect(
      report(14, { branch_id: w.bystander.branches[0].id }),
    ).rejects.toMatchObject({ status: 404, message: 'Branch not found' });
  });
});
