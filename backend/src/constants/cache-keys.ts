// Cache key generation functions
// All cache keys follow the pattern: consumerId:entity:details for efficient consumer-specific invalidation
// Global cache keys (plans, consumers) use 'global:' prefix

// Helper functions to generate dynamic cache keys
export const generateCacheKey = {
  productList: (consumerId: number, page?: number, limit?: number, search?: string) =>
    `${consumerId}:products:list:${page || 1}:${limit || 10}:${search || 'all'}`,
  
  productDetail: (productId: number, consumerId: number) =>
    `${consumerId}:product:detail:${productId}`,

  productVariantDetail: (variantId: number, consumerId: number) =>
    `${consumerId}:product-variant:detail:${variantId}`,

  productVariantsByProduct: (productId: number, consumerId: number) =>
    `${consumerId}:product-variants:product:${productId}`,

  categoryList: (consumerId: number) =>
    `${consumerId}:categories:list`,

  categoryDetail: (categoryId: number, consumerId: number) =>
    `${consumerId}:category:detail:${categoryId}`,

  brandList: (consumerId: number) =>
    `${consumerId}:brands:list`,

  brandDetail: (brandId: number, consumerId: number) =>
    `${consumerId}:brand:detail:${brandId}`,

  tagList: (consumerId: number) =>
    `${consumerId}:tags:list`,

  tagDetail: (tagId: number, consumerId: number) =>
    `${consumerId}:tag:detail:${tagId}`,

  unitList: (consumerId: number) =>
    `${consumerId}:units:list`,

  unitDetail: (unitId: number, consumerId: number) =>
    `${consumerId}:unit:detail:${unitId}`,

  branchList: (consumerId: number) =>
    `${consumerId}:branches:list`,
  
  branchDetail: (branchId: number, consumerId: number) =>
    `${consumerId}:branch:detail:${branchId}`,

  vendorList: (consumerId: number) =>
    `${consumerId}:vendors:list`,

  vendorDetail: (vendorId: number, consumerId: number) =>
    `${consumerId}:vendor:detail:${vendorId}`,

  userList: (consumerId: number, search?: string, roleId?: number) =>
    `${consumerId}:users:list:${search || 'all'}:${roleId || 'all'}`,

  userDetail: (userId: number, consumerId: number) =>
    `${consumerId}:user:detail:${userId}`,

  roleList: (consumerId: number) =>
    `${consumerId}:roles:list`,

  roleDetail: (roleId: number, consumerId: number) =>
    `${consumerId}:role:detail:${roleId}`,

  planList: () =>
    `global:plans:list`,
  planDetail: (planId: number) =>
    `global:plan:detail:${planId}`,

  consumerDetail: (consumerId: number) =>
    `global:consumer:detail:${consumerId}`,
  
  consumerBySubdomain: (subdomain: string) =>
    `global:consumer:subdomain:${subdomain}`,

  // Inventory cache helpers
  inventorySummary: (consumerId: number, branchId?: number) =>
    `${consumerId}:inventory:summary:${branchId || 'all'}`,

  stockByVariant: (consumerId: number, page?: number, limit?: number, branchId?: number, search?: string, lowStockOnly?: boolean) =>
    `${consumerId}:inventory:stock-by-variant:${page || 1}:${limit || 10}:${branchId || 'all'}:${search || 'all'}:${lowStockOnly || false}`,

  expiringBatches: (consumerId: number, days?: number) =>
    `${consumerId}:inventory:expiring-batches:${days || 30}`,

  variantStock: (variantId: number, consumerId: number, branchId?: number) =>
    `${consumerId}:inventory:variant-stock:${variantId}:${branchId || 'all'}`,

  lowStockItems: (consumerId: number, branchId?: number) =>
    `${consumerId}:inventory:low-stock:${branchId || 'all'}`,

  movementHistory: (variantId: number, consumerId: number, page?: number, limit?: number, branchId?: number) =>
    `${consumerId}:inventory:movement-history:${variantId}:${page || 1}:${limit || 20}:${branchId || 'all'}`,

  // Inventory Batch cache helpers
  inventoryBatchList: (consumerId: number, page?: number, limit?: number, search?: string, branchId?: number, variantId?: number) =>
    `${consumerId}:inventory-batches:list:${page || 1}:${limit || 10}:${search || 'all'}:${branchId || 'all'}:${variantId || 'all'}`,

  inventoryBatchDetail: (batchId: number, consumerId: number) =>
    `${consumerId}:inventory-batch:detail:${batchId}`,

  // Inventory Adjustment cache helpers
  inventoryAdjustmentList: (consumerId: number, page?: number, limit?: number, search?: string, branchId?: number, variantId?: number) =>
    `${consumerId}:inventory-adjustments:list:${page || 1}:${limit || 10}:${search || 'all'}:${branchId || 'all'}:${variantId || 'all'}`,

  inventoryAdjustmentDetail: (adjustmentId: number, consumerId: number) =>
    `${consumerId}:inventory-adjustment:detail:${adjustmentId}`,

  // Inventory Transfer cache helpers
  inventoryTransferList: (consumerId: number, page?: number, limit?: number, search?: string, sourceBranchId?: number, destinationBranchId?: number) =>
    `${consumerId}:inventory-transfers:list:${page || 1}:${limit || 10}:${search || 'all'}:${sourceBranchId || 'all'}:${destinationBranchId || 'all'}`,

  inventoryTransferDetail: (transferId: number, consumerId: number) =>
    `${consumerId}:inventory-transfer:detail:${transferId}`,
};

