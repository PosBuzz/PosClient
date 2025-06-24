import axiosInstance from "./axiosInstance";
import type {
  Sale,
  SaleFormData,
  SaleListFilters,
  SaleListResponse,
  ProductVariantForSale,
  SalesStats,
} from "../types/sale.types";

export const saleApi = {
  // Get all sales with filters
  getSales: async (filters: SaleListFilters = {}): Promise<SaleListResponse> => {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, String(value));
      }
    });

    const response = await axiosInstance.get(`/sales?${params.toString()}`);
    return response.data;
  },

  // Get sale by ID
  getSale: async (id: number): Promise<Sale> => {
    const response = await axiosInstance.get(`/sales/${id}`);
    return response.data;
  },

  // Create new sale
  createSale: async (data: SaleFormData): Promise<Sale> => {
    const response = await axiosInstance.post("/sales", data);
    return response.data;
  },

  // Update sale
  updateSale: async (id: number, data: Partial<SaleFormData>): Promise<Sale> => {
    const response = await axiosInstance.put(`/sales/${id}`, data);
    return response.data;
  },

  // Delete sale
  deleteSale: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/sales/${id}`);
  },

  // Get product variants for sale (with stock information)
  getProductVariantsForSale: async (
    branchId: number,
    search?: string
  ): Promise<ProductVariantForSale[]> => {
    const params = new URLSearchParams({ branch_id: String(branchId) });
    if (search) {
      params.append("search", search);
    }
    
    const response = await axiosInstance.get(`/sales/variants?${params.toString()}`);
    return response.data;
  },

  // Get sales statistics
  getSalesStats: async (
    branchId?: number,
    dateFrom?: string,
    dateTo?: string
  ): Promise<SalesStats> => {
    const params = new URLSearchParams();
    if (branchId) params.append("branch_id", String(branchId));
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    
    const response = await axiosInstance.get(`/sales/stats?${params.toString()}`);
    return response.data;
  },

  // Generate sale receipt
  generateReceipt: async (id: number): Promise<Blob> => {
    const response = await axiosInstance.get(`/sales/${id}/receipt`, {
      responseType: "blob",
    });
    return response.data;
  },
};
