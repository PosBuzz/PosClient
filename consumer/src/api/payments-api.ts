import { get, post } from './crud-api';
import { endpoints } from './endpoints';
import { 
  MakePaymentForm,
  PartialPaymentFilters,
  PartialPaymentListResponse,
  PaymentResponse,
  SaleForPayment
} from '../types/payment.types';

export const paymentsApi = {
  // Get all partially paid sales
  getPartiallyPaidSales: async (filters: PartialPaymentFilters): Promise<PartialPaymentListResponse> => {
    return await get(endpoints.getPartiallyPaidSales, filters);
  },

  // Get a single sale for making payment
  getSaleForPayment: async (saleId: number): Promise<SaleForPayment> => {
    return await get(endpoints.getSaleForPayment(saleId));
  },

  // Make a payment on a partially paid sale
  makePayment: async (paymentData: MakePaymentForm): Promise<PaymentResponse> => {
    return await post(endpoints.makePayment, paymentData);
  },

  // Get payment history for a sale
  getSalePayments: async (saleId: number): Promise<{ payments: any[] }> => {
    return await get(endpoints.getSalePayments(saleId));
  },
};
