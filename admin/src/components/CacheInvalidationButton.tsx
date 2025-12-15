import { ReloadOutlined } from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Tooltip, message } from "antd";
import { deleteApi } from "../api/crud-api";

interface CacheInvalidationButtonProps {
  size?: "small" | "middle" | "large";
  type?: "text" | "primary" | "default" | "dashed" | "link";
}

export default function CacheInvalidationButton({
  size = "middle",
  type = "text",
}: CacheInvalidationButtonProps) {
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();

  // Mutation for invalidating all caches
  const invalidateAllMutation = useMutation({
    mutationFn: async () => {
      const response = await deleteApi("/admin/cache/invalidate-all");
      return response.data;
    },
    onSuccess: (data) => {
      messageApi.success({
        content: `All admin caches cleared! ${
          data.invalidated_keys_count
            ? `(${data.invalidated_keys_count} keys)`
            : ""
        }`,
        duration: 3,
      });
      // Invalidate all queries in React Query
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      messageApi.error({
        content: `Failed to clear caches: ${
          error?.response?.data?.message || error.message
        }`,
        duration: 5,
      });
    },
  });

  const handleClearAll = () => {
    invalidateAllMutation.mutate();
  };

  const isLoading = invalidateAllMutation.isPending;

  return (
    <>
      {contextHolder}
      <Tooltip title="Clear All Admin Caches">
        <Button
          type={type}
          size={size}
          icon={<ReloadOutlined spin={isLoading} />}
          loading={isLoading}
          onClick={handleClearAll}
        />
      </Tooltip>
    </>
  );
}
