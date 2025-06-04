export const CACHE_KEYS = {
  // Product related cache keys
  PRODUCT: {
    LIST: 'products:list',
    DETAIL: 'product:detail',
    BY_CONSUMER: 'products:consumer',
    BY_CATEGORY: 'products:category',
    BY_BRAND: 'products:brand',
    BY_TAG: 'products:tag',
    SEARCH: 'products:search',
  },

  // Product Variant cache keys
  PRODUCT_VARIANT: {
    LIST: 'product-variants:list',
    DETAIL: 'product-variant:detail',
    BY_PRODUCT: 'product-variants:product',
  },

  // Category cache keys
  CATEGORY: {
    LIST: 'categories:list',
    DETAIL: 'category:detail',
    BY_CONSUMER: 'categories:consumer',
  },

  // Brand cache keys
  BRAND: {
    LIST: 'brands:list',
    DETAIL: 'brand:detail',
    BY_CONSUMER: 'brands:consumer',
  },

  // Tag cache keys
  TAG: {
    LIST: 'tags:list',
    DETAIL: 'tag:detail',
    BY_CONSUMER: 'tags:consumer',
  },

  // Unit cache keys
  UNIT: {
    LIST: 'units:list',
    DETAIL: 'unit:detail',
    BY_CONSUMER: 'units:consumer',
  },
  // Branch cache keys
  BRANCH: {
    LIST: 'branches:list',
    DETAIL: 'branch:detail',
    BY_CONSUMER: 'branches:consumer',
  },

  // Vendor cache keys
  VENDOR: {
    LIST: 'vendors:list',
    DETAIL: 'vendor:detail',
    BY_CONSUMER: 'vendors:consumer',
  },

  // User cache keys
  USER: {
    LIST: 'users:list',
    DETAIL: 'user:detail',
    BY_CONSUMER: 'users:consumer',
    BY_ROLE: 'users:role',
  },

  // Role cache keys
  ROLE: {
    LIST: 'roles:list',
    DETAIL: 'role:detail',
    BY_CONSUMER: 'roles:consumer',
    PERMISSIONS: 'role:permissions',
  },

  // Permission cache keys
  PERMISSION: {
    LIST: 'permissions:list',
    DETAIL: 'permission:detail',
    BY_PLAN: 'permissions:plan',
  },

  // Plan cache keys
  PLAN: {
    LIST: 'plans:list',
    DETAIL: 'plan:detail',
    PERMISSIONS: 'plan:permissions',
  },

  // Consumer cache keys
  CONSUMER: {
    LIST: 'consumers:list',
    DETAIL: 'consumer:detail',
    BY_SUBDOMAIN: 'consumer:subdomain',
  },

  // Billing cache keys
  BILLING: {
    HISTORY: 'billing:history',
    INVOICE: 'billing:invoice',
    BY_CONSUMER: 'billing:consumer',
  },
  // Inventory cache keys
  INVENTORY: {
    ITEMS: 'inventory:items',
    SUMMARY: 'inventory:summary',
    BY_BRANCH: 'inventory:branch',
    BY_PRODUCT: 'inventory:product',
    LOW_STOCK: 'inventory:low-stock',
    STOCK_BY_VARIANT: 'inventory:stock-by-variant',
    EXPIRING_BATCHES: 'inventory:expiring-batches',
    VARIANT_STOCK: 'inventory:variant-stock',
    MOVEMENT_HISTORY: 'inventory:movement-history',
  },

  // Inventory Batch cache keys
  INVENTORY_BATCH: {
    LIST: 'inventory-batches:list',
    DETAIL: 'inventory-batch:detail',
    BY_VARIANT: 'inventory-batches:variant',
    BY_BRANCH: 'inventory-batches:branch',
  },

  // Inventory Adjustment cache keys
  INVENTORY_ADJUSTMENT: {
    LIST: 'inventory-adjustments:list',
    DETAIL: 'inventory-adjustment:detail',
    BY_VARIANT: 'inventory-adjustments:variant',
    BY_BRANCH: 'inventory-adjustments:branch',
  },

  // Inventory Transfer cache keys
  INVENTORY_TRANSFER: {
    LIST: 'inventory-transfers:list',
    DETAIL: 'inventory-transfer:detail',
    BY_SOURCE_BRANCH: 'inventory-transfers:source-branch',
    BY_DESTINATION_BRANCH: 'inventory-transfers:destination-branch',
  },

  // Search cache keys
  SEARCH: {
    RESULTS: 'search:results',
    SUGGESTIONS: 'search:suggestions',
  },

  // Statistics cache keys
  STATS: {
    DASHBOARD: 'stats:dashboard',
    SALES: 'stats:sales',
    INVENTORY: 'stats:inventory',
    USERS: 'stats:users',
  },
};

