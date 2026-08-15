import { ReloadOutlined } from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Tooltip, message } from "antd";

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

  const handleClearAll = async () => {
    await queryClient.invalidateQueries();
    messageApi.success({
      content: `All admin caches cleared!`,
      duration: 3,
    });
  };

  return (
    <>
      {contextHolder}
      <Tooltip title="Clear All Admin Caches">
        <Button
          type={type}
          size={size}
          icon={<ReloadOutlined />}

          onClick={handleClearAll}
        />
      </Tooltip>
    </>
  );
}
