// sales-pdf.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ReceiptPdfService } from './receipt-pdf.service';
import { ReceiptPdfSettingService } from './receipt-pdf-setting.service';
import { ReceiptPdfSettings, ReceiptPresetType } from '../preset/receipt-pdf-settings';
import { ReceiptPdfData } from '../interfaces/receipt-pdf-data.interface';
import { deepMerge, normalizeLineBreaks, humanPaymentMethod, humanPaymentType } from '../helpers/receipt-pdf.helpers';

@Injectable()
export class SalesPdfService {
  private readonly logger = new Logger(SalesPdfService.name);

  constructor(
    private readonly receiptPdfService: ReceiptPdfService,
    private readonly receiptPdfSettingService: ReceiptPdfSettingService,
  ) {}

  async generateSaleReceiptPdf(
    sale: any,
    settingsOverride?: Partial<ReceiptPdfSettings>,
    dataOverrides?: Partial<ReceiptPdfData>,
  ): Promise<Buffer> {
    const consumerId: number = sale.consumer_id;
    const branchId: number = sale.branch_id;
    const saleType: string = sale.sale_type || 'sale';
    const presetType = this.toPresetType(saleType);

    const [settings, branding] = await Promise.all([
      this.receiptPdfSettingService.getActiveSettings(consumerId, presetType, branchId),
      this.receiptPdfSettingService.getBrandingData(consumerId, branchId),
    ]);

    const mergedSettings = settingsOverride
      ? (deepMerge(settings, settingsOverride) as ReceiptPdfSettings)
      : settings;

    let data = this.mapSaleToPdfData(sale, mergedSettings, branding);

    if (dataOverrides) {
      data = { ...data, ...dataOverrides };
    }

    return this.receiptPdfService.generatePdf(data, mergedSettings);
  }

  private toPresetType(saleType: string): ReceiptPresetType {
    if (saleType === 'quotation') return 'quotation';
    if (saleType === 'return') return 'return';
    return 'receipt';
  }

  private mapSaleToPdfData(
    sale: any,
    settings: ReceiptPdfSettings,
    branding: {
      storeName: string;
      logoPath: string;
      branchName: string;
      branchAddress: string;
      branchPhone: string;
      branchEmail: string;
      vatRegistrationNumber: string;
    },
  ): ReceiptPdfData {
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

      headerText: settings.header?.text || 'RECEIPT',

      saleNumber: sale.sale_number || '',
      saleDate: sale.sale_date ? new Date(sale.sale_date) : new Date(),
      saleType: sale.sale_type || 'sale',
      priceType: sale.price_type || 'regular',
      paymentStatus: sale.payment_status || 'paid',
      cashierName: sale.user?.name || '',
      servedByName: sale.served_by?.name || '',

      customerName: sale.customer?.name || sale.customer_name || '',
      customerPhone: sale.customer?.phone || sale.customer_phone || '',
      customerEmail: sale.customer?.email || sale.customer_email || '',
      customerRewardPoints: sale.customer?.rewards_points?.total_points ?? null,

      items: (sale.items || []).map((it: any) => {
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

      subtotal: Number(sale.subtotal) || 0,
      discountAmount: Number(sale.discount_amount) || 0,
      promotionDiscount: Number(sale.promotion_discount) || 0,
      shippingCost: Number(sale.shipping_cost) || 0,
      taxAmount: Number(sale.tax_amount) || 0,
      totalAmount: Number(sale.total_amount) || 0,

      payments: (sale.payments || []).map((p: any) => ({
        method: humanPaymentMethod(p.payment_method),
        type: p.payment_type ? humanPaymentType(p.payment_type) : '',
        amount: Number(p.amount) || 0,
        reference: p.reference || '',
      })),

      receivedAmount: Number(sale.received_amount) || 0,
      changeAmount: Math.max(0, (Number(sale.received_amount) || 0) - (Number(sale.total_amount) || 0)),
      dueAmount: Math.max(0, (Number(sale.total_amount) || 0) - (Number(sale.received_amount) || 0)),

      notes: normalizeLineBreaks(sale.notes || ''),
      isOnlineOrder: sale.is_online_order || false,
      onlineOrderStatus: sale.online_order_status || null,
    };
  }
}
