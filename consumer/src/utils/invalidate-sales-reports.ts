import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "../constants/queryKeys";

/**
 * Every roll-up that is computed from sales and returns. Anything that creates,
 * removes or refunds a sale moves all of these at once, so they are invalidated
 * together rather than each caller remembering the full list — the dashboard in
 * particular used to be refreshed by nothing at all.
 */
export const invalidateSalesReports = (queryClient: QueryClient) => {
  [
    queryKeys.sales,
    queryKeys.sale,
    queryKeys.salesStats,
    queryKeys.dashboardAnalytics,
    queryKeys.eod,
    queryKeys.dailyTarget,
    queryKeys.userSalesStats,
    queryKeys.variantSalesStats,
  ].forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key] });
  });
};
