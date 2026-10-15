import { HttpException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { BillingInvoicesService } from './billing-invoices.service';
import { pdfText } from '../../../test/helpers/pdf';

describe('billing exports', () => {
  const service = new BillingInvoicesService();
  const instant = new Date('2026-03-15T10:00:00Z');
  const plan = {
    id: 1,
    name: 'Starter',
    price: 100,
    created_at: instant,
    updated_at: instant,
  };
  const older = {
    id: 1,
    consumer_id: 1,
    amount: 123.45,
    reference: 'OLD-BILL',
    created_at: instant,
    updated_at: instant,
    billing_date: new Date('2026-03-01T00:00:00Z'),
    billing_from: new Date('2026-03-01T00:00:00Z'),
    billing_till: new Date('2026-03-31T23:59:59.999Z'),
    plan,
  };
  const newer = {
    ...older,
    id: 2,
    amount: 200.25,
    reference: 'NEW-BILL',
    billing_date: new Date('2026-04-01T00:00:00Z'),
  };
  const consumer: any = {
    id: 1,
    company_name: 'My company',
    email: 'company@example.test',
    secondary_email: null,
    phone: '123',
    address: 'Street',
    subdomain: 'my-company',
    created_at: instant,
    updated_at: instant,
    plan_id: 1,
    business_category: 'Retail',
    users: [
      {
        name: 'Owner',
        role: { id: 1, name: 'Admin', consumer_id: 1, is_admin: true },
      },
    ],
    billing_logs: [older, newer],
  };

  it('[BE-BILL-100] {BillingInvoicesService.generateBillingHistoryExcel} sorts newest invoices first, keeps decimal amounts and includes owner information', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      await service.generateBillingHistoryExcel(consumer),
    );
    const sheet = workbook.getWorksheet('Billing History')!;
    expect(sheet.getRow(1).getCell(8).value).toBe('Amount');
    expect(sheet.getRow(2).getCell(6).value).toBe('NEW-BILL');
    expect(sheet.getRow(2).getCell(8).value).toBe(200.25);
    expect(sheet.getRow(3).getCell(6).value).toBe('OLD-BILL');
    expect(sheet.getRow(4).getCell(8).value).toBeCloseTo(323.7, 2);
    expect(
      workbook.getWorksheet('Company Info')!.getRow(8).getCell(2).value,
    ).toBe('Owner');
    expect(consumer.billing_logs.map((row: any) => row.id)).toEqual([1, 2]);
  });

  it('[BE-BILL-101] {BillingInvoicesService.generateInvoicePdf} renders the company, reference, plan and charged amount in an actual PDF', async () => {
    const text = pdfText(
      await service.generateInvoicePdf({ ...older, consumer }),
    );
    expect(text).toContain('INVOICE');
    expect(text).toContain('My company');
    expect(text).toContain('OLD-BILL');
    expect(text).toContain('Starter');
    expect(text).toContain('$123.45');
  });

  it('[BE-BILL-102] {BillingInvoicesService.generateBillingHistoryPdf} renders both invoices and their exact combined amount', async () => {
    const text = pdfText(await service.generateBillingHistoryPdf(consumer));
    expect(text).toContain('My company');
    expect(text).toContain('OLD-BILL');
    expect(text).toContain('NEW-BILL');
    expect(text).toContain('$123.45');
    expect(text).toContain('$200.25');
    expect(text).toContain('$323.70');
  });

  it('[BE-BILL-103] {BillingInvoicesService.generateBillingHistoryExcel} invalid export input becomes the pinned generic 500 without source internals', async () => {
    const error = await service
      .generateBillingHistoryExcel({ ...consumer, billing_logs: null })
      .catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(500);
    expect(error.message).toBe('Failed to generate billing history Excel');
  });
});
