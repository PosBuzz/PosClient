/* eslint-disable */

import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Image, message, Popconfirm, Space, Table, Tag } from "antd";
import { API_CRUD_FIND_WHERE, getUrlForModel } from "../../api/endpoints";
import { deleteApi, post } from "../../api/crud-api";
import { useEffect } from "react";

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
      title: "Image",
      render: (record: any) => {
        const parsedData = JSON.parse(record.data || "{}");
        return (
          <div style={{ height: "40px", width: "40px" }}>
            <Image width={40} height={40} src={parsedData?.image} />
          </div>
        );
      },
    },
    {
      title: "Title",
      render: (record: any) => {
        const parsedData = JSON.parse(record.data || "{}");
        return parsedData?.title || "-";
      },
    },
    {
      title: "Sub Title",
      render: (record: any) => {
        const parsedData = JSON.parse(record.data || "{}");
        return parsedData?.sub_title || "-";
      },
    },
    {
      title: "URL",
      render: (record: any) => {
        const parsedData = JSON.parse(record.data || "{}");
        return parsedData?.url ? (
          <a href={parsedData.url} target="_blank" rel="noopener noreferrer">
            {parsedData.url}
          </a>
        ) : (
          "-"
        );
      },
    },
    {
      title: "Open in New Tab",
      render: (record: any) => {
        const parsedData = JSON.parse(record.data || "{}");
        return (
          <Tag color={parsedData?.open_in_newtab ? "success" : "error"}>
            {parsedData?.open_in_newtab ? "Yes" : "No"}
          </Tag>
        );
      },
    },
    {
      title: "Is Active?",
      render: (record: any) => (
        <Tag color={record.is_active ? "success" : "error"}>
          {record.is_active ? "Active" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Actions",
      render: (record: any) => (
        <Space>
          <Button onClick={() => onClickEdit(record)} type={"link"}>
            <EditOutlined />
          </Button>
          <Popconfirm
            title="Delete this item?"
            description="This action cannot be undone"
            onConfirm={() => handleDeleteClient(record.id)}
            onCancel={() => {}}
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
        dataSource={fetchData?.data}
      />
    </>
  );
}
