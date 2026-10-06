import { get, post, patch, deleteApi } from "./crud-api";
import { endpoints } from "./endpoints";

export interface InventorySummary {
  total_batches: number;
  total_quantity: number;
  physical_quantity: number;
  reserved_quantity: number;
  low_stock_variants: number;
  expiring_soon: number;
}

export interface InventoryBatch {
  id: number;
  variant_id: number;
  branch_id: number;
  batch_number: string;
  quantity: number;
  reserved_quantity: number;
  cost_price: string;
  vendor_id?: number;
  /** Physical storage location, e.g. "A-3-2" */
  location?: string | null;
  expiry_date?: string;
  payment_status: string;
  paid_amount: string;
  created_at: string;
  updated_at: string;
  variant: {
    product_id: number;
    id: number;
    name: string;
    sku?: string;
    regular_price: string;
    wholesale_price?: string | null;
    product: {
      id: number;
      name: string;
    };
  };
  branch: {
    id: number;
    name: string;
  };
  vendor?: {
    id: number;
    name: string;
  };
  purchasePayments?: Array<{
    id: number;
    payment_method: string;
    payment_type?: string;
    amount: string;
    reference?: string;
    created_at: string;
  }>;
}

export interface CreateBatchData {
  variant_id: number;
  branch_id: number | null;
  batch_number: string;
  quantity: number;
  cost_price: string;
  regular_price?: string;
  wholesale_price?: string;
  vendor_id?: number;
  location?: string;
  expiry_date?: string;
  payments?: Array<{
    payment_method: string;
    payment_type?: string;
    amount: number;
    reference?: string;
  }>;
}

export interface ProductForInventory {
  id: number;
  name: string;
}

export interface ProductVariant {
  id: number;
  name: string;
  regular_price: string;
  wholesale_price?: string | null;
}

export interface Branch {
  id: number;
  name: string;
  address?: string;
  is_main: boolean;
}

export interface Vendor {
  id: number;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface TransferItem {
  batch_id: number;
  quantity: number;
}

export interface CreateTransferData {
  source_branch_id: number;
  destination_branch_id: number;
  notes?: string;
  items: TransferItem[];
}

export interface InventoryTransfer {
  id: number;
  source_branch_id: number;
  destination_branch_id: number;
  status: "pending" | "completed" | "cancelled";
  notes?: string;
  created_at: string;
  completed_date?: string;
  source_branch: {
    id: number;
    name: string;
  };
  destination_branch: {
    id: number;
    name: string;
  };
  created_by_user: {
    id: number;
    name: string;
  };
  items: {
    id: number;
    batch_id: number;
    quantity: number;
    batch: {
      id: number;
      batch_number: string;
      cost_price: string;
      variant_id: number;
      variant: {
        id: number;
        name: string;
        product: {
          id: number;
          name: string;
        };
      };
    };
  }[];
}

export interface InventoryAdjustment {
  id: number;
  variant_id: number;
  branch_id: number;
  batch_id?: number;
  quantity_change: number;
  reason: string;
  notes?: string;
  created_at: string;
  batch?: {
    id: number;
    batch_number: string;
    cost_price: string;
    variant: {
      id: number;
      name: string;
      product: {
        id: number;
        name: string;
      };
    };
  };
  branch?: {
    id: number;
    name: string;
  };
  created_by_user: {
    id: number;
    name: string;
  };
}

export interface CreateAdjustmentData {
  variant_id: number;
  branch_id: number;
  batch_id: number;
  quantity_change: number;
  reason: string;
  notes?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const inventoryApi = {
  // Summary
  getSummary: async (branchId?: number): Promise<InventorySummary> => {
    const params = branchId ? { branch_id: branchId } : {};
    return get(endpoints.inventorySummary, params);
  },

  // Products for inventory selection
  getProductsForInventory: async (): Promise<ProductForInventory[]> => {
    return get(endpoints.inventoryProducts);
  },

  // Product variants - direct variant search
  getVariants: async (productId: number): Promise<ProductVariant[]> => {
    return get(endpoints.inventoryProductVariants(productId));
  },

  // Batches
  getBatches: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    branch_id?: number;
    variant_id?: number;
    category_id?: number;
  }): Promise<PaginatedResponse<InventoryBatch>> => {
    return get(endpoints.inventoryBatches, params);
  },

