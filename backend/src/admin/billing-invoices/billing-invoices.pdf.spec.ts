import { join } from 'node:path';
import { createPdfRecorder } from '../../../test/helpers/pdf-recorder';
import { expectPdfGolden } from '../../../test/helpers/pdf-golden';

const recorder = createPdfRecorder();
jest.mock('pdfkit', () => recorder.RecordingDocument);

import { BillingInvoicesService } from './billing-invoices.service';

const instant = new Date('2026-03-15T10:00:00Z');
const plan = (name: string | null) => ({
  id: 1,
  name,
  price: 100,
  created_at: instant,
  updated_at: instant,
});
const bill = (id: number, extra: object = {}): any => ({
  id,
  consumer_id: 1,
  amount: 123.456,
  reference: `REF-${id}`,
  created_at: instant,
  updated_at: instant,
  billing_date: new Date(`2026-0${id}-01T00:00:00Z`),
  billing_from: new Date(`2026-0${id}-01T00:00:00Z`),
  billing_till: new Date(`2026-0${id}-28T00:00:00Z`),
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
  created_at: instant,
  updated_at: instant,
  plan_id: 1,
  business_category: 'Retail',
  users: [
    { name: 'Not admin', role: { name: 'Staff', is_admin: false } },
    { name: 'Owner', role: { id: 1, name: 'Admin', is_admin: true } },
  ],
  billing_logs: [bill(1), bill(2, { plan: plan(null), reference: null })],
  ...extra,
});

const GOLDEN = join(__dirname, '__golden__', 'billing-invoices.pdf.json');

describe('BillingInvoicesService PDF layout (unit)', () => {
  const service = new BillingInvoicesService();
  beforeEach(() => {
    recorder.documents.length = 0;
    jest.useFakeTimers().setSystemTime(new Date('2026-05-05T10:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('[BE-MUT-600] the invoice PDF draws its header, billed-to block, details and footer exactly as reviewed', async () => {
    await expect(
      service.generateInvoicePdf({
        ...bill(1),
        consumer: consumer(),
      }),
    ).resolves.toEqual(Buffer.from('%PDF-recorded'));
    const [doc] = recorder.documents;
    expectPdfGolden(GOLDEN, 'invoice', doc);
  });

  it('[BE-MUT-601] missing optional invoice data prints N/A', async () => {
    await service.generateInvoicePdf({
      ...bill(1, { reference: null }),
      consumer: consumer({ users: [], phone: null, address: null }),
    });
    const [doc] = recorder.documents;
    expectPdfGolden(GOLDEN, 'invoice-na', doc);
  });

  it('[BE-MUT-602] the billing history PDF draws the header, company block and a striped table with the total', async () => {
    await service.generateBillingHistoryPdf(consumer());
    const [doc] = recorder.documents;
    expectPdfGolden(GOLDEN, 'history', doc);
  });

  it('[BE-MUT-603] an empty billing history says so; a long one continues on a new page with the header repeated', async () => {
    await service.generateBillingHistoryPdf(consumer({ billing_logs: [] }));
    expectPdfGolden(GOLDEN, 'history-empty', recorder.documents[0]);
    recorder.documents.length = 0;
    const many = Array.from({ length: 30 }, (_, i) =>
      bill((i % 9) + 1, { id: i + 1, amount: 10 + i }),
    );
    await service.generateBillingHistoryPdf(consumer({ billing_logs: many }));
    const calls = recorder.documents[0].calls;
    expect(calls.filter((c) => c[0] === 'addPage').length).toBeGreaterThan(0);
    expectPdfGolden(GOLDEN, 'history-paged', recorder.documents[0]);
  });
});
