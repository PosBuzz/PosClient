// quotation-pdf.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ReceiptPdfService } from './receipt-pdf.service';
import { ReceiptPdfSettingService } from './receipt-pdf-setting.service';
import { ReceiptPdfSettings } from '../preset/receipt-pdf-settings';
import { ReceiptPdfData } from '../interfaces/receipt-pdf-data.interface';
import { deepMerge, normalizeLineBreaks, humanPaymentMethod, humanPaymentType } from '../helpers/receipt-pdf.helpers';

@Injectable()
export class QuotationPdfService {
  private readonly logger = new Logger(QuotationPdfService.name);

  constructor(
    private readonly receiptPdfService: ReceiptPdfService,
    private readonly receiptPdfSettingService: ReceiptPdfSettingService,
  ) {}

  async generateQuotationPdf(
    quotation: any, // This is a Sale object with sale_type = 'quotation'
    settingsOverride?: Partial<ReceiptPdfSettings>,
    dataOverrides?: Partial<ReceiptPdfData>,
  ): Promise<Buffer> {
    const consumerId: number = quotation.consumer_id;
    const branchId: number = quotation.branch_id;

    const [settings, branding] = await Promise.all([
      this.receiptPdfSettingService.getActiveSettings(consumerId, 'quotation', branchId),
      this.receiptPdfSettingService.getBrandingData(consumerId, branchId),
    ]);

    const mergedSettings = settingsOverride
      ? (deepMerge(settings, settingsOverride) as ReceiptPdfSettings)
      : settings;

    let data = this.mapQuotationToPdfData(quotation, mergedSettings, branding);

    if (dataOverrides) {
      data = { ...data, ...dataOverrides };
    }

    return this.receiptPdfService.generatePdf(data, mergedSettings);
  }

  private mapQuotationToPdfData(
    quotation: any,
    settings: ReceiptPdfSettings,
    branding: any,
  ): ReceiptPdfData {
    // Map exactly like a sale, but enforce quotation specific defaults
    return {
      storeName: branding.storeName,
      branchName: branding.branchName,
      branchAddress: branding.branchAddress,
      branchPhone: branding.branchPhone,
      branchEmail: branding.branchEmail,
      logoPath: branding.logoPath,
      vatRegistrationNumber: branding.vatRegistrationNumber,

      currencySymbol: settings.currencySymbol || '$',
      currencyPosition: settings.currencyPosition || 'before',
      footerTerms: normalizeLineBreaks(settings.footer?.termsText || ''),

      headerText: settings.header?.text || 'QUOTATION',

      saleNumber: quotation.sale_number || '',
      saleDate: quotation.sale_date ? new Date(quotation.sale_date) : new Date(),
      saleType: 'quotation',
      priceType: quotation.price_type || 'regular',
      paymentStatus: 'unpaid', // Quotations are inherently unpaid
      cashierName: quotation.user?.name || '',
      servedByName: quotation.served_by?.name || '',

      customerName: quotation.customer?.name || quotation.customer_name || '',
      customerPhone: quotation.customer?.phone || quotation.customer_phone || '',
      customerEmail: quotation.customer?.email || quotation.customer_email || '',
      customerRewardPoints: quotation.customer?.rewards_points?.total_points ?? null,

      items: (quotation.items || []).map((it: any) => {
        const avg = Number(it.average_discount_amount) || 0;
        const spc = Number(it.special_discount_amount) || 0;
        const pro = Number(it.promotion_discount_amount) || 0;
        return {
          productName: it.variant?.product?.name || '',
          variantName: it.variant?.name || '',
          sku: it.variant?.sku || '',
          barcode: it.variant?.barcode || '',
          quantity: it.quantity || 0,
          unitPrice: Number(it.unit_price) || 0,
          soldUnitPrice: Number(it.sold_unit_price) || 0,
          averageDiscount: avg,
          specialDiscount: spc,
          promotionDiscount: pro,
          totalDiscount: avg + spc + pro,
          taxAmount: Number(it.tax_amount) || 0,
          taxPercentage: it.variant?.product?.tax || 0,
          taxMethod: it.variant?.product?.tax_method || 'EXCLUSIVE',
          lineTotal: Number(it.line_total) || 0,
        };
      }),

      subtotal: Number(quotation.subtotal) || 0,
      discountAmount: Number(quotation.discount_amount) || 0,
      promotionDiscount: Number(quotation.promotion_discount) || 0,
      shippingCost: Number(quotation.shipping_cost) || 0,
      taxAmount: Number(quotation.tax_amount) || 0,
      totalAmount: Number(quotation.total_amount) || 0,

      payments: [], // Quotations typically don't have payments yet
      receivedAmount: 0,
      changeAmount: 0,

      notes: normalizeLineBreaks(quotation.notes || ''),
      isOnlineOrder: false,
      onlineOrderStatus: null,
    };
  }
}