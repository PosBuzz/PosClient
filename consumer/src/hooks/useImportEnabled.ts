import { useQuery } from "@tanstack/react-query";
import { importApi } from "../api/import-api";

/**
 * Whether the server has bulk import switched on. Hidden until the server says
 * yes, so a failed or slow lookup never shows a button that would be refused.
 */
export function useImportEnabled(): boolean {
  const { data } = useQuery({
    queryKey: ["import-status"],
    queryFn: importApi.getStatus,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return data?.enabled === true;
}