// Helper functions to generate dynamic cache keys
export const generateCacheKey = {
  productList: (consumerId: number, page?: number, limit?: number, search?: string) =>
    `${CACHE_KEYS.PRODUCT.BY_CONSUMER}:${consumerId}:${page || 1}:${limit || 10}:${search || 'all'}`,
  productDetail: (productId: number, consumerId: number) =>
    `${CACHE_KEYS.PRODUCT.DETAIL}:${productId}:${consumerId}`,

  productVariantDetail: (variantId: number) =>
    `${CACHE_KEYS.PRODUCT_VARIANT.DETAIL}:${variantId}`,

  productVariantsByProduct: (productId: number) =>
    `${CACHE_KEYS.PRODUCT_VARIANT.BY_PRODUCT}:${productId}`,

  categoryList: (consumerId: number) =>
    `${CACHE_KEYS.CATEGORY.BY_CONSUMER}:${consumerId}`,

  categoryDetail: (categoryId: number, consumerId: number) =>
    `${CACHE_KEYS.CATEGORY.DETAIL}:${categoryId}:${consumerId}`,

  brandList: (consumerId: number) =>
    `${CACHE_KEYS.BRAND.BY_CONSUMER}:${consumerId}`,

  brandDetail: (brandId: number, consumerId: number) =>
    `${CACHE_KEYS.BRAND.DETAIL}:${brandId}:${consumerId}`,

  tagList: (consumerId: number) =>
    `${CACHE_KEYS.TAG.BY_CONSUMER}:${consumerId}`,

  tagDetail: (tagId: number, consumerId: number) =>
    `${CACHE_KEYS.TAG.DETAIL}:${tagId}:${consumerId}`,

  unitList: (consumerId: number) =>
    `${CACHE_KEYS.UNIT.BY_CONSUMER}:${consumerId}`,

  unitDetail: (unitId: number, consumerId: number) =>
    `${CACHE_KEYS.UNIT.DETAIL}:${unitId}:${consumerId}`,

  branchList: (consumerId: number) =>
    `${CACHE_KEYS.BRANCH.BY_CONSUMER}:${consumerId}`,
  branchDetail: (branchId: number, consumerId: number) =>
    `${CACHE_KEYS.BRANCH.DETAIL}:${branchId}:${consumerId}`,

  vendorList: (consumerId: number) =>
    `${CACHE_KEYS.VENDOR.BY_CONSUMER}:${consumerId}`,

  vendorDetail: (vendorId: number, consumerId: number) =>
    `${CACHE_KEYS.VENDOR.DETAIL}:${vendorId}:${consumerId}`,

  userList: (consumerId: number, search?: string, roleId?: number) =>
    `${CACHE_KEYS.USER.BY_CONSUMER}:${consumerId}:${search || 'all'}:${roleId || 'all'}`,

  userDetail: (userId: number, consumerId: number) =>
    `${CACHE_KEYS.USER.DETAIL}:${userId}:${consumerId}`,

  roleList: (consumerId: number) =>
    `${CACHE_KEYS.ROLE.BY_CONSUMER}:${consumerId}`,

  roleDetail: (roleId: number, consumerId: number) =>
    `${CACHE_KEYS.ROLE.DETAIL}:${roleId}:${consumerId}`,

  planList: () =>
    `${CACHE_KEYS.PLAN.LIST}`,

  planDetail: (planId: number) =>
    `${CACHE_KEYS.PLAN.DETAIL}:${planId}`,

  planPermissions: (planId: number) =>
    `${CACHE_KEYS.PLAN.PERMISSIONS}:${planId}`,

  consumerDetail: (consumerId: number) =>
    `${CACHE_KEYS.CONSUMER.DETAIL}:${consumerId}`,
  consumerBySubdomain: (subdomain: string) =>
    `${CACHE_KEYS.CONSUMER.BY_SUBDOMAIN}:${subdomain}`,

  // Inventory cache helpers
  inventorySummary: (consumerId: number, branchId?: number) =>
    `${CACHE_KEYS.INVENTORY.SUMMARY}:${consumerId}:${branchId || 'all'}`,

  stockByVariant: (consumerId: number, page?: number, limit?: number, branchId?: number, search?: string, lowStockOnly?: boolean) =>
    `${CACHE_KEYS.INVENTORY.STOCK_BY_VARIANT}:${consumerId}:${page || 1}:${limit || 10}:${branchId || 'all'}:${search || 'all'}:${lowStockOnly || false}`,

  expiringBatches: (consumerId: number, days?: number) =>
    `${CACHE_KEYS.INVENTORY.EXPIRING_BATCHES}:${consumerId}:${days || 30}`,

  variantStock: (variantId: number, consumerId: number, branchId?: number) =>
    `${CACHE_KEYS.INVENTORY.VARIANT_STOCK}:${variantId}:${consumerId}:${branchId || 'all'}`,

  lowStockItems: (consumerId: number, branchId?: number) =>
    `${CACHE_KEYS.INVENTORY.LOW_STOCK}:${consumerId}:${branchId || 'all'}`,

  movementHistory: (variantId: number, consumerId: number, page?: number, limit?: number, branchId?: number) =>
    `${CACHE_KEYS.INVENTORY.MOVEMENT_HISTORY}:${variantId}:${consumerId}:${page || 1}:${limit || 20}:${branchId || 'all'}`,

  // Inventory Batch cache helpers
  inventoryBatchList: (consumerId: number, page?: number, limit?: number, search?: string, branchId?: number, variantId?: number) =>
    `${CACHE_KEYS.INVENTORY_BATCH.LIST}:${consumerId}:${page || 1}:${limit || 10}:${search || 'all'}:${branchId || 'all'}:${variantId || 'all'}`,

  inventoryBatchDetail: (batchId: number, consumerId: number) =>
    `${CACHE_KEYS.INVENTORY_BATCH.DETAIL}:${batchId}:${consumerId}`,

  // Inventory Adjustment cache helpers
  inventoryAdjustmentList: (consumerId: number, page?: number, limit?: number, search?: string, branchId?: number, variantId?: number) =>
    `${CACHE_KEYS.INVENTORY_ADJUSTMENT.LIST}:${consumerId}:${page || 1}:${limit || 10}:${search || 'all'}:${branchId || 'all'}:${variantId || 'all'}`,

  inventoryAdjustmentDetail: (adjustmentId: number, consumerId: number) =>
    `${CACHE_KEYS.INVENTORY_ADJUSTMENT.DETAIL}:${adjustmentId}:${consumerId}`,

  // Inventory Transfer cache helpers
  inventoryTransferList: (consumerId: number, page?: number, limit?: number, search?: string, sourceBranchId?: number, destinationBranchId?: number) =>
    `${CACHE_KEYS.INVENTORY_TRANSFER.LIST}:${consumerId}:${page || 1}:${limit || 10}:${search || 'all'}:${sourceBranchId || 'all'}:${destinationBranchId || 'all'}`,

  inventoryTransferDetail: (transferId: number, consumerId: number) =>
    `${CACHE_KEYS.INVENTORY_TRANSFER.DETAIL}:${transferId}:${consumerId}`,

  searchResults: (query: string, model: string, filters?: string) =>
    `${CACHE_KEYS.SEARCH.RESULTS}:${model}:${query}:${filters || 'none'}`,
};
