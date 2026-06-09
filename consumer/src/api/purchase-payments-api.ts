import { get, post } from "./crud-api";
import { endpoints } from "./endpoints";
import {
  MakePurchasePaymentForm,
  PurchasePaymentResponse,
  PurchaseBatchesFilters,
  PurchaseBatchesListResponse,
  InventoryBatchForPayment,
  PurchasePayment,
} from "../types/purchase-payment.types";

export const purchasePaymentsApi = {
  // Get purchase payment batches across paid, partial, due, and vendorless views.
  getPurchaseBatches: async (
    filters: PurchaseBatchesFilters,
  ): Promise<PurchaseBatchesListResponse> => {
    return await get(endpoints.getPurchasePaymentBatches, filters);
  },

  // Get a single batch for making payment
  getBatchForPayment: async (
    batchId: number,
  ): Promise<InventoryBatchForPayment> => {
    return await get(endpoints.getBatchForPayment(batchId));
  },

  // Make a payment on an unpaid batch
  makePayment: async (
    paymentData: MakePurchasePaymentForm,
  ): Promise<PurchasePaymentResponse> => {
    return await post(endpoints.makePurchasePayment, paymentData);
  },

  // Get payment history for a batch
  getBatchPayments: async (
    batchId: number,
  ): Promise<{ payments: PurchasePayment[] }> => {
    return await get(endpoints.getBatchPayments(batchId));
  },
};
