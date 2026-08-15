import {
  DeleteOutlined,
  EditOutlined,
  MailOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Popconfirm, Space, Table, Tag } from "antd";
import { deleteApi, get } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { useMessageStore } from "../../stores/messageStore";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";

export default function TableGrid({ onClickEdit }) {
  const { messageApi } = useMessageStore();
  const queryClient = useQueryClient();

  const {
    data: fetchData,
    refetch,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [queryKeys.branches],
    queryFn: () => get(endpoints.getBranches),
    staleTime: queryStaleTimeMap[queryKeys.branches],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: any) => await deleteApi(endpoints.deleteBranch(id)),
    onSuccess: () => {
      messageApi?.success("Branch deleted successfully");
      queryClient.invalidateQueries({ queryKey: [queryKeys.users] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.branchOptions] });
      refetch();
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to delete branch",
      );
    },
  });

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: any) => (
        <div className="flex gap-4 items-center">
          <div>{text}</div>
          {record.is_main && <Tag color="gold">Main Branch</Tag>}
        </div>
      ),
    },
    {
      title: "Phone",
      dataIndex: "phone",
      key: "phone",
      render: (phone: string) =>
        phone ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <PhoneOutlined style={{ color: "#666" }} />
            {phone}
          </div>
        ) : (
          <span style={{ color: "#999" }}>No phone</span>
        ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (email: string) =>
        email ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <MailOutlined style={{ color: "#666" }} />
            {email}
          </div>
        ) : (
          <span style={{ color: "#999" }}>No email</span>
        ),
    },
    {
      title: "Address",
      dataIndex: "address",
      key: "address",
      render: (address: string) =>
        address || <span style={{ color: "#999" }}>No address</span>,
    },
    {
      title: "VAT Registration Number",
      dataIndex: "vat_registration_number",
      key: "vat_registration_number",
      render: (vat_registration_number: string) =>
        vat_registration_number || (
          <span style={{ color: "#999" }}>No VAT Registration Number</span>
        ),
    },
    {
      title: "Created Date",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => {
        if (!date) return "-";
        return new Date(date).toLocaleDateString();
      },
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: any) => (
        <Space>
          <Button onClick={() => onClickEdit(record)} type="link">
            <EditOutlined />
          </Button>
          {!record.is_main && (
            <Popconfirm
              title="Delete this branch?"
              description="This action cannot be undone. All inventory in this branch will be moved to warehouse."
              onConfirm={() => deleteMutation.mutate(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button danger type="link" loading={deleteMutation.isPending}>
                <DeleteOutlined />
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  if (isError) {
    return <p>Failed to load branches</p>;
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
          `${range[0]}-${range[1]} of ${total} branches`,
      }}
    />
  );
}
