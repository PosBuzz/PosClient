export const endpoints = {
  csrfToken: "/auth/csrf-token",
  login: "/auth/login-user",
  getMe: "/auth/client",
  logout: "/auth/client-logout",
  refreshToken: "/auth/client-refresh-token",
  changePassword: "/consumer/change-password",
  role: "/consumer/users/roles",
  user: "/consumer/users",
  planPermissions: "/consumer/users/plan-permissions",

  // Product management
  products: "/consumer/products",
  productCount: "/consumer/products/count",
  getProduct: (id: number) => `/consumer/products/${id}`,
  updateProduct: (id: number) => `/consumer/products/${id}`,
  deleteProduct: (id: number) => `/consumer/products/${id}`,
  configureProduct: (id: number) => `/consumer/products/${id}/configure`,
  bulkCreateProducts: "/consumer/products/bulk-create",

  // Product variants
  getProductVariants: (productId: number) => `/consumer/products/${productId}/variants`,
  addProductVariant: (productId: number) => `/consumer/products/${productId}/variants`,
  updateVariant: (variantId: number) => `/consumer/products/variants/${variantId}`,
  deleteVariant: (variantId: number) => `/consumer/products/variants/${variantId}`,

  // Inventory management
  updateVariantInventory: (variantId: number) => `/consumer/products/variants/${variantId}/inventory`,

  // Tags and branch pricing
  updateProductTags: (productId: number) => `/consumer/products/${productId}/tags`,
  updateBranchPrices: (productId: number) => `/consumer/products/${productId}/branch-prices`,

  // Batch management
  createProductBatch: (productId: number) => `/consumer/products/${productId}/batches`,
  getProductBatches: (productId: number) => `/consumer/products/${productId}/batches`,

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

  // AI Services
  generateDescription: "/ai/auto-description",
  submitFeedback: "/ai/description-feedback",
};
