import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../constants/queryKeys';

/**
 * Utility functions for cache invalidation to ensure consistency
 * across different operations that affect inventory and sales data
 */

export const cacheInvalidation = {
  /**
   * Invalidate all sales-related caches
   * Use this after sales operations (create, update, delete)
   */
  invalidateSalesCaches: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: [queryKeys.sales] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.sale] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.salesStats] });
  },

  /**
   * Invalidate all inventory-related caches
   * Use this after inventory operations (batch create/update/delete, adjustments, transfers)
   */
  invalidateInventoryCaches: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: [queryKeys.batches] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.batch] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.inventorySummary] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.lowStockItems] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.stockByVariant] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.variantStock] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.movementHistory] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.expiringBatches] });
  },

  /**
   * Invalidate all product-related caches
   * Use this after product operations (create, update, delete)
   */
  invalidateProductCaches: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: [queryKeys.products] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.product] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.productVariants] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.productsForInventory] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.productsForSale] });
  },

  /**
   * Invalidate all transfer-related caches
   * Use this after transfer operations (create, complete, cancel)
   */
  invalidateTransferCaches: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: [queryKeys.transfers] });
  },

  /**
   * Invalidate all adjustment-related caches
   * Use this after adjustment operations (create, update, delete)
   */
  invalidateAdjustmentCaches: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: [queryKeys.adjustments] });
  },

  /**
   * Comprehensive cache invalidation for sales operations
   * Use this after sales create/update/delete as they affect inventory
   */
  invalidateAfterSalesOperation: (queryClient: QueryClient) => {
    cacheInvalidation.invalidateSalesCaches(queryClient);
    cacheInvalidation.invalidateInventoryCaches(queryClient);
    cacheInvalidation.invalidateProductCaches(queryClient);
  },

  /**
   * Comprehensive cache invalidation for inventory operations
   * Use this after inventory create/update/delete/adjust/transfer
   */
  invalidateAfterInventoryOperation: (queryClient: QueryClient) => {
    cacheInvalidation.invalidateInventoryCaches(queryClient);
    cacheInvalidation.invalidateProductCaches(queryClient);
  },

  /**
   * Comprehensive cache invalidation for product operations
   * Use this after product create/update/delete as they affect inventory
   */
  invalidateAfterProductOperation: (queryClient: QueryClient) => {
    cacheInvalidation.invalidateProductCaches(queryClient);
    cacheInvalidation.invalidateInventoryCaches(queryClient);
  },

  /**
   * Comprehensive cache invalidation for transfer operations
   * Use this after transfer create/complete/cancel as they affect inventory
   */
  invalidateAfterTransferOperation: (queryClient: QueryClient) => {
    cacheInvalidation.invalidateTransferCaches(queryClient);
    cacheInvalidation.invalidateInventoryCaches(queryClient);
  },

  /**
   * Comprehensive cache invalidation for adjustment operations
   * Use this after adjustment create/update/delete as they affect inventory
   */
  invalidateAfterAdjustmentOperation: (queryClient: QueryClient) => {
    cacheInvalidation.invalidateAdjustmentCaches(queryClient);
    cacheInvalidation.invalidateInventoryCaches(queryClient);
  },
};
