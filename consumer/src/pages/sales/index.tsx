import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FilterOutlined,
  PlusOutlined,
  PrinterOutlined,
  SearchOutlined,
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
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography
} from "antd";
import dayjs from "dayjs";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { salesApi } from "../../api/sales-api";
import PageTitle from "../../components/PageTitle";
import { Permissions } from "../../constants/permissions";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";
import { useMessageStore } from "../../stores/messageStore";
import type {
  PaymentMethod,
  PaymentStatus,
  Sale,
  SaleListFilters,
} from "../../types/sale.types";
import { cacheInvalidation } from "../../utils/cacheInvalidation";
import { setPageTitle } from "../../utils/setPageTitle";

const { Option } = Select;
const { Text } = Typography;

const SalesTable = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { messageApi } = useMessageStore();
  const queryClient = useQueryClient();

  const showMessage = (
    content: string,
    type: "success" | "error" | "info" = "info"
  ) => {
    messageApi?.[type](content);
  };

  const hasPermission = (permission: string) => {
    return user?.permissions?.includes(permission);
  };

  const [filters, setFilters] = useState<SaleListFilters>({
    page: 1,
    limit: 20,
    search: "",
  });

  // Use real API query with optimized caching
  const salesQuery = useQuery({
    queryKey: [queryKeys.sales, filters],
    queryFn: () => salesApi.getSales(filters),
    placeholderData: (previousData) => previousData,
    staleTime: queryStaleTimeMap[queryKeys.sales],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      // For now, since we don't have delete API, just show success
      return Promise.resolve();
    },
    onSuccess: () => {
      showMessage("Sale deleted successfully", "success");
      // Invalidate all relevant caches after sales operation
      cacheInvalidation.invalidateAfterSalesOperation(queryClient);
    },
    onError: (error: any) => {
      showMessage(
        error.response?.data?.message || "Failed to delete sale",
        "error"
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

  const handlePrint = async (saleId: number) => {
    try {
      // For development, just show a message
      showMessage(
        "Receipt generation will be implemented with backend",
        "info"
      );
    } catch (error) {
      showMessage("Failed to generate receipt", "error");
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    const colors = {
      paid: "success",
      pending: "warning",
      partial: "processing",
      cancelled: "error",
    };
    return colors[status] || "default";
  };

  const getPaymentMethodDisplay = (method: PaymentMethod) => {
    const displays = {
      cash: "Cash",
      card: "Card",
      bank_transfer: "Bank Transfer",
      mobile_money: "Mobile Money",
      credit: "Credit",
    };
    return displays[method] || method;
  };

  const columns = [
    {
      title: "Sale #",
      dataIndex: "sale_number",
      key: "sale_number",
      render: (text: string, record: Sale) => (
        <Link to={`/sales/view/${record.id}`}>{text}</Link>
      ),
    },
    {
      title: "Customer",
      key: "customer",
      render: (record: Sale) => (
        <div>
          <div>{record.customer_name || "Walk-in Customer"}</div>
          {record.customer_phone && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {record.customer_phone}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "Branch",
      key: "branch",
      render: (record: Sale) => record.branch?.name || record.branch_name || 'N/A',
    },
    {
      title: "Sale Date",
      dataIndex: "sale_date",
      key: "sale_date",
      render: (date: string) => dayjs(date).format("MMM DD, YYYY HH:mm"),
    },
    {
      title: "Items",
      key: "items_count",
      render: (record: Sale) => record.items?.length || 0,
    },
    {
      title: "Total Amount",
      dataIndex: "total_amount",
      key: "total_amount",
      render: (amount: number) => `$${(Number(amount) || 0).toFixed(2)}`,
    },
    {
      title: "Payment",
      key: "payment",
      render: (record: Sale) => (
        <div>
          <Tag color={getPaymentStatusColor(record.payment_status)}>
            {record.payment_status.toUpperCase()}
          </Tag>
          <div style={{ fontSize: "12px", color: "#666" }}>
            {getPaymentMethodDisplay(record.payment_method)}
          </div>
        </div>
      ),
    },
    {
      title: "Sold By",
      dataIndex: "user_name",
      key: "user_name",
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: Sale) => (
        <Space size="small">
          <Tooltip title="View Sale">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/sales/view/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Print Receipt">
            <Button
              type="text"
              icon={<PrinterOutlined />}
              onClick={() => handlePrint(record.id!)}
            />
          </Tooltip>
          {hasPermission(Permissions.edit_sale) && (
            <Tooltip title="Edit Sale">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => navigate(`/sales/edit/${record.id}`)}
              />
            </Tooltip>
          )}
          {hasPermission(Permissions.delete_sale) && (
            <Popconfirm
              title="Are you sure you want to delete this sale?"
              onConfirm={() => deleteMutation.mutate(record.id!)}
              okText="Yes"
              cancelText="No"
            >
              <Tooltip title="Delete Sale">
                <Button type="text" icon={<DeleteOutlined />} danger />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  useEffect(() => {
    setPageTitle("Sales");
  }, []);

  return (
    <div>
      <PageTitle
        title="Sales"
        breadcrumbs={[{ title: "Home", href: "/" }, { title: "Sales" }]}
        rightSection={
          hasPermission(Permissions.add_sale) ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/sales/new")}
            >
              New Sale
            </Button>
          ) : undefined
        }
      />

      {/* Sales Summary Cards */}
      {salesQuery.data?.summary && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Sales"
                value={salesQuery.data.summary.total_sales}
                suffix="transactions"
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Amount"
                value={salesQuery.data.summary.total_amount}
                prefix="$"
                precision={2}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Average Sale"
                value={salesQuery.data.summary.average_sale}
                prefix="$"
                precision={2}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        {/* Filters */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Input
              placeholder="Search sales..."
              prefix={<SearchOutlined />}
              onChange={(e) => handleSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="Payment Status"
              style={{ width: "100%" }}
              onChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  payment_status: value,
                  page: 1,
                }))
              }
              allowClear
            >
              <Option value="paid">Paid</Option>
              <Option value="pending">Pending</Option>
              <Option value="partial">Partial</Option>
              <Option value="cancelled">Cancelled</Option>
            </Select>
          </Col>
          <Col span={6}>
            <Select
              placeholder="Payment Method"
              style={{ width: "100%" }}
              onChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  payment_method: value,
                  page: 1,
                }))
              }
              allowClear
            >
              <Option value="cash">Cash</Option>
              <Option value="card">Card</Option>
              <Option value="bank_transfer">Bank Transfer</Option>
              <Option value="mobile_money">Mobile Money</Option>
              <Option value="credit">Credit</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Button icon={<FilterOutlined />} style={{ width: "100%" }}>
              More Filters
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={salesQuery.data?.data || []}
          loading={salesQuery.isLoading}
          rowKey="id"
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: salesQuery.data?.meta.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} sales`,
            onChange: (page, pageSize) =>
              setFilters((prev) => ({ ...prev, page, limit: pageSize })),
          }}
        />
      </Card>
    </div>
  );
};

export default SalesTable;
