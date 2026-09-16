// receipt-pdf-settings.ts

export const RECEIPT_PRESET_TYPES = [
  'receipt',
  'quotation',
  'return',
  'chalan',
  'money_receipt',
  'delivery_slip',
  'online_delivery_slip',
] as const;

export type ReceiptPresetType = (typeof RECEIPT_PRESET_TYPES)[number];

export interface ReceiptPdfSettings {
  page: {
    size: 'A4' | 'A5' | 'A6' | 'Letter';
    margins: { top: number; right: number; bottom: number; left: number };
  };

  currencySymbol?: string;
  currencyPosition?: 'before' | 'after';

  header: {
    show: boolean;
    text: string;
    showLogo: boolean;
    logoMaxWidth: number;
    logoMaxHeight: number;
    layout: 'centered' | 'logo-left';
  };

  storeInfo: {
    show: boolean;
    showStoreName: boolean;
    showBranchName: boolean;
    showAddress: boolean;
    showPhone: boolean;
    showEmail: boolean;
    showVatRegistration: boolean;
  };

  orderInfo: {
    show: boolean;
    showSaleNumber: boolean;
    showSaleType: boolean;
    showDate: boolean;
    showCashier: boolean;
    showServedBy: boolean;
    showPriceType: boolean;
  };

  customerInfo: {
    show: boolean;
    showName: boolean;
    showPhone: boolean;
    showEmail: boolean;
    showAddress?: boolean;
    showRewardPoints: boolean;
  };

  items: {
    show: boolean;
    showSku: boolean;
    showVariantName: boolean;
    showUnitPrice: boolean;
    showQuantity: boolean;
    showDiscount: boolean;
    discountDisplay: 'total' | 'breakdown';
    showTax: boolean;
    taxDisplay: 'total' | 'breakdown';
    showLineTotal: boolean;
  };

  totals: {
    show: boolean;
    titleAlign?: 'left' | 'right';
    showSubtotal: boolean;
    showDiscount: boolean;
    showShipping: boolean;
    showTax: boolean;
  };

  payment: {
    show: boolean;
    titleAlign?: 'left' | 'right';
    showBreakdown: boolean;
    /** Date of each payment in the breakdown. Defaults off. */
    showPaymentDate?: boolean;
    /** Reference/transaction id of each payment. Defaults on. */
    showReference?: boolean;
    showReceivedAmount: boolean;
    showChangeAmount: boolean;
    showDueAmount?: boolean;
  };

  notes: {
    show: boolean;
  };

  footer: {
    showBarcode: boolean;
    showTerms: boolean;
    termsText?: string;
    showThankYou: boolean;
    showPrintDate: boolean;
  };

  // NOTE: Branding data like storeName, logoPath, branchName, etc.,
  // still come from Consumer/Branch database tables.
  // However, currencySymbol, currencyPosition, and footer termsText
  // are now configured directly here in the settings JSON.

  fontSizes: {
    title: number;
    subtitle: number;
    heading: number;
    body: number;
    small: number;
  };
}

export const DEFAULT_RECEIPT_SETTINGS: ReceiptPdfSettings = {
  page: {
    size: 'A4',
    margins: { top: 50, right: 50, bottom: 50, left: 50 },
  },
  currencySymbol: '৳',
  currencyPosition: 'before',
  header: {
    show: true,
    text: 'RECEIPT',
    showLogo: true,
    logoMaxWidth: 120,
    logoMaxHeight: 60,
    layout: 'centered',
  },
  storeInfo: {
    show: true,
    showStoreName: true,
    showBranchName: true,
    showAddress: true,
    showPhone: true,
    showEmail: true,
    showVatRegistration: false,
  },
  orderInfo: {
    show: true,
    showSaleNumber: true,
    showSaleType: false,
    showDate: true,
    showCashier: true,
    showServedBy: false,
    showPriceType: false,
  },
  customerInfo: {
    show: true,
    showName: true,
    showPhone: true,
    showEmail: false,
    showRewardPoints: false,
  },
  items: {
    show: true,
    showSku: false,
    showVariantName: true,
    showUnitPrice: true,
    showQuantity: true,
    showDiscount: true,
    discountDisplay: 'total',
    showTax: false,
    taxDisplay: 'total',
    showLineTotal: true,
  },
  totals: {
    show: true,
    titleAlign: 'left',
    showSubtotal: true,
    showDiscount: true,
    showShipping: false,
    showTax: false,
  },
  payment: {
    show: true,
    titleAlign: 'left',
    showBreakdown: false,
    showReceivedAmount: true,
    showChangeAmount: true,
    showDueAmount: true,
  },
  notes: { show: false },
  footer: {
    showTerms: true,
    termsText:
      'Thank you for your purchase! All sales are final. Items must be returned within 7 days with original receipt.',
    showBarcode: true,
    showThankYou: true,
    showPrintDate: true,
  },
  fontSizes: {
    title: 18,
    subtitle: 13,
    heading: 10,
    body: 9,
    small: 7.5,
  },
};

