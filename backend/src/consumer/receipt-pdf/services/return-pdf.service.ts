// return-pdf.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ReceiptPdfService } from './receipt-pdf.service';
import { ReceiptPdfSettingService } from './receipt-pdf-setting.service';
import { ReceiptPdfSettings } from '../preset/receipt-pdf-settings';
import { ReceiptPdfData } from '../interfaces/receipt-pdf-data.interface';
import { deepMerge, normalizeLineBreaks, humanPaymentMethod, humanPaymentType } from '../helpers/receipt-pdf.helpers';

@Injectable()
export class ReturnPdfService {
  private readonly logger = new Logger(ReturnPdfService.name);

  constructor(
    private readonly receiptPdfService: ReceiptPdfService,
    private readonly receiptPdfSettingService: ReceiptPdfSettingService,
  ) {}

  async generateReturnReceiptPdf(
    returnRecord: any,
    settingsOverride?: Partial<ReceiptPdfSettings>,
    dataOverrides?: Partial<ReceiptPdfData>,
  ): Promise<Buffer> {
    const consumerId: number = returnRecord.consumer_id;
    const branchId: number = returnRecord.branch_id;

    const [settings, branding] = await Promise.all([
      this.receiptPdfSettingService.getActiveSettings(consumerId, 'return', branchId),
      this.receiptPdfSettingService.getBrandingData(consumerId, branchId),
    ]);

    const mergedSettings = settingsOverride
      ? (deepMerge(settings, settingsOverride) as ReceiptPdfSettings)
      : settings;

    let data = this.mapReturnToPdfData(returnRecord, mergedSettings, branding);

    if (dataOverrides) {
      data = { ...data, ...dataOverrides };
    }

    return this.receiptPdfService.generatePdf(data, mergedSettings);
  }

  private mapReturnToPdfData(
    returnRecord: any,
    settings: ReceiptPdfSettings,
    branding: any,
  ): ReceiptPdfData {
    const originalSale = returnRecord.original_sale;

    // Combine returned items and exchange items into a single list for the PDF
    const returnedItems = (returnRecord.items || [])
      .filter((item: any) => Number(item.quantity) > 0) // Prevent 0-qty items from rendering
      .map((item: any) => {
        const variant = item.variant || item.sale_item?.variant;
        const saleItem = item.sale_item;

        // Use sold_unit_price for accurate refund representation
        const unitPrice = Number(saleItem?.sold_unit_price || saleItem?.unit_price || 0);
        const qty = Number(item.quantity) || 0;
        const lineTotal = qty * unitPrice; // Positive value for returned item

        return {
          productName: variant?.product?.name || '',
          variantName: variant?.name || '',
          sku: variant?.sku || '',
          barcode: variant?.barcode || '',
          quantity: qty, // Show as positive quantity on the receipt
          unitPrice: unitPrice,
          soldUnitPrice: unitPrice,
          averageDiscount: 0,
          specialDiscount: 0,
          promotionDiscount: 0,
          totalDiscount: 0,
          taxAmount: Number(saleItem?.tax_amount || 0),
          taxPercentage: variant?.product?.tax || 0,
          taxMethod: variant?.product?.tax_method || 'EXCLUSIVE',
          lineTotal: lineTotal, // Positive line total
        };
      });

    const exchangeItems = (returnRecord.exchanges || []).map((exc: any) => {
      const variant = exc.variant;
      const qty = Number(exc.quantity) || 0;
      const unitPrice = Number(exc.unit_price) || 0;
      const lineTotal = Number(exc.line_total) || qty * unitPrice;

      return {
        productName: `[Exchange] ${variant?.product?.name || ''}`,
        variantName: variant?.name || '',
        sku: variant?.sku || '',
        barcode: variant?.barcode || '',
        quantity: qty,
        unitPrice: unitPrice,
        soldUnitPrice: unitPrice,
        averageDiscount: 0,
        specialDiscount: 0,
        promotionDiscount: 0,
        totalDiscount: 0,
        taxAmount: 0,
        taxPercentage: variant?.product?.tax || 0,
        taxMethod: variant?.product?.tax_method || 'EXCLUSIVE',
        lineTotal: lineTotal,
      };
    });

    // Calculate subtotal manually from returned items to match the receipt table
    const subtotal = returnedItems.reduce((sum, item) => sum + item.lineTotal, 0);

    return {
      storeName: branding.storeName,
      branchName: branding.branchName,
      branchAddress: branding.branchAddress,
      branchPhone: branding.branchPhone,
      branchEmail: branding.branchEmail,
      logoPath: branding.logoPath,
      vatRegistrationNumber: branding.vatRegistrationNumber,

      currencySymbol: settings.currencySymbol || '৳',
      currencyPosition: settings.currencyPosition || 'before',
      footerTerms: normalizeLineBreaks(settings.footer?.termsText || ''),

      headerText: settings.header?.text || 'RETURN RECEIPT',

      saleNumber: returnRecord.return_number || '',
      saleDate: returnRecord.return_date ? new Date(returnRecord.return_date) : new Date(),
      saleType: 'return',
      priceType: 'regular',
      paymentStatus: 'refunded',
      cashierName: returnRecord.user?.name || '',
      servedByName: originalSale?.served_by?.name || '',

      // Customer pulled from original sale
      customerName: originalSale?.customer?.name || originalSale?.customer_name || '',
      customerPhone: originalSale?.customer?.phone || originalSale?.customer_phone || '',
      customerEmail: originalSale?.customer?.email || originalSale?.customer_email || '',
      customerAddress: originalSale?.customer?.address || '',
      customerRewardPoints: originalSale?.customer?.rewards_points?.total_points ?? null,

      items: [...returnedItems, ...exchangeItems],

      subtotal: subtotal,
      discountAmount: 0,
      promotionDiscount: 0,
      shippingCost: 0,
      taxAmount: 0,
      totalAmount: Number(returnRecord.total_refund || 0) - Number(returnRecord.total_exchange || 0), 

      payments: (returnRecord.payments || []).map((p: any) => ({
        method: humanPaymentMethod(p.payment_method),
        type: p.payment_type ? humanPaymentType(p.payment_type) : '',
        amount: Number(p.amount) || 0,
        reference: p.reference || '',
      })),

      receivedAmount: 0,
      changeAmount: 0,
      dueAmount: 0,

      notes: normalizeLineBreaks(returnRecord.reason || returnRecord.notes || ''),
      isOnlineOrder: false,
      onlineOrderStatus: null,
    };
  }
}
