export interface ReceiptPdfItem {
  productName: string;
  variantName: string;
  sku: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  soldUnitPrice: number;
  averageDiscount: number;
  specialDiscount: number;
  promotionDiscount: number;
  totalDiscount: number;
  taxAmount: number;
  taxPercentage: number;
  taxMethod: 'INCLUSIVE' | 'EXCLUSIVE';
  lineTotal: number;
}

export interface ReceiptPdfPayment {
  method: string;
  type: string;
  amount: number;
  reference: string;
  /** Set on per-payment money receipts, where the individual date matters */
  date?: Date;
}

export interface ReceiptPdfData {
  storeName: string;
  branchName: string;
  branchAddress: string;
  branchPhone: string;
  branchEmail: string;
  logoPath: string;

  /** Currency formatting – sourced from Consumer table */
  currencySymbol: string;
  currencyPosition: 'before' | 'after';

  headerText: string;

  saleNumber: string;
  saleDate: Date;
  saleType: string;
  priceType: string;
  paymentStatus: string;
  cashierName: string;
  servedByName: string;

  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress?: string;
  customerRewardPoints: number | null;

  items: ReceiptPdfItem[];

  subtotal: number;
  discountAmount: number;
  promotionDiscount: number;
  shippingCost: number;
  taxAmount: number;
  totalAmount: number;

  payments: ReceiptPdfPayment[];
  receivedAmount: number;
  changeAmount: number;
  dueAmount: number;

  /**
   * Per-payment money receipts only: what the customer owed before this
   * payment landed. `dueAmount` is then the balance left after it.
   */
  previousDueAmount?: number;

  notes: string;

  vatRegistrationNumber: string;
  footerTerms: string;

  isOnlineOrder: boolean;
  onlineOrderStatus: string | null;
}
