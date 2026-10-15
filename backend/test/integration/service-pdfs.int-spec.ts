import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReceiptPdfService } from '../../src/consumer/receipt-pdf/services/receipt-pdf.service';
import { SalesPdfService } from '../../src/consumer/receipt-pdf/services/sales-pdf.service';
import { QuotationPdfService } from '../../src/consumer/receipt-pdf/services/quotation-pdf.service';
import { ReturnPdfService } from '../../src/consumer/receipt-pdf/services/return-pdf.service';
import { SalesService } from '../../src/consumer/sales/services/sales.service';
import { ReturnService } from '../../src/consumer/returns/services/return.service';
import { ProductAuditService } from '../../src/product-audit/services/product-audit.service';
import { ProductAuditPdfService } from '../../src/product-audit/services/product-audit-pdf.service';
import { BusinessReportPdfService } from '../../src/consumer/sales/services/business-report-pdf.service';
import { PRESET_DEFAULTS } from '../../src/consumer/receipt-pdf/preset/receipt-pdf-settings';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { pdfText } from '../helpers/pdf';

describe('real PDF documents from persisted business records', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  beforeAll(async () => {
    boot = await bootDomain();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await w.check();
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  const cid = () => w.tenant.consumer.id;

  it('[BE-PDF-100] {SalesPdfService.generatePaymentReceiptPdf} {ReceiptPdfService.generatePdf} prints the selected payment and its historical balance through the real renderer', async () => {
    const variant = await w.stock({
      price: 100,
      batches: [{ qty: 10, cost: 40 }],
    });
    const created = await w.sell([{ variant, qty: 2 }], {}, 100);
    const sale: any = await boot.get(SalesService).findOne(created.id, cid());
    const renderer = boot.get(ReceiptPdfService);
    const spy = jest.spyOn(renderer, 'generatePdf'); // Observes the call; real PDF generation remains active.
    const paymentId = sale.payments[0].id;
    const output = await boot
      .get(SalesPdfService)
      .generatePaymentReceiptPdf(sale, paymentId);
    expect(pdfText(output)).toContain(sale.sale_number);
    const [data] = spy.mock.calls[0];
    expect(data).toMatchObject({
      receivedAmount: 100,
      previousDueAmount: 200,
      dueAmount: 100,
      changeAmount: 0,
      paymentStatus: 'partial',
      payments: [{ amount: 100 }],
    });
    expect(
      pdfText(await renderer.generatePdf(data, PRESET_DEFAULTS.money_receipt)),
    ).toContain(sale.sale_number);
    const error = await boot
      .get(SalesPdfService)
      .generatePaymentReceiptPdf(sale, -1)
      .catch((e) => e);
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.getStatus()).toBe(404);
    expect(error.message).toBe('Payment not found for this sale');
    expect(await db.salePayment.count({ where: { sale_id: sale.id } })).toBe(1);
  });

  it('[BE-PDF-101] {QuotationPdfService.generateQuotationPdf} quotations remain unpaid and show their actual line prices without reserving stock', async () => {
    const variant = await w.stock({
      price: 100,
      batches: [{ qty: 10, cost: 40 }],
    });
    const created = await w.sell(
      [{ variant, qty: 2 }],
      { sale_type: 'quotation' as any },
      null,
    );
    const sale: any = await db.sale.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        user: true,
        branch: true,
        consumer: true,
      },
    });
    const spy = jest.spyOn(boot.get(ReceiptPdfService), 'generatePdf');
    const output = await boot
      .get(QuotationPdfService)
      .generateQuotationPdf(sale);
    expect(pdfText(output)).toContain(sale.sale_number);
    expect(spy.mock.calls[0][0]).toMatchObject({
      saleType: 'quotation',
      paymentStatus: 'unpaid',
      totalAmount: 200,
      items: [{ quantity: 2, unitPrice: 100, lineTotal: 200 }],
    });
    expect(
      await db.inventoryBatch.findFirstOrThrow({
        where: { variant_id: variant.id },
      }),
    ).toMatchObject({ quantity: 10 });
  });

  it('[BE-PDF-102] {ReturnPdfService.generateReturnReceiptPdf} returned units and the refund are printed from the actual return', async () => {
    const variant = await w.stock({
      price: 100,
      batches: [{ qty: 10, cost: 40 }],
    });
    const sale = await w.sell([{ variant, qty: 2 }]);
    const item = await db.saleItem.findFirstOrThrow({
      where: { sale_id: sale.id },
    });
    const returned: any = await boot
      .get(ReturnService)
      .create(cid(), w.tenant.adminUser.id, {
        original_sale_id: sale.id,
        branch_id: w.tenant.branches[0].id,
        reason: 'Defective',
        items: [
          {
            sale_item_id: item.id,
            variant_id: variant.id,
            batch_id: (
              await db.inventoryBatch.findFirstOrThrow({
                where: { variant_id: variant.id },
              })
            ).id,
            quantity: 1,
          },
        ],
        payments: [{ payment_method: 'CASH', amount: 100 }],
      } as any);
    const record: any = await boot
      .get(ReturnService)
      .findOne(returned.id, cid());
    const spy = jest.spyOn(boot.get(ReceiptPdfService), 'generatePdf');
    const output = await boot
      .get(ReturnPdfService)
      .generateReturnReceiptPdf(record);
    expect(pdfText(output)).toContain(record.return_number);
    expect(spy.mock.calls[0][0]).toMatchObject({
      saleType: 'return',
      items: [{ quantity: 1, unitPrice: 100, lineTotal: 100 }],
    });
    expect(
      await db.inventoryBatch.findFirstOrThrow({
        where: { variant_id: variant.id },
      }),
    ).toMatchObject({ quantity: 9 });
  });

  it('[BE-PDF-103] {ProductAuditService.getAuditData} {ProductAuditService.generateAuditReport} {ProductAuditPdfService.generatePdf} (cross-tenant) stock history and PDF refer only to the owned variant', async () => {
    const variant = await w.stock({
      price: 100,
      batches: [{ qty: 10, cost: 40 }],
    });
    await db.inventoryAuditLog.updateMany({
      where: { variant_id: variant.id },
      data: { created_at: new Date('2026-03-15T10:00:00Z') },
    });
    const query = {
      variant_id: variant.id,
      start_date: '2026-03-15',
      end_date: '2026-03-15',
    };
    const service = boot.get(ProductAuditService);
    const data = await service.getAuditData(cid(), query);
    expect(data.meta.variant.id).toBe(variant.id);
    expect(data.meta.consumer!.id).toBe(cid());
    expect(pdfText(await service.generateAuditReport(cid(), query))).toContain(
      variant.product.name,
    );
    expect(
      pdfText(await boot.get(ProductAuditPdfService).generatePdf(data)),
    ).toContain(variant.product.name);
    for (const action of [
      () => service.getAuditData(w.bystander.consumer.id, query),
      () => service.generateAuditReport(w.bystander.consumer.id, query),
    ]) {
      const error = await action().catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getStatus()).toBe(400);
      expect(error.message).toBe('Variant not found');
    }
  });

  it('[BE-PDF-104] {BusinessReportPdfService.generate} (cross-tenant) business report includes owned sales and omits foreign branch branding', async () => {
    const variant = await w.stock({
      price: 100,
      batches: [{ qty: 10, cost: 40 }],
    });
    const sale = await w.sell([{ variant, qty: 2 }]);
    await db.sale.update({
      where: { id: sale.id },
      data: { sale_date: new Date('2026-03-15T10:00:00Z') },
    });
    const query = { date: '2026-03-15' } as any;
    const report = await boot.get(SalesService).getEODReport(cid(), query);
    const service = boot.get(BusinessReportPdfService);
    const text = pdfText(await service.generate(cid(), query, report));
    expect(text).toContain('BUSINESS REPORT');
    expect(text).toContain('200.00');
    const foreign = pdfText(
      await service.generate(
        cid(),
        { ...query, branch_id: w.bystander.branches[0].id },
        report,
      ),
    );
    expect(foreign).toContain('All Branches');
    expect(foreign).not.toContain(w.bystander.consumer.company_name);
  });
});
