import { getPrisma, resetDb, disconnect } from '../../helpers/db';
import { Boot, bootDomain } from '../../helpers/domain';
import { findViolations } from '../../helpers/invariants';
import { SalesService } from '../../../src/consumer/sales/services/sales.service';
import { DashboardService } from '../../../src/consumer/dashboard/services/dashboard.service';
import { InventoryService } from '../../../src/consumer/inventory/services/inventory.service';
import { Scenario, at, buildBusinessDay, iso } from './scenario';

/** The reports compared with each other (BE-RPT-100…111). */
describe('reports: cross-report reconciliation', () => {
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

  const eod = (extra: object = {}, tenant = () => cid): Promise<any> =>
    sales.getEODReport(tenant(), { date: '2026-03-14', ...extra });
  const dash = (id = cid, query: object = {}): Promise<any> =>
    at(iso('16:00'), () => dashboard.getAnalytics(id, query as any));
  const list = (id = cid) =>
    sales.findAll(
      { date_from: iso('00:00'), date_to: '2026-03-14T23:59:59.999Z' },
      id,
    ) as Promise<any>;
  const sum = (rows: number[]) => rows.reduce((a, b) => a + b, 0);

  it("[BE-RPT-100] EOD, dashboard and the sales list agree on the day's sales amount", async () => {
    const [e, d, l] = await Promise.all([eod(), dash(), list()]);
    expect(e.summary.total_amount).toBe(d.summary.today_total_sale);
    expect(e.summary.total_amount).toBe(l.summary.total_amount);
  });

  it('[BE-RPT-101] ... and on how many sales there were', async () => {
    const [e, d, l] = await Promise.all([eod(), dash(), list()]);
    expect(e.summary.total_sales).toBe(d.summary.today_transactions);
    expect(e.summary.total_sales).toBe(l.summary.total_sales);
  });

  it('[BE-RPT-102] {SalesService.getVariantSalesStats} the variant stats add up to the EOD sales without shipping', async () => {
    const variants: any = await sales.getVariantSalesStats(
      cid,
      '2026-03-14',
      '2026-03-14',
      undefined,
      1,
      100,
    );
    const e = await eod();
    expect(sum(variants.data.map((v: any) => v.total_amount))).toBeCloseTo(
      e.summary.total_amount - e.summary.total_shipping,
      2,
    );
    // and the EOD product table is the same truth
    expect(sum(e.product_sales.map((p: any) => p.total_amount))).toBeCloseTo(
      e.summary.total_amount - e.summary.total_shipping,
      2,
    );
  });

  it('[BE-RPT-103] {SalesService.getUsersSalesStats} the cashier stats add up to the EOD sales amount', async () => {
    const users: any[] = await sales.getUsersSalesStats(
      cid,
      '2026-03-14',
      '2026-03-14',
    );
    expect(sum(users.map((u) => u.totalSales))).toBeCloseTo(
      (await eod()).summary.total_amount,
      2,
    );
  });

  it('[BE-RPT-104] the payment methods add up to what the EOD says was collected', async () => {
    const e = await eod();
    expect(
      sum(e.payment_method_breakdown.map((p: any) => p.total_amount)),
    ).toBeCloseTo(e.summary.total_collected, 2);
    expect(
      sum(e.return_payment_breakdown.map((p: any) => p.total_amount)),
    ).toBeCloseTo(e.summary.total_refund + e.summary.total_exchange_return, 2);
  });

  it('[BE-RPT-105] dashboard refunds plus exchanges are its returns total, and match the EOD', async () => {
    const d = await dash();
    expect(
      d.summary.today_refunds_total + d.summary.today_exchanges_total,
    ).toBe(d.summary.today_returns_total);
    const e = await eod();
    expect(d.summary.today_refunds_total).toBe(e.summary.total_refund);
    expect(d.summary.today_exchanges_total).toBe(
      e.summary.total_exchange_return,
    );
    expect(d.summary.today_returns_count).toBe(e.summary.total_returns);
  });

  it('[BE-RPT-106] intentional difference: the dashboard counts a refund when it was paid, the sales list when the sale was made', async () => {
    const d = await dash();
    const l = await list();
    const r0 = Number(s.returns.r0.total_refund);
    expect(r0).toBe(40);
    expect(d.summary.today_refunds_total - l.summary.total_refund).toBe(r0);
  });

  it('[BE-RPT-107] Main plus Second equals all branches for every additive EOD figure', async () => {
    const [all, main, second] = await Promise.all([
      eod(),
      eod({ branch_id: s.main.id }),
      eod({ branch_id: s.second.id }),
    ]);
    const additive = [
      'total_sales',
      'total_amount',
      'gross_subtotal',
      'total_discount',
      'total_tax',
      'total_shipping',
      'total_collected',
      'real_money_collected',
      'period_sales_collected',
      'due_collected',
      'total_due',
      'due_sales_count',
      'cash_sales',
      'digital_sales',
      'total_items_sold',
      'operational_costs',
      'total_returns',
      'total_refund',
      'total_items_returned',
      'cash_refunds',
      'total_exchange_return',
      'net_sale_amount',
      'net_operating_result',
      'net_money_collected',
    ];
    for (const key of additive) {
      expect({
        key,
        value: main.summary[key] + second.summary[key],
      }).toEqual({ key, value: expect.closeTo(all.summary[key], 2) });
    }
  });

  it('[BE-RPT-108] {SalesService.getEODReport} {SalesService.getUsersSalesStats} {SalesService.getVariantSalesStats} a quotation and a deleted sale change no number in any report', async () => {
    const clean = await buildBusinessDay(db, boot, { withoutNoise: true });
    const strip = async (id: number, branch?: number) => {
      const [e, d, l, u, v] = await Promise.all([
        sales.getEODReport(id, { date: '2026-03-14' } as any),
        dash(id),
        list(id),
        sales.getUsersSalesStats(id, '2026-03-14', '2026-03-14'),
        sales.getVariantSalesStats(
          id,
          '2026-03-14',
          '2026-03-14',
          branch,
          1,
          100,
        ),
      ]);
      return {
        eod: {
          summary: e.summary,
          pay: e.payment_method_breakdown,
          ret: e.return_payment_breakdown,
          status: e.payment_status_breakdown,
          hourly: e.hourly_sales,
        },
        dash: {
          summary: d.summary,
          trend: d.weekly_sales_trend,
          pay: d.payment_method_breakdown,
          ret: d.return_payment_breakdown,
        },
        list: l.summary,
        users: (u as any[]).map(
          ({ id: _id, email: _email, name: _name, ...rest }) => rest,
        ),
        variants: (v as any).data.map(
          ({
            variant_id: _id,
            product_name: _p,
            sku: _s,
            variant_name: _v,
            ...rest
          }: any) => rest,
        ),
      };
    };
    expect(await strip(clean.tenant.consumer.id)).toEqual(await strip(cid));
  });

  it('[BE-RPT-109] {InventoryService.getVariantStock} {InventoryService.getInventorySummary} stock per variant agrees between batches, the variant view and the inventory summary', async () => {
    const inventory = boot.get(InventoryService);
    let physical = 0;
    let reserved = 0;
    for (const p of [s.p1, s.p2, s.p3]) {
      const batches = await db.inventoryBatch.findMany({
        where: { variant_id: p.variant.id },
      });
      const rawAvailable = sum(
        batches.map((b) => b.quantity - b.reserved_quantity),
      );
      physical += sum(batches.map((b) => b.quantity));
      reserved += sum(batches.map((b) => b.reserved_quantity));
      const view: any = await inventory.getVariantStock(p.variant.id, cid);
      expect(view.total_stock).toBe(rawAvailable);
    }
    const summary: any = await inventory.getInventorySummary(cid);
    expect(summary).toMatchObject({
      physical_quantity: physical,
      reserved_quantity: reserved,
      total_quantity: physical - reserved,
    });
  });

  it("[BE-RPT-111] another shop's sales on the same day change none of my numbers", async () => {
    const before = {
      eod: await eod(),
      dash: await dash(),
      list: (await list()).summary,
    };
    // the bystander shop sells on the same day
    const other = await buildBusinessDay(db, boot, { withoutNoise: true });
    expect(other.tenant.consumer.id).not.toBe(cid);
    const after = {
      eod: await eod(),
      dash: await dash(),
      list: (await list()).summary,
    };
    expect(after).toEqual(before);
  });

  it('[BE-RPT-000] the invariant net still holds after all of that', async () => {
    expect(await findViolations(db)).toEqual([]);
  });
});
