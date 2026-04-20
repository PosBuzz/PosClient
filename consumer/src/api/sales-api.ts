import { get, post, patch } from "./crud-api";
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

export const salesApi = {
  // Get all sales with filters
  getSales: async (filters: SaleListFilters): Promise<SaleListResponse> => {
    return await get(endpoints.getSales, filters);
  },

  // Get a single sale by ID
  getSale: async (id: number): Promise<Sale> => {
    return await get(endpoints.getSale(id));
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

  // Generate sale receipt PDF
  generateReceipt: async (id: number): Promise<Blob> => {
    const response = await axiosInstance.get(
      endpoints.generateSaleReceipt(id),
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
    } = {},
  ): Promise<DailyTargetReportResponse> => {
    const cleanParams: {
      date?: string;
      branch_id?: number;
      page?: number;
      limit?: number;
    } = {};

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
    params: { date?: string; branch_id?: number } = {},
  ): Promise<EODReportResponse> => {
    const queryParams = new URLSearchParams();

    if (params.date) {
      queryParams.append("date", params.date);
    }

    if (params.branch_id) {
      queryParams.append("branch_id", params.branch_id.toString());
    }

    const response = await get(
      `${endpoints.getSales}/reports/eod?${queryParams.toString()}`,
    );

    return response;
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
    status: OnlineOrderStatus,
  ): Promise<Sale> => {
    return await patch(`${endpoints.getSales}/online-orders/${id}/status`, {
      status,
    });
  },
};
