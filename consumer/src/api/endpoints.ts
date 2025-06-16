export const endpoints = {
  csrfToken: "/auth/csrf-token",
  login: "/auth/login-user",
  getMe: "/auth/client",
  logout: "/auth/client-logout",
  refreshToken: "/auth/client-refresh-token",
  changePassword: "/consumer/change-password",
  planPermissions: "/consumer/users/plan-permissions",

  user: "/consumer/users",
  updateUser: (id: number) => `/consumer/users/${id}`,
  deleteUser: (id: number) => `/consumer/users/${id}`,

  role: "/consumer/users/roles",
  updateRole: (id: number) => `/consumer/users/roles/${id}`,
  deleteRole: (id: number) => `/consumer/users/roles/${id}`,

  // Product management
  products: "/consumer/products",
  productCount: "/consumer/products/count",
  getProduct: (id: number) => `/consumer/products/${id}`,
  updateProduct: (id: number) => `/consumer/products/${id}`,
  deleteProduct: (id: number) => `/consumer/products/${id}`,

  // Master data endpoints
  getBrands: "/consumer/brands",
  getCategories: "/consumer/categories",
  getUnits: "/consumer/units",
  getBranches: "/consumer/branches",
  getTags: "/consumer/tags",

  // Create master data
  createBrand: "/consumer/brands",
  createCategory: "/consumer/categories",
  createUnit: "/consumer/units",
  createBranch: "/consumer/branches",
  createTag: "/consumer/tags",

  // Update master data
  updateBrand: (id: number) => `/consumer/brands/${id}`,
  updateCategory: (id: number) => `/consumer/categories/${id}`,
  updateUnit: (id: number) => `/consumer/units/${id}`,
  updateBranch: (id: number) => `/consumer/branches/${id}`,
  updateTag: (id: number) => `/consumer/tags/${id}`,

  // Delete master data
  deleteBrand: (id: number) => `/consumer/brands/${id}`,
  deleteCategory: (id: number) => `/consumer/categories/${id}`,
  deleteUnit: (id: number) => `/consumer/units/${id}`,
  deleteBranch: (id: number) => `/consumer/branches/${id}`,
  deleteTag: (id: number) => `/consumer/tags/${id}`,

  // Vendor management
  getVendors: "/consumer/vendors",
  createVendor: "/consumer/vendors",
  updateVendor: (id: number) => `/consumer/vendors/${id}`,
  deleteVendor: (id: number) => `/consumer/vendors/${id}`,

  // Inventory Management
  inventorySummary: "/consumer/inventory/summary",
  inventoryProducts: "/consumer/inventory/products",
  inventoryProductVariants: (productId: number) =>
    `/consumer/inventory/products/${productId}/variants`,
  inventoryVariantStock: (variantId: number) =>
    `/consumer/inventory/variants/${variantId}/stock`,

  // Batch Management
  inventoryBatches: "/consumer/inventory/batches",
  inventoryBatch: (id: number) => `/consumer/inventory/batches/${id}`,
  createInventoryBatch: "/consumer/inventory/batches",
  updateInventoryBatch: (id: number) => `/consumer/inventory/batches/${id}`,
  deleteInventoryBatch: (id: number) => `/consumer/inventory/batches/${id}`,

  // Transfer Management
  inventoryTransfers: "/consumer/inventory/transfers",
  inventoryTransfer: (id: number) => `/consumer/inventory/transfers/${id}`,
  createInventoryTransfer: "/consumer/inventory/transfers",
  completeInventoryTransfer: (id: number) =>
    `/consumer/inventory/transfers/${id}/complete`,
  cancelInventoryTransfer: (id: number) =>
    `/consumer/inventory/transfers/${id}/cancel`,
  branchBatches: (branchId: number) =>
    `/consumer/inventory/batches?branch_id=${branchId}`,

  // Adjustment Management
  inventoryAdjustments: "/consumer/inventory/adjustments",
  inventoryAdjustment: (id: number) => `/consumer/inventory/adjustments/${id}`,
  createInventoryAdjustment: "/consumer/inventory/adjustments",

  // AI Services
  generateDescription: "/ai/auto-description",
  submitFeedback: "/ai/description-feedback",
};