  getBatch: async (id: number): Promise<InventoryBatch> => {
    return get(endpoints.inventoryBatch(id));
  },

  createBatch: async (data: CreateBatchData): Promise<InventoryBatch> => {
    return post(endpoints.createInventoryBatch, data);
  },

  updateBatch: async (
    id: number,
    data: Partial<CreateBatchData>,
  ): Promise<InventoryBatch> => {
    return patch(endpoints.updateInventoryBatch(id), data);
  },

  deleteBatch: async (id: number): Promise<void> => {
    return deleteApi(endpoints.deleteInventoryBatch(id));
  },

  // Supporting data
  getBranches: async (): Promise<Branch[]> => {
    return get(endpoints.getBranches);
  },

  getVendors: async (): Promise<Vendor[]> => {
    return get(endpoints.getVendors);
  },

  // Vendor CRUD operations
  createVendor: async (data: {
    name: string;
    contact?: string;
    phone?: string;
    email?: string;
    address?: string;
  }): Promise<Vendor> => {
    return post(endpoints.createVendor, data);
  },

  updateVendor: async (
    id: number,
    data: {
      name: string;
      contact?: string;
      phone?: string;
      email?: string;
      address?: string;
    },
  ): Promise<Vendor> => {
    return patch(endpoints.updateVendor(id), data);
  },

  deleteVendor: async (id: number): Promise<void> => {
    return deleteApi(endpoints.deleteVendor(id));
  },

  // Transfers
  getTransfers: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    branch_id?: number;
  }): Promise<PaginatedResponse<InventoryTransfer>> => {
    return get(endpoints.inventoryTransfers, params);
  },

  getTransfer: async (id: number): Promise<InventoryTransfer> => {
    return get(endpoints.inventoryTransfer(id));
  },

  createTransfer: async (
    data: CreateTransferData,
  ): Promise<InventoryTransfer> => {
    return post(endpoints.createInventoryTransfer, data);
  },

  completeTransfer: async (id: number): Promise<InventoryTransfer> => {
    return patch(endpoints.completeInventoryTransfer(id), {});
  },

  cancelTransfer: async (id: number): Promise<InventoryTransfer> => {
    return patch(endpoints.cancelInventoryTransfer(id), {});
  },

  // Get batches for a specific branch (for transfer selection)
  getBranchBatches: async (
    branchId: number,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
    },
  ): Promise<PaginatedResponse<InventoryBatch>> => {
    return get(endpoints.branchBatches(branchId), params);
  },

  getAdjustments: async (params?: {
    page?: number;
    limit?: number;
    variant_id?: number;
    branch_id?: number;
  }): Promise<PaginatedResponse<InventoryAdjustment>> => {
    return get(endpoints.inventoryAdjustments, params);
  },

  getAdjustment: async (id: number): Promise<InventoryAdjustment> => {
    return get(endpoints.inventoryAdjustment(id));
  },
  createAdjustment: async (
    data: CreateAdjustmentData,
  ): Promise<InventoryAdjustment> => {
    return post(endpoints.createInventoryAdjustment, data);
  },
  // New inventory views
  getStockByVariant: async (params?: {
    page?: number;
    limit?: number;
    branch_id?: number;
    search?: string;
    low_stock_only?: boolean;
  }): Promise<PaginatedResponse<any>> => {
    return get(endpoints.inventoryStockByVariant, params);
  },

  getExpiringBatches: async (params?: {
    days?: number;
    page?: number;
    limit?: number;
    branch_id?: number;
  }): Promise<InventoryBatch[]> => {
    return get(endpoints.inventoryExpiringBatches, params);
  },

  getVariantStock: async (
    variantId: number,
    params?: {
      branch_id?: number;
    },
  ): Promise<any> => {
    return get(endpoints.inventoryVariantStock(variantId), params);
  },

  getLowStockItems: async (params?: {
    page?: number;
    limit?: number;
    branch_id?: number;
  }): Promise<any[]> => {
    return get(endpoints.inventoryLowStock, params);
  },

  getInventoryMovementHistory: async (
    variantId: number,
    params?: {
      page?: number;
      limit?: number;
      branch_id?: number;
    },
  ): Promise<PaginatedResponse<any>> => {
    return get(endpoints.inventoryMovementHistory(variantId), params);
  },
};
