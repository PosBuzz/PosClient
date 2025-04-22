/* eslint-disable */

import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Popconfirm, Space, Table, Tag } from "antd";
import { useEffect } from "react";
import { deleteApi, post } from "../../api/crud-api";
import { API_CRUD_FIND_WHERE, getUrlForModel } from "../../api/endpoints";
import { useAntdMessage } from "../../contexts/MessageContext";

// @ts-ignore
export default function _TableGrid({ model, trigger, onClickEdit, ...props }) {
  const messageApi = useAntdMessage();
  const KEY = `all-${model}`;

  const {
    isLoading,
    isError,
    data: fetchData,
    refetch,
  } = useQuery({
    queryKey: [KEY],
    queryFn: () =>
      post(`${API_CRUD_FIND_WHERE}?model=${model}`, {
        where: {},
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      }),
  });

  useEffect(() => {
    if (trigger) {
      refetch();
    }
  }, [trigger]);

  const deleteMutation = useMutation({
    mutationFn: async (id: any) => await deleteApi(getUrlForModel(model, id)),
    onSuccess: () => {
      messageApi.success("Deleted Successfully");
      refetch();
    },
    onError: () => {
      messageApi.error("Something went wrong");
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
          {record?.name !== "admin" && (
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
        style={{textTransform: 'capitalize'}}
      />
    </>
  );
}
