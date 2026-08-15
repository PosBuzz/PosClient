import axiosInstance from "./axiosInstance";
import { endpoints } from "./endpoints";

export interface ProductAuditQuery {
  variant_id: number;
  start_date: string;
  end_date: string;
  branch_id?: number;
}

const getAuditData = async (query: ProductAuditQuery) => {
  const params: Record<string, string | number> = {
    variant_id: query.variant_id,
    start_date: query.start_date,
    end_date: query.end_date,
  };
  if (query.branch_id) params.branch_id = query.branch_id;
  const { data } = await axiosInstance.get(endpoints.getProductAudit, {
    params,
  });
  return data;
};

const downloadAuditPdf = async (query: ProductAuditQuery): Promise<void> => {
  const params: Record<string, string | number> = {
    variant_id: query.variant_id,
    start_date: query.start_date,
    end_date: query.end_date,
  };
  if (query.branch_id) params.branch_id = query.branch_id;

  const response = await axiosInstance.get(endpoints.downloadProductAuditPdf, {
    params,
    responseType: "blob",
  });

  const blob = new Blob([response.data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const disposition = response.headers["content-disposition"] as
    string | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/);
  a.download = match ? match[1] : `product-audit.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};

export const productAuditApi = { getAuditData, downloadAuditPdf };