export const DEFAULT_QUOTATION_SETTINGS: ReceiptPdfSettings = {
  ...DEFAULT_RECEIPT_SETTINGS,
  header: {
    show: true,
    text: 'QUOTATION',
    showLogo: true,
    logoMaxWidth: 150,
    logoMaxHeight: 75,
    layout: 'logo-left',
  },
  storeInfo: {
    show: true,
    showStoreName: true,
    showBranchName: true,
    showAddress: true,
    showPhone: true,
    showEmail: true,
    showVatRegistration: true,
  },
  orderInfo: {
    show: true,
    showSaleNumber: true,
    showSaleType: true,
    showDate: true,
    showCashier: true,
    showServedBy: true,
    showPriceType: true,
  },
  customerInfo: {
    show: true,
    showName: true,
    showPhone: true,
    showEmail: true,
    showRewardPoints: false,
  },
  items: {
    show: true,
    showSku: true,
    showVariantName: true,
    showUnitPrice: true,
    showQuantity: true,
    showDiscount: true,
    discountDisplay: 'breakdown',
    showTax: true,
    taxDisplay: 'breakdown',
    showLineTotal: true,
  },
  totals: {
    show: true,
    titleAlign: 'left',
    showSubtotal: true,
    showDiscount: true,
    showShipping: true,
    showTax: true,
  },
  payment: {
    show: false,
    titleAlign: 'left',
    showBreakdown: false,
    showReceivedAmount: false,
    showChangeAmount: false,
    showDueAmount: false,
  },
  notes: { show: true },
  footer: {
    showTerms: true,
    termsText:
      'This quotation is valid for 30 days from the date of issue. Prices are subject to change after expiration.',
    showBarcode: false,
    showThankYou: true,
    showPrintDate: true,
  },
  fontSizes: {
    title: 20,
    subtitle: 14,
    heading: 10,
    body: 9.5,
    small: 8,
  },
};

export const DEFAULT_RETURN_SETTINGS: ReceiptPdfSettings = {
  ...DEFAULT_RECEIPT_SETTINGS,
  header: {
    show: true,
    text: 'RETURN RECEIPT',
    showLogo: true,
    logoMaxWidth: 120,
    logoMaxHeight: 60,
    layout: 'centered',
  },
  orderInfo: {
    show: true,
    showSaleNumber: true,
    showSaleType: true,
    showDate: true,
    showCashier: true,
    showServedBy: false,
    showPriceType: false,
  },
  customerInfo: {
    show: true,
    showName: true,
    showPhone: true,
    showEmail: false,
    showRewardPoints: true,
  },
  items: {
    show: true,
    showSku: false,
    showVariantName: true,
    showUnitPrice: true,
    showQuantity: true,
    showDiscount: false,
    discountDisplay: 'total',
    showTax: true,
    taxDisplay: 'total',
    showLineTotal: true,
  },
  totals: {
    show: true,
    titleAlign: 'left',
    showSubtotal: true,
    showDiscount: false,
    showShipping: false,
    showTax: true,
  },
  payment: {
    show: true,
    titleAlign: 'left',
    showBreakdown: true,
    showReceivedAmount: true,
    showChangeAmount: true,
  },
  notes: { show: true },
  footer: {
    showTerms: true,
    termsText:
      'Refunds will be processed within 3-5 business days. Items must be in their original condition with tags attached.',
    showBarcode: true,
    showThankYou: true,
    showPrintDate: true,
  },
};

/**
 * Delivery chalan / challan: goods hand-over document.
 * Lists what is being delivered, deliberately without any money on it.
 */
