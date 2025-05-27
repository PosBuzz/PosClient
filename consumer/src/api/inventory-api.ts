import { get, post, patch, deleteApi } from "./crud-api";
import { endpoints } from "./endpoints";

export interface InventorySummary {
  total_batches: number;
  total_quantity: number;
  low_stock_variants: number;
  expiring_soon: number;
}

export interface InventoryBatch {
  id: number;
  variant_id: number;
  branch_id?: number;
  batch_number: string;
  quantity: number;
  cost_price: string;
  vendor_id?: number;
  expiry_date?: string;
  created_at: string;
  updated_at: string;
  variant: {
    id: number;
    name: string;
    sku?: string;
    product: {
      id: number;
      name: string;
    };
  };
  branch?: {
    id: number;
    name: string;
  };
  vendor?: {
    id: number;
    name: string;
  };
}

export interface CreateBatchData {
  variant_id: number;
  branch_id?: number | null;
  batch_number: string;
  quantity: number;
  cost_price: string;
  vendor_id?: number;
  expiry_date?: string;
}

export interface ProductForInventory {
  id: number;
  name: string;
}

export interface ProductVariant {
  id: number;
  name: string;
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
    data: Partial<CreateBatchData>
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

  getVendors: async (search?: string): Promise<Vendor[]> => {
    const params = search ? { search } : {};
    return get(endpoints.getVendors, params);
  },
};
