import axiosInstance from "./axiosInstance";
import { endpoints } from "./endpoints";

export type ExportEntity = "products" | "customers" | "inventory";
export type ExportFormat = "xlsx" | "pdf";

const EXPORT_ENDPOINTS: Record<ExportEntity, string> = {
  products: endpoints.exportProducts,
  customers: endpoints.exportCustomers,
  inventory: endpoints.exportInventory,
};

export const exportApi = {
  /** The whole list as a spreadsheet or a PDF */
  download: async (
    entity: ExportEntity,
    format: ExportFormat,
  ): Promise<Blob> => {
    const response = await axiosInstance.get(EXPORT_ENDPOINTS[entity], {
      params: { format },
      responseType: "blob",
    });
    return response.data;
  },
};