export const DEFAULT_CHALAN_SETTINGS: ReceiptPdfSettings = {
  ...DEFAULT_RECEIPT_SETTINGS,
  header: {
    show: true,
    text: 'DELIVERY CHALAN',
    showLogo: true,
    logoMaxWidth: 150,
    logoMaxHeight: 75,
    layout: 'logo-left',
  },
  storeInfo: {
    show: true,
    showStoreName: true,
    showBranchName: true,
    showAddress: true,
    showPhone: true,
    showEmail: false,
    showVatRegistration: true,
  },
  orderInfo: {
    show: true,
    showSaleNumber: true,
    showSaleType: false,
    showDate: true,
    showCashier: false,
    showServedBy: true,
    showPriceType: false,
  },
  customerInfo: {
    show: true,
    showName: true,
    showPhone: true,
    showEmail: false,
    showAddress: true,
    showRewardPoints: false,
  },
  items: {
    show: true,
    showSku: true,
    showVariantName: true,
    showUnitPrice: false,
    showQuantity: true,
    showDiscount: false,
    discountDisplay: 'total',
    showTax: false,
    taxDisplay: 'total',
    showLineTotal: false,
  },
  totals: {
    show: false,
    titleAlign: 'left',
    showSubtotal: false,
    showDiscount: false,
    showShipping: false,
    showTax: false,
  },
  payment: {
    show: false,
    titleAlign: 'left',
    showBreakdown: false,
    showReceivedAmount: false,
    showChangeAmount: false,
    showDueAmount: false,
  },
  notes: { show: true },
  footer: {
    showTerms: true,
    termsText:
      'Goods received in good condition and correct quantity.\n\nReceiver Signature: ____________________     Date: ____________',
    showBarcode: true,
    showThankYou: false,
    showPrintDate: true,
  },
};

/**
 * Money receipt: acknowledges payment received against a sale.
 * No item table — the money side is the whole point.
 */
export const DEFAULT_MONEY_RECEIPT_SETTINGS: ReceiptPdfSettings = {
  ...DEFAULT_RECEIPT_SETTINGS,
  page: {
    size: 'A5',
    margins: { top: 30, right: 30, bottom: 30, left: 30 },
  },
  header: {
    show: true,
    text: 'MONEY RECEIPT',
    showLogo: true,
    logoMaxWidth: 120,
    logoMaxHeight: 60,
    layout: 'centered',
  },
  storeInfo: {
    show: true,
    showStoreName: true,
    showBranchName: true,
    showAddress: true,
    showPhone: true,
    showEmail: false,
    showVatRegistration: true,
  },
  orderInfo: {
    show: true,
    showSaleNumber: true,
    showSaleType: false,
    showDate: true,
    showCashier: true,
    showServedBy: false,
    showPriceType: false,
  },
  customerInfo: {
    show: true,
    showName: true,
    showPhone: true,
    showEmail: false,
    showRewardPoints: false,
  },
  items: {
    show: false,
    showSku: false,
    showVariantName: false,
    showUnitPrice: false,
    showQuantity: false,
    showDiscount: false,
    discountDisplay: 'total',
    showTax: false,
    taxDisplay: 'total',
    showLineTotal: false,
  },
  totals: {
    show: true,
    titleAlign: 'left',
    showSubtotal: false,
    showDiscount: false,
    showShipping: false,
    showTax: false,
  },
  payment: {
    show: true,
    titleAlign: 'left',
    showBreakdown: true,
    showPaymentDate: true,
    showReference: true,
    showReceivedAmount: true,
    showChangeAmount: false,
    showDueAmount: true,
  },
  notes: { show: true },
  footer: {
    showTerms: true,
    termsText:
      'Received with thanks.\n\nAuthorised Signature: ____________________',
    showBarcode: false,
    showThankYou: false,
    showPrintDate: true,
  },
  fontSizes: {
    title: 16,
    subtitle: 11,
    heading: 9,
    body: 8.5,
    small: 7,
  },
};

/**
 * Delivery slip / sticker: small label that goes on the parcel.
 * Delivery address first, item lines as a packing check, no money.
 */
