import {
    DeleteOutlined,
    EditOutlined,
    SearchOutlined,
    UserOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Button,
    Card,
    Col,
    Input,
    Popconfirm,
    Row,
    Select,
    Space,
    Table,
    Tag,
    Tooltip,
    Typography,
} from "antd";
import dayjs from "dayjs";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useState } from "react";
import { deleteApi, get } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useMessageStore } from "../../stores/messageStore";
import type {
    Customer,
    CustomerListFilters,
    CustomerType,
} from "../../types/customer.types";

const { Option } = Select;
const { Text } = Typography;

interface TableGridProps {
  onClickEdit: (record: Customer) => void;
}

const TableGrid = ({ onClickEdit }: TableGridProps) => {
  const { messageApi } = useMessageStore();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<CustomerListFilters>({
    page: 1,
    limit: 20,
    search: "",
  });

  // Fetch customers using the API
  const customersQuery = useQuery({
    queryKey: [queryKeys.customers, filters],
    queryFn: async () => {
      const params: any = {
        page: filters.page || 1,
        limit: filters.limit || 20,
      };
      
      if (filters.search) {
        params.search = filters.search;
      }
      
      if (filters.customer_type) {
        params.customer_type = filters.customer_type;
      }

      return await get(endpoints.getCustomers, params);
    },
    staleTime: queryStaleTimeMap[queryKeys.customers],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      await deleteApi(endpoints.deleteCustomer(id)),
    onSuccess: () => {
      messageApi?.success("Customer deleted successfully");
      queryClient.invalidateQueries({ queryKey: [queryKeys.customers] });
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to delete customer"
      );
    },
  });

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setFilters((prev) => ({ ...prev, search: value, page: 1 }));
    }, 300),
    []
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearch = (value: string) => {
    debouncedSearch(value);
  };

  const getCustomerTypeColor = (type: CustomerType) => {
    return type === "business" ? "blue" : "green";
  };

  const getCustomerTypeLabel = (type: CustomerType) => {
    return type === "business" ? "Business" : "Individual";
  };

  const columns = [
    {
      title: "Customer",
      key: "customer",
      render: (record: Customer) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.name}</div>
          {record.email && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {record.email}
            </Text>
          )}
          {record.phone && (
            <div>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                {record.phone}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Type",
      dataIndex: "customer_type",
      key: "customer_type",
      render: (type: CustomerType) => (
        <Tag color={getCustomerTypeColor(type)} icon={<UserOutlined />}>
          {getCustomerTypeLabel(type)}
        </Tag>
      ),
    },
    {
      title: "Birthday",
      dataIndex: "birthday",
      key: "birthday",
      render: (birthday: string | null) => {
        if (!birthday) return <Text type="secondary">—</Text>;

        const date = dayjs(birthday);
        // Same day and month as today, whatever the year
        const isToday = date.format("MM-DD") === dayjs().format("MM-DD");

        return (
          <Space size={4}>
            <Text style={{ fontSize: 12 }}>{date.format("DD MMM YYYY")}</Text>
            {isToday && <Tag color="magenta">Today</Tag>}
          </Space>
        );
      },
    },
    {
      title: "Address",
      key: "address",
      render: (record: Customer) => (
        <div>
          {record.address && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {record.address}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: Customer) => (
        <Space size="small">
          <Tooltip title="Edit Customer">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => onClickEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to delete this customer?"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete Customer">
              <Button type="text" icon={<DeleteOutlined />} danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      {/* Filters */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Input
            placeholder="Search customers..."
            prefix={<SearchOutlined />}
            onChange={(e) => handleSearch(e.target.value)}
            allowClear
          />
        </Col>
        <Col span={6}>
          <Select
            placeholder="Customer Type"
            style={{ width: "100%" }}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, customer_type: value, page: 1 }))
            }
            allowClear
          >
            <Option value="individual">Individual</Option>
            <Option value="business">Business</Option>
          </Select>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={customersQuery.data?.data || []}
        loading={customersQuery.isLoading}
        rowKey="id"
        pagination={{
          current: filters.page,
          pageSize: filters.limit,
          total: customersQuery.data?.meta?.total || 0,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total} customers`,
          onChange: (page, pageSize) =>
            setFilters((prev) => ({ ...prev, page, limit: pageSize })),
        }}
      />
    </Card>
  );
};

export default TableGrid;
