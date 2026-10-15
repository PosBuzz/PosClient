import type { QueryClientConfig } from "@tanstack/react-query";

// The options the app's QueryClient is built with. Kept in its own module (not Providers.tsx)
// so tests can build a real QueryClient from them without importing the whole app.
export const queryClientOptions: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // Default stale time - data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Cache time - data stays in cache for 10 minutes after becoming unused
      gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
      // Retry failed requests 1 times with exponential backoff
      retry: 1,
      // Refetch on window focus for critical data
      refetchOnWindowFocus: true,
      // Don't refetch on reconnect by default (can be overridden per query)
      refetchOnReconnect: false,
      // Don't refetch on mount if data is fresh
      refetchOnMount: true,
    },
    mutations: {
      // Never auto-retry: mutations create sales, returns, payments and stock
      // movements. A request that failed client-side (timeout, 5xx after
      // commit) may already be saved, and a silent resend would duplicate it.
      retry: 0,
    },
  },
};
