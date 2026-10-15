import * as ExcelJS from 'exceljs';
import { Logger } from '@nestjs/common';
import { BillingInvoicesService } from './billing-invoices.service';

const service = new BillingInvoicesService();
const instant = new Date('2026-03-15T10:00:00Z');
const plan = (name: string | null): any => ({
  id: 1,
  name,
  price: 100,
  created_at: instant,
  updated_at: instant,
});
const bill = (id: number, extra: object = {}): any => ({
  id,
  consumer_id: 1,
  amount: id * 10.5,
  reference: `REF-${id}`,
  created_at: new Date('2026-01-02T12:00:00Z'),
  updated_at: instant,
  billing_date: new Date(`2026-0${id}-10T12:00:00Z`),
  billing_from: new Date(`2026-0${id}-01T12:00:00Z`),
  billing_till: new Date(`2026-0${id}-28T12:00:00Z`),
  plan: plan('Starter'),
  ...extra,
});
const consumer = (extra: object = {}): any => ({
  id: 1,
  company_name: 'My company',
  email: 'company@example.test',
  secondary_email: 'second@example.test',
  phone: '123',
  address: 'Street 1',
  subdomain: 'my-company',
  created_at: new Date('2025-12-25T12:00:00Z'),
  updated_at: instant,
  plan_id: 1,
  business_category: 'Retail',
  users: [
    { name: 'Staff', role: { name: 'Staff', is_admin: false } },
    { name: 'Fake admin', role: { name: 'Admin', is_admin: false } },
    { name: 'Owner', role: { name: 'Admin', is_admin: true } },
  ],
  billing_logs: [
    bill(1),
    bill(3),
    bill(2, { reference: null, plan: plan(null) }),
  ],
  ...extra,
});

const load = async (c: any) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await service.generateBillingHistoryExcel(c));
  return workbook;
};
const row = (sheet: ExcelJS.Worksheet, n: number) =>
  (sheet.getRow(n).values as unknown[]).slice(1);

describe('BillingInvoicesService Excel export (unit)', () => {
  it('[BE-MUT-604] the billing sheet has the pinned header, newest bill first, formatted dates, N/A fallbacks and a total row', async () => {
    const workbook = await load(consumer());
    const sheet = workbook.getWorksheet('Billing History')!;
    expect(row(sheet, 1)).toEqual([
      'No.',
      'Created On',
      'Billing Date',
      'Billing From',
      'Billing Till',
      'Reference',
      'Plan Name',
      'Amount',
    ]);
    expect(row(sheet, 2)).toEqual([
      1,
      'January 2, 2026',
      'March 10, 2026',
      'March 1, 2026',
      'March 28, 2026',
      'REF-3',
      'Starter',
      31.5,
    ]);
    expect(row(sheet, 3)).toEqual([
      2,
      'January 2, 2026',
      'February 10, 2026',
      'February 1, 2026',
      'February 28, 2026',
      'N/A',
      'N/A',
      21,
    ]);
    expect(row(sheet, 4)[0]).toBe(3);
    expect(row(sheet, 5)).toEqual(['', '', '', '', '', '', 'Total', 63]);
    expect(sheet.rowCount).toBe(5);
  });

  it('[BE-MUT-605] the company sheet lists every field in order, the client-since date and the real admin owner', async () => {
    const workbook = await load(consumer());
    const info = workbook.getWorksheet('Company Info')!;
    expect(workbook.worksheets.map((s) => s.name)).toEqual([
      'Billing History',
      'Company Info',
    ]);
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((n) => row(info, n))).toEqual([
      ['Company Name', 'My company'],
      ['Email', 'company@example.test'],
      ['Secondary Email', 'second@example.test'],
      ['Phone', '123'],
      ['Address', 'Street 1'],
      ['Subdomain', 'my-company'],
      ['Client Since', 'December 25, 2025'],
      ['Owner Name', 'Owner'],
    ]);
  });

  it('[BE-MUT-606] missing company details and a missing owner print N/A', async () => {
    const workbook = await load(
      consumer({
        company_name: '',
        email: '',
        secondary_email: null,
        phone: null,
        address: null,
        subdomain: '',
        users: [
          { name: 'Staff', role: { name: 'Staff', is_admin: true } },
          { name: 'No role' },
        ],
      }),
    );
    const info = workbook.getWorksheet('Company Info')!;
    for (const [n, label] of [
      [1, 'Company Name'],
      [2, 'Email'],
      [3, 'Secondary Email'],
      [4, 'Phone'],
      [5, 'Address'],
      [6, 'Subdomain'],
      [8, 'Owner Name'],
    ] as const) {
      expect(row(info, n)).toEqual([label, 'N/A']);
    }
  });

  it('[BE-MUT-607] an empty history exports just the header and a zero total, and the input list is not reordered', async () => {
    const workbook = await load(consumer({ billing_logs: [] }));
    const sheet = workbook.getWorksheet('Billing History')!;
    expect(sheet.rowCount).toBe(2);
    expect(row(sheet, 2)).toEqual(['', '', '', '', '', '', 'Total', 0]);
    const input = consumer();
    const before = input.billing_logs.map((b: any) => b.id);
    await service.generateBillingHistoryExcel(input);
    expect(input.billing_logs.map((b: any) => b.id)).toEqual(before);
  });

  it('[BE-MUT-608] a failure is logged with its stack and replaced by the pinned 500', async () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const error = await service
      .generateBillingHistoryExcel(consumer({ billing_logs: null }))
      .catch((e) => e);
    expect(error.getStatus()).toBe(500);
    expect(error.message).toBe('Failed to generate billing history Excel');
    expect(log).toHaveBeenCalledWith(
      'Failed to generate billing history Excel',
      expect.any(String),
    );
    log.mockRestore();
  });
});
