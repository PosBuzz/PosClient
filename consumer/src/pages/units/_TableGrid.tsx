import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Popconfirm, Space, Table } from "antd";
import { deleteApi, get } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useMessageStore } from "../../stores/messageStore";

export default function _TableGrid({ onClickEdit }) {
  const { messageApi } = useMessageStore();

  const {
    data: fetchData,
    refetch,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [queryKeys.units],
    queryFn: () => get(endpoints.getUnits),
    staleTime: queryStaleTimeMap[queryKeys.units],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: any) => await deleteApi(endpoints.deleteUnit(id)),
    onSuccess: () => {
      messageApi?.success("Unit deleted successfully");
      refetch();
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to delete unit"
      );
    },
  });

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text: string) => <div style={{ fontWeight: 500 }}>{text}</div>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: any) => (
        <Space>
          <Button onClick={() => onClickEdit(record)} type="link">
            <EditOutlined />
          </Button>
          <Popconfirm
            title="Delete this unit?"
            description="This action cannot be undone. Products using this unit will no longer have a unit."
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger type="link" loading={deleteMutation.isPending}>
              <DeleteOutlined />
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (isError) {
    return <p>Failed to load units</p>;
  }

  return (
    <Table
      rowKey="id"
      scroll={{ x: true }}
      loading={isLoading}
      columns={columns}
      dataSource={fetchData}
      pagination={{
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total, range) =>
          `${range[0]}-${range[1]} of ${total} units`,
      }}
    />
  );
}
