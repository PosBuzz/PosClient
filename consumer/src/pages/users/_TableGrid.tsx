import {
  DeleteOutlined,
  EditOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Button,
  Col,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import { debounce } from "lodash";
import { useCallback, useEffect, useState } from "react";
import { deleteApi, get } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { useMessageStore } from "../../stores/messageStore";
import { useAuthStore } from "../../stores/authStore";

export default function _TableGrid({
  trigger,
  onClickEdit,
  roleOptions = [],
  ...props
}) {
  const [searchText, setSearchText] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const { messageApi } = useMessageStore();
  const { user } = useAuthStore();

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

  const {
    data: fetchData,
    isError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["users", debouncedSearchText, selectedRole],
    queryFn: () =>
      get(
        `${endpoints.user}?search_text=${debouncedSearchText}&role_id=${selectedRole}`
      ),
  });

  useEffect(() => {
    if (trigger) {
      refetch();
    }
  }, [trigger]);

  const deleteMutation = useMutation({
    mutationFn: async (id: any) => await deleteApi(`${endpoints.user}/${id}`),
    onSuccess: () => {
      messageApi?.success("Deleted Successfully");
      refetch();
    },
    onError: () => {
      messageApi?.error("Something went wrong");
    },
  });

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
      title: "Role",
      render: (record: any) => (
        <Tag color="blue" className="capitalize">
          {record?.role?.name}
        </Tag>
      ),
      key: "role",
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: any) => (
        <Space>
          {record?.email !== user?.company_email && (
            <>
              <Button onClick={() => onClickEdit(record)} type="link">
                <EditOutlined />
              </Button>
              <Popconfirm
                title="Delete this item?"
                description="This action cannot be undone"
                onConfirm={() => deleteMutation.mutate(record.id)}
                okText="Yes"
                cancelText="No"
              >
                <Button danger type="link">
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
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12} lg={8}>
          <Input
            allowClear
            placeholder="Search name or email"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </Col>

        <Col xs={24} md={6} lg={6}>
          <Select
            allowClear
            placeholder="Filter by Role"
            style={{ width: "100%" }}
            value={selectedRole}
            onChange={(value) => setSelectedRole(value)}
            options={roleOptions}
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
