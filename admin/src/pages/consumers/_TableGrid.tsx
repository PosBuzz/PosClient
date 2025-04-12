/* eslint-disable */

import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Image, message, Popconfirm, Space, Table, Tag } from "antd";
import { API_CRUD_FIND_WHERE, getUrlForModel } from "../../api/endpoints";
import { deleteApi, post } from "../../api/crud-api";
import { useEffect } from "react";
import dayjs from "dayjs";

// @ts-ignore
export default function _TableGrid({ model, trigger, onClickEdit, ...props }) {
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
          plan: true,
          billing_logs: {
            where: {
              billing_month: {
                gte: dayjs().startOf("month"),
                lte: dayjs().endOf("month"),
              },
            },
          }, // <- This closing brace was missing
        },
      }),
    staleTime: 0,
  });

  useEffect(() => {
    if (trigger) {
      refetch();
    }
  }, [trigger]);

  const deleteMutation = useMutation({
    mutationFn: async (id: any) => await deleteApi(getUrlForModel(model, id)),
    onSuccess: () => {
      message.success("Deleted Successfully");
      refetch();
    },
    onError: () => {
      message.error("Something went wrong");
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
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Phone",
      dataIndex: "phone",
      key: "phone",
    },
    {
      title: "Address",
      dataIndex: "address",
      key: "address",
    },
    {
      title: "Subdomain",
      dataIndex: "subdomain",
      key: "subdomain",
    },
    {
      title: "Plan",
      render: (record: any) => record.plan?.name || "-",
      key: "plan",
    },
    {
      title: "Status",
      render: (record: any) => (
        <Tag color={record.billing_logs?.length ? "success" : "error"}>
          {record.billing_logs?.length ? "Active" : "Inactive"}
        </Tag>
      ),
      key: "status",
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: any) => (
        <Space>
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
      />
    </>
  );
}
