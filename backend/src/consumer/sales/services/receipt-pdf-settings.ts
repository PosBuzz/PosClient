// receipt-pdf-settings.ts

export interface ReceiptPdfSettings {
  page: {
    size: 'A4' | 'A5' | 'Letter';
    margins: { top: number; right: number; bottom: number; left: number };
  };

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
  };

  notes: {
    show: boolean;
  };

  footer: {
    showTerms: boolean;
    showBarcode: boolean;
    showThankYou: boolean;
    showPrintDate: boolean;
  };

  branding: {
    currencySymbol: string;
    currencyPosition: 'before' | 'after';
    vatRegistrationNumber: string;
    footerTerms: string;
    storeName: string;
    logoPath: string;
  };

  fontSizes: {
    title: number;
    subtitle: number;
    heading: number;
    body: number;
    small: number;
  };
}

export const DEFAULT_RECEIPT_PDF_SETTINGS: ReceiptPdfSettings = {
  page: {
    size: 'A4',
    margins: { top: 50, right: 50, bottom: 50, left: 50 },
  },

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
    showSku: false,
    showVariantName: true,
    showUnitPrice: true,
    showQuantity: true,
    showDiscount: true,
    discountDisplay: 'total',
    showTax: true,
    taxDisplay: 'total',
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
    show: true,
    showBreakdown: true,
    showReceivedAmount: true,
    showChangeAmount: true,
  },

  notes: { show: true },

  footer: {
    showTerms: false,
    showBarcode: true,
    showThankYou: true,
    showPrintDate: true,
  },

  branding: {
    currencySymbol: '$',
    currencyPosition: 'before',
    vatRegistrationNumber: '',
    footerTerms: '',
    storeName: '',
    logoPath: '',
  },

  fontSizes: {
    title: 18,
    subtitle: 13,
    heading: 10,
    body: 9,
    small: 7.5,
  },
};

/* ------------------------------------------------------------------ */
/*  Pre-built layout presets                                           */
/* ------------------------------------------------------------------ */

export const COMPACT_PRESET: Partial<ReceiptPdfSettings> = {
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
  fontSizes: { title: 16, subtitle: 11, heading: 9, body: 8, small: 7 },
};

export const DETAILED_PRESET: Partial<ReceiptPdfSettings> = {
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
    showRewardPoints: true,
  },
  footer: {
    showTerms: true,
    showBarcode: true,
    showThankYou: true,
    showPrintDate: true,
  },
  fontSizes: { title: 18, subtitle: 13, heading: 10, body: 9, small: 7.5 },
};

export const INVOICE_PRESET: Partial<ReceiptPdfSettings> = {
  header: {
    show: true,
    text: 'TAX INVOICE',
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
  footer: {
    showTerms: true,
    showBarcode: true,
    showThankYou: true,
    showPrintDate: true,
  },
  fontSizes: { title: 20, subtitle: 14, heading: 10, body: 9.5, small: 8 },
};