export const DEFAULT_DELIVERY_SLIP_SETTINGS: ReceiptPdfSettings = {
  ...DEFAULT_RECEIPT_SETTINGS,
  page: {
    size: 'A6',
    margins: { top: 12, right: 12, bottom: 12, left: 12 },
  },
  header: {
    show: true,
    text: 'DELIVERY SLIP',
    showLogo: true,
    logoMaxWidth: 70,
    logoMaxHeight: 35,
    layout: 'logo-left',
  },
  storeInfo: {
    show: true,
    showStoreName: true,
    showBranchName: false,
    showAddress: false,
    showPhone: true,
    showEmail: false,
    showVatRegistration: false,
  },
  orderInfo: {
    show: true,
    showSaleNumber: true,
    showSaleType: false,
    showDate: true,
    showCashier: false,
    showServedBy: false,
    showPriceType: false,
  },
  customerInfo: {
    show: true,
    showName: true,
    showPhone: true,
    showEmail: false,
    showAddress: true,
    showRewardPoints: false,
  },
  items: {
    show: true,
    showSku: false,
    showVariantName: true,
    showUnitPrice: false,
    showQuantity: true,
    showDiscount: false,
    discountDisplay: 'total',
    showTax: false,
    taxDisplay: 'total',
    showLineTotal: false,
  },
  totals: {
    show: false,
    titleAlign: 'left',
    showSubtotal: false,
    showDiscount: false,
    showShipping: false,
    showTax: false,
  },
  payment: {
    show: false,
    titleAlign: 'left',
    showBreakdown: false,
    showReceivedAmount: false,
    showChangeAmount: false,
    showDueAmount: false,
  },
  notes: { show: true },
  footer: {
    showTerms: false,
    termsText: '',
    showBarcode: true,
    showThankYou: false,
    showPrintDate: false,
  },
  fontSizes: {
    title: 13,
    subtitle: 9,
    heading: 8,
    body: 7.5,
    small: 6,
  },
};

/* ------------------------------------------------------------------ */
/*  Preset type to default settings mapping                           */
/* ------------------------------------------------------------------ */

export const DEFAULT_ONLINE_DELIVERY_SLIP_SETTINGS: ReceiptPdfSettings = {
  ...DEFAULT_DELIVERY_SLIP_SETTINGS,
  header: {
    ...DEFAULT_DELIVERY_SLIP_SETTINGS.header,
    text: 'ONLINE DELIVERY SLIP',
  },
  payment: {
    ...DEFAULT_DELIVERY_SLIP_SETTINGS.payment,
    show: true,
    showDueAmount: true,
  },
};

export const PRESET_DEFAULTS: Record<ReceiptPresetType, ReceiptPdfSettings> = {
  receipt: DEFAULT_RECEIPT_SETTINGS,
  quotation: DEFAULT_QUOTATION_SETTINGS,
  return: DEFAULT_RETURN_SETTINGS,
  chalan: DEFAULT_CHALAN_SETTINGS,
  money_receipt: DEFAULT_MONEY_RECEIPT_SETTINGS,
  delivery_slip: DEFAULT_DELIVERY_SLIP_SETTINGS,
  online_delivery_slip: DEFAULT_ONLINE_DELIVERY_SLIP_SETTINGS,
};

/* ------------------------------------------------------------------ */
/*  Optional compact presets (not auto-created, but available)        */
/* ------------------------------------------------------------------ */

export const COMPACT_RECEIPT_SETTINGS: ReceiptPdfSettings = {
  ...DEFAULT_RECEIPT_SETTINGS,
  page: {
    size: 'A5',
    margins: { top: 15, right: 10, bottom: 15, left: 10 },
  },
  header: {
    show: true,
    text: 'RECEIPT',
    showLogo: true,
    logoMaxWidth: 80,
    logoMaxHeight: 40,
    layout: 'centered',
  },
  storeInfo: {
    show: true,
    showStoreName: true,
    showBranchName: false,
    showAddress: true,
    showPhone: true,
    showEmail: false,
    showVatRegistration: false,
  },
  orderInfo: {
    show: true,
    showSaleNumber: true,
    showSaleType: false,
    showDate: true,
    showCashier: false,
    showServedBy: false,
    showPriceType: false,
  },
  customerInfo: {
    show: false,
    showName: false,
    showPhone: false,
    showEmail: false,
    showRewardPoints: false,
  },
  items: {
    show: true,
    showSku: false,
    showVariantName: false,
    showUnitPrice: false,
    showQuantity: true,
    showDiscount: true,
    discountDisplay: 'total',
    showTax: false,
    taxDisplay: 'total',
    showLineTotal: true,
  },
  totals: {
    show: true,
    titleAlign: 'left',
    showSubtotal: false,
    showDiscount: true,
    showShipping: false,
    showTax: false,
  },
  payment: {
    show: true,
    titleAlign: 'left',
    showBreakdown: false,
    showReceivedAmount: true,
    showChangeAmount: true,
    showDueAmount: true,
  },
  notes: { show: false },
  footer: {
    showTerms: true,
    termsText: 'Thank you for your purchase!',
    showBarcode: true,
    showThankYou: true,
    showPrintDate: true,
  },
  fontSizes: {
    title: 14,
    subtitle: 10,
    heading: 8,
    body: 7,
    small: 6,
  },
};
