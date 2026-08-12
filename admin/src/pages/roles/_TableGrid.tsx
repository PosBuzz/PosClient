/* eslint-disable */

import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Popconfirm, Space, Table, Tag } from "antd";
import { deleteApi, get } from "../../api/http";
import { endpoints } from "../../api/endpoints";
import { useMessageStore } from "../../stores/messageStore";

export default function _TableGrid({ model, onClickEdit }) {
  const { messageApi } = useMessageStore();
  const KEY = `all-${model}`;

  const {
    isLoading,
    isError,
    data: fetchData,
    refetch,
  } = useQuery({
    queryKey: [KEY],
    queryFn: () =>
      get(endpoints.role),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: any) => await deleteApi(`${endpoints.role}/${id}`),
    onSuccess: () => {
      messageApi?.success("Deleted Successfully");
      refetch();
    },
    onError: () => {
      messageApi?.error("Something went wrong");
    },
  });

  const handleDeleteClient = (id: any) => {
    deleteMutation.mutate(id);
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Permissions",
      render: (record: any) => (
        <>
          {record.permissions?.map((p: any) => (
            <Tag color="blue" key={p.permission_id}>
              {p.permission?.action}
            </Tag>
          ))}
        </>
      ),
      key: "permissions",
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: any) => (
        <Space>
          {record?.name?.toLowerCase() !== "admin" && (
            <>
              <Button onClick={() => onClickEdit(record)} type={"link"}>
                <EditOutlined />
              </Button>
              <Popconfirm
                title="Delete this item?"
                description="This action cannot be undone"
                onConfirm={() => handleDeleteClient(record.id)}
                okText="Yes"
                cancelText="No"
              >
                <Button danger type={"link"}>
                  <DeleteOutlined />
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  if (isError) {
    return <p>Failed to load data</p>;
  }

  return (
    <>
      <Table
        rowKey="id"
        scroll={{
          x: true,
        }}
        loading={isLoading}
        columns={columns}
        dataSource={fetchData}
        style={{ textTransform: "capitalize" }}
      />
    </>
  );
}
