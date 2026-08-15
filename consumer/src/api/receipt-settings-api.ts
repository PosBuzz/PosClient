// src/api/receipt-settings-api.ts

import { get, post, patch, deleteApi } from "./crud-api";
import { endpoints } from "./endpoints";
import axiosInstance from "./axiosInstance"; // <-- Import your axios instance

/* ================================================================== */
/*  TYPES                                                             */
/* ================================================================== */

export type ReceiptPresetType =
  | "receipt"
  | "quotation"
  | "return"
  | "chalan"
  | "money_receipt"
  | "delivery_slip";

/**
 * Extra documents that can be printed off an existing sale. Same sale data,
 * only the receipt preset differs.
 */
export const SALE_DOCUMENT_PRESETS: {
  label: string;
  type: ReceiptPresetType;
  filePrefix: string;
}[] = [
  { label: "Chalan Slip", type: "chalan", filePrefix: "chalan" },
  {
    label: "Money Receipt",
    type: "money_receipt",
    filePrefix: "money-receipt",
  },
  {
    label: "Delivery Slip / Sticker",
    type: "delivery_slip",
    filePrefix: "delivery-slip",
  },
];

export interface ReceiptPdfSettings {
  page: {
    size: string | number[];
    margins: { top: number; right: number; bottom: number; left: number };
  };
  currencySymbol?: string;
  currencyPosition?: "before" | "after";
  header: {
    show: boolean;
    text: string;
    showLogo: boolean;
    layout: "center" | "logo-left";
    logoMaxWidth: number;
    logoMaxHeight: number;
  };
  storeInfo: {
    show: boolean;
    showStoreName: boolean;
    showBranchName: boolean;
    showAddress: boolean;
    showPhone: boolean;
    showEmail: boolean;
    showVatRegistration: boolean;
  };
  orderInfo: {
    show: boolean;
    showSaleNumber: boolean;
    showDate: boolean;
    showSaleType: boolean;
    showPriceType: boolean;
    showCashier: boolean;
    showServedBy: boolean;
  };
  customerInfo: {
    show: boolean;
    showName: boolean;
    showPhone: boolean;
    showEmail: boolean;
    showAddress?: boolean;
    showRewardPoints: boolean;
  };
  items: {
    show: boolean;
    showSku: boolean;
    showQuantity: boolean;
    showUnitPrice: boolean;
    showDiscount: boolean;
    discountDisplay: "total" | "breakdown";
    showTax: boolean;
    taxDisplay: "total" | "breakdown";
    showLineTotal: boolean;
    showVariantName: boolean;
  };
  totals: {
    show: boolean;
    titleAlign?: "left" | "right";
    showSubtotal: boolean;
    showDiscount: boolean;
    showShipping: boolean;
    showTax: boolean;
  };
  payment: {
    show: boolean;
    titleAlign?: "left" | "right";
    showBreakdown: boolean;
    showPaymentDate?: boolean;
    showReference?: boolean;
    showReceivedAmount: boolean;
    showChangeAmount: boolean;
    showDueAmount?: boolean;
  };
  notes: {
    show: boolean;
  };
  footer: {
    showBarcode: boolean;
    showTerms: boolean;
    showThankYou: boolean;
    showPrintDate: boolean;
  };
  fontSizes: {
    title: number;
    subtitle: number;
    heading: number;
    body: number;
    small: number;
  };
}

export interface ReceiptPdfSetting {
  id: number;
  consumer_id: number;
  branch_id: number | null;
  name: string;
  type: ReceiptPresetType;
  is_active: boolean;
  settings: ReceiptPdfSettings;
  created_by: number;
  created_at: string;
  updated_at: string;
  createdBy?: {
    id: number;
    name: string;
    email: string;
  };
  branch?: {
    id: number;
    name: string;
  };
}

export interface CreateReceiptSettingData {
  name: string;
  type: ReceiptPresetType;
  branchId?: number | null;
  settings: ReceiptPdfSettings;
  isActive?: boolean;
}

export interface UpdateReceiptSettingData {
  name?: string;
  settings?: Partial<ReceiptPdfSettings>;
}

/* ================================================================== */
/*  API FUNCTIONS                                                     */
/* ================================================================== */

export const receiptSettingsApi = {
  // List settings with optional filters
  list: async (params?: {
    type?: ReceiptPresetType;
    branchId?: number | null;
  }): Promise<ReceiptPdfSetting[]> => {
    return get(endpoints.receiptSettings, params);
  },

  // List all settings by type (across all branches)
  listByType: async (type: ReceiptPresetType): Promise<ReceiptPdfSetting[]> => {
    return get(endpoints.receiptSettingsByType(type));
  },

  // Get preset defaults for a type
  getDefaults: async (type: ReceiptPresetType): Promise<ReceiptPdfSettings> => {
    return get(endpoints.receiptSettingDefaults(type));
  },

  // Get a single setting by ID
  getById: async (id: number): Promise<ReceiptPdfSetting> => {
    return get(endpoints.receiptSettingAction(id));
  },

  // Create a new setting
  create: async (
    data: CreateReceiptSettingData,
  ): Promise<ReceiptPdfSetting> => {
    return post(endpoints.receiptSettings, {
      name: data.name,
      type: data.type,
      branchId: data.branchId,
      settings: data.settings,
      isActive: data.isActive,
    });
  },

  // Update a setting
  update: async (
    id: number,
    data: UpdateReceiptSettingData,
  ): Promise<ReceiptPdfSetting> => {
    return patch(endpoints.receiptSettingAction(id), data);
  },

  // Activate a setting
  activate: async (id: number): Promise<ReceiptPdfSetting> => {
    return patch(endpoints.receiptSettingActivate(id), {});
  },

  // Deactivate a setting
  deactivate: async (id: number): Promise<ReceiptPdfSetting> => {
    return patch(endpoints.receiptSettingDeactivate(id), {});
  },

  // Delete a setting
  remove: async (id: number): Promise<void> => {
    return deleteApi(endpoints.receiptSettingAction(id));
  },

  // Copy setting to another branch
  copyToBranch: async (
    id: number,
    branchId: number,
  ): Promise<ReceiptPdfSetting> => {
    return post(endpoints.receiptSettingCopyToBranch(id, branchId), {});
  },

  // Generate preview PDF — returns a Blob
  generatePreview: async (data: {
    settings: ReceiptPdfSettings;
    type: ReceiptPresetType;
    branchId?: number | null;
  }): Promise<Blob> => {
    // Use axiosInstance directly so CSRF tokens & refresh interceptors apply
    const response = await axiosInstance.post(
      endpoints.receiptSettingPreview,
      data,
      {
        responseType: "blob", // Required to receive PDF binary data correctly
      },
    );
    return response.data;
  },
};
