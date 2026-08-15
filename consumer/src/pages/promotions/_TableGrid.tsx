import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Popconfirm, Space, Table, Tag } from "antd";
import dayjs from "dayjs";
import { promotionApi } from "../../api/promotion-api";
import { Money } from "../../components/Currency";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useMessageStore } from "../../stores/messageStore";

const scopeColors: Record<string, string> = {
  SINGLE_PRODUCT: "blue",
  BUNDLE: "purple",
  BRAND: "gold",
};

export default function TableGrid({
  onClickEdit,
}: {
  onClickEdit: (record: any) => void;
}) {
  const { messageApi } = useMessageStore();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: [queryKeys.promotions],
    queryFn: promotionApi.getPromotions,
    staleTime: queryStaleTimeMap[queryKeys.promotions],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => promotionApi.deletePromotion(id),
    onSuccess: () => {
      messageApi?.success("Promotion deleted successfully");
      queryClient.invalidateQueries({ queryKey: [queryKeys.promotions] });
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to delete promotion",
      );
    },
  });

  const columns = [
    {
      title: "Name",
      key: "name",
      dataIndex: "name",
    },
    {
      title: "Description",
      key: "description",
      dataIndex: "description",
    },
    {
      title: "Type",
      dataIndex: "scope",
      key: "scope",
      render: (scope: string) => (
        <Tag color={scopeColors[scope] || "default"}>{scope}</Tag>
      ),
    },
    {
      title: "Discount",
      key: "discount",
      render: (record: any) =>
        record.discount_type === "percentage" ? (
          `${record.discount_value}%`
        ) : (
          <Money value={record.discount_value} />
        ),
    },
    {
      title: "Valid",
      key: "validity",
      render: (record: any) => (
        <span>
          {dayjs(record.start_date).format("YYYY-MM-DD")} →{" "}
          {record.end_date
            ? dayjs(record.end_date).format("YYYY-MM-DD")
            : "No End"}
        </span>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (record: any) => (
        <Tag color={record.is_active ? "green" : "red"}>
          {record.is_active ? "ACTIVE" : "INACTIVE"}
        </Tag>
      ),
    },
    {
      title: "Used Sales",
      dataIndex: "sales_count",
      key: "sales_count",
    },
    {
      title: "Total Discount",
      dataIndex: "total_discount_given",
      key: "total_discount_given",
      render: (value: number) => <Money value={value} />,
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
            title="Delete this promotion?"
            description="This action cannot be undone."
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
    return <p>Failed to load promotions</p>;
  }

  return (
    <Table
      rowKey="id"
      scroll={{ x: true }}
      loading={isLoading}
      columns={columns as any}
      dataSource={data || []}
      pagination={{
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total, range) =>
          `${range[0]}-${range[1]} of ${total} promotions`,
      }}
    />
  );
}
