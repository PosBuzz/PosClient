import { deleteApi } from "./crud-api";
import { endpoints } from "./endpoints";

export const cacheApi = {
  /**
   * Invalidate all consumer-related caches
   */
  invalidateAllCaches: async (): Promise<{
    success: boolean;
    message: string;
    invalidated_keys_count?: number;
    timestamp: string;
  }> => {
    return deleteApi(endpoints.invalidateAllCaches);
  },
};
