import { Injectable, Logger } from '@nestjs/common';
import { ReceiptPdfService } from './receipt-pdf.service';
import { ReceiptPdfSettingService } from './receipt-pdf-setting.service';
import { ReceiptPdfSettings, ReceiptPresetType } from '../preset/receipt-pdf-settings';
import { ReceiptPdfData } from '../interfaces/receipt-pdf-data.interface';

@Injectable()
export class SalesPdfService {
  private readonly logger = new Logger(SalesPdfService.name);

  constructor(
    private readonly receiptPdfService: ReceiptPdfService,
    private readonly receiptPdfSettingService: ReceiptPdfSettingService,
  ) {}

  /* ================================================================== */
  /*  PUBLIC API                                                        */
  /* ================================================================== */

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
      this.receiptPdfSettingService.getActiveSettings(
        consumerId,
        presetType,
        branchId,
      ),
      this.receiptPdfSettingService.getBrandingData(consumerId, branchId),
    ]);

    const mergedSettings = settingsOverride
      ? (this.deepMerge(settings, settingsOverride) as ReceiptPdfSettings)
      : settings;

    let data = this.mapSaleToPdfData(sale, mergedSettings, branding);

    // Merge in testing data overrides (like footerTerms, currencySymbol)
    if (dataOverrides) {
      data = { ...data, ...dataOverrides };
    }

    return this.receiptPdfService.generatePdf(data, mergedSettings);
  }

  /* ================================================================== */
  /*  PRESET TYPE MAPPING                                               */
  /* ================================================================== */

  private toPresetType(saleType: string): ReceiptPresetType {
    if (saleType === 'quotation') return 'quotation';
    if (saleType === 'return') return 'return';
    return 'receipt';
  }

  /* ================================================================== */
  /*  TEXT NORMALIZATION                                                */
  /* ================================================================== */

  private normalizeLineBreaks(text: string): string {
    if (!text) return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim();
  }

  /* ================================================================== */
  /*  DATA MAPPING                                                      */
  /* ================================================================== */

  private mapSaleToPdfData(
    sale: any,
    settings: ReceiptPdfSettings,
    branding: {
      storeName: string;
      logoPath: string;
      currencySymbol: string;
      currencyPosition: 'before' | 'after';
      footerTerms: string;
      branchName: string;
      branchAddress: string;
      branchPhone: string;
      branchEmail: string;
      vatRegistrationNumber: string;
    },
  ): ReceiptPdfData {
    return {
      // Branding (from Consumer/Branch tables via service)
      storeName: branding.storeName,
      branchName: branding.branchName,
      branchAddress: branding.branchAddress,
      branchPhone: branding.branchPhone,
      branchEmail: branding.branchEmail,
      logoPath: branding.logoPath,
      currencySymbol: branding.currencySymbol,
      currencyPosition: branding.currencyPosition,
      vatRegistrationNumber: branding.vatRegistrationNumber,
      footerTerms: this.normalizeLineBreaks(branding.footerTerms),

      // Header text from settings
      headerText: settings.header.text,

      // Order details
      saleNumber: sale.sale_number || '',
      saleDate: sale.sale_date ? new Date(sale.sale_date) : new Date(),
      saleType: sale.sale_type || 'sale',
      priceType: sale.price_type || 'regular',
      paymentStatus: sale.payment_status || 'paid',
      cashierName: sale.user?.name || '',
      servedByName: sale.served_by?.name || '',

      // Customer
      customerName: sale.customer?.name || sale.customer_name || '',
      customerPhone: sale.customer?.phone || sale.customer_phone || '',
      customerEmail: sale.customer?.email || sale.customer_email || '',
      customerRewardPoints: sale.customer?.rewards_points?.total_points ?? null,

      // Items
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

      // Totals
      subtotal: Number(sale.subtotal) || 0,
      discountAmount: Number(sale.discount_amount) || 0,
      promotionDiscount: Number(sale.promotion_discount) || 0,
      shippingCost: Number(sale.shipping_cost) || 0,
      taxAmount: Number(sale.tax_amount) || 0,
      totalAmount: Number(sale.total_amount) || 0,

      // Payments
      payments: (sale.payments || []).map((p: any) => ({
        method: this.humanPaymentMethod(p.payment_method),
        type: p.payment_type ? this.humanPaymentType(p.payment_type) : '',
        amount: Number(p.amount) || 0,
        reference: p.reference || '',
      })),

      receivedAmount: Number(sale.received_amount) || 0,
      changeAmount: Math.max(
        0,
        (Number(sale.received_amount) || 0) - (Number(sale.total_amount) || 0),
      ),

      notes: this.normalizeLineBreaks(sale.notes || ''),

      // Online order
      isOnlineOrder: sale.is_online_order || false,
      onlineOrderStatus: sale.online_order_status || null,
    };
  }

  /* ================================================================== */
  /*  ENUM FORMATTERS                                                   */
  /* ================================================================== */

  private humanPaymentMethod(m: string): string {
    const map: Record<string, string> = {
      CASH: 'Cash',
      CARD: 'Card',
      CHEQUE: 'Cheque',
      BANK_TRANSFER: 'Bank Transfer',
      MOBILE_MONEY: 'Mobile Money',
      MFS: 'MFS',
      CREDIT: 'Credit',
      EXCHANGE: 'Exchange',
    };
    return map[m] ?? m;
  }

  private humanPaymentType(t: string): string {
    const special: Record<string, string> = {
      BKASH: 'bKash',
      NAGAD: 'Nagad',
      ROCKET: 'Rocket',
      MYCASH: 'MyCash',
      UPAY: 'Upay',
      OK_WALLET: 'OK Wallet',
      TELECASH: 'TeleCash',
      ISLAMIC_WALLET: 'Islamic Wallet',
      MEGHNA_PAY: 'Meghna Pay',
      FIRSTCASH: 'FirstCash',
      ISLAMI_BANK_MCASH: 'Islami Bank mCash',
      TRUST_AXIATA_PAY_TAP: 'Trust Axiata Pay Tap',
      RUPALI_BANK: 'Rupali Bank',
    };
    if (special[t]) return special[t];
    return t
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /* ================================================================== */
  /*  DEEP MERGE                                                        */
  /* ================================================================== */

  private deepMerge(target: any, source: any): any {
    const out = { ...target };
    for (const key of Object.keys(source)) {
      if (
        source[key] !== null &&
        source[key] !== undefined &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        out[key] = this.deepMerge(target[key] ?? {}, source[key]);
      } else if (source[key] !== undefined) {
        out[key] = source[key];
      }
    }
    return out;
  }
}
