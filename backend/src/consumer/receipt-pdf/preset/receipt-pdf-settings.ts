// receipt-pdf-settings.ts

export type ReceiptPresetType = 'receipt' | 'quotation' | 'return';

export interface ReceiptPdfSettings {
  page: {
    size: 'A4' | 'A5' | 'Letter';
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
    showSubtotal: boolean;
    showDiscount: boolean;
    showShipping: boolean;
    showTax: boolean;
  };

  payment: {
    show: boolean;
    showBreakdown: boolean;
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
  currencySymbol: '$',
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
    showSubtotal: true,
    showDiscount: true,
    showShipping: false,
    showTax: false,
  },
  payment: {
    show: true,
    showBreakdown: false,
    showReceivedAmount: true,
    showChangeAmount: true,
    showDueAmount: true,
  },
  notes: { show: false },
  footer: {
    showTerms: true,
    termsText: 'Thank you for your purchase! All sales are final. Items must be returned within 7 days with original receipt.',
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
    showSubtotal: true,
    showDiscount: true,
    showShipping: true,
    showTax: true,
  },
  payment: {
    show: false,
    showBreakdown: false,
    showReceivedAmount: false,
    showChangeAmount: false,
    showDueAmount: false,
  },
  notes: { show: true },
  footer: {
    showTerms: true,
    termsText: 'This quotation is valid for 30 days from the date of issue. Prices are subject to change after expiration.',
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
    showSubtotal: true,
    showDiscount: false,
    showShipping: false,
    showTax: true,
  },
  payment: {
    show: true,
    showBreakdown: true,
    showReceivedAmount: true,
    showChangeAmount: true,
  },
  notes: { show: true },
  footer: {
    showTerms: true,
    termsText: 'Refunds will be processed within 3-5 business days. Items must be in their original condition with tags attached.',
    showBarcode: true,
    showThankYou: true,
    showPrintDate: true,
  },
};

/* ------------------------------------------------------------------ */
/*  Preset type to default settings mapping                           */
/* ------------------------------------------------------------------ */

export const PRESET_DEFAULTS: Record<ReceiptPresetType, ReceiptPdfSettings> = {
  receipt: DEFAULT_RECEIPT_SETTINGS,
  quotation: DEFAULT_QUOTATION_SETTINGS,
  return: DEFAULT_RETURN_SETTINGS,
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
    showSubtotal: false,
    showDiscount: true,
    showShipping: false,
    showTax: false,
  },
  payment: {
    show: true,
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
