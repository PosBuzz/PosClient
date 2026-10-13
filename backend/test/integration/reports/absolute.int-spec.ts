import { getPrisma, resetDb, disconnect } from '../../helpers/db';
import { Boot, bootDomain } from '../../helpers/domain';
import { findViolations } from '../../helpers/invariants';
import { SalesService } from '../../../src/consumer/sales/services/sales.service';
import { DashboardService } from '../../../src/consumer/dashboard/services/dashboard.service';
import { InventoryService } from '../../../src/consumer/inventory/services/inventory.service';
import { PromotionsService } from '../../../src/consumer/promotions/services/promotions.service';
import { BusinessReportPdfService } from '../../../src/consumer/sales/services/business-report-pdf.service';
import { Scenario, at, buildBusinessDay, expected, iso } from './scenario';

/** Each report against hand-computed truth (BE-RPT-001…012). */
describe('reports: the business day against hand-computed numbers', () => {
  const db = getPrisma();
  let boot: Boot;
  let s: Scenario;
  let sales: SalesService;
  let dashboard: DashboardService;
  let cid: number;

  beforeAll(async () => {
    await resetDb();
    boot = await bootDomain();
    sales = boot.get(SalesService);
    dashboard = boot.get(DashboardService);
    s = await buildBusinessDay(db, boot);
    cid = s.tenant.consumer.id;
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });

  const eod = (extra: object = {}) =>
    sales.getEODReport(cid, { date: '2026-03-14', ...extra });
  const dash = (query: object = {}) =>
    at(iso('16:00'), () => dashboard.getAnalytics(cid, query as any));
  const near = (actual: number, want: number) =>
    expect(actual).toBeCloseTo(want, 2);

  it('[BE-RPT-000] the invariant net holds after the scenario', async () => {
    expect(await findViolations(db)).toEqual([]);
  });

  describe('[BE-RPT-001] EOD, all branches', () => {
    it('summary figures', async () => {
      const { summary } = await eod();
      for (const [key, want] of Object.entries(expected.eod)) {
        near((summary as any)[key], want);
      }
    });

    it('payment and return-payment breakdowns', async () => {
      const report = await eod();
      const byMethod = Object.fromEntries(
        report.payment_method_breakdown.map((p) => [
          p.payment_method,
          { amount: p.total_amount, count: p.transaction_count },
        ]),
      );
      expect(byMethod).toEqual(expected.paymentMethods);
      const returns = Object.fromEntries(
        report.return_payment_breakdown.map((p) => [
          p.payment_method,
          { amount: p.total_amount, count: p.transaction_count },
        ]),
      );
      expect(returns).toEqual(expected.returnMethods);
    });

    it('product sales and returns per variant', async () => {
      const report = await eod();
      const byVariant = new Map(
        report.product_sales.map((p) => [p.variant_id, p]),
      );
      for (const [key, want] of Object.entries(expected.products)) {
        const variantId = (s as any)[key.toLowerCase()].variant.id;
        const row = byVariant.get(variantId)!;
        expect({
          qty: row.quantity_sold,
          amount: row.total_amount,
          returned: row.quantity_returned,
        }).toEqual({
          qty: want.qty,
          amount: want.amount,
          returned: want.returned,
        });
        if ('refund' in want) near(row.refund_amount, want.refund);
      }
    });

    it('hourly sales, payment status and the date labels', async () => {
      const report = await eod();
      // Hours are business-local: Dhaka is UTC+6, the scenario is stamped in UTC
      const offset =
        Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Dhaka'
          ? 6
          : 0;
      const hour = (h: number) =>
        report.hourly_sales.find((x) => x.hour === h + offset)!;
      expect(hour(10)).toMatchObject({ sales_count: 2, total_amount: 480 }); // S1 250 + S2 230
      expect(hour(11)).toMatchObject({ sales_count: 2, total_amount: 335 }); // S3 95 + S4 240
      expect(hour(15)).toMatchObject({ sales_count: 1, total_amount: 250 }); // S6
      const status = Object.fromEntries(
        report.payment_status_breakdown.map((p) => [
          p.status,
          { count: p.count, total: p.total_amount },
        ]),
      );
      expect(status).toEqual({
        paid: { count: 4, total: 970 },
        partial: { count: 1, total: 95 },
      });
      expect(report).toMatchObject({
        date: '2026-03-14',
        period_start: '2026-03-14',
        period_end: '2026-03-14',
      });
      expect(report.operational_costs.map((c) => c.amount)).toEqual([300]);
    });
  });

  it('[BE-RPT-002] EOD for the Second branch holds only S3 and its payments', async () => {
    const { summary, payment_method_breakdown } = await eod({
      branch_id: s.second.id,
    });
    expect(summary).toMatchObject({
      total_sales: 1,
      total_amount: 95,
      total_due: 20,
      cash_sales: 75,
      total_refund: 0,
      operational_costs: 0,
    });
    expect(payment_method_breakdown).toEqual([
      { payment_method: 'CASH', total_amount: 75, transaction_count: 2 },
    ]);
  });

  describe('[BE-RPT-003…006] dashboard', () => {
    it('today figures (returns count in the period they were refunded in)', async () => {
      const { summary } = await dash();
      expect(summary).toMatchObject({
        today_total_sale: 1065,
        today_collected: 1045, // received on the day's sales: 250 + 230 + 75 + 240 + 250
        today_due: 20,
        today_transactions: 5,
        today_returns_count: 3, // R0, R1, R2
        today_refunds_total: 80,
        today_exchanges_total: 72,
        today_returns_total: 152,
        today_net_sale: 985,
      });
    });

    it('payment and return-payment breakdown (daily)', async () => {
      const { payment_method_breakdown, return_payment_breakdown } =
        await dash();
      expect(
        Object.fromEntries(
          payment_method_breakdown.map((p) => [
            p.payment_method,
            { amount: p.total_amount, count: p.transaction_count },
          ]),
        ),
      ).toEqual(expected.paymentMethods);
      expect(
        Object.fromEntries(
          return_payment_breakdown.map((p) => [
            p.payment_method,
            { amount: p.total_amount, count: p.transaction_count },
          ]),
        ),
      ).toEqual(expected.returnMethods);
    });

    it('top products by quantity (daily)', async () => {
      const { top_products } = await dash();
      expect(
        top_products.map((p) => [
          p.variant_id,
          p.total_quantity,
          p.total_amount,
        ]),
      ).toEqual([
        [s.p3.variant.id, 6, 220],
        [s.p1.variant.id, 3, 305],
        [s.p2.variant.id, 2, 480],
      ]);
    });

    it('{DashboardService.getAnalytics} the week starts on Saturday: 03-13 belongs to the previous week', async () => {
      const { summary, weekly_sales_trend } = await dash();
      expect(summary).toMatchObject({
        weekly_total_sale: 1065,
        weekly_transactions: 5,
        weekly_refunds_total: 80,
        weekly_net_sale: 985,
      });
      expect(weekly_sales_trend).toEqual([
        {
          date: '2026-03-14',
          sales_count: 5,
          total_amount: 1065,
          returns_count: 3,
          returns_amount: 80,
          net_amount: 985,
        },
      ]);
      // A Friday 03-13 "now" (both in UTC and Dhaka) is in the week before: S0 only, no 03-14 sales
      const friday = await at('2026-03-13T12:00:00.000Z', () =>
        dashboard.getAnalytics(cid, {} as any),
      );
      expect(friday.summary.today_total_sale).toBe(80);
      expect(friday.summary.weekly_total_sale).toBe(80);
    });
  });

  it('[BE-RPT-007] {SalesService.findAll} the sales list summary covers the day; refunds follow the original sale', async () => {
    const list: any = await sales.findAll(
      { date_from: iso('00:00'), date_to: '2026-03-14T23:59:59.999Z' },
      cid,
    );
    expect(list.summary).toMatchObject({
      total_sales: 5,
      total_amount: 1065,
      total_received: 1045,
      total_due: 20,
      total_refund: 40, // R1 (S1) only: R0's sale is yesterday's, R2 refunded 0
      return_count: 2,
      net_amount: 1025,
    });
  });

  it('[BE-RPT-008] {SalesService.getVariantSalesStats} variant sales stats', async () => {
    const result: any = await sales.getVariantSalesStats(
      cid,
      '2026-03-14',
      '2026-03-14',
    );
    const row = (id: number) =>
      result.data.find((r: any) => r.variant_id === id);
    // total_amount is the net line total (the client already sends it after discounts):
    // P1 210 + 95, P2 230 + 250, P3 40 + 180
    expect(row(s.p1.variant.id)).toMatchObject({
      total_qty: 3,
      total_sales: 2,
      total_amount: 305,
      returned_qty: 0,
    });
    expect(row(s.p2.variant.id)).toMatchObject({
      total_qty: 2,
      total_sales: 2,
      total_amount: 480,
    });
    // P3 returned: R0 40 + R1 40 + R2 72 (2/5 of 180)
    expect(row(s.p3.variant.id)).toMatchObject({
      total_qty: 6,
      total_sales: 2,
      total_amount: 220,
      returned_qty: 4,
    });
    expect(row(s.p3.variant.id).returned_amount).toBeCloseTo(152, 2);
  });

  it('[BE-RPT-009] {SalesService.getUsersSalesStats} user sales stats follow who served the sale', async () => {
    const result: any[] = await sales.getUsersSalesStats(
      cid,
      '2026-03-14',
      '2026-03-14',
    );
    const byName = Object.fromEntries(result.map((r) => [r.id, r]));
    // the admin served S1, S3, S4, S6 (250 + 95 + 240 + 250); cashier B served S2 (230)
    expect(byName[s.tenant.adminUser.id]).toMatchObject({
      totalSales: 835,
      salesCount: 4,
      totalRefunds: 40,
      returnsCount: 2,
      netSales: 795,
    });
    expect(byName[s.cashierB.id]).toMatchObject({
      totalSales: 230,
      salesCount: 1,
      totalRefunds: 0,
      netSales: 230,
    });
  });

  it('[BE-RPT-010] stock after the day: quantities, the reservation and the low-stock list', async () => {
    const batch = async (v: { id: number }, branch: number) =>
      db.inventoryBatch.findFirstOrThrow({
        where: { variant_id: v.id, branch_id: branch },
      });
    for (const [key, want] of Object.entries(expected.stock)) {
      const p = (s as any)[key.toLowerCase()];
      expect((await batch(p.variant, s.main.id)).quantity).toBe(want.main);
      expect((await batch(p.variant, s.second.id)).quantity).toBe(want.second);
    }
    expect((await batch(s.p2.variant, s.main.id)).reserved_quantity).toBe(
      expected.stock.P2.reservedMain,
    );
    // P2 alerts at 98: Main has 99 on hand minus 1 reserved = 98 available
    const low: any[] = await boot.get(InventoryService).getLowStockItems(cid);
    expect(low.map((i) => i.id ?? i.variant_id)).toEqual([s.p2.variant.id]);
  });

  it('[BE-RPT-011] promotion sales report', async () => {
    const report: any = await boot
      .get(PromotionsService)
      .getPromotionSales(s.promo.id, {}, cid);
    expect(report.meta.total).toBe(1);
    expect(report.summary).toEqual({
      total_discount_amount: 10,
      total_sales_amount: 95,
    });
    const figures = await boot.get(PromotionsService).findOne(s.promo.id, cid);
    expect(figures).toMatchObject({
      sales_count: 1,
      total_discount_given: 10,
      total_discounted_sales: 95,
    });
  });

  it('[BE-RPT-012] the business report PDF renders the EOD report', async () => {
    const report = await eod();
    const pdf = await boot
      .get(BusinessReportPdfService)
      .generate(cid, { date: '2026-03-14' }, report);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('[BE-RPT-110] the customer earned points for S2 only: rate x eligible amount', async () => {
    const points = await db.customerRewardsPoints.findUniqueOrThrow({
      where: { customer_id: s.c1.id },
    });
    expect(points.total_points).toBe(expected.rewardsC1); // 1 point per currency unit x 230
  });
});
