import axiosInstance from './axiosInstance';

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
    const response = await axiosInstance.delete('/consumer/cache/invalidate-all');
    return response.data;
  },
};
