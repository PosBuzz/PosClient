import { get, post } from "./crud-api";
import { endpoints } from "./endpoints";
import {
  Return,
  CreateReturnForm,
  ReturnListFilters,
  ReturnListResponse,
  SaleForReturn,
} from "../types/return.types";
import axiosInstance from "./axiosInstance";

export const returnsApi = {
  // Get all returns with filters
  getReturns: async (
    filters: ReturnListFilters,
  ): Promise<ReturnListResponse> => {
    return await get(endpoints.getReturns, filters);
  },

  // Get a single return by ID
  getReturn: async (id: number): Promise<Return> => {
    return await get(endpoints.getReturn(id));
  },

  // Create a new return
  createReturn: async (returnData: CreateReturnForm): Promise<Return> => {
    return await post(endpoints.createReturn, returnData);
  },

  // Get sale details for creating return (using existing sales API)
  getSaleForReturn: async (saleId: number): Promise<SaleForReturn> => {
    return await get(endpoints.getSale(saleId));
  },

  // Download PDF
  downloadReturnPdf: async (id: number): Promise<Blob> => {
    const response = await axiosInstance.get(endpoints.downloadReturnPdf(id), {
      responseType: "blob",
    });
    return response.data;
  },
};
