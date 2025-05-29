import { DeleteOutlined, EditOutlined, PhoneOutlined, MailOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Popconfirm, Space, Table, Tooltip } from "antd";
import { useEffect } from "react";
import { deleteApi, get } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { useMessageStore } from "../../stores/messageStore";

// @ts-ignore
export default function _TableGrid({ trigger, onClickEdit, ...props }) {
  const { messageApi } = useMessageStore();

  const {
    data: fetchData,
    refetch,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => get(endpoints.getVendors),
  });

  useEffect(() => {
    if (trigger) {
      refetch();
    }
  }, [trigger]);

  const deleteMutation = useMutation({
    mutationFn: async (id: any) => await deleteApi(endpoints.deleteVendor(id)),
    onSuccess: () => {
      messageApi?.success("Vendor deleted successfully");
      refetch();
    },
    onError: (error: any) => {
      messageApi?.error(error.response?.data?.message || "Failed to delete vendor");
    },
  });

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          {record.contact && (
            <div style={{ fontSize: "12px", color: "#666" }}>
              Contact: {record.contact}
            </div>
          )}
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
        address ? (
          <Tooltip title={address}>
            <div style={{ 
              maxWidth: 200, 
              overflow: "hidden", 
              textOverflow: "ellipsis", 
              whiteSpace: "nowrap" 
            }}>
              {address}
            </div>
          </Tooltip>
        ) : (
          <span style={{ color: "#999" }}>No address</span>
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
          <Popconfirm
            title="Delete this vendor?"
            description="This action cannot be undone. All inventory batches from this vendor will lose vendor association."
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
    return <p>Failed to load vendors</p>;
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
        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} vendors`,
      }}
    />
  );
}