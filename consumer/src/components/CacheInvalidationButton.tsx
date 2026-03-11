import { useQueryClient } from '@tanstack/react-query';
import { Button, Tooltip, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

interface CacheInvalidationButtonProps {
  size?: 'small' | 'middle' | 'large';
  type?: 'text' | 'primary' | 'default' | 'dashed' | 'link';
}

export default function CacheInvalidationButton({ 
  size = 'middle', 
  type = 'text' 
}: CacheInvalidationButtonProps) {
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();


  const handleClearAll = async () => {
   // Invalidate all queries in React Query
     await queryClient.invalidateQueries();
       messageApi.success({
        content: `All caches cleared!`,
        duration: 3,
      });
  };


  return (
    <>
      {contextHolder}
      <Tooltip title="Clear Application Cache">
        <Button
          type={type}
          size={size}
          icon={<ReloadOutlined />}
          // loading={isLoading}
          onClick={handleClearAll}
        />
      </Tooltip>
    </>
  );
}
