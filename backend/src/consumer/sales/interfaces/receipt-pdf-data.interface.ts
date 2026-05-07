// receipt-pdf-data.interface.ts

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
}

export interface ReceiptPdfData {
  storeName: string;
  branchName: string;
  branchAddress: string;
  branchPhone: string;
  branchEmail: string;
  logoPath: string;

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

  notes: string;

  vatRegistrationNumber: string;
  footerTerms: string;

  isOnlineOrder: boolean;
  onlineOrderStatus: string | null;
}