import { DeleteOutlined, EditOutlined, LinkOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Image, Popconfirm, Space, Table } from "antd";
import { deleteApi, get } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useMessageStore } from "../../stores/messageStore";

export default function TableGrid({ onClickEdit }) {
  const { messageApi } = useMessageStore();

  const {
    data: fetchData,
    refetch,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [queryKeys.brands],
    queryFn: () => get(endpoints.getBrands),
    staleTime: queryStaleTimeMap[queryKeys.brands],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: any) => await deleteApi(endpoints.deleteBrand(id)),
    onSuccess: () => {
      messageApi?.success("Brand deleted successfully");
      refetch();
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to delete brand"
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
      title: "Logo",
      dataIndex: "logo",
      key: "logo",
      render: (logo: string, record: any) => (
        <Image src={logo} alt={record.name} height={50} width={50} />
      ),
    },
    {
      title: "Website",
      dataIndex: "website",
      key: "website",
      render: (website: string) =>
        website ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <LinkOutlined style={{ color: "#666" }} />
            <a href={website} target="_blank" rel="noopener noreferrer">
              {website}
            </a>
          </div>
        ) : (
          <span style={{ color: "#999" }}>No website</span>
        ),
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
            title="Delete this brand?"
            description="This action cannot be undone. Products with this brand will no longer be associated with it."
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
    return <p>Failed to load brands</p>;
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
          `${range[0]}-${range[1]} of ${total} brands`,
      }}
    />
  );
}
