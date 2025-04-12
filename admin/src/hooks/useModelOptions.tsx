import { useQuery } from "@tanstack/react-query";
import { API_CRUD_FIND_WHERE, getUrlForModel } from "../api/endpoints";
import { get, post } from "../api/crud-api";

function useModelOptions(modelName: string, labelColumn: string | any) {
  const { isLoading, isSuccess, isError, data } = useQuery({
    queryKey: [`all-${modelName}`],
    queryFn: () => get(getUrlForModel(modelName)),
    staleTime: 0,
  });

  if (isLoading || isError) {
    return [];
  }

  // Ensure data.data is an array before mapping over it
  if (isSuccess && Array.isArray(data)) {
    return data.map((i: any) => ({
      label: i[labelColumn],
      value: i.id,
    }));
  }

  return [];
}

export default useModelOptions;

export function useGetSingleDataById(modelName: string, id: number) {
  return useQuery({
    queryKey: [modelName, "post by", id],
    queryFn: () =>
      post(`${API_CRUD_FIND_WHERE}?model=${modelName}`, {
        where: { id },
      }),
    select(data) {
      return data?.data?.[0] ?? {};
    },
  });
}

export const useModelOptionByFilter = (
  modelName: string,
  key: string,
  filterOption: any,
  field: string
) => {
  const { data } = useQuery({
    queryKey: [`${key}-${modelName}`],
    queryFn: () =>
      post(`${API_CRUD_FIND_WHERE}?model=${modelName}`, {
        where: filterOption,
      }),
    select(data) {
      return data?.data ?? [];
    },
  });

  if (data?.length) {
    const options = data?.map((i) => {
      return {
        value: i?.id,
        label: i[field],
      };
    });

    return options;
  }

  return [];
};