// Pattern generation functions for cache invalidation
// These generate patterns that can be used with Redis SCAN to invalidate related cache keys
export const generateCachePatterns = {
  // Consumer-specific patterns
  allForConsumer: (consumerId: number) => `${consumerId}:*`,
  
  // Product patterns
  allProducts: (consumerId: number) => `${consumerId}:product*`,
  allProductLists: (consumerId: number) => `${consumerId}:products:*`,
  allProductVariants: (consumerId: number) => `${consumerId}:product-variant*`,
  productsByProduct: (consumerId: number, productId: number) => `${consumerId}:product-variants:product:${productId}*`,
  
  // Category patterns
  allCategories: (consumerId: number) => `${consumerId}:categor*`,
  
  // Brand patterns
  allBrands: (consumerId: number) => `${consumerId}:brand*`,
  
  // Tag patterns
  allTags: (consumerId: number) => `${consumerId}:tag*`,
  
  // Unit patterns
  allUnits: (consumerId: number) => `${consumerId}:unit*`,
  
  // Branch patterns
  allBranches: (consumerId: number) => `${consumerId}:branch*`,
  
  // Vendor patterns
  allVendors: (consumerId: number) => `${consumerId}:vendor*`,
  
  // User patterns
  allUsers: (consumerId: number) => `${consumerId}:user*`,
  
  // Role patterns
  allRoles: (consumerId: number) => `${consumerId}:role*`,
  
  // Inventory patterns
  allInventory: (consumerId: number) => `${consumerId}:inventory*`,
  allInventoryBatches: (consumerId: number) => `${consumerId}:inventory-batch*`,
  allInventoryAdjustments: (consumerId: number) => `${consumerId}:inventory-adjustment*`,
  allInventoryTransfers: (consumerId: number) => `${consumerId}:inventory-transfer*`,
  
  // Combined patterns for operations that affect multiple entities
  allInventoryRelated: (consumerId: number) => [
    `${consumerId}:inventory*`,
    `${consumerId}:product*`, // Products affect inventory display
    `${consumerId}:product-variant*`, // Variants are core to inventory
  ],
  
  allProductRelated: (consumerId: number) => [
    `${consumerId}:product*`,
    `${consumerId}:inventory*`, // Inventory data shows in products
  ],
};
