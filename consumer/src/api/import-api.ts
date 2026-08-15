// src/api/import-api.ts

import axiosInstance from "./axiosInstance";
import { endpoints } from "./endpoints";

export type ImportEntity = "products" | "inventory" | "customers";

export interface ImportColumn {
  header: string;
  required: boolean;
  hint: string;
  example: string | number;
}

export interface ImportRowError {
  /** 1-based row number as it appears in Excel (header is row 1) */
  row: number;
  column: string | null;
  message: string;
}

export interface ImportResult {
  entity: ImportEntity;
  totalRows: number;
  validRows: number;
  errors: ImportRowError[];
  /** False when this was only a validation pass */
  imported: boolean;
  created: Record<string, number>;
}

export const IMPORT_LABELS: Record<ImportEntity, string> = {
  products: "Products",
  inventory: "Stock Intake",
  customers: "Customers",
};

async function upload(url: string, file: File | Blob): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axiosInstance.post(url, formData);
  return response.data;
}

export const importApi = {
  /** Column spec, so the dialog can describe the sheet it expects */
  getColumns: async (
    entity: ImportEntity,
  ): Promise<{ entity: ImportEntity; columns: ImportColumn[] }> => {
    const response = await axiosInstance.get(endpoints.importColumns(entity));
    return response.data;
  },

  downloadTemplate: async (entity: ImportEntity): Promise<Blob> => {
    const response = await axiosInstance.get(endpoints.importTemplate(entity), {
      responseType: "blob",
    });
    return response.data;
  },

  /** Validate without writing anything */
  preview: (entity: ImportEntity, file: File | Blob): Promise<ImportResult> =>
    upload(endpoints.importPreview(entity), file),

  /** Validate and, if every row is clean, write in one transaction */
  import: (entity: ImportEntity, file: File | Blob): Promise<ImportResult> =>
    upload(endpoints.import(entity), file),
};
