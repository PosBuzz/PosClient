import {
  DeleteOutlined,
  EditOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Col, Input, Popconfirm, Row, Select, Space, Table, Tag, message } from "antd";
import dayjs from "dayjs";
import { debounce } from "lodash";
import { useCallback, useEffect, useState } from "react";
import { deleteApi, post } from "../../api/crud-api";
import { API_CRUD_FIND_WHERE, getUrlForModel } from "../../api/endpoints";
const { Option } = Select;


export default function _TableGrid({
  model,
  trigger,
  onClickEdit,
  planOptions = [],
  ...props
}) {
  const [searchText, setSearchText] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [debouncedSearchText, setDebouncedSearchText] = useState(searchText);

  // Debounced API call function using lodash's debounce
  const debouncedSearch = useCallback(
    debounce((nextValue) => setDebouncedSearchText(nextValue), 500),
    []
  );

  useEffect(() => {
    debouncedSearch(searchText);
    return () => {
      debouncedSearch.cancel(); // Cleanup on unmount
    };
  }, [searchText, debouncedSearch]);

  const KEY = `all-${model}`;

  const { isLoading, isError, data: fetchData, refetch } = useQuery({
    queryKey: [KEY, debouncedSearchText, selectedStatus, selectedPlan],
    queryFn: () =>
      post(`${API_CRUD_FIND_WHERE}?model=${model}`, {
        where: {
          ...(debouncedSearchText && {
            OR: [
              { name: { contains: debouncedSearchText, mode: "insensitive" } },
              { email: { contains: debouncedSearchText, mode: "insensitive" } },
              { phone: { contains: debouncedSearchText, mode: "insensitive" } },
              {
                subdomain: {
                  contains: debouncedSearchText,
                  mode: "insensitive",
                },
              },
            ],
          }),
          ...(selectedStatus && {
            billing_logs:
              selectedStatus === "active"
                ? {
                    some: {
                      billing_month: dayjs().format("YYYY-MM"),
                    },
                  }
                : {
                    none: {
                      billing_month: dayjs().format("YYYY-MM"),
                    },
                  },
          }),
          ...(selectedPlan && {
            plan_id: selectedPlan,
          }),
        },
        include: {
          plan: true,
          billing_logs: {
            where: {
              billing_month: dayjs().format("YYYY-MM"),
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
          <Button onClick={() => onClickEdit(record)} type="link">
            <EditOutlined />
          </Button>
          <Popconfirm
            title="Delete this item?"
            description="This action cannot be undone"
            onConfirm={() => handleDeleteClient(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger type="link">
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
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12} lg={8}>
          <Input
            allowClear
            placeholder="Search name, email, phone or subdomain"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </Col>

        <Col xs={24} md={6} lg={6}>
          <Select
            allowClear
            placeholder="Filter by Status"
            style={{ width: "100%" }}
            value={selectedStatus}
            onChange={(value) => setSelectedStatus(value)}
          >
            <Option value="active">Active</Option>
            <Option value="inactive">Inactive</Option>
          </Select>
        </Col>

        <Col xs={24} md={6} lg={6}>
          <Select
            allowClear
            placeholder="Filter by Plan"
            style={{ width: "100%" }}
            value={selectedPlan}
            onChange={(value) => setSelectedPlan(value)}
            options={planOptions}
          />
        </Col>
      </Row>

      <Table
        rowKey="id"
        scroll={{ x: true }}
        loading={isLoading}
        columns={columns}
        dataSource={fetchData}
      />
    </>
  );
}
