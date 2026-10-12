import { getPrisma, resetDb, disconnect } from '../../helpers/db';
import { Boot, bootDomain } from '../../helpers/domain';
import { SalesService } from '../../../src/consumer/sales/services/sales.service';
import { DashboardService } from '../../../src/consumer/dashboard/services/dashboard.service';
import { Scenario, at, buildBusinessDay, iso } from './scenario';

/**
 * Business days follow the process time zone (src/timezone.ts sets it in production; the npm
 * script sets TZ for tests). Run with `npm run test:int:tz` for Asia/Dhaka, the default business zone.
 */
// The zone the code under test sees (jest's process.env is a copy, so read it the way the code does)
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const dhaka = zone === 'Asia/Dhaka';
const utc = zone === 'UTC';

describe('reports: business time zone', () => {
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
    s = await buildBusinessDay(db, boot, { lateNight: true });
    cid = s.tenant.consumer.id;
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });

  (dhaka ? describe : describe.skip)('Asia/Dhaka (UTC+6)', () => {
    it('[BE-RPT-020] a sale at 19:30Z is on the next local day, and is numbered that way', () => {
      expect(s.sales.s7.sale_number).toMatch(/^SAL-20260315-/);
      expect(s.sales.s1.sale_number).toMatch(/^SAL-20260314-/);
    });

    it('[BE-RPT-021] at 02:00 local the dashboard and the EOD report show the same new day, without the daytime sales', async () => {
      const now = '2026-03-14T20:00:00.000Z'; // 2026-03-15 02:00 in Dhaka
      const d = await at(now, () => dashboard.getAnalytics(cid, {} as any));
      const e = await sales.getEODReport(cid, { date: '2026-03-15' });
      expect(e.summary.total_sales).toBe(1);
      expect(e.summary.total_amount).toBe(40); // S7 only: P3 x1
      expect(d.summary.today_total_sale).toBe(e.summary.total_amount);
      expect(d.summary.today_transactions).toBe(e.summary.total_sales);
    });

    it('[BE-RPT-022] the weekly trend files S7 under the local date 2026-03-15', async () => {
      const d = await at('2026-03-14T20:00:00.000Z', () =>
        dashboard.getAnalytics(cid, {} as any),
      );
      const byDate = Object.fromEntries(
        d.weekly_sales_trend.map((p) => [p.date, p.sales_count]),
      );
      expect(byDate).toEqual({ '2026-03-14': 5, '2026-03-15': 1 });
    });

    it('[BE-RPT-023] the EOD labels are the requested local date, not a UTC day', async () => {
      const e = await sales.getEODReport(cid, { date: '2026-03-15' });
      expect(e).toMatchObject({
        date: '2026-03-15',
        period_start: '2026-03-15',
        period_end: '2026-03-15',
      });
      const month = await sales.getEODReport(cid, {
        date: '2026-03-15',
        period: 'month',
      } as any);
      expect(month).toMatchObject({
        period_start: '2026-03-01',
        period_end: '2026-03-31',
      });
    });
  });

  (utc ? describe : describe.skip)('UTC', () => {
    it('[BE-RPT-024] the same sale is part of 2026-03-14 and the reports still agree', async () => {
      expect(s.sales.s7.sale_number).toMatch(/^SAL-20260314-/);
      const e = await sales.getEODReport(cid, { date: '2026-03-14' });
      const d = await at(iso('16:00'), () =>
        dashboard.getAnalytics(cid, {} as any),
      );
      expect(e.summary.total_amount).toBe(1105); // 1065 + S7 40
      expect(d.summary.today_total_sale).toBe(e.summary.total_amount);
    });
  });
});
