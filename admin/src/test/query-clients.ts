// Mirrors consumer/src/test/query-clients.ts — keep in sync
import { QueryClient } from "@tanstack/react-query";
const clients = new Set<QueryClient>();
export function testQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  clients.add(client);
  return client;
}
export function clearTestQueryClients() {
  for (const client of clients) client.clear();
  clients.clear();
}
