import { get, post, patch, deleteApi } from "./crud-api";
import { endpoints } from "./endpoints";
import {
  Sale,
  SaleFormData,
  SaleListFilters,
  SaleListResponse,
  SalesStats,
  ProductVariantForSale,
  DailyTargetReportResponse,
  EODReportResponse,
  DashboardAnalyticsResponse,
  OnlineOrderStatus,
} from "../types/sale.types";
import axiosInstance from "./axiosInstance";
import type { ReceiptPresetType } from "./receipt-settings-api";

export const salesApi = {
  // Get all sales with filters
  getSales: async (filters: SaleListFilters): Promise<SaleListResponse> => {
    return await get(endpoints.getSales, filters);
  },

  // Get a single sale by ID (pass includeDeleted for soft-deleted sales)
  getSale: async (id: number, includeDeleted = false): Promise<Sale> => {
    return await get(
      endpoints.getSale(id),
      includeDeleted ? { include_deleted: true } : undefined,
    );
  },

  // Update the note on a sale (the only editable field after a sale is made)
  updateSaleNote: async (id: number, notes: string): Promise<Sale> => {
    return await patch(endpoints.updateSaleNote(id), { notes });
  },

  // Soft-delete a sale: restores stock, keeps the record in the Deleted tab
  deleteSale: async (
    id: number,
    reason?: string,
  ): Promise<{ message: string; sale_id: number }> => {
    return await deleteApi(endpoints.getSale(id), reason ? { reason } : {});
  },

  // Restore a soft-deleted sale (re-deducts stock)
  restoreSale: async (id: number): Promise<Sale> => {
    return await post(endpoints.restoreSale(id), {});
  },

  // Create a new sale
  createSale: async (saleData: SaleFormData): Promise<Sale> => {
    return await post(endpoints.createSale, saleData);
  },

  // Get sales statistics
  getSalesStats: async (branchId: number): Promise<SalesStats> => {
    return await get(endpoints.getSalesStats, { branch_id: branchId });
  },

  // Get user sales statistics with date range
  getUserSalesStats: async (params: {
    startDate: string;
    endDate: string;
    branch_id?: number | null;
  }): Promise<any> => {
    const cleanParams: any = {
      startDate: params.startDate,
      endDate: params.endDate,
    };
    if (params.branch_id) {
      cleanParams.branch_id = params.branch_id;
    }
    return await get(endpoints.getUserSalesStats, cleanParams);
  },
  getUserSalesDetail: async (
    userId: number,
    params: { startDate: string; endDate: string; page: number; limit: number },
  ): Promise<any> => {
    return await get(endpoints.getUserSalesDetail(userId), params);
  },
  getBranchOptions: async (): Promise<{ id: number; name: string }[]> => {
    return await get(endpoints.getBranchOptions);
  },
  getVariantSalesStats: async (params: {
    startDate: string;
    endDate: string;
    branch_id?: number | null;
    page?: number;
    limit?: number;
  }): Promise<any> => {
    const cleanParams: any = {
      startDate: params.startDate,
      endDate: params.endDate,
    };
    if (params.branch_id) {
      cleanParams.branch_id = params.branch_id;
    }

    if (params.page) {
      cleanParams.page = params.page;
    }

    if (params.limit) {
      cleanParams.limit = params.limit;
    }

    return await get(endpoints.getVariantSalesStats, cleanParams);
  },
  getVariantSalesDetail: async (
    variantId: number,
    params: {
      startDate: string;
      endDate: string;
      branch_id?: number | null;
      page: number;
      limit: number;
    },
  ): Promise<any> => {
    const cleanParams: any = {
      startDate: params.startDate,
      endDate: params.endDate,
      page: params.page,
      limit: params.limit,
    };
    if (params.branch_id) {
      cleanParams.branch_id = params.branch_id;
    }
    return await get(endpoints.getVariantSalesDetail(variantId), cleanParams);
  },

  // Get products available for sale
  getProductsForSale: async (
    branchId: number,
    search?: string,
  ): Promise<ProductVariantForSale[]> => {
    const params: any = { branch_id: branchId };
    if (search) {
      params.search = search;
    }
    return await get(endpoints.getProductsForSale, params);
  },

  // Get product by barcode
  getProductByBarcode: async (
    branchId: number,
    barcode: string,
  ): Promise<ProductVariantForSale | null> => {
    try {
      return await get(endpoints.getProductByBarcode, {
        branch_id: branchId,
        barcode,
      });
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null; // Product not found
      }
      throw error; // Re-throw other errors
    }
  },

  // Generate sale receipt PDF. Pass a preset type to print the same sale as a
  // chalan, money receipt or delivery slip instead of the normal receipt.
  generateReceipt: async (
    id: number,
    type?: ReceiptPresetType,
  ): Promise<Blob> => {
    const response = await axiosInstance.get(
      endpoints.generateSaleReceipt(id, type),
      {
        responseType: "blob",
      },
    );
    return response.data;
  },

  // Money receipt for a single payment against a sale (date, method, reference
  // and balance before/after), as opposed to the sale-level money receipt.
  generatePaymentReceipt: async (
    id: number,
    paymentId: number,
  ): Promise<Blob> => {
    const response = await axiosInstance.get(
      endpoints.generateSalePaymentReceipt(id, paymentId),
      {
        responseType: "blob",
      },
    );
    return response.data;
  },

  // Search sale by sale number
  getSaleBySaleNumber: async (saleNumber: string): Promise<Sale> => {
    return get(endpoints.getSaleBySaleNumber(saleNumber));
  },

  // Get Daily Target report
  getDailyTargetReport: async (
    params: {
      date?: string;
      branch_id?: number;
      page?: number;
      limit?: number;
      search?: string;
      target_status?: "achieved" | "not_achieved";
    } = {},
  ): Promise<DailyTargetReportResponse> => {
    const cleanParams: {
      date?: string;
      branch_id?: number;
      page?: number;
      limit?: number;
      search?: string;
      target_status?: "achieved" | "not_achieved";
    } = {};

    if (params.search?.trim()) {
      cleanParams.search = params.search.trim();
    }

    if (params.target_status) {
      cleanParams.target_status = params.target_status;
    }

    if (params.date) {
      cleanParams.date = params.date;
    }

    if (params.branch_id) {
      cleanParams.branch_id = params.branch_id;
    }

    if (params.page) {
      cleanParams.page = params.page;
    }

    if (params.limit) {
      cleanParams.limit = params.limit;
    }

    return await get(endpoints.getDailyTargetReport, cleanParams);
  },

  // Get dashboard analytics report
  getDashboardAnalytics: async (
    params: {
      branch_id?: number;
      payment_period?: "daily" | "weekly" | "monthly";
      return_payment_period?: "daily" | "weekly" | "monthly";
      top_products_period?: "daily" | "weekly" | "monthly";
    } = {},
  ): Promise<DashboardAnalyticsResponse> => {
    const cleanParams: {
      branch_id?: number;
      payment_period?: string;
      return_payment_period?: string;
      top_products_period?: string;
    } = {};

    if (params.branch_id) {
      cleanParams.branch_id = params.branch_id;
    }
    if (params.payment_period) {
      cleanParams.payment_period = params.payment_period;
    }
    if (params.return_payment_period) {
      cleanParams.return_payment_period = params.return_payment_period;
    }
    if (params.top_products_period) {
      cleanParams.top_products_period = params.top_products_period;
    }

    return await get(endpoints.getDashboardAnalytics, cleanParams);
  },

  // Get End of Day report
  getEODReport: async (
    params: {
      date?: string;
      branch_id?: number;
      period?: "day" | "month" | "all";
    } = {},
  ): Promise<EODReportResponse> => {
    const queryParams = new URLSearchParams();

    if (params.date) {
      queryParams.append("date", params.date);
    }

    if (params.branch_id) {
      queryParams.append("branch_id", params.branch_id.toString());
    }
    if (params.period) queryParams.append("period", params.period);

    const response = await get(
      `${endpoints.getSales}/reports/eod?${queryParams.toString()}`,
    );

    return response;
  },

  // Returns the document rather than saving it, so it can be previewed first;
  // the filename the backend chose is carried along for the download button.
  getBusinessReportPdf: async (params: {
    date: string;
    branch_id?: number;
    period: "day" | "month" | "all";
  }): Promise<{ blob: Blob; fileName: string }> => {
    const response = await axiosInstance.get(endpoints.businessReportPdf, {
      params,
      responseType: "blob",
    });
    const disposition = response.headers["content-disposition"] as
      string | undefined;

    return {
      blob: new Blob([response.data], { type: "application/pdf" }),
      fileName:
        disposition?.match(/filename="?([^";]+)"?/)?.[1] ??
        "business-report.pdf",
    };
  },

  // ========== QUOTATION METHODS ==========

  // Get all quotations with filters
  getQuotations: async (
    filters: SaleListFilters,
  ): Promise<SaleListResponse> => {
    return await get(endpoints.getQuotations, filters);
  },

  // Get a single quotation by ID
  getQuotation: async (id: number): Promise<Sale> => {
    return await get(endpoints.getQuotation(id));
  },

  // Create a new quotation
  createQuotation: async (quotationData: SaleFormData): Promise<Sale> => {
    // Set sale_type to 'quotation'
    const data = { ...quotationData, sale_type: "quotation" };
    return await post(endpoints.createQuotation, data);
  },

  // Download quotation PDF
  downloadQuotationPdf: async (id: number): Promise<Blob> => {
    const response = await axiosInstance.get(
      endpoints.downloadQuotationPdf(id),
      {
        responseType: "blob",
      },
    );
    return response.data;
  },

  // ========== ONLINE ORDER METHODS ==========

  // Get all online orders with filters
  getOnlineOrders: async (filters: any): Promise<SaleListResponse> => {
    return await get(`${endpoints.getSales}/online-orders/list`, filters);
  },

  // Get online order statistics
  getOnlineOrderStats: async (branchId?: number): Promise<any> => {
    const params: any = {};
    if (branchId) {
      params.branch_id = branchId;
    }
    return await get(`${endpoints.getSales}/online-orders/stats`, params);
  },

  // Update online order status
  updateOnlineOrderStatus: async (
    id: number,
    data: {
      status: OnlineOrderStatus;
      /** null removes the partner; omit to keep it */
      delivery_partner_id?: number | null;
      cod_amount?: number;
      delivery_charge?: number;
      cod_fee?: number;
    },
  ): Promise<Sale> => {
    return await patch(
      `${endpoints.getSales}/online-orders/${id}/status`,
      data,
    );
  },

  getPendingDeliveries: (filters: any): Promise<SaleListResponse> =>
    get(`${endpoints.getSales}/pending-deliveries/list`, filters),
  completePendingDelivery: (id: number): Promise<Sale> =>
    patch(`${endpoints.getSales}/pending-deliveries/${id}/complete`, {}),
  cancelPendingDelivery: (id: number): Promise<Sale> =>
    patch(`${endpoints.getSales}/pending-deliveries/${id}/cancel`, {}),
};
