import { useQuery } from "@tanstack/react-query";
import { get } from "../api/http";

/**
 * Fetches a list from a dedicated endpoint and maps it to Select options.
 *
 * Takes an endpoint path rather than a model name: each resource now has its
 * own typed endpoint instead of the generic /crud route.
 */
function useModelOptions(endpoint: string, labelColumn: string) {
  const { isLoading, isSuccess, isError, data } = useQuery({
    queryKey: [endpoint],
    queryFn: () => get(endpoint),
  });

  if (isLoading || isError) {
    return [];
  }

  if (isSuccess && Array.isArray(data)) {
    return data.map((i: any) => ({
      label: i[labelColumn],
      value: i.id,
    }));
  }

  return [];
}

export default useModelOptions;
