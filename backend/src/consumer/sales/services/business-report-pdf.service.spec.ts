import { join } from 'node:path';
import { createPdfRecorder } from '../../../../test/helpers/pdf-recorder';
import { expectPdfGolden } from '../../../../test/helpers/pdf-golden';

const recorder = createPdfRecorder();
jest.mock('pdfkit', () => recorder.RecordingDocument);

import { BusinessReportPdfService } from './business-report-pdf.service';

const GOLDEN = join(__dirname, '__golden__', 'business-report-pdf.json');

const summary = (extra: object = {}): any => ({
  total_sales: 12,
  total_amount: 123456.789,
  total_transactions: 12,
  total_collected: 100000,
  real_money_collected: 90000.5,
  total_due: 3500.25,
  due_sales_count: 2,
  cash_sales: 60000,
  digital_sales: 30000.5,
  reward_point_sales: 450,
  exchange_sales: 100,
  total_exchange_return: 50,
  unique_exchanges: 75,
  non_cash_sales: 30450.5,
  average_transaction_value: 10288,
  total_items_sold: 40,
  unique_products_sold: 9,
  operational_costs: 5000,
  total_returns: 3,
  total_refund: 2500,
  total_items_returned: 4,
  net_sale_amount: 120956.789,
  cash_refunds: 2000,
  digital_refunds: 500,
  net_cash_sales: 58000,
  net_money_collected: 87500.5,
  net_operating_result: 115956.789,
  ...extra,
});

const report = (extra: object = {}): any => ({
  date: '2026-05-05',
  period: 'day',
  period_start: '2026-05-05T12:00:00.000Z',
  period_end: '2026-05-05T12:00:00.000Z',
  summary: summary(),
  payment_method_breakdown: [
    { payment_method: 'CASH', total_amount: 60000, transaction_count: 7 },
    {
      payment_method: 'mobile_money',
      total_amount: 20000,
      transaction_count: 3,
    },
    { payment_method: 'CREDIT', total_amount: 450, transaction_count: 1 },
    {
      payment_method: 'bank_transfer',
      total_amount: 10000.5,
      transaction_count: 1,
    },
  ],
  return_payment_breakdown: [
    { payment_method: 'CARD', total_amount: 500, transaction_count: 1 },
    { payment_method: 'EXCHANGE', total_amount: 100, transaction_count: 1 },
  ],
  payment_status_breakdown: [
    { status: 'PAID', count: 9, total_amount: 100000 },
    { status: 'PARTIAL', count: 2, total_amount: 20000 },
    { status: 'DUE', count: 1, total_amount: 3456.789 },
  ],
  operational_costs: [
    {
      id: 1,
      name: 'Rent',
      amount: 4000,
      incurred_on: '2026-05-01T12:00:00Z',
      branch_name: 'Main',
    },
    { id: 2, name: 'Tea', amount: 1000, incurred_on: '2026-05-02T12:00:00Z' },
  ],
  product_sales: Array.from({ length: 17 }, (_, i) => ({
    variant_id: i,
    variant_name: `Variant ${i}`,
    product_name: `Product ${i}`,
    quantity_sold: i + 1,
    total_amount: 100 * (i + 1),
    average_unit_price: 100,
    quantity_returned: i % 2,
    refund_amount: 0,
    net_amount: 100 * (i + 1) - (i % 2) * 100,
  })),
  hourly_sales: [],
  ...extra,
});

function setup() {
  const prisma: any = {
    consumer: { findUnique: jest.fn() },
    branch: { findFirst: jest.fn() },
  };
  prisma.consumer.findUnique.mockResolvedValue({
    company_name: 'Acme Ltd',
    address: 'Head office',
    phone: '111',
    email: 'hq@acme.test',
  });
  prisma.branch.findFirst.mockResolvedValue({
    name: 'Banani',
    address: 'Road 4',
    phone: '222',
    email: 'banani@acme.test',
  });
  return { prisma, service: new BusinessReportPdfService(prisma) };
}

describe('BusinessReportPdfService layout (unit)', () => {
  beforeEach(() => {
    recorder.documents.length = 0;
    jest
      .spyOn(Date.prototype, 'toLocaleString')
      .mockReturnValue('05/05/2026, 10:00:00');
  });
  afterEach(() => jest.restoreAllMocks());

  it('[BE-MUT-610] the full report draws header, cards, every table, terms and footer as reviewed', async () => {
    const { prisma, service } = setup();
    const buffer = await service.generate(5, { branch_id: 2 }, report());
    expect(buffer).toEqual(Buffer.from('%PDF-recorded'));
    expect(prisma.consumer.findUnique).toHaveBeenCalledWith({
      where: { id: 5 },
    });
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { id: 2, consumer_id: 5 },
    });
    expectPdfGolden(GOLDEN, 'full', recorder.documents[0]);
  });

  it('[BE-MUT-611] without a branch the report is for all branches and uses the company contact details', async () => {
    const { prisma, service } = setup();
    await service.generate(5, {}, report({ period: 'month' }));
    expect(prisma.branch.findFirst).not.toHaveBeenCalled();
    expectPdfGolden(GOLDEN, 'all-branches-month', recorder.documents[0]);
  });

  it('[BE-MUT-612] a till-date report on a minimal dataset prints the empty-state notices and omits optional tables', async () => {
    const { prisma, service } = setup();
    prisma.consumer.findUnique.mockResolvedValue(null);
    await service.generate(
      5,
      {},
      report({
        period: 'all',
        summary: summary({
          total_due: 0,
          due_sales_count: 0,
          total_refund: 0,
          total_returns: 0,
          reward_point_sales: 0,
          operational_costs: 0,
          net_operating_result: -10,
          real_money_collected: undefined,
          unique_exchanges: undefined,
          exchange_sales: undefined,
          total_exchange_return: 7,
          digital_sales: undefined,
        }),
        payment_method_breakdown: [],
        return_payment_breakdown: [],
        payment_status_breakdown: [],
        operational_costs: [],
        product_sales: [],
      }),
    );
    expectPdfGolden(GOLDEN, 'minimal-till-date', recorder.documents[0]);
  });

  it('[BE-MUT-613] refunds without a method breakdown say so; a long product list is capped at 15 rows and paginates', async () => {
    const { service } = setup();
    await service.generate(
      5,
      {},
      report({
        return_payment_breakdown: [],
        summary: summary({ due_sales_count: 0 }),
        payment_method_breakdown: Array.from({ length: 40 }, (_, i) => ({
          payment_method: `custom_method_${i}`,
          total_amount: i,
          transaction_count: i,
        })),
      }),
    );
    const calls = recorder.documents[0].calls;
    expect(calls.some((c) => c[0] === 'addPage')).toBe(true);
    expect(
      calls.filter(
        (c) => c[0] === 'text' && /^Product \d+$/.test(String(c[1])),
      ),
    ).toHaveLength(15);
    expectPdfGolden(
      GOLDEN,
      'paged-and-no-refund-methods',
      recorder.documents[0],
    );
  });
});